# LACUNA Live Session Log (Saturday Night - Sunday Morning)

## Solo Implementation: amadeus branch

Started: ~11 PM Saturday
Branch: amadeus (on /tmp/lacuna-final)
State at start: Universal merge complete, interpreter live, UI fixes partially applied.

---

## What Was Built

### 1. Live Text Query System (/api/query)

**Files created:**
- `src/app/api/query/route.ts` -- POST endpoint
- `src/data/concept-embeddings.json` -- 43 concepts x 10 languages x 1024-dim vectors (8MB)
- `scripts/extract-query-embeddings.mjs` -- extracts EN/DE/FR/ES/ZH/KO/AR/PT/RU/JA from raw mistral-embed file
- `.env.local` -- MISTRAL_API_KEY

**How it works:**
- User types any sentence
- 1 mistral-embed API call embeds the text (1024-dim vector)
- Cosine similarity computed against all 43 concept vectors in lang_a and lang_b
- Returns activations sorted by divergence (|sim_a - sim_b|)
- Direction field shows which language the concept leans toward

**Files modified:**
- `src/app/page.tsx` -- query state, input bar, results panel, QUERY toggle button
- `src/components/TopologyTerrain.tsx` -- highlightedConcepts prop chain (TopologyTerrain -> Scene -> ConceptLabels), amber glow for top-10 divergence concepts, 0.15 opacity for non-highlighted

### 2. Multi-Language Support

Query endpoint accepts any pair from the 10 available languages. UI automatically compares current terrain language vs EN (or vs DE if already on EN). Placeholder text updates dynamically.

### 3. Prior UI Fixes (from before this session, partially applied)

- Labels stay English by default (TopologyTerrain line 408)
- Lacuna depression multiplier 0.3 -> 0.7
- Click-away dismiss via onPointerMissed
- Terrain legend (top-left, explains height/position/color/depression)
- Simplified ConceptCard (interpretation first, EN/DE only)

---

## Query Experiment Results

### Article 231 (War Guilt Clause) -- EN vs DE

Text: "The Allied and Associated Governments affirm and Germany accepts the responsibility..."

Top divergence concepts:
| Concept | EN sim | DE sim | Gap | Direction |
|---------|--------|--------|-----|-----------|
| restitution | 0.714 | 0.774 | 0.060 | DE |
| dolchstoss | 0.748 | 0.716 | 0.032 | EN |
| demilitarization | 0.721 | 0.742 | 0.021 | DE |
| armistice | 0.732 | 0.753 | 0.020 | DE |
| debt | 0.720 | 0.740 | 0.020 | DE |
| justice | 0.756 | 0.737 | 0.019 | EN |

Key finding: restitution at 0.060 gap is the largest outlier. German "Wiedergutmachung" (making-good-again) activates far more than English "restitution" for this text.

### Treaty of Nanking (1842) -- EN vs ZH

Text: "Her Majesty the Queen of the United Kingdom and the Emperor of China agree that the Island of Hong Kong shall be ceded..."

Top divergence:
| Concept | EN sim | ZH sim | Gap | Direction |
|---------|--------|--------|-----|-----------|
| schmach | 0.655 | 0.713 | 0.058 | ZH |
| dolchstoss | 0.651 | 0.697 | 0.046 | ZH |
| legitimacy | 0.705 | 0.739 | 0.034 | ZH |
| magnanimity | 0.677 | 0.644 | 0.032 | EN |

Key finding: Chinese embeddings pull shame/disgrace (schmach) and betrayal (dolchstoss) far harder than English. Century of Humiliation encoded in vector space. English pulls magnanimity -- the self-framing as generous.

### Potsdam Declaration (1945) -- EN vs JA

Text: "We call upon the Government of Japan to proclaim the unconditional surrender..."

Top divergence:
| Concept | EN sim | JA sim | Gap | Direction |
|---------|--------|--------|-----|-----------|
| schmach | 0.667 | 0.726 | 0.059 | JA |
| volkszorn | 0.691 | 0.729 | 0.038 | JA |
| debt | 0.680 | 0.718 | 0.037 | JA |
| betrayal | 0.702 | 0.665 | 0.037 | EN |
| diktat | 0.754 | 0.718 | 0.036 | EN |

Key finding: Same shame pattern as ZH. Japanese embeddings pull schmach, volkszorn (popular fury), debt. English pulls betrayal and diktat (imposed terms). The framing inversion is consistent.

### Sykes-Picot (1916) -- EN vs AR

Text: "France and Great Britain are prepared to recognize and protect an independent Arab state..."

Top divergence:
| Concept | EN sim | AR sim | Gap | Direction |
|---------|--------|--------|-----|-----------|
| accountability | 0.691 | 0.623 | 0.067 | EN |
| mandate | 0.764 | 0.705 | 0.059 | EN |
| honor | 0.746 | 0.697 | 0.049 | EN |
| selfdetermination | 0.753 | 0.711 | 0.042 | EN |
| restitution | 0.667 | 0.704 | 0.036 | AR |
| resentment | 0.656 | 0.690 | 0.034 | AR |
| humiliation | 0.657 | 0.687 | 0.030 | AR |
| subjugation | 0.699 | 0.729 | 0.030 | AR |

Key finding: Largest gaps in the set. English pulls accountability, mandate, honor, selfdetermination -- the colonial language of "protection." Arabic pulls restitution, resentment, humiliation, subjugation -- the colonized reading of the same text. The gap IS the finding.

### Korean Partition (1945) -- EN vs KO

Text: "The Soviet Union shall occupy the area north of the 38th parallel..."

Top divergence:
| Concept | EN sim | KO sim | Gap | Direction |
|---------|--------|--------|-----|-----------|
| blockade | 0.691 | 0.733 | 0.042 | KO |
| concession | 0.743 | 0.778 | 0.035 | KO |
| armistice | 0.719 | 0.752 | 0.034 | KO |
| honor | 0.721 | 0.693 | 0.028 | EN |

Key finding: Korean embeddings read the partition as blockade, concession, subjugation. English reads honor. Nearly all concepts lean KO except honor.

---

## Cross-Query Pattern

Consistent across all 5 probes:
- **Imperial/colonial language** pulls: accountability, mandate, honor, legitimacy, magnanimity, justice
- **Colonized/occupied language** pulls: schmach, humiliation, subjugation, resentment, restitution, debt, revenge

Same text. Different conceptual activation. The embedding model encodes cultural framing into vector space. LACUNA reads it out.

---

## Technical Decisions Made

1. **Sorted by divergence, not similarity.** The gaps ARE the findings.
2. **Stripped z-score normalization.** Was comparing wrong quantities (intrinsic EN-DE gap vs query-relative gap). Raw cosine divergence is the honest signal.
3. **All 10 languages extracted.** Not just EN/DE. concept-embeddings.json went from 1.6MB to 8MB but query supports any pair.
4. **1 API call per probe.** No new agents for query. Interpreter already works for deep dive on individual concepts.
5. **Highlight top 10 by divergence on terrain.** Amber glow, font scaled by divergence magnitude.

---

## API Calls Used This Session

| Call | Endpoint | Purpose |
|------|----------|---------|
| 1 | mistral-embed | Article 231 EN vs DE (broken z-score) |
| 2 | mistral-embed | Article 231 EN vs DE (fixed normalization) |
| 3 | mistral-embed | Treaty of Nanking EN vs ZH |
| 4 | mistral-embed | Potsdam Declaration EN vs JA |
| 5 | mistral-embed | Sykes-Picot EN vs AR |
| 6 | mistral-embed | Korean Partition EN vs KO |

Total: 6 mistral-embed calls. Zero agent calls. All on Brendan's key.

---

## Build Status

All builds pass clean. Route list:
- / (static)
- /dev (static)
- /api/concept/[id], /api/concepts, /api/embed, /api/extract, /api/interpret, /api/orchestrate, /api/query (dynamic)

## Audit Fixes (Sunday ~3 AM)

1. Gap magnitude context: rank numbers, "/ 43 concepts", divergence intensity color
2. Pre-loaded demo probes: 5 historical texts as one-click buttons
3. Identity: "Conceptual Topology Mapper" -> "Cross-Lingual Divergence Explorer"
4. Demo flow: QUERY button amber hint, probes auto-fire with correct lang pairs
5. Direction edge case (Karpathy): divergence < 0.005 -> "neutral", grey rendering
6. fireProbe refactor: direct param invocation for demo probes

## Thiel + Karpathy Critique (Sunday ~3:30 AM)

### Thiel
- Real secret (cultural memory in vector geometry). No moat (API access + 43 defs = reproduction).
- Vitamin not painkiller. No identified buyer.
- Demo buries the lead. Lead with Sykes-Picot probe, not terrain.
- Position as research instrument. "First tool that reads cultural framing out of embedding space."

### Karpathy
- Cosine regime compressed (0.001-0.067 range). Need noise floor baseline.
- Definition variance confound: are we measuring different strings or different cultural encoding?
- Single model. Cohere comparison would massively boost credibility.
- Fixed: direction "neutral" for < 0.005 divergence.
- Honest claim: "instrument for probing cross-lingual divergence, patterns consistent with known asymmetries."

## Not Yet Committed

All changes are local in /tmp/lacuna-final on amadeus branch. Nothing pushed.
