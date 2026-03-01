"use client";

import {
  useRef,
  useMemo,
  useEffect,
  useState,
  useCallback,
  Component,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Vignette,
  ChromaticAberration,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { useControls } from "leva";
import * as THREE from "three";
import {
  concepts,
  CLUSTER_COLORS,
  CLUSTER_HEX,
  getLabel,
  getClusterColor,
  getClusterColorRGB,
} from "../data/versailles";

// ── Constants ────────────────────────────────────────────────
const GRID = 100;
const TERRAIN_SIZE = 100;
const VERTEX_COUNT = (GRID + 1) * (GRID + 1); // 10201
const TRANSITION_DURATION = 1.4; // seconds

// ── Pure functions ───────────────────────────────────────────
function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function gaussian(dx: number, dz: number, sigma: number): number {
  return Math.exp(-(dx * dx + dz * dz) / (2 * sigma * sigma));
}

// ── Terrain computation ──────────────────────────────────────
// Returns height and HDR color arrays for the full vertex grid.
// Lacuna concepts subtract from height (depressions).
// Colors are NOT clamped: values >1.0 feed the bloom pass.
function computeTerrain(
  language: string,
  showLacunae: boolean,
  sigma: number,
  heightScale: number,
  emissiveStrength: number,
  referenceLanguage?: string,
  deltaScale?: number,
  positionOverride?: Record<string, Record<string, [number, number]>>,
  weightOverride?: Record<string, Record<string, number>>,
  clusterOverride?: Record<string, Record<string, number | string>>,
  lacunaOverride?: Record<string, Record<string, boolean>>
): { heights: Float32Array; colors: Float32Array } {
  const heights = new Float32Array(VERTEX_COUNT);
  const colors = new Float32Array(VERTEX_COUNT * 3);
  const halfSize = TERRAIN_SIZE / 2;
  const step = TERRAIN_SIZE / GRID;

  for (let iz = 0; iz <= GRID; iz++) {
    for (let ix = 0; ix <= GRID; ix++) {
      const idx = iz * (GRID + 1) + ix;
      const wx = ix * step - halfSize;
      const wz = iz * step - halfSize;

      let h = 0;
      let maxContrib = 0;
      let dominant: number | string = "core";

      for (const concept of concepts) {
        // Resolve position and weight, with optional override and delta amplification
        let cx: number, cz: number, cw: number;

        // Use overrides if provided, else fall back to curated data
        const getPos = (lang: string) =>
          positionOverride?.[concept.id]?.[lang] ?? concept.position[lang];
        const getWeight = (lang: string) =>
          weightOverride?.[concept.id]?.[lang] ?? concept.weight[lang] ?? 0;

        if (referenceLanguage && deltaScale !== undefined && deltaScale !== 1) {
          const refPos = getPos(referenceLanguage) || [0, 0];
          const refW = getWeight(referenceLanguage);
          const curPos = getPos(language) || refPos;
          const curW = getWeight(language);
          cx = refPos[0] + (curPos[0] - refPos[0]) * deltaScale;
          cz = refPos[1] + (curPos[1] - refPos[1]) * deltaScale;
          cw = Math.max(0, refW + (curW - refW) * deltaScale);
        } else {
          const pos = getPos(language);
          if (!pos) continue;
          cx = pos[0];
          cz = pos[1];
          cw = getWeight(language);
        }

        const isLacuna = lacunaOverride?.[concept.id]?.[language] ?? concept.lacuna[language] ?? false;
        if (isLacuna && !showLacunae) continue;
        if (cw === 0 && !isLacuna) continue;

        const dx = wx - cx;
        const dz = wz - cz;
        const g = gaussian(dx, dz, sigma) * cw;

        if (isLacuna) {
          h -= g * 0.7; // Deep depressions where absent concepts would be
        } else {
          h += g;
          if (g > maxContrib) {
            maxContrib = g;
            dominant = clusterOverride?.[concept.id]?.[language] ?? concept.cluster;
          }
        }
      }

      // Sculptural peaks: exaggerate height nonlinearly
      const sculpted = Math.sign(h) * Math.pow(Math.abs(h), 1.3);
      heights[idx] = sculpted * heightScale;

      // HDR vertex colors: base dark + cluster tint + glow
      // NO Math.min clamping. Values >1.0 are intentional for bloom.
      const heightNorm = Math.min(Math.abs(sculpted), 1);
      const cc = getClusterColorRGB(dominant);
      const ci = idx * 3;
      const tint = 0.3 + heightNorm * 0.7;
      const glow = heightNorm * heightNorm * emissiveStrength;

      colors[ci] = 0.02 + cc[0] * tint * 0.5 + glow * cc[0];
      colors[ci + 1] = 0.02 + cc[1] * tint * 0.5 + glow * cc[1];
      colors[ci + 2] = 0.04 + cc[2] * tint * 0.5 + glow * cc[2];
    }
  }

  return { heights, colors };
}

// ── TerrainMesh ──────────────────────────────────────────────
// Animated terrain mesh with snapshot-based ease-out transitions.
// Height goes into position[i*3+2] (local Z -> world Y after rotation).
function TerrainMesh({
  language,
  showLacunae,
  sigma,
  heightScale,
  emissiveStrength,
  referenceLanguage,
  deltaScale,
  positionOverride,
  weightOverride,
  clusterOverride,
  lacunaOverride,
}: {
  language: string;
  showLacunae: boolean;
  sigma: number;
  heightScale: number;
  emissiveStrength: number;
  referenceLanguage?: string;
  deltaScale?: number;
  positionOverride?: Record<string, Record<string, [number, number]>>;
  weightOverride?: Record<string, Record<string, number>>;
  clusterOverride?: Record<string, Record<string, number | string>>;
  lacunaOverride?: Record<string, Record<string, boolean>>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Transition state: snapshot pattern
  const targetH = useRef(new Float32Array(VERTEX_COUNT));
  const targetC = useRef(new Float32Array(VERTEX_COUNT * 3));
  const startH = useRef(new Float32Array(VERTEX_COUNT));
  const startC = useRef(new Float32Array(VERTEX_COUNT * 3));
  const currentH = useRef(new Float32Array(VERTEX_COUNT));
  const currentC = useRef(new Float32Array(VERTEX_COUNT * 3));
  const transitionStart = useRef(0);
  const needsUpdate = useRef(true);
  const firstRender = useRef(true);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, GRID, GRID);
    geo.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(new Float32Array(VERTEX_COUNT * 3), 3)
    );
    return geo;
  }, []);

  useEffect(() => {
    const { heights, colors } = computeTerrain(
      language,
      showLacunae,
      sigma,
      heightScale,
      emissiveStrength,
      referenceLanguage,
      deltaScale,
      positionOverride,
      weightOverride,
      clusterOverride,
      lacunaOverride
    );

    targetH.current.set(heights);
    targetC.current.set(colors);

    if (firstRender.current) {
      // Snap: no transition on first render
      startH.current.set(heights);
      startC.current.set(colors);
      currentH.current.set(heights);
      currentC.current.set(colors);
      transitionStart.current = performance.now() / 1000 - TRANSITION_DURATION;
      firstRender.current = false;
    } else {
      // Snapshot current for smooth transition
      startH.current.set(currentH.current);
      startC.current.set(currentC.current);
      transitionStart.current = performance.now() / 1000;
    }
    needsUpdate.current = true;
  }, [language, showLacunae, sigma, heightScale, emissiveStrength, referenceLanguage, deltaScale, positionOverride, weightOverride, clusterOverride, lacunaOverride]);

  useFrame(() => {
    if (!meshRef.current || !needsUpdate.current) return;

    const elapsed = performance.now() / 1000 - transitionStart.current;
    const raw = Math.min(elapsed / TRANSITION_DURATION, 1);
    const t = easeOutQuad(raw);

    const posArr = geometry.attributes.position.array as Float32Array;
    const colArr = geometry.attributes.color.array as Float32Array;

    for (let i = 0; i < VERTEX_COUNT; i++) {
      const h = startH.current[i] + (targetH.current[i] - startH.current[i]) * t;
      posArr[i * 3 + 2] = h;
      currentH.current[i] = h;

      const ci = i * 3;
      colArr[ci] = startC.current[ci] + (targetC.current[ci] - startC.current[ci]) * t;
      colArr[ci + 1] = startC.current[ci + 1] + (targetC.current[ci + 1] - startC.current[ci + 1]) * t;
      colArr[ci + 2] = startC.current[ci + 2] + (targetC.current[ci + 2] - startC.current[ci + 2]) * t;
      currentC.current[ci] = colArr[ci];
      currentC.current[ci + 1] = colArr[ci + 1];
      currentC.current[ci + 2] = colArr[ci + 2];
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.computeVertexNormals();

    if (raw >= 1) needsUpdate.current = false;
  });

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial
        vertexColors
        side={THREE.DoubleSide}
        roughness={0.35}
        metalness={0.3}
        toneMapped={false}
      />
    </mesh>
  );
}

// ── ConceptLabels ────────────────────────────────────────────
// Floating text labels above terrain peaks with transition animation.
function ConceptLabels({
  language,
  showLacunae,
  heightScale,
  sigma,
  lacunaOpacity,
  emissiveStrength,
  onConceptClick,
  positionOverride,
  weightOverride,
  clusterOverride,
  lacunaOverride,
  clusterColors,
}: {
  language: string;
  showLacunae: boolean;
  heightScale: number;
  sigma: number;
  lacunaOpacity: number;
  emissiveStrength: number;
  onConceptClick: (id: string) => void;
  positionOverride?: Record<string, Record<string, [number, number]>>;
  weightOverride?: Record<string, Record<string, number>>;
  clusterOverride?: Record<string, Record<string, number | string>>;
  lacunaOverride?: Record<string, Record<string, boolean>>;
  clusterColors?: Record<string, string>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const targetPos = useRef<Record<string, [number, number, number]>>({});
  const startPos = useRef<Record<string, [number, number, number]>>({});
  const currentPos = useRef<Record<string, [number, number, number]>>({});
  const transitionStart = useRef(0);
  const needsUpdate = useRef(true);
  const firstRender = useRef(true);

  useEffect(() => {
    for (const concept of concepts) {
      const pos = positionOverride?.[concept.id]?.[language] ?? concept.position[language];
      if (!pos) continue;

      const weight = weightOverride?.[concept.id]?.[language] ?? concept.weight[language] ?? 0;
      const isLacuna = lacunaOverride?.[concept.id]?.[language] ?? concept.lacuna[language] ?? false;

      // Peak height at concept center (gaussian = 1 at center)
      const rawH = isLacuna ? -(weight * 0.7) : weight;
      const sculpted = Math.sign(rawH) * Math.pow(Math.abs(rawH), 1.3);
      const y = sculpted * heightScale + 2;

      const target: [number, number, number] = [pos[0], y, pos[1]];
      targetPos.current[concept.id] = target;

      if (firstRender.current || !currentPos.current[concept.id]) {
        startPos.current[concept.id] = [...target];
        currentPos.current[concept.id] = [...target];
      } else {
        startPos.current[concept.id] = [...currentPos.current[concept.id]];
      }
    }

    if (firstRender.current) {
      transitionStart.current = performance.now() / 1000 - TRANSITION_DURATION;
      firstRender.current = false;
    } else {
      transitionStart.current = performance.now() / 1000;
    }
    needsUpdate.current = true;
  }, [language, showLacunae, heightScale, sigma, emissiveStrength, positionOverride, weightOverride, clusterOverride, lacunaOverride]);

  useFrame(() => {
    if (!needsUpdate.current || !groupRef.current) return;

    const elapsed = performance.now() / 1000 - transitionStart.current;
    const raw = Math.min(elapsed / TRANSITION_DURATION, 1);
    const t = easeOutQuad(raw);

    for (const child of groupRef.current.children) {
      const id = (child.userData as { conceptId?: string }).conceptId;
      if (!id) continue;
      const s = startPos.current[id];
      const tgt = targetPos.current[id];
      if (!s || !tgt) continue;

      child.position.set(
        s[0] + (tgt[0] - s[0]) * t,
        s[1] + (tgt[1] - s[1]) * t,
        s[2] + (tgt[2] - s[2]) * t
      );
      currentPos.current[id] = [child.position.x, child.position.y, child.position.z];
    }

    if (raw >= 1) needsUpdate.current = false;
  });

  const visibleConcepts = useMemo(() => {
    return concepts.filter((c) => {
      const pos = positionOverride?.[c.id]?.[language] ?? c.position[language];
      if (!pos) return false;
      const isLacuna = lacunaOverride?.[c.id]?.[language] ?? c.lacuna[language] ?? false;
      return !isLacuna || showLacunae;
    });
  }, [language, showLacunae, positionOverride, lacunaOverride]);

  return (
    <group ref={groupRef}>
      {visibleConcepts.map((concept) => {
        const isLacuna = lacunaOverride?.[concept.id]?.[language] ?? concept.lacuna[language] ?? false;
        const clusterLabel = clusterOverride?.[concept.id]?.[language] ?? concept.cluster;
        const hex = isLacuna
          ? "#78716c"
          : getClusterColor(clusterLabel, clusterColors);
        const pos = currentPos.current[concept.id] || [0, 2, 0];

        return (
          <Text
            key={concept.id}
            userData={{ conceptId: concept.id }}
            position={pos as [number, number, number]}
            fontSize={concept.id === "reparations" ? 2.8 : 1.8}
            color={hex}
            anchorX="center"
            anchorY="bottom"
            fillOpacity={isLacuna ? lacunaOpacity : 1}
            outlineWidth={0.06}
            outlineColor="#000000"
            onClick={() => onConceptClick(concept.id)}
            onPointerOver={() => {
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              document.body.style.cursor = "default";
            }}
          >
            {getLabel(concept, "en")}
          </Text>
        );
      })}
    </group>
  );
}

// ── GroundGrid ───────────────────────────────────────────────
function GroundGrid() {
  const geometry = useMemo(() => {
    const points: number[] = [];
    const half = TERRAIN_SIZE / 2;
    for (let i = -half; i <= half; i += 10) {
      points.push(-half, -0.2, i, half, -0.2, i);
      points.push(i, -0.2, -half, i, -0.2, half);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(points, 3)
    );
    return geo;
  }, []);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#0d0d1a" opacity={0.3} transparent />
    </lineSegments>
  );
}

// ── CameraRig ────────────────────────────────────────────────
function CameraRig() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(55, 40, 55);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  return null;
}

// ── Scene ────────────────────────────────────────────────────
// Assembles terrain, labels, lights, fog, postprocessing, and controls.
function Scene({
  language,
  showLacunae,
  onConceptClick,
  positionOverride,
  weightOverride,
  clusterOverride,
  lacunaOverride,
  clusterColors,
}: {
  language: string;
  showLacunae: boolean;
  onConceptClick: (id: string) => void;
  positionOverride?: Record<string, Record<string, [number, number]>>;
  weightOverride?: Record<string, Record<string, number>>;
  clusterOverride?: Record<string, Record<string, number | string>>;
  lacunaOverride?: Record<string, Record<string, boolean>>;
  clusterColors?: Record<string, string>;
}) {
  const { scene } = useThree();

  // Leva control panels
  const { sigma, heightScale, deltaScale } = useControls("Terrain", {
    sigma: { value: 12, min: 2, max: 30, step: 0.5 },
    heightScale: { value: 20, min: 1, max: 50, step: 0.5 },
    deltaScale: { value: 1.0, min: 0, max: 3, step: 0.05 },
  });

  const {
    emissiveStrength,
    bloomIntensity,
    bloomThreshold,
    bloomRadius,
    fogNear,
    fogFar,
    vignette: vignetteAmount,
  } = useControls("Visual", {
    emissiveStrength: { value: 2.5, min: 0, max: 8, step: 0.1 },
    bloomIntensity: { value: 1.2, min: 0, max: 4, step: 0.1 },
    bloomThreshold: { value: 0.3, min: 0, max: 2, step: 0.05 },
    bloomRadius: { value: 0.8, min: 0, max: 1, step: 0.05 },
    fogNear: { value: 60, min: 10, max: 200, step: 5 },
    fogFar: { value: 180, min: 50, max: 500, step: 5 },
    vignette: { value: 0.45, min: 0, max: 1, step: 0.05 },
  });

  const { lacunaOpacity } = useControls("Lacunae", {
    lacunaOpacity: { value: 0.5, min: 0, max: 1, step: 0.05 },
  });

  // Fog + scene background
  useEffect(() => {
    scene.fog = new THREE.Fog("#050508", fogNear, fogFar);
    scene.background = new THREE.Color("#050508");
  }, [scene, fogNear, fogFar]);

  // Auto-rotate: stops on interaction, resumes after 2.2s idle
  const [autoRotate, setAutoRotate] = useState(true);
  const idleTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleOrbitStart = useCallback(() => {
    setAutoRotate(false);
    if (idleTimeout.current) clearTimeout(idleTimeout.current);
  }, []);

  const handleOrbitEnd = useCallback(() => {
    if (idleTimeout.current) clearTimeout(idleTimeout.current);
    idleTimeout.current = setTimeout(() => setAutoRotate(true), 2200);
  }, []);

  // Chromatic aberration offset (stable reference)
  const chromaOffset = useMemo(() => new THREE.Vector2(0.0005, 0.0005), []);

  return (
    <>
      <CameraRig />

      {/* Lighting */}
      <ambientLight intensity={0.15} color="#1a1a2e" />
      <directionalLight position={[30, 50, 20]} intensity={0.8} color="#ffffff" />
      <directionalLight position={[-20, 30, -40]} intensity={0.4} color="#4338ca" />
      <pointLight position={[0, 25, 0]} intensity={1.2} color="#f59e0b" distance={80} />
      <pointLight position={[-40, 15, -30]} intensity={0.6} color="#3b82f6" distance={60} />
      <pointLight position={[35, 15, 25]} intensity={0.6} color="#ef4444" distance={60} />

      {/* Terrain */}
      <TerrainMesh
        language={language}
        showLacunae={showLacunae}
        sigma={sigma}
        heightScale={heightScale}
        emissiveStrength={emissiveStrength}
        referenceLanguage={language === "de" ? "en" : undefined}
        deltaScale={deltaScale}
        positionOverride={positionOverride}
        weightOverride={weightOverride}
        clusterOverride={clusterOverride}
        lacunaOverride={lacunaOverride}
      />

      {/* Labels */}
      <ConceptLabels
        language={language}
        showLacunae={showLacunae}
        heightScale={heightScale}
        sigma={sigma}
        lacunaOpacity={lacunaOpacity}
        emissiveStrength={emissiveStrength}
        onConceptClick={onConceptClick}
        positionOverride={positionOverride}
        weightOverride={weightOverride}
        clusterOverride={clusterOverride}
        lacunaOverride={lacunaOverride}
        clusterColors={clusterColors}
      />

      {/* Ground reference grid */}
      <GroundGrid />

      {/* Controls */}
      <OrbitControls
        autoRotate={autoRotate}
        autoRotateSpeed={0.5}
        enableDamping
        dampingFactor={0.05}
        minDistance={15}
        maxDistance={150}
        maxPolarAngle={Math.PI / 2.1}
        onStart={handleOrbitStart}
        onEnd={handleOrbitEnd}
      />

      {/* Postprocessing */}
      <PostEffects
        bloomIntensity={bloomIntensity}
        bloomThreshold={bloomThreshold}
        bloomRadius={bloomRadius}
        vignetteAmount={vignetteAmount}
        chromaOffset={chromaOffset}
      />
    </>
  );
}

// ── PostEffects ──────────────────────────────────────────────
// Bloom, vignette, and chromatic aberration.
// The getContextAttributes() null-safety patch is applied in
// the Canvas onCreated callback (see TopologyTerrain below).
function PostEffects({
  bloomIntensity,
  bloomThreshold,
  bloomRadius,
  vignetteAmount,
  chromaOffset,
}: {
  bloomIntensity: number;
  bloomThreshold: number;
  bloomRadius: number;
  vignetteAmount: number;
  chromaOffset: THREE.Vector2;
}) {
  return (
    <EffectComposer>
      <Bloom
        mipmapBlur
        intensity={bloomIntensity}
        luminanceThreshold={bloomThreshold}
        luminanceSmoothing={0.025}
        radius={bloomRadius}
      />
      <Vignette
        darkness={vignetteAmount}
        offset={0.1}
        blendFunction={BlendFunction.NORMAL}
      />
      <ChromaticAberration offset={chromaOffset} />
    </EffectComposer>
  );
}

// ── Error boundary ───────────────────────────────────────────
// Catches WebGL context loss and offers retry via Canvas remount.
interface ErrorBoundaryProps {
  children: ReactNode;
  onRetry: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class CanvasErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            color: "#e5e5e5",
            background: "#0a0a0a",
            gap: "1rem",
            fontFamily: "monospace",
          }}
        >
          <p>WebGL context lost</p>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              this.props.onRetry();
            }}
            style={{
              padding: "0.5rem 1.5rem",
              background: "#262626",
              border: "1px solid #404040",
              color: "#e5e5e5",
              cursor: "pointer",
              borderRadius: "4px",
              fontFamily: "monospace",
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── TopologyTerrain (default export) ─────────────────────────
// The full 3D terrain visualization with mounted guard and error boundary.
// MUST be dynamically imported with { ssr: false } from page.tsx.
export default function TopologyTerrain({
  language,
  showLacunae,
  onConceptClick,
  onBackgroundClick,
  positionOverride,
  weightOverride,
  clusterOverride,
  lacunaOverride,
  clusterColors,
}: {
  language: string;
  showLacunae: boolean;
  onConceptClick: (id: string) => void;
  onBackgroundClick?: () => void;
  positionOverride?: Record<string, Record<string, [number, number]>>;
  weightOverride?: Record<string, Record<string, number>>;
  clusterOverride?: Record<string, Record<string, number | string>>;
  lacunaOverride?: Record<string, Record<string, boolean>>;
  clusterColors?: Record<string, string>;
}) {
  // Mounted guard: prevents WebGL context null error during SSR/HMR
  const [mounted, setMounted] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  if (!mounted) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          background: "#0a0a0a",
        }}
      />
    );
  }

  return (
    <CanvasErrorBoundary onRetry={() => setCanvasKey((k) => k + 1)}>
      <Canvas
        key={canvasKey}
        gl={{ alpha: false, antialias: true }}
        camera={{ fov: 50, near: 0.1, far: 500 }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color("#050508"));
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.2;

          // Patch getContextAttributes so it never returns null.
          // The postprocessing library reads `.alpha` from the result
          // and crashes if null (context lost / HMR remount).
          const ctx = gl.getContext() as WebGLRenderingContext;
          const original = ctx.getContextAttributes.bind(ctx);
          ctx.getContextAttributes = () =>
            original() ?? ({ alpha: false } as WebGLContextAttributes);
        }}
        style={{ width: "100vw", height: "100vh" }}
        onPointerMissed={onBackgroundClick}
      >
        <Scene
          language={language}
          showLacunae={showLacunae}
          onConceptClick={onConceptClick}
          positionOverride={positionOverride}
          weightOverride={weightOverride}
          clusterOverride={clusterOverride}
          lacunaOverride={lacunaOverride}
          clusterColors={clusterColors}
        />
      </Canvas>
    </CanvasErrorBoundary>
  );
}
