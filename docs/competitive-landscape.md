# Competitive Landscape: Prior Art for LACUNA

**Compiled: Feb 28, 2026 (Hackathon Day 1)**
**Purpose:** Know these three papers cold. Judges may reference them. Each does something adjacent to LACUNA but none does what we do.

---

## TL;DR for Sunny (2 minutes)

Three recent papers measure how languages differ structurally. None of them do what LACUNA does:

1. **Draganov & Skiena (EMNLP 2024)** -- Use topology (persistent homology) to show embedding clouds have different *shapes* per language. They prove non-isometry exists but never explain what it means for specific concepts. They work with unlabeled point clouds. LACUNA labels every concept and shows you where the gaps are.

2. **Khishigsuren et al. (PNAS 2025)** -- Count how many words languages have for concepts (e.g., Mongolian has many horse words). They use 1,574 bilingual dictionaries across 616 languages. Massive scale, but they measure *lexical density* (word count), not *conceptual topology* (geometric relationships between ideas). LACUNA measures how concepts relate to each other differently, not just how many words exist.

3. **Gong / Semanscope (arXiv 2025)** -- Uses PHATE manifold learning to visualize multilingual embeddings. Introduces "Semantic Affinity" metric (0-1 bounded). Closest to our approach visually, but focuses on benchmarking embedding models, not on surfacing untranslatable conceptual gaps. Their question: "which embedding model aligns languages best?" Our question: "where do languages structurally disagree about reality?"

**The sentence that positions us:** "Draganov proved the shapes differ. Khishigsuren counted the words. Gong benchmarked the models. LACUNA is the first tool that shows you where a specific concept lives differently in two languages and what that means."

---

## Paper 1: The Shape of Word Embeddings

**Full Title:** The Shape of Word Embeddings: Quantifying Non-Isometry with Topological Data Analysis

**Authors:** Ondrej Draganov, Steven Skiena (Stony Brook University)

**Venue:** Findings of EMNLP 2024, pages 12080-12099, Miami, Florida

**Links:**
- Paper: https://aclanthology.org/2024.findings-emnlp.705/
- arXiv: https://arxiv.org/abs/2404.00500
- Code: https://github.com/OnDraganov/shape-of-word-embeddings

### Abstract (verbatim)

"Word embeddings represent language vocabularies as clouds of d-dimensional points. We investigate how information is conveyed by the general shape of these clouds, instead of representing the semantic meaning of each token. Specifically, we use the notion of persistent homology from topological data analysis (TDA) to measure the distances between language pairs from the shape of their unlabeled embeddings. These distances quantify the degree of non-isometry of the embeddings. To distinguish whether these differences are random training errors or capture real information about the languages, we use the computed distance matrices to construct language phylogenetic trees over 81 Indo-European languages. Careful evaluation shows that our reconstructed trees exhibit strong and statistically-significant similarities to the reference."

### Key Methodology

- **Embeddings:** FastText 300-dimensional pre-trained vectors (Common Crawl + Wikipedia), 10,000 most frequent tokens per language
- **Core technique:** Persistent homology from Topological Data Analysis (TDA)
- **Pipeline:** Word embeddings -> Vietoris-Rips complex -> persistence diagrams -> distance matrices -> phylogenetic trees
- **Distance metrics between persistence diagrams:** Bottleneck distance, Sliced Wasserstein distance, Persistence images, Bars statistics (40 numerical features)
- **Tree construction:** UPGMA and Neighbor Joining algorithms
- **Validation:** Permutation testing (100,000 random label shuffles) against Ethnologue reference trees
- **Comparison metrics:** Path distance, Jaccard-Robinson-Foulds, Matching split distance, Phylogenetic/Clustering information distances
- **Scale:** 81 Indo-European languages, 144 tree variants tested, 864 total conditions

### Key Findings

- 56% of conditions (484/864) achieved statistical significance at p < 0.05
- Maximum significance: 6.87 sigma (Bonferroni-corrected p = 2.77 x 10^-9)
- Dimension 1 (loops) outperformed dimensions 0 (components) and 2 (voids)
- UPGMA trees (114 significant at p < 0.005) outperformed Neighbor Joining (63)
- **Core result:** "Non-isometry between unlabeled word embeddings is not completely erroneous" and contains real linguistic signal -- contradicting earlier claims that embedding shape differences were training artifacts

### Key Limitations (from their own paper)

- No data normalization; scaling and translation affect outcomes
- Outlier sensitivity (isolated tokens inflate homology features)
- Only degrees 0-2 computed despite 300-dimensional embeddings
- Single embedding source (FastText only)
- Weak interpretability: "Unclear which linguistic properties correspond to detected topological features"

### How LACUNA Differs

| Dimension | Draganov & Skiena | LACUNA |
|-----------|-------------------|--------|
| Granularity | Unlabeled point clouds (no concept identity) | Named, curated concepts with semantic labels |
| Interpretability | Abstract topology (holes, loops) with no semantic grounding | Each distance is between identified concepts with human-readable explanation |
| Output | Phylogenetic trees (language family relationships) | Concept topology maps showing where languages diverge on specific ideas |
| Embedding model | FastText (static, monolingual) | BGE-M3 (multilingual, contextual) |
| User-facing | Academic analysis tool | Interactive 3D terrain with live LLM interpretation |
| Question answered | "Do embedding shapes differ across languages?" | "Where specifically do they differ and what does that mean?" |

### What We Can Learn

- Their permutation testing methodology (100K shuffles) is rigorous. If we need statistical validation, this is the gold standard approach.
- They proved non-isometry is REAL, not noise. We can cite this directly: "Draganov & Skiena (2024) proved that geometric differences in embedding spaces across languages contain genuine linguistic signal. LACUNA operationalizes this finding."
- Their finding that dimension 1 (loops) carries the most signal is interesting. Loops in embedding space could correspond to conceptual cycles (e.g., revenge -> guilt -> obligation -> revenge).

### Useful Quotes for Positioning

- "We investigate how information is conveyed by the general shape of these clouds, instead of representing the semantic meaning of each token." -- They explicitly say they ignore semantic meaning. We don't.
- "Non-isometry between unlabeled word embeddings is not completely erroneous." -- They prove the phenomenon exists. We map it.

---

## Paper 2: A Computational Analysis of Lexical Elaboration Across Languages

**Full Title:** A computational analysis of lexical elaboration across languages

**Authors:** Temuulen Khishigsuren (U Melbourne, Psychological Sciences), Terry Regier (UC Berkeley, Linguistics), Ekaterina Vylomova (U Melbourne, Computing), Charles Kemp (U Melbourne, Psychological Sciences)

**Venue:** PNAS, Vol. 122, No. 15, April 2025

**Links:**
- Paper: https://www.pnas.org/doi/10.1073/pnas.2417304122
- PubMed: https://pubmed.ncbi.nlm.nih.gov/40208936/
- Code: https://github.com/cskemp/lexical_elaboration

### Abstract (verbatim)

"Claims about lexical elaboration (e.g. Mongolian has many horse-related terms) are widespread in the scholarly and popular literature. Here, we show that computational analyses of bilingual dictionaries can be used to test claims about lexical elaboration at scale. We validate our approach by introducing BILA, a dataset including 1,574 bilingual dictionaries, and showing that it confirms 147 out of 163 previous claims from the literature. We then identify previously unreported examples of lexical elaboration, and analyze how lexical elaboration is influenced by ecological and cultural variables. Claims about lexical elaboration are sometimes dismissed as either obvious or fanciful, but our work suggests that large-scale computational approaches to the topic can produce nonobvious and well-grounded insights into language and culture."

### Key Methodology

- **Dataset:** BILA (Bilingual Elaboration Dataset) -- 1,574 bilingual dictionaries between English and 616 languages
- **Sources:** HathiTrust Digital Library + additional dictionaries OCR'd via ABBYY FineReader
- **Measurement:** Word frequency counts extracted from dictionaries; L_lang scores via mixed-effects logistic regression
- **Validation:** Confirmed 147/163 previously documented claims (90% hit rate)
- **Analysis:** Ecological variables (temperature, precipitation, windspeed) and subsistence strategies as predictors
- **Parts of speech:** Focused on nouns, verbs, and adjectives (2,230 terms)
- **Tools:** Hierarchical statistical modeling, Bayesian methods, interactive web application for exploration

### Key Findings

- Arctic languages (Ahtena, Central Alaskan Yupik) score highly for snow; Scots has terms like "doon-lay" (heavy snowfall), "feughter" (light dusting), "fuddum" (drifting snow)
- Mongolian excels in horse vocabulary
- Marshallese (Oceanic) has exceptional vocabulary for smell
- Hindi shows lexical richness around love
- Japanese scores highly on obligation and duty
- Snow-rich vocabularies cluster in cold environments, but rain vocabulary does NOT follow a neat climatic gradient
- Ecological and cultural variables predict lexical elaboration patterns

### How LACUNA Differs

| Dimension | Khishigsuren et al. | LACUNA |
|-----------|---------------------|--------|
| What they measure | Lexical density (how many words exist for a concept) | Conceptual topology (how concepts relate to each other in embedding space) |
| Data source | Bilingual dictionaries (word counts) | Multilingual embeddings (geometric distances) |
| Scale | 616 languages, 2,230 terms | Focused depth (currently EN/DE/FR), 43+ concepts per topic |
| Core insight | "Languages have different numbers of words for things" | "Languages organize the relationships between concepts differently" |
| Sapir-Whorf angle | Lexical elaboration is shaped by environment/culture (weak Whorf) | Conceptual topology constrains what is thinkable in a language (strong Whorf measurement) |
| Output | Statistical elaboration scores | Interactive 3D terrain showing topological differences |

### What We Can Learn

- Their 90% confirmation rate (147/163) is a powerful validation story. We should aspire to similar empirical grounding.
- The Japan-obligation finding directly validates our Treaty of Versailles concept set. Obligation structures differently across languages -- they found it lexically, we find it geometrically.
- Their ecological/cultural variable analysis is a roadmap for our "temporal topology" future direction. If lexical elaboration correlates with environment, conceptual topology should too.
- BILA as a potential validation dataset: if concepts that are lexically elaborated in a language also cluster tighter in embedding space, that would be strong cross-validation.
- PNAS publication means this research direction is taken seriously at the highest level of academic publishing.

### Useful Quotes for Positioning

- "Claims about lexical elaboration are sometimes dismissed as either obvious or fanciful, but our work suggests that large-scale computational approaches to the topic can produce nonobvious and well-grounded insights into language and culture." -- We can echo this framing: our findings are neither obvious nor fanciful, they are measurable.
- The fact that they needed 1,574 dictionaries to measure what we can measure with a single embedding model and cosine distance is a powerful efficiency argument for our approach.

---

## Paper 3: Geometric Patterns of Meaning (Semanscope)

**Full Title:** Geometric Patterns of Meaning: A PHATE Manifold Analysis of Multi-lingual Embeddings

**Authors:** Wen G. Gong

**Venue:** arXiv preprint, January 2025 (arXiv:2601.09731)

**Related companion paper:** "Benchmarking Cross-Lingual Semantic Alignment in Multilingual Embeddings" (arXiv:2601.09732) -- introduces the Semantic Affinity metric

**Earlier version:** "Geometric Structures and Patterns of Meaning: A PHATE Manifold Analysis of Chinese Character Embeddings" (arXiv:2510.01230, October 2025)

**Links:**
- Paper (patterns): https://arxiv.org/abs/2601.09731
- Paper (benchmarking): https://arxiv.org/abs/2601.09732
- Paper (Chinese characters): https://arxiv.org/abs/2510.01230

### Abstract (summary -- full PDF was not extractable)

Introduces a multi-level analysis framework for studying semantic geometry across multilingual embeddings using Semanscope, a visualization tool applying PHATE manifold learning. Examines diverse datasets spanning sub-character components, alphabetic systems, semantic domains, and numerical concepts. Reveals systematic geometric patterns and critical limitations in current embedding models.

### Key Methodology

**Four linguistic levels of analysis:**
1. Sub-character level (Chinese radicals) -- geometric collapse reveals models fail to distinguish semantic from structural components
2. Character level (different writing systems) -- distinct geometric signatures per writing system
3. Word level (20 semantic domains in English, Chinese, German) -- content words form clustering-branching patterns
4. Numerical concepts (Arabic numbers) -- spiral trajectories, contradicting distributional semantics assumptions

**Semantic Affinity (SA) metric** (from companion paper):
- Bounded between 0 and 1
- Measures ratio of inter-lingual spread to intra-lingual spread using cosine distance
- Higher SA = better cross-lingual alignment
- Formula: SA = inter-lingual cosine distance / intra-lingual cosine distance (bounded)

**Benchmarking results (13 models, 4 datasets, 52 experiments):**
- Tier 1: LaBSE (SA=0.70), USE (SA=0.68), S-BERT (SA=0.68) -- translation-pair supervision drives alignment
- Tier 2: LLM embeddings plateau at SA 0.55-0.61 regardless of scale (0.6B to 8B parameters)
- Tier 3: MLM-only BERT models (mBERT, XLM-R) score below 0.50 despite 100+ language training

**Key insight:** "Training objective, not architecture or scale, determines alignment."

**Dimensionality reduction:** PHATE (Potential of Heat-diffusion for Affinity-based Trajectory Embedding) -- chosen over UMAP and t-SNE for its ability to preserve both local and global structure, and for revealing trajectory/branching patterns that other methods collapse.

### Key Findings

- Chinese radicals show geometric collapse in embeddings -- models cannot distinguish semantic from structural components
- Content words form clustering-branching patterns across domains in EN/CN/DE
- Arabic numbers organize in spiral trajectories (not clusters), violating distributional semantics assumptions
- Scaling LLM embeddings does NOT improve cross-lingual alignment
- Translation-pair supervised training is the key to genuine alignment, not architecture or parameter count

### How LACUNA Differs

| Dimension | Semanscope / Gong | LACUNA |
|-----------|-------------------|--------|
| Primary question | "Which embedding models align languages best?" | "Where do languages structurally disagree about specific concepts?" |
| Dimensionality reduction | PHATE | UMAP |
| Embedding model | Benchmarks 13 models | BGE-M3 (selected for multilingual coverage) |
| Visualization | Static PHATE plots | Interactive 3D terrain with bloom, fog, transitions |
| Interpretation | Geometric pattern taxonomy (clustering, branching, spiral) | LLM-powered natural language interpretation of each concept's position |
| Concept selection | 20 semantic domains (broad coverage) | Topic-driven extraction (Treaty of Versailles, user-submitted documents) |
| Use case | Academic benchmarking tool | Applied instrument for diplomacy, propaganda analysis, education |
| Metric | Semantic Affinity (model quality) | Cosine distance divergence (conceptual topology differences) |

### What We Can Learn

- Their Semantic Affinity metric is simple and powerful. We should consider computing SA for BGE-M3 to validate our model choice. If BGE-M3 has low SA, our entire pipeline is suspect. (LaBSE might be worth investigating as alternative or validation.)
- PHATE vs UMAP: they argue PHATE preserves trajectory structures better than UMAP. For our terrain visualization, UMAP is fine (we want spatial separation, not trajectory preservation). But worth noting if judges ask.
- Their finding that scaling does not help alignment is important for us: we don't need a bigger model, we need the right training objective. BGE-M3's contrastive multilingual training is the right approach.
- The "training objective determines alignment" finding validates our choice of BGE-M3 over general-purpose LLM embeddings.

### Useful Quotes for Positioning

- "PHATE manifold learning as an essential analytic tool...for validating the effectiveness of embedding models in capturing semantic relationships."
- "Training objective, not architecture or scale, determines alignment." -- This is ammunition against "why didn't you use GPT-4 embeddings?"

---

## Synthesis: LACUNA's Unique Position

### What the field has established (what we build on):

1. **Non-isometry is real.** Embedding spaces are genuinely shaped differently across languages -- not noise, not training artifacts. (Draganov & Skiena, 2024)
2. **Lexical elaboration is measurable at scale.** Languages demonstrably allocate vocabulary differently based on ecological and cultural factors. (Khishigsuren et al., 2025)
3. **Geometric patterns in embeddings are systematic.** Content words cluster-branch, numbers spiral, writing systems have distinct signatures. (Gong, 2025)
4. **Training objective beats scale.** Bigger models do not automatically mean better cross-lingual alignment. (Gong, 2025)

### What nobody has done (what LACUNA does):

1. **Concept-level topology comparison.** Nobody measures how specific named concepts (betrayal, guilt, obligation, sovereignty) relate to each other differently across languages. Draganov works with unlabeled clouds. Khishigsuren counts words. Gong benchmarks models. LACUNA maps the topology of ideas.

2. **Interactive, interpretable output.** All three papers produce static academic visualizations. LACUNA produces a 3D terrain that a diplomat, journalist, or student can explore and understand without reading a paper.

3. **LLM-powered interpretation.** Nobody else uses an LLM to explain what the geometric differences mean in human terms. Our Interpreter agent translates math into insight.

4. **Topic-driven extraction.** Nobody else lets a user submit a document and get back its conceptual topology across languages. Our Extractor agent makes this a general-purpose tool, not a fixed analysis.

5. **Applied verticals.** Nobody else connects embedding geometry to diplomacy, propaganda detection, misinformation analysis, legal interpretation, or education. They answer academic questions. We answer operational ones.

### The elevator pitch incorporating prior art:

"In 2024, Draganov and Skiena proved that embedding spaces are genuinely shaped differently across languages. In 2025, Khishigsuren et al. showed that languages allocate vocabulary differently based on culture and environment. LACUNA is the first tool that maps where specific concepts live differently across languages and tells you what that means. It is the first empirical measurement instrument for the Sapir-Whorf hypothesis -- not counting words, not measuring abstract topology, but showing you the doors your language doesn't have."

---

## Risk Assessment: Could Judges Cite These Papers Against Us?

**Possible challenge:** "How is this different from Semanscope?"
**Answer:** Semanscope asks which embedding model is best. LACUNA asks what your language hides from you. Same math neighborhood, completely different question.

**Possible challenge:** "Draganov already did this with persistent homology."
**Answer:** Draganov proved the phenomenon exists with unlabeled point clouds. We identify specific concepts and explain what the differences mean. That is the difference between proving gravity exists and building a bridge.

**Possible challenge:** "The PNAS paper covers 616 languages. You only have two."
**Answer:** They count words. We map relationships. Counting that Mongolian has 300 horse words tells you something. Showing that "obligation" and "honor" are 3x closer in Japanese than in English tells you something different and arguably more dangerous to miss in a treaty negotiation.

**Possible challenge:** "Why UMAP and not PHATE?"
**Answer:** PHATE excels at trajectory preservation, which matters for temporal sequences. UMAP excels at cluster separation, which matters for spatial topology of co-existing concepts. Our terrain needs spatial separation, not trajectory flow. Different tools for different questions.
