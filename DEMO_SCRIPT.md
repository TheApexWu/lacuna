# LACUNA — 2-Minute Video Demo Script

## Strategy: "The Door That Isn't There"

**Format:** Narrative-driven with live demo woven in. Open with a visceral human story, reveal the tool, show the tech, close with the vision. Never let the energy dip — every second earns the next.

**Core narrative arc:** "Languages don't just say things differently. They make different things *thinkable*. We built a tool that finds the doors your language doesn't have."

---

## Team Assignments

| Member | Role | Sections |
|--------|------|----------|
| **Person 1** (strongest storyteller) | Hook + Problem | 0:00 - 0:25 |
| **Person 2** (strongest technical speaker) | Architecture + Mistral Agents | 0:25 - 0:55 |
| **Person 3** (best at live demo / screen presence) | Live Demo Walkthrough | 0:55 - 1:35 |
| **Person 4** (strongest closer) | Impact + Vision | 1:35 - 2:00 |

---

## Section 1: The Hook (0:00 - 0:25) — Person 1

**On screen:** Black screen. Then a single German word fades in: *Dolchstoß*. Then its definition. Then the 3D terrain, camera slowly rotating.

**Script:**

> "In 1919, a German word entered the political lexicon that has no English equivalent: *Dolchstoß* — the stab in the back. It described a belief that Germany's army was never defeated on the battlefield, but betrayed from within by civilian politicians.
>
> There is no English word for this. Not 'betrayal.' Not 'backstab.' English literally could not think this thought. And because the Treaty of Versailles was written by people who could not think this thought, they could not predict what came next.
>
> We call these invisible gaps *lacunae*. And we built a tool that finds them."

**Timing notes:** Deliver with gravitas, not speed. The pause after "what came next" is important. 25 seconds.

**On screen transitions:**
- 0:00 — Black, then "Dolchstoß" fades in white on black
- 0:05 — Definition text appears below
- 0:10 — Cut to the 3D terrain, dark, slowly rotating, concept nodes glowing
- 0:20 — LACUNA logo/title card overlays briefly
- 0:25 — Transition to architecture diagram

---

## Section 2: How It Works (0:25 - 0:55) — Person 2

**On screen:** Clean architecture diagram (pipeline flow), then quick cuts showing each agent in action.

**Script:**

> "LACUNA is a three-agent pipeline powered by Mistral.
>
> **Agent one: the Extractor.** Feed it any historical document. Mistral Large doesn't just extract keywords — it decomposes concepts into their constituent *frames*. 'Reparations' becomes four separate ideas: justice, debt, punishment, and humiliation. Each one operates differently across cultures.
>
> **Agent two: the Validator.** Mistral validates semantic coherence, then BGE-M3 multilingual embeddings compute the math. If a concept embeds identically across languages — cosine similarity above 0.92 — it gets killed. No structural difference means no lacuna. We only keep what's interesting.
>
> **Agent three: the Interpreter.** Click any concept on the terrain and Mistral explains *why* the gap exists — the cultural, historical, and linguistic reasons, with citations.
>
> The LLM decides what matters. The math decides where it goes. UMAP projects 1024-dimensional embeddings onto a 3D terrain. Deterministic. Reproducible."

**Timing notes:** 30 seconds. Confident, measured pace. The three-agent structure gives natural rhythm. Emphasize "frames" (not keywords), "killed" (dramatic), and "deterministic" (credibility).

**On screen transitions:**
- 0:25 — Pipeline diagram: Document → Extractor → Validator → Interpreter → 3D Terrain
- 0:30 — Show the "Reparations" frame decomposition
- 0:38 — Flash terminal: `[validator] REJECT new-world-order-as-naivety: too similar across languages (0.953)`
- 0:45 — Show interpreter card with cultural/historical/structural explanations
- 0:50 — Quick flash of UMAP projection / cosine distance math
- 0:55 — Transition to live demo

---

## Section 3: Live Demo (0:55 - 1:35) — Person 3

**On screen:** The actual LACUNA web application, full screen. 40 seconds of pure demo.

**Script (while navigating):**

> "Here's LACUNA running live. This terrain is the Treaty of Versailles as seen through English.
>
> *(clicks EN → DE)* Watch what happens when I switch to German. The terrain *reshapes*. Concepts don't just translate — they migrate. 'Honor' jumps from here *(points)* to here. In German, *Ehre* sits close to shame and duty. In English, honor sits near justice and victory. Same word. Completely different neighborhood.
>
> *(clicks REVEAL LACUNAE)* Now — the ghost concepts. These translucent nodes are *lacunae*: ideas that exist in German but have no real English equivalent. *Dolchstoß*. *Schmach* — a national disgrace so deep it demands blood. *Kriegsschuld* — war guilt fused with debt in a single compound word. English has to use two words for what German thinks as one.
>
> *(clicks on Dolchstoß node, ConceptCard appears)* Click any ghost and Mistral explains it. Cultural context. Historical roots. Linguistic structure. Three kinds of explanation, all generated, all cited.
>
> *(clicks DIVERGENCE)* The butterfly chart shows the weight divergence across every concept between two languages. The wider the gap, the bigger the blind spot."

**Timing notes:** 40 seconds. Pre-record this segment. Every click should already be queued.

**On screen transitions:**
- 0:55 — Full-screen terrain, English view
- 1:00 — Click DE language button, terrain animates
- 1:07 — Pause on German topology, point out honor's migration
- 1:12 — Click "REVEAL LACUNAE," ghost nodes appear
- 1:18 — Hover/highlight Dolchstoß, Schmach, Kriegsschuld nodes
- 1:23 — Click Dolchstoß, ConceptCard slides in
- 1:28 — Click DIVERGENCE, butterfly chart opens
- 1:33 — Brief pause on chart
- 1:35 — Transition to closing

---

## Section 4: Why It Matters (1:35 - 2:00) — Person 4

**On screen:** The terrain, then pull back. End on the LACUNA logo.

**Script:**

> "Every mistranslation of a treaty has consequences. Every diplomatic misunderstanding starts with a concept one side literally cannot see.
>
> LACUNA is the first tool that maps where languages structurally disagree about reality. Not by counting words like a dictionary. Not by measuring abstract topology. By showing you the specific doors your language doesn't have — and what's behind them.
>
> It works on any document, any language pair that BGE-M3 supports — over a hundred languages. Feed it a UN resolution, a trade agreement, a constitution. Wherever language carries power, LACUNA shows you what's missing.
>
> LACUNA. The shape of what you can't say."

**Timing notes:** 25 seconds. The final line should land with a beat of silence before the video ends.

**On screen transitions:**
- 1:35 — Terrain with ghost concepts, slowly rotating
- 1:42 — Text overlay: "Any document. Any language pair. 100+ languages."
- 1:48 — Brief montage: terrain, butterfly chart, concept card, network graph (1s each)
- 1:53 — LACUNA logo centered, tagline: "The shape of what you can't say"
- 1:57 — Hold on logo for 3 seconds until 2:00

---

## Judging Criteria Coverage

| Criterion | Where It Lands | Key Moment |
|-----------|---------------|------------|
| **Technicality** | Section 2 (architecture). Three Mistral agents. Frame decomposition. Embedding validation. UMAP. FastAPI. | "The LLM decides what matters. The math decides where it goes." |
| **Creativity** | Section 1 (hook) + Section 3 (ghosts). Finding what's invisible. 3D terrain. Embedding geometry reveals cultural blind spots. | Dolchstoß story. Ghost concepts appearing. |
| **Usefulness** | Section 4 (vision). Diplomacy, treaty analysis, legal interpretation, education. | "Feed it a UN resolution, a trade agreement, a constitution." |
| **Demo** | Section 3 (walkthrough). Terrain transition EN→DE is the centerpiece. | The terrain reshaping when switching languages. |
| **Mistral alignment** | Section 2 + throughout. Three agents all Mistral Large. Structured JSON output. | "Three-agent pipeline powered by Mistral." |

---

## Production Tips

1. **Pre-record the demo segment.** Screen-record Section 3 separately with narration overlaid. Eliminates loading/lag/fumbled clicks.
2. **Rehearse the terrain transition.** The EN→DE animation is your most powerful visual moment. Set the camera angle for maximum dramatic deformation.
3. **Use the dark theme.** The terrain with bloom and vignette looks cinematic. Keep background dark throughout.
4. **The terminal rejection line is memorable.** `[validator] REJECT new-world-order-as-naivety: too similar (0.953)` — flash it during Section 2. Judges will remember it.
5. **Time the final line.** "The shape of what you can't say" → 2-3 seconds of logo on dark background → end. Silence is more powerful than music.
6. **No background music during speaking.** If you want ambient music, only during the montage at 1:48-1:53.
7. **Each person visible at least once.** Cut to a face shot at the start of each section.
8. **Keep the architecture diagram clean.** Document → Extractor → Validator → Interpreter → 3D Terrain. Five boxes, four arrows, readable in 3 seconds.

---

## Backup Cuts (if Running Over 2 Minutes)

Priority order:
1. **Cut butterfly chart** in Section 3 (saves 5s). End demo on concept card.
2. **Shorten the hook** — remove "There is no English word..." paragraph. Go straight to "We call these invisible gaps lacunae." (saves 8s).
3. **Compress architecture** to two sentences: "Three Mistral agents: one extracts conceptual frames, one validates against multilingual embeddings, one explains the gaps. The math is UMAP on BGE-M3 vectors." (saves 10s).

Do NOT cut the demo walkthrough or the closing.

---

## Key Phrases to Practice

- "Languages don't just say things differently. They make different things *thinkable*."
- "Not keywords. *Frames.*"
- "If a concept embeds identically across languages, it gets killed."
- "The LLM decides what matters. The math decides where it goes."
- "Same word. Completely different neighborhood."
- "These are *lacunae*: ideas that exist in one language but have no real equivalent in another."
- "The shape of what you can't say."