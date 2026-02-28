// LACUNA -- Treaty of Versailles concept topology data
// Types + curated concept positions + helpers
// Positions are curated placeholders. Source switches to "embedding" after BGE-M3 validation.

export type Language = string;

export type Concept = {
  id: string;
  labels: Record<string, string>;
  definitions?: Record<string, string>;
  cluster: string;
  position: Record<string, [number, number]>; // [x, z]
  weight: Record<string, number>; // 0-1
  ghost: Record<string, boolean>;
  hero?: boolean;
  source: "curated" | "embedding";
};

export const CLUSTER_COLORS: Record<string, [number, number, number]> = {
  core: [0.96, 0.62, 0.04],
  justice: [0.23, 0.51, 0.96],
  victory: [0.13, 0.77, 0.37],
  humiliation: [0.94, 0.27, 0.27],
  "ghost-de": [0.47, 0.44, 0.42],
  "ghost-en": [0.47, 0.44, 0.42],
};

export const CLUSTER_HEX: Record<string, string> = {
  core: "#f59e0b",
  justice: "#3b82f6",
  victory: "#22c55e",
  humiliation: "#ef4444",
  "ghost-de": "#78716c",
  "ghost-en": "#78716c",
};

export function getLabel(concept: Concept, language: string): string {
  return concept.labels[language] || concept.labels["en"] || concept.id;
}

export function getAvailableLanguages(): string[] {
  if (concepts.length === 0) return ["en"];
  return Object.keys(concepts[0].position);
}

export const concepts: Concept[] = [
  // === CORE ===
  {
    id: "reparations",
    labels: { en: "reparations", de: "Reparationen" },
    definitions: {
      en: "Financial payments imposed on a defeated nation as compensation for war damages and losses",
      de: "Finanzielle Zahlungen, die einer besiegten Nation als Entschädigung für Kriegsschäden auferlegt werden",
    },
    cluster: "core",
    position: { en: [0, 0], de: [5, 8] },
    weight: { en: 1.0, de: 1.0 },
    ghost: { en: false, de: false },
    source: "curated",
  },
  {
    id: "armistice",
    labels: { en: "armistice", de: "Waffenstillstand" },
    definitions: {
      en: "A formal agreement to cease fighting, ending active hostilities before a peace treaty",
      de: "Ein formelles Abkommen zur Einstellung der Kampfhandlungen vor einem Friedensvertrag",
    },
    cluster: "core",
    position: { en: [3, -5], de: [8, -3] },
    weight: { en: 0.7, de: 0.65 },
    ghost: { en: false, de: false },
    source: "curated",
  },
  {
    id: "honor",
    labels: { en: "honor", de: "Ehre" },
    definitions: {
      en: "The reputation and moral standing of a nation in the eyes of the international community",
      de: "Der Ruf und die moralische Stellung einer Nation in den Augen der internationalen Gemeinschaft",
    },
    cluster: "core",
    position: { en: [-4, 3], de: [12, 15] },
    weight: { en: 0.6, de: 0.85 },
    ghost: { en: false, de: false },
    source: "curated",
  },
  {
    id: "treaty",
    labels: { en: "treaty", de: "Vertrag" },
    definitions: {
      en: "A formal agreement between nations establishing terms of peace and future relations",
      de: "Ein formelles Abkommen zwischen Nationen, das Friedensbedingungen und zukünftige Beziehungen festlegt",
    },
    cluster: "core",
    position: { en: [5, -3], de: [2, -6] },
    weight: { en: 0.75, de: 0.7 },
    ghost: { en: false, de: false },
    source: "curated",
  },

  // === JUSTICE ===
  {
    id: "justice",
    labels: { en: "justice", de: "Gerechtigkeit" },
    definitions: {
      en: "The principle that those who cause harm must be held accountable and make amends",
      de: "Das Prinzip, dass diejenigen, die Schaden verursachen, zur Rechenschaft gezogen werden müssen",
    },
    cluster: "justice",
    position: { en: [-10, -8], de: [-25, -20] },
    weight: { en: 0.85, de: 0.4 },
    ghost: { en: false, de: false },
    source: "curated",
  },
  {
    id: "accountability",
    labels: { en: "accountability", de: "Verantwortlichkeit" },
    definitions: {
      en: "The obligation to accept responsibility for one's actions and their consequences",
      de: "Die Pflicht, Verantwortung für das eigene Handeln und dessen Folgen zu übernehmen",
    },
    cluster: "justice",
    position: { en: [-8, -5], de: [-20, -15] },
    weight: { en: 0.75, de: 0.35 },
    ghost: { en: false, de: false },
    source: "curated",
  },
  {
    id: "punishment",
    labels: { en: "punishment", de: "Strafe" },
    definitions: {
      en: "A penalty imposed on a wrongdoer as retribution for harmful actions",
      de: "Eine Strafe, die einem Übeltäter als Vergeltung für schädliche Handlungen auferlegt wird",
    },
    cluster: "justice",
    position: { en: [-12, -3], de: [-30, -10] },
    weight: { en: 0.8, de: 0.3 },
    ghost: { en: false, de: false },
    source: "curated",
  },
  {
    id: "debt",
    labels: { en: "debt", de: "Schulden" },
    definitions: {
      en: "An obligation to repay what is owed, whether financial or moral",
      de: "Eine Verpflichtung zur Rückzahlung dessen, was geschuldet wird, ob finanziell oder moralisch",
    },
    cluster: "justice",
    position: { en: [-5, -10], de: [-18, -25] },
    weight: { en: 0.7, de: 0.4 },
    ghost: { en: false, de: false },
    source: "curated",
  },
  {
    id: "obligation",
    labels: { en: "obligation", de: "Pflicht" },
    definitions: {
      en: "A binding duty or commitment that must be fulfilled",
      de: "Eine verbindliche Pflicht oder Verpflichtung, die erfüllt werden muss",
    },
    cluster: "justice",
    position: { en: [-14, -6], de: [-35, -15] },
    weight: { en: 0.9, de: 0.45 },
    ghost: { en: false, de: false },
    hero: true,
    source: "curated",
  },
  {
    id: "guilt",
    labels: { en: "guilt", de: "Schuld" },
    definitions: {
      en: "The state of having committed a wrong or offense against others",
      de: "Der Zustand, ein Unrecht oder Vergehen gegen andere begangen zu haben",
    },
    cluster: "justice",
    position: { en: [-7, -12], de: [-15, -30] },
    weight: { en: 0.85, de: 0.45 },
    ghost: { en: false, de: false },
    hero: true,
    source: "curated",
  },
  {
    id: "restitution",
    labels: { en: "restitution", de: "Wiedergutmachung" },
    definitions: {
      en: "The act of restoring something to its rightful owner or compensating for loss",
      de: "Die Handlung der Wiederherstellung oder Entschädigung für einen Verlust",
    },
    cluster: "justice",
    position: { en: [-6, -7], de: [-22, -18] },
    weight: { en: 0.65, de: 0.3 },
    ghost: { en: false, de: false },
    source: "curated",
  },
  {
    id: "sanctions",
    labels: { en: "sanctions", de: "Sanktionen" },
    definitions: {
      en: "Punitive measures imposed on a nation to enforce compliance with international demands",
      de: "Strafmaßnahmen gegen eine Nation zur Durchsetzung internationaler Forderungen",
    },
    cluster: "justice",
    position: { en: [-11, -9], de: [-28, -22] },
    weight: { en: 0.9, de: 0.4 },
    ghost: { en: false, de: false },
    hero: true,
    source: "curated",
  },
  {
    id: "concession",
    labels: { en: "concession", de: "Zugeständnis" },
    definitions: {
      en: "Territory or rights surrendered by a defeated nation as part of peace terms",
      de: "Gebiet oder Rechte, die von einer besiegten Nation als Teil der Friedensbedingungen abgetreten werden",
    },
    cluster: "justice",
    position: { en: [-9, -11], de: [-24, -28] },
    weight: { en: 0.6, de: 0.35 },
    ghost: { en: false, de: false },
    source: "curated",
  },
  {
    id: "demilitarization",
    labels: { en: "demilitarization", de: "Entmilitarisierung" },
    definitions: {
      en: "The forced reduction or elimination of a nation's military capability",
      de: "Die erzwungene Reduzierung oder Beseitigung der militärischen Fähigkeiten einer Nation",
    },
    cluster: "justice",
    position: { en: [-13, -4], de: [-32, -12] },
    weight: { en: 0.7, de: 0.3 },
    ghost: { en: false, de: false },
    source: "curated",
  },

  // === VICTORY ===
  {
    id: "victory",
    labels: { en: "victory", de: "Sieg" },
    definitions: {
      en: "The successful conclusion of a military conflict through defeating the enemy",
      de: "Der erfolgreiche Abschluss eines militärischen Konflikts durch Besiegung des Feindes",
    },
    cluster: "victory",
    position: { en: [15, -10], de: [-35, 18] },
    weight: { en: 0.85, de: 0.2 },
    ghost: { en: false, de: false },
    source: "curated",
  },
  {
    id: "peace",
    labels: { en: "peace", de: "Frieden" },
    definitions: {
      en: "The cessation of armed conflict and establishment of stable relations between nations",
      de: "Die Beendigung bewaffneter Konflikte und Herstellung stabiler Beziehungen zwischen Nationen",
    },
    cluster: "victory",
    position: { en: [18, -5], de: [-38, 22] },
    weight: { en: 0.8, de: 0.15 },
    ghost: { en: false, de: false },
    source: "curated",
  },
  {
    id: "order",
    labels: { en: "order", de: "Ordnung" },
    definitions: {
      en: "A stable arrangement of power and governance that prevents future conflict",
      de: "Eine stabile Ordnung von Macht und Regierung, die zukünftige Konflikte verhindert",
    },
    cluster: "victory",
    position: { en: [12, -16], de: [-40, 15] },
    weight: { en: 0.7, de: 0.25 },
    ghost: { en: false, de: false },
    source: "curated",
  },
  {
    id: "triumph",
    labels: { en: "triumph", de: "Triumph" },
    definitions: {
      en: "A great achievement or success, especially in overcoming an adversary",
      de: "Ein großer Erfolg, besonders in der Überwindung eines Gegners",
    },
    cluster: "victory",
    position: { en: [20, -8], de: [-36, 25] },
    weight: { en: 0.85, de: 0.2 },
    ghost: { en: false, de: false },
    hero: true,
    source: "curated",
  },
  {
    id: "sovereignty",
    labels: { en: "sovereignty", de: "Souveränität" },
    definitions: {
      en: "The supreme authority of a state to govern itself without external interference",
      de: "Die höchste Autorität eines Staates, sich ohne äußere Einmischung selbst zu regieren",
    },
    cluster: "victory",
    position: { en: [14, -14], de: [-33, 20] },
    weight: { en: 0.7, de: 0.25 },
    ghost: { en: false, de: false },
    source: "curated",
  },
  {
    id: "selfdetermination",
    labels: { en: "self-determination", de: "Selbstbestimmung" },
    definitions: {
      en: "The right of peoples to determine their own political status and form of government",
      de: "Das Recht der Völker, ihren eigenen politischen Status und ihre Regierungsform zu bestimmen",
    },
    cluster: "victory",
    position: { en: [16, -12], de: [-37, 16] },
    weight: { en: 0.65, de: 0.2 },
    ghost: { en: false, de: false },
    source: "curated",
  },
  {
    id: "legitimacy",
    labels: { en: "legitimacy", de: "Legitimität" },
    definitions: {
      en: "The rightful authority to exercise power, recognized by other nations",
      de: "Die rechtmäßige Autorität zur Ausübung von Macht, anerkannt von anderen Nationen",
    },
    cluster: "victory",
    position: { en: [13, -7], de: [-34, 19] },
    weight: { en: 0.6, de: 0.2 },
    ghost: { en: false, de: false },
    source: "curated",
  },
  {
    id: "diplomacy",
    labels: { en: "diplomacy", de: "Diplomatie" },
    definitions: {
      en: "The conduct of negotiations between nations to resolve disputes and establish agreements",
      de: "Die Führung von Verhandlungen zwischen Nationen zur Beilegung von Streitigkeiten",
    },
    cluster: "victory",
    position: { en: [17, -15], de: [-39, 17] },
    weight: { en: 0.65, de: 0.15 },
    ghost: { en: false, de: false },
    source: "curated",
  },
  {
    id: "reconstruction",
    labels: { en: "reconstruction", de: "Wiederaufbau" },
    definitions: {
      en: "The process of rebuilding a nation's infrastructure and institutions after war",
      de: "Der Prozess des Wiederaufbaus der Infrastruktur und Institutionen einer Nation nach dem Krieg",
    },
    cluster: "victory",
    position: { en: [19, -6], de: [-36, 21] },
    weight: { en: 0.6, de: 0.15 },
    ghost: { en: false, de: false },
    source: "curated",
  },

  // === HUMILIATION ===
  {
    id: "humiliation",
    labels: { en: "humiliation", de: "Demütigung" },
    definitions: {
      en: "The act of causing someone to feel deeply ashamed or degraded",
      de: "Die Handlung, jemanden tief zu beschämen oder zu erniedrigen",
    },
    cluster: "humiliation",
    position: { en: [30, 22], de: [-2, 10] },
    weight: { en: 0.15, de: 0.9 },
    ghost: { en: false, de: false },
    source: "curated",
  },
  {
    id: "betrayal",
    labels: { en: "betrayal", de: "Verrat" },
    definitions: {
      en: "The violation of trust or allegiance by those who were supposed to be allies",
      de: "Der Vertrauensbruch durch diejenigen, die Verbündete hätten sein sollen",
    },
    cluster: "humiliation",
    position: { en: [28, 25], de: [5, 15] },
    weight: { en: 0.1, de: 0.95 },
    ghost: { en: false, de: false },
    hero: true,
    source: "curated",
  },
  {
    id: "injustice",
    labels: { en: "injustice", de: "Ungerechtigkeit" },
    definitions: {
      en: "An unfair or unjust act that violates principles of fairness and equity",
      de: "Eine unfaire Handlung, die Grundsätze der Gerechtigkeit und Gleichheit verletzt",
    },
    cluster: "humiliation",
    position: { en: [35, 20], de: [-8, 6] },
    weight: { en: 0.2, de: 0.85 },
    ghost: { en: false, de: false },
    source: "curated",
  },
  {
    id: "revenge",
    labels: { en: "revenge", de: "Rache" },
    definitions: {
      en: "Retaliation against those who have caused harm, seeking to inflict equivalent suffering",
      de: "Vergeltung gegen diejenigen, die Schaden verursacht haben, um gleichwertiges Leid zuzufügen",
    },
    cluster: "humiliation",
    position: { en: [38, 30], de: [12, 20] },
    weight: { en: 0.15, de: 0.9 },
    ghost: { en: false, de: false },
    hero: true,
    source: "curated",
  },
  {
    id: "resentment",
    labels: { en: "resentment", de: "Groll" },
    definitions: {
      en: "Deep-seated anger and bitterness resulting from perceived unfair treatment",
      de: "Tief verwurzelter Zorn und Verbitterung aufgrund wahrgenommener ungerechter Behandlung",
    },
    cluster: "humiliation",
    position: { en: [32, 28], de: [0, 18] },
    weight: { en: 0.1, de: 0.85 },
    ghost: { en: false, de: false },
    source: "curated",
  },
  {
    id: "subjugation",
    labels: { en: "subjugation", de: "Unterwerfung" },
    definitions: {
      en: "The forceful domination and control of a people or nation by another power",
      de: "Die gewaltsame Unterwerfung und Kontrolle eines Volkes oder einer Nation durch eine andere Macht",
    },
    cluster: "humiliation",
    position: { en: [33, 35], de: [8, 25] },
    weight: { en: 0.2, de: 0.8 },
    ghost: { en: false, de: false },
    source: "curated",
  },
  {
    id: "occupation",
    labels: { en: "occupation", de: "Besatzung" },
    definitions: {
      en: "The military control of a defeated nation's territory by foreign forces",
      de: "Die militärische Kontrolle des Territoriums einer besiegten Nation durch fremde Streitkräfte",
    },
    cluster: "humiliation",
    position: { en: [36, 24], de: [-5, 12] },
    weight: { en: 0.15, de: 0.8 },
    ghost: { en: false, de: false },
    source: "curated",
  },
  {
    id: "propaganda",
    labels: { en: "propaganda", de: "Propaganda" },
    definitions: {
      en: "The systematic dissemination of information to promote a political cause or damage an opponent",
      de: "Die systematische Verbreitung von Informationen zur Förderung einer politischen Sache oder Schädigung eines Gegners",
    },
    cluster: "humiliation",
    position: { en: [34, 32], de: [3, 22] },
    weight: { en: 0.15, de: 0.75 },
    ghost: { en: false, de: false },
    source: "curated",
  },
  {
    id: "nationalism",
    labels: { en: "nationalism", de: "Nationalismus" },
    definitions: {
      en: "Strong identification with one's nation, often including the belief in its superiority",
      de: "Starke Identifikation mit der eigenen Nation, oft einschließlich des Glaubens an deren Überlegenheit",
    },
    cluster: "humiliation",
    position: { en: [31, 26], de: [1, 16] },
    weight: { en: 0.1, de: 0.85 },
    ghost: { en: false, de: false },
    source: "curated",
  },
  {
    id: "starvation",
    labels: { en: "starvation", de: "Hungersnot" },
    definitions: {
      en: "The deliberate deprivation of food supplies as a weapon of war or coercion",
      de: "Der absichtliche Entzug von Nahrungsmitteln als Kriegswaffe oder Zwangsmittel",
    },
    cluster: "humiliation",
    position: { en: [37, 33], de: [10, 24] },
    weight: { en: 0.1, de: 0.8 },
    ghost: { en: false, de: false },
    source: "curated",
  },
  {
    id: "blockade",
    labels: { en: "blockade", de: "Blockade" },
    definitions: {
      en: "The naval prevention of goods reaching a nation, causing economic and humanitarian crisis",
      de: "Die Seeblockade zur Verhinderung von Warenlieferungen an eine Nation, die wirtschaftliche und humanitäre Krisen verursacht",
    },
    cluster: "humiliation",
    position: { en: [36, 29], de: [7, 19] },
    weight: { en: 0.1, de: 0.75 },
    ghost: { en: false, de: false },
    source: "curated",
  },

  // === GHOST-DE (exist in German, absent in English) ===
  {
    id: "dolchstoss",
    labels: { en: "Dolchstoss", de: "Dolchstoß" },
    definitions: {
      en: "The conspiracy theory that Germany's military was betrayed by civilian politicians who surrendered unnecessarily",
      de: "Die Dolchstoßlegende, dass Deutschlands Militär von zivilen Politikern verraten wurde, die unnötig kapitulierten",
    },
    cluster: "ghost-de",
    position: { en: [20, 15], de: [15, 30] },
    weight: { en: 0.0, de: 0.85 },
    ghost: { en: true, de: false },
    source: "curated",
  },
  {
    id: "schmach",
    labels: { en: "Schmach", de: "Schmach" },
    definitions: {
      en: "A deep national disgrace that stains collective honor and demands redress",
      de: "Eine tiefe nationale Schmach, die die kollektive Ehre befleckt und Wiedergutmachung verlangt",
    },
    cluster: "ghost-de",
    position: { en: [22, 18], de: [18, 28] },
    weight: { en: 0.0, de: 0.8 },
    ghost: { en: true, de: false },
    source: "curated",
  },
  {
    id: "diktat",
    labels: { en: "Diktat", de: "Diktat" },
    definitions: {
      en: "A dictated peace imposed without negotiation by the victorious powers",
      de: "Ein aufgezwungener Frieden, der von den Siegermächten ohne Verhandlung diktiert wurde",
    },
    cluster: "ghost-de",
    position: { en: [18, 12], de: [20, 32] },
    weight: { en: 0.0, de: 0.8 },
    ghost: { en: true, de: false },
    source: "curated",
  },
  {
    id: "kriegsschuld",
    labels: { en: "Kriegsschuld", de: "Kriegsschuld" },
    definitions: {
      en: "The assignment of sole war guilt to one nation as the legal basis for reparations",
      de: "Die Zuweisung der alleinigen Kriegsschuld an eine Nation als rechtliche Grundlage für Reparationen",
    },
    cluster: "ghost-de",
    position: { en: [24, 16], de: [22, 26] },
    weight: { en: 0.0, de: 0.75 },
    ghost: { en: true, de: false },
    source: "curated",
  },
  {
    id: "volkszorn",
    labels: { en: "Volkszorn", de: "Volkszorn" },
    definitions: {
      en: "The collective rage of a people against perceived national humiliation",
      de: "Der kollektive Zorn eines Volkes gegen empfundene nationale Demütigung",
    },
    cluster: "ghost-de",
    position: { en: [21, 20], de: [16, 34] },
    weight: { en: 0.0, de: 0.7 },
    ghost: { en: true, de: false },
    source: "curated",
  },
  {
    id: "revanchism",
    labels: { en: "revanchism", de: "Revanchismus" },
    definitions: {
      en: "A political movement seeking to reverse territorial losses through future conflict",
      de: "Eine politische Bewegung, die territoriale Verluste durch zukünftige Konflikte rückgängig machen will",
    },
    cluster: "ghost-de",
    position: { en: [23, 14], de: [19, 31] },
    weight: { en: 0.0, de: 0.75 },
    ghost: { en: true, de: false },
    source: "curated",
  },

  // === GHOST-EN (exist in English, absent in German) ===
  {
    id: "magnanimity",
    labels: { en: "magnanimity", de: "Großmut" },
    definitions: {
      en: "Generosity and nobility of spirit shown by the victor toward the defeated",
      de: "Großmut und Edelmut des Siegers gegenüber dem Besiegten",
    },
    cluster: "ghost-en",
    position: { en: [10, -20], de: [-30, 30] },
    weight: { en: 0.6, de: 0.0 },
    ghost: { en: false, de: true },
    source: "curated",
  },
  {
    id: "civilizing",
    labels: { en: "civilizing mission", de: "Zivilisierungsmission" },
    definitions: {
      en: "The belief that advanced nations have a duty to bring progress and order to others",
      de: "Der Glaube, dass fortgeschrittene Nationen die Pflicht haben, anderen Fortschritt und Ordnung zu bringen",
    },
    cluster: "ghost-en",
    position: { en: [8, -18], de: [-28, 28] },
    weight: { en: 0.55, de: 0.0 },
    ghost: { en: false, de: true },
    source: "curated",
  },
  {
    id: "mandate",
    labels: { en: "mandate", de: "Mandat" },
    definitions: {
      en: "International authorization to govern a territory on behalf of the League of Nations",
      de: "Internationale Ermächtigung, ein Gebiet im Namen des Völkerbunds zu regieren",
    },
    cluster: "ghost-en",
    position: { en: [11, -22], de: [-32, 32] },
    weight: { en: 0.5, de: 0.0 },
    ghost: { en: false, de: true },
    source: "curated",
  },
];
