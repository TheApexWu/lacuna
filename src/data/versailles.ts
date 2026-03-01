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
  lacuna: Record<string, boolean>;
  hero?: boolean;
  source: "curated" | "embedding";
};

export const LANGUAGES: { code: string; label: string; name: string }[] = [
  { code: "en", label: "EN", name: "English" },
  { code: "de", label: "DE", name: "Deutsch" },
  { code: "fr", label: "FR", name: "Français" },
  { code: "es", label: "ES", name: "Español" },
  { code: "zh", label: "ZH", name: "中文" },
  { code: "ko", label: "KO", name: "한국어" },
  { code: "ar", label: "AR", name: "العربية" },
  { code: "pt", label: "PT", name: "Português" },
  { code: "ru", label: "RU", name: "Русский" },
  { code: "ja", label: "JA", name: "日本語" },
];

export const CLUSTER_COLORS: Record<string, [number, number, number]> = {
  core: [0.96, 0.62, 0.04],
  justice: [0.23, 0.51, 0.96],
  victory: [0.13, 0.77, 0.37],
  humiliation: [0.94, 0.27, 0.27],
  "lacuna-de": [0.47, 0.44, 0.42],
  "lacuna-en": [0.47, 0.44, 0.42],
};

export const CLUSTER_HEX: Record<string, string> = {
  core: "#f59e0b",
  justice: "#3b82f6",
  victory: "#22c55e",
  humiliation: "#ef4444",
  "lacuna-de": "#78716c",
  "lacuna-en": "#78716c",
};

export function getLabel(concept: Concept, language: string): string {
  return concept.labels[language] || concept.labels["en"] || concept.id;
}

// ── Dynamic cluster color palette ────────────────────────────
// Used when embedding models derive their own clusters via HDBSCAN.
// Indexed by cluster label (0, 1, 2, ...). Noise (-1) gets NOISE_CLUSTER_COLOR.
export const DYNAMIC_CLUSTER_PALETTE = [
  "#f59e0b", "#3b82f6", "#22c55e", "#ef4444",
  "#a78bfa", "#ec4899", "#14b8a6", "#f97316",
  "#6366f1", "#84cc16",
];

export const DYNAMIC_CLUSTER_PALETTE_RGB: [number, number, number][] = [
  [0.96, 0.62, 0.04], [0.23, 0.51, 0.96], [0.13, 0.77, 0.37], [0.94, 0.27, 0.27],
  [0.65, 0.55, 0.98], [0.93, 0.30, 0.60], [0.08, 0.72, 0.65], [0.98, 0.45, 0.09],
  [0.39, 0.40, 0.95], [0.52, 0.80, 0.09],
];

export const NOISE_CLUSTER_COLOR = "#78716c";
export const NOISE_CLUSTER_RGB: [number, number, number] = [0.47, 0.44, 0.42];

export function getClusterColor(label: number | string, clusterColors?: Record<string, string>): string {
  if (clusterColors?.[String(label)]) return clusterColors[String(label)];
  if (typeof label === "string") return CLUSTER_HEX[label] || NOISE_CLUSTER_COLOR;
  if (label < 0) return NOISE_CLUSTER_COLOR;
  return DYNAMIC_CLUSTER_PALETTE[label % DYNAMIC_CLUSTER_PALETTE.length];
}

export function getClusterColorRGB(label: number | string): [number, number, number] {
  if (typeof label === "string") return CLUSTER_COLORS[label] || NOISE_CLUSTER_RGB;
  if (label < 0) return NOISE_CLUSTER_RGB;
  return DYNAMIC_CLUSTER_PALETTE_RGB[label % DYNAMIC_CLUSTER_PALETTE_RGB.length];
}

export function getAvailableLanguages(): string[] {
  if (concepts.length === 0) return ["en"];
  return Object.keys(concepts[0].position);
}

// ── Helper: lacuna flag for all languages ─────────────────────
// lacuna in all except the listed languages
function lacunaExcept(...present: string[]): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const l of LANGUAGES) {
    result[l.code] = !present.includes(l.code);
  }
  return result;
}

// not a lacuna in any language
function noLacuna(): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const l of LANGUAGES) {
    result[l.code] = false;
  }
  return result;
}

export const concepts: Concept[] = [
  // ══════════════════════════════════════════════════════════════
  // === CORE ===
  // ══════════════════════════════════════════════════════════════
  {
    id: "reparations",
    labels: {
      en: "reparations", de: "Reparationen", fr: "réparations", es: "reparaciones",
      zh: "赔款", ko: "배상금", ar: "تعويضات", pt: "reparações", ru: "репарации", ja: "賠償金",
    },
    definitions: {
      en: "Financial payments imposed on a defeated nation as compensation for war damages and losses",
      de: "Finanzielle Zahlungen, die einer besiegten Nation als Entschädigung für Kriegsschäden auferlegt werden",
      fr: "Paiements financiers imposés à une nation vaincue en compensation des dommages de guerre",
      es: "Pagos financieros impuestos a una nación derrotada como compensación por daños de guerra",
      zh: "对战败国强制征收的经济赔偿，用于补偿战争损失",
      ko: "전쟁 피해 배상을 위해 패전국에 부과된 재정적 지불",
      ar: "مدفوعات مالية مفروضة على دولة مهزومة كتعويض عن أضرار الحرب",
      pt: "Pagamentos financeiros impostos a uma nação derrotada como compensação por danos de guerra",
      ru: "Финансовые платежи, наложенные на побеждённую страну в качестве компенсации за военный ущерб",
      ja: "戦争による損害の賠償として敗戦国に課された金銭的支払い",
    },
    cluster: "core",
    position: {
      en: [0, 0], de: [5, 8], fr: [-2, -3], es: [1, 2],
      zh: [8, -5], ko: [5, 3], ar: [10, 5], pt: [-1, -2],
      ru: [12, -8], ja: [3, -4],
    },
    weight: {
      en: 1.0, de: 1.0, fr: 1.0, es: 0.45,
      zh: 0.6, ko: 0.4, ar: 0.5, pt: 0.55,
      ru: 0.7, ja: 0.35,
    },
    lacuna: noLacuna(),
    source: "curated",
  },
  {
    id: "armistice",
    labels: {
      en: "armistice", de: "Waffenstillstand", fr: "armistice", es: "armisticio",
      zh: "停战协定", ko: "휴전", ar: "هدنة", pt: "armistício", ru: "перемирие", ja: "休戦協定",
    },
    definitions: {
      en: "A formal agreement to cease fighting, ending active hostilities before a peace treaty",
      de: "Ein formelles Abkommen zur Einstellung der Kampfhandlungen vor einem Friedensvertrag",
      fr: "Un accord formel de cessation des combats, mettant fin aux hostilités avant un traité de paix",
      es: "Un acuerdo formal para cesar los combates, poniendo fin a las hostilidades antes de un tratado de paz",
      zh: "在和平条约之前正式停止战斗的协议",
      ko: "평화 조약 이전에 전투를 중단하는 공식 협정",
      ar: "اتفاق رسمي لوقف القتال قبل معاهدة السلام",
      pt: "Um acordo formal para cessar os combates antes de um tratado de paz",
      ru: "Формальное соглашение о прекращении боевых действий до заключения мирного договора",
      ja: "講和条約に先立ち戦闘を停止する公式の協定",
    },
    cluster: "core",
    position: {
      en: [3, -5], de: [8, -3], fr: [1, -6], es: [4, -3],
      zh: [6, -8], ko: [3, -5], ar: [8, -2], pt: [2, -5],
      ru: [10, -6], ja: [5, -7],
    },
    weight: {
      en: 0.7, de: 0.65, fr: 0.75, es: 0.4,
      zh: 0.45, ko: 0.35, ar: 0.4, pt: 0.45,
      ru: 0.5, ja: 0.4,
    },
    lacuna: noLacuna(),
    source: "curated",
  },
  {
    id: "honor",
    labels: {
      en: "honor", de: "Ehre", fr: "honneur", es: "honor",
      zh: "荣誉", ko: "명예", ar: "شرف", pt: "honra", ru: "честь", ja: "名誉",
    },
    definitions: {
      en: "The reputation and moral standing of a nation in the eyes of the international community",
      de: "Der Ruf und die moralische Stellung einer Nation in den Augen der internationalen Gemeinschaft",
      fr: "La réputation et la position morale d'une nation aux yeux de la communauté internationale",
      es: "La reputación y la posición moral de una nación ante la comunidad internacional",
      zh: "一个国家在国际社会中的声誉和道德地位",
      ko: "국제사회에서 한 나라의 명성과 도덕적 위상",
      ar: "سمعة ومكانة أمة أخلاقياً في نظر المجتمع الدولي",
      pt: "A reputação e posição moral de uma nação perante a comunidade internacional",
      ru: "Репутация и моральное положение нации в глазах международного сообщества",
      ja: "国際社会における国家の名声と道徳的立場",
    },
    cluster: "core",
    position: {
      en: [-4, 3], de: [12, 15], fr: [-3, 5], es: [-2, 4],
      zh: [5, 10], ko: [8, 12], ar: [6, 8], pt: [-3, 4],
      ru: [2, 6], ja: [10, 14],
    },
    weight: {
      en: 0.6, de: 0.85, fr: 0.7, es: 0.4,
      zh: 0.65, ko: 0.7, ar: 0.6, pt: 0.45,
      ru: 0.3, ja: 0.75,
    },
    lacuna: noLacuna(),
    source: "curated",
  },
  {
    id: "treaty",
    labels: {
      en: "treaty", de: "Vertrag", fr: "traité", es: "tratado",
      zh: "条约", ko: "조약", ar: "معاهدة", pt: "tratado", ru: "договор", ja: "条約",
    },
    definitions: {
      en: "A formal agreement between nations establishing terms of peace and future relations",
      de: "Ein formelles Abkommen zwischen Nationen, das Friedensbedingungen und zukünftige Beziehungen festlegt",
      fr: "Un accord formel entre nations établissant les termes de la paix et des relations futures",
      es: "Un acuerdo formal entre naciones que establece los términos de paz y relaciones futuras",
      zh: "国家之间建立和平条件和未来关系的正式协议",
      ko: "평화 조건과 미래 관계를 수립하는 국가 간 공식 협정",
      ar: "اتفاق رسمي بين الدول يحدد شروط السلام والعلاقات المستقبلية",
      pt: "Um acordo formal entre nações estabelecendo termos de paz e relações futuras",
      ru: "Формальное соглашение между государствами, устанавливающее условия мира и будущих отношений",
      ja: "平和の条件と将来の関係を定める国家間の正式な協定",
    },
    cluster: "core",
    position: {
      en: [5, -3], de: [2, -6], fr: [4, -4], es: [6, -2],
      zh: [3, -10], ko: [4, -6], ar: [7, -5], pt: [5, -3],
      ru: [8, -9], ja: [6, -5],
    },
    weight: {
      en: 0.75, de: 0.7, fr: 0.8, es: 0.5,
      zh: 0.65, ko: 0.5, ar: 0.55, pt: 0.5,
      ru: 0.55, ja: 0.55,
    },
    lacuna: noLacuna(),
    source: "curated",
  },

  // ══════════════════════════════════════════════════════════════
  // === JUSTICE ===
  // ══════════════════════════════════════════════════════════════
  {
    id: "justice",
    labels: {
      en: "justice", de: "Gerechtigkeit", fr: "justice", es: "justicia",
      zh: "正义", ko: "정의", ar: "عدالة", pt: "justiça", ru: "справедливость", ja: "正義",
    },
    definitions: {
      en: "The principle that those who cause harm must be held accountable and make amends",
      de: "Das Prinzip, dass diejenigen, die Schaden verursachen, zur Rechenschaft gezogen werden müssen",
      fr: "Le principe que ceux qui causent du tort doivent rendre des comptes et réparer",
      es: "El principio de que quienes causan daño deben rendir cuentas",
      zh: "造成伤害者必须承担责任并作出补偿的原则",
      ko: "해를 끼친 자가 책임을 지고 보상해야 한다는 원칙",
      ar: "مبدأ محاسبة من يتسبب في الأذى وتعويض الضرر",
      pt: "O princípio de que aqueles que causam danos devem prestar contas",
      ru: "Принцип, что причинившие вред должны нести ответственность",
      ja: "害を与えた者は責任を負い償いをすべきという原則",
    },
    cluster: "justice",
    position: {
      en: [-10, -8], de: [-25, -20], fr: [-12, -10], es: [-8, -6],
      zh: [-5, -15], ko: [-7, -10], ar: [-6, -12], pt: [-9, -7],
      ru: [-15, -18], ja: [-10, -8],
    },
    weight: {
      en: 0.85, de: 0.4, fr: 0.9, es: 0.45,
      zh: 0.5, ko: 0.55, ar: 0.4, pt: 0.55,
      ru: 0.3, ja: 0.5,
    },
    lacuna: noLacuna(),
    source: "curated",
  },
  {
    id: "accountability",
    labels: {
      en: "accountability", de: "Verantwortlichkeit", fr: "responsabilité", es: "responsabilidad",
      zh: "问责", ko: "책임", ar: "مساءلة", pt: "responsabilidade", ru: "ответственность", ja: "責任",
    },
    definitions: {
      en: "The obligation to accept responsibility for one's actions and their consequences",
      de: "Die Pflicht, Verantwortung für das eigene Handeln und dessen Folgen zu übernehmen",
      fr: "L'obligation d'accepter la responsabilité de ses actes et de leurs conséquences",
      es: "La obligación de aceptar la responsabilidad de las propias acciones",
      zh: "为自己的行为及其后果承担责任的义务",
      ko: "자신의 행동과 결과에 대한 책임을 받아들이는 의무",
      ar: "الالتزام بتحمل المسؤولية عن الأفعال وعواقبها",
      pt: "A obrigação de aceitar responsabilidade por suas ações e consequências",
      ru: "Обязанность принять ответственность за свои действия и их последствия",
      ja: "自らの行動とその結果に対する責任を受け入れる義務",
    },
    cluster: "justice",
    position: {
      en: [-8, -5], de: [-20, -15], fr: [-10, -7], es: [-6, -4],
      zh: [-3, -12], ko: [-5, -8], ar: [-4, -10], pt: [-7, -5],
      ru: [-12, -14], ja: [-8, -6],
    },
    weight: {
      en: 0.75, de: 0.35, fr: 0.8, es: 0.4,
      zh: 0.45, ko: 0.4, ar: 0.35, pt: 0.5,
      ru: 0.25, ja: 0.45,
    },
    lacuna: noLacuna(),
    source: "curated",
  },
  {
    id: "punishment",
    labels: {
      en: "punishment", de: "Strafe", fr: "punition", es: "castigo",
      zh: "惩罚", ko: "처벌", ar: "عقاب", pt: "punição", ru: "наказание", ja: "処罰",
    },
    definitions: {
      en: "A penalty imposed on a wrongdoer as retribution for harmful actions",
      de: "Eine Strafe, die einem Übeltäter als Vergeltung für schädliche Handlungen auferlegt wird",
      fr: "Une pénalité imposée à un fautif en rétribution d'actions nuisibles",
      es: "Una penalidad impuesta como retribución por acciones dañinas",
      zh: "对作恶者施加的惩罚以报复其有害行为",
      ko: "해로운 행위에 대한 응보로 부과되는 형벌",
      ar: "عقوبة مفروضة على المخطئ كعقاب على أفعاله الضارة",
      pt: "Uma penalidade imposta como retribuição por ações prejudiciais",
      ru: "Наказание, наложенное на нарушителя в качестве возмездия за вредные действия",
      ja: "有害な行為に対する報いとして課される罰則",
    },
    cluster: "justice",
    position: {
      en: [-12, -3], de: [-30, -10], fr: [-14, -5], es: [-9, -2],
      zh: [-6, -8], ko: [-8, -5], ar: [-7, -6], pt: [-10, -3],
      ru: [-18, -12], ja: [-11, -4],
    },
    weight: {
      en: 0.8, de: 0.3, fr: 0.9, es: 0.4,
      zh: 0.45, ko: 0.4, ar: 0.35, pt: 0.5,
      ru: 0.35, ja: 0.4,
    },
    lacuna: noLacuna(),
    source: "curated",
  },
  {
    id: "debt",
    labels: {
      en: "debt", de: "Schulden", fr: "dette", es: "deuda",
      zh: "债务", ko: "부채", ar: "دين", pt: "dívida", ru: "долг", ja: "債務",
    },
    definitions: {
      en: "An obligation to repay what is owed, whether financial or moral",
      de: "Eine Verpflichtung zur Rückzahlung dessen, was geschuldet wird, ob finanziell oder moralisch",
      fr: "Une obligation de rembourser ce qui est dû, financier ou moral",
      es: "Una obligación de pagar lo que se debe, ya sea financiero o moral",
      zh: "偿还所欠之物的义务，无论是经济的还是道德的",
      ko: "재정적이든 도덕적이든 빚진 것을 갚아야 하는 의무",
      ar: "التزام بسداد ما هو مستحق سواء كان مالياً أو أخلاقياً",
      pt: "Uma obrigação de pagar o que é devido, financeiro ou moral",
      ru: "Обязательство вернуть то, что причитается, будь то финансовое или моральное",
      ja: "金銭的であれ道義的であれ、負っているものを返済する義務",
    },
    cluster: "justice",
    position: {
      en: [-5, -10], de: [-18, -25], fr: [-7, -12], es: [-4, -8],
      zh: [-2, -18], ko: [-4, -12], ar: [-3, -15], pt: [-5, -9],
      ru: [-10, -20], ja: [-6, -10],
    },
    weight: {
      en: 0.7, de: 0.4, fr: 0.75, es: 0.35,
      zh: 0.55, ko: 0.35, ar: 0.4, pt: 0.45,
      ru: 0.5, ja: 0.35,
    },
    lacuna: noLacuna(),
    source: "curated",
  },
  {
    id: "obligation",
    labels: {
      en: "obligation", de: "Pflicht", fr: "obligation", es: "obligación",
      zh: "义务", ko: "의무", ar: "التزام", pt: "obrigação", ru: "обязательство", ja: "義務",
    },
    definitions: {
      en: "A binding duty or commitment that must be fulfilled",
      de: "Eine verbindliche Pflicht oder Verpflichtung, die erfüllt werden muss",
      fr: "Un devoir contraignant ou un engagement qui doit être rempli",
      es: "Un deber vinculante o compromiso que debe cumplirse",
      zh: "必须履行的有约束力的责任或承诺",
      ko: "반드시 이행해야 하는 구속력 있는 의무",
      ar: "واجب ملزم أو التزام يجب الوفاء به",
      pt: "Um dever vinculativo ou compromisso que deve ser cumprido",
      ru: "Обязывающий долг или обязательство, которое должно быть выполнено",
      ja: "果たさなければならない拘束力のある義務",
    },
    cluster: "justice",
    position: {
      en: [-14, -6], de: [-35, -15], fr: [-16, -8], es: [-10, -5],
      zh: [-7, -14], ko: [-9, -9], ar: [-8, -11], pt: [-12, -6],
      ru: [-20, -16], ja: [-13, -7],
    },
    weight: {
      en: 0.9, de: 0.45, fr: 0.85, es: 0.4,
      zh: 0.5, ko: 0.45, ar: 0.4, pt: 0.5,
      ru: 0.3, ja: 0.5,
    },
    lacuna: noLacuna(),
    hero: true,
    source: "curated",
  },
  {
    id: "guilt",
    labels: {
      en: "guilt", de: "Schuld", fr: "culpabilité", es: "culpa",
      zh: "罪责", ko: "죄책감", ar: "ذنب", pt: "culpa", ru: "вина", ja: "罪悪感",
    },
    definitions: {
      en: "The state of having committed a wrong or offense against others",
      de: "Der Zustand, ein Unrecht oder Vergehen gegen andere begangen zu haben",
      fr: "L'état d'avoir commis un tort ou une offense envers autrui",
      es: "El estado de haber cometido un agravio contra otros",
      zh: "犯下了对他人的过错或冒犯的状态",
      ko: "타인에 대한 잘못이나 범죄를 저지른 상태",
      ar: "حالة ارتكاب خطأ أو إساءة ضد الآخرين",
      pt: "O estado de ter cometido um erro ou ofensa contra outros",
      ru: "Состояние совершения проступка или преступления против других",
      ja: "他者に対する過ちや罪を犯した状態",
    },
    cluster: "justice",
    position: {
      en: [-7, -12], de: [-15, -30], fr: [-9, -14], es: [-5, -9],
      zh: [-3, -20], ko: [-5, -14], ar: [-4, -16], pt: [-6, -10],
      ru: [-12, -22], ja: [-7, -11],
    },
    weight: {
      en: 0.85, de: 0.45, fr: 0.9, es: 0.35,
      zh: 0.4, ko: 0.35, ar: 0.3, pt: 0.5,
      ru: 0.4, ja: 0.4,
    },
    lacuna: noLacuna(),
    hero: true,
    source: "curated",
  },
  {
    id: "restitution",
    labels: {
      en: "restitution", de: "Wiedergutmachung", fr: "restitution", es: "restitución",
      zh: "归还", ko: "배상", ar: "استرداد", pt: "restituição", ru: "реституция", ja: "返還",
    },
    definitions: {
      en: "The act of restoring something to its rightful owner or compensating for loss",
      de: "Die Handlung der Wiederherstellung oder Entschädigung für einen Verlust",
      fr: "L'acte de restituer quelque chose à son propriétaire légitime ou de compenser une perte",
      es: "El acto de devolver algo a su legítimo dueño o compensar una pérdida",
      zh: "将某物归还其合法所有者或赔偿损失的行为",
      ko: "정당한 소유자에게 무언가를 되돌려주거나 손실을 보상하는 행위",
      ar: "فعل إعادة شيء لصاحبه الشرعي أو التعويض عن الخسارة",
      pt: "O ato de restituir algo ao seu legítimo proprietário ou compensar uma perda",
      ru: "Акт возвращения чего-либо законному владельцу или компенсации за потерю",
      ja: "正当な所有者に返還するか損失を補償する行為",
    },
    cluster: "justice",
    position: {
      en: [-6, -7], de: [-22, -18], fr: [-8, -9], es: [-5, -6],
      zh: [-2, -14], ko: [-4, -9], ar: [-3, -12], pt: [-6, -7],
      ru: [-14, -16], ja: [-6, -8],
    },
    weight: {
      en: 0.65, de: 0.3, fr: 0.7, es: 0.35,
      zh: 0.45, ko: 0.35, ar: 0.35, pt: 0.4,
      ru: 0.35, ja: 0.35,
    },
    lacuna: noLacuna(),
    source: "curated",
  },
  {
    id: "sanctions",
    labels: {
      en: "sanctions", de: "Sanktionen", fr: "sanctions", es: "sanciones",
      zh: "制裁", ko: "제재", ar: "عقوبات", pt: "sanções", ru: "санкции", ja: "制裁",
    },
    definitions: {
      en: "Punitive measures imposed on a nation to enforce compliance with international demands",
      de: "Strafmaßnahmen gegen eine Nation zur Durchsetzung internationaler Forderungen",
      fr: "Mesures punitives imposées à une nation pour faire respecter les exigences internationales",
      es: "Medidas punitivas impuestas a una nación para hacer cumplir las exigencias internacionales",
      zh: "为强制执行国际要求而对一国施加的惩罚措施",
      ko: "국제적 요구를 준수하도록 강제하기 위해 한 나라에 부과된 징벌적 조치",
      ar: "إجراءات عقابية مفروضة على دولة لفرض الامتثال للمطالب الدولية",
      pt: "Medidas punitivas impostas a uma nação para garantir conformidade com exigências internacionais",
      ru: "Карательные меры, наложенные на государство для обеспечения выполнения международных требований",
      ja: "国際的要求の遵守を強制するために国家に課される懲罰措置",
    },
    cluster: "justice",
    position: {
      en: [-11, -9], de: [-28, -22], fr: [-13, -11], es: [-8, -7],
      zh: [-5, -16], ko: [-7, -11], ar: [-6, -14], pt: [-9, -8],
      ru: [-16, -19], ja: [-10, -9],
    },
    weight: {
      en: 0.9, de: 0.4, fr: 0.85, es: 0.35,
      zh: 0.5, ko: 0.4, ar: 0.4, pt: 0.5,
      ru: 0.35, ja: 0.45,
    },
    lacuna: noLacuna(),
    hero: true,
    source: "curated",
  },
  {
    id: "concession",
    labels: {
      en: "concession", de: "Zugeständnis", fr: "concession", es: "concesión",
      zh: "让步", ko: "양보", ar: "تنازل", pt: "concessão", ru: "уступка", ja: "譲歩",
    },
    definitions: {
      en: "Territory or rights surrendered by a defeated nation as part of peace terms",
      de: "Gebiet oder Rechte, die von einer besiegten Nation als Teil der Friedensbedingungen abgetreten werden",
      fr: "Territoire ou droits cédés par une nation vaincue dans le cadre des termes de la paix",
      es: "Territorio o derechos cedidos por una nación derrotada como parte de las condiciones de paz",
      zh: "战败国作为和平条款的一部分而让出的领土或权利",
      ko: "평화 조건의 일부로 패전국이 양도한 영토나 권리",
      ar: "أراضٍ أو حقوق تنازلت عنها دولة مهزومة كجزء من شروط السلام",
      pt: "Território ou direitos cedidos por uma nação derrotada como parte dos termos de paz",
      ru: "Территория или права, отданные побеждённой нацией как часть условий мира",
      ja: "講和条件の一部として敗戦国が明け渡した領土や権利",
    },
    cluster: "justice",
    position: {
      en: [-9, -11], de: [-24, -28], fr: [-11, -13], es: [-7, -9],
      zh: [-4, -22], ko: [-6, -14], ar: [-5, -18], pt: [-8, -10],
      ru: [-14, -24], ja: [-9, -12],
    },
    weight: {
      en: 0.6, de: 0.35, fr: 0.65, es: 0.3,
      zh: 0.6, ko: 0.45, ar: 0.55, pt: 0.4,
      ru: 0.45, ja: 0.5,
    },
    lacuna: noLacuna(),
    source: "curated",
  },
  {
    id: "demilitarization",
    labels: {
      en: "demilitarization", de: "Entmilitarisierung", fr: "démilitarisation", es: "desmilitarización",
      zh: "非军事化", ko: "비무장화", ar: "نزع السلاح", pt: "desmilitarização", ru: "демилитаризация", ja: "非武装化",
    },
    definitions: {
      en: "The forced reduction or elimination of a nation's military capability",
      de: "Die erzwungene Reduzierung oder Beseitigung der militärischen Fähigkeiten einer Nation",
      fr: "La réduction forcée ou l'élimination des capacités militaires d'une nation",
      es: "La reducción forzada o eliminación de la capacidad militar de una nación",
      zh: "强制削减或消除一国军事能力",
      ko: "한 나라의 군사 능력을 강제로 축소하거나 제거하는 것",
      ar: "التخفيض القسري أو إزالة القدرة العسكرية لدولة",
      pt: "A redução forçada ou eliminação da capacidade militar de uma nação",
      ru: "Принудительное сокращение или ликвидация военного потенциала государства",
      ja: "国家の軍事能力の強制的な削減または排除",
    },
    cluster: "justice",
    position: {
      en: [-13, -4], de: [-32, -12], fr: [-15, -6], es: [-10, -3],
      zh: [-6, -10], ko: [-8, -6], ar: [-7, -8], pt: [-11, -4],
      ru: [-18, -14], ja: [-12, -5],
    },
    weight: {
      en: 0.7, de: 0.3, fr: 0.8, es: 0.35,
      zh: 0.4, ko: 0.35, ar: 0.4, pt: 0.45,
      ru: 0.4, ja: 0.45,
    },
    lacuna: noLacuna(),
    source: "curated",
  },

  // ══════════════════════════════════════════════════════════════
  // === VICTORY ===
  // ══════════════════════════════════════════════════════════════
  {
    id: "victory",
    labels: {
      en: "victory", de: "Sieg", fr: "victoire", es: "victoria",
      zh: "胜利", ko: "승리", ar: "نصر", pt: "vitória", ru: "победа", ja: "勝利",
    },
    definitions: {
      en: "The successful conclusion of a military conflict through defeating the enemy",
      de: "Der erfolgreiche Abschluss eines militärischen Konflikts durch Besiegung des Feindes",
      fr: "La conclusion réussie d'un conflit militaire par la défaite de l'ennemi",
      es: "La conclusión exitosa de un conflicto militar mediante la derrota del enemigo",
      zh: "通过击败敌人成功结束军事冲突",
      ko: "적을 격파하여 군사 충돌을 성공적으로 종결하는 것",
      ar: "الانتهاء الناجح من نزاع عسكري بهزيمة العدو",
      pt: "A conclusão bem-sucedida de um conflito militar pela derrota do inimigo",
      ru: "Успешное завершение военного конфликта путём разгрома противника",
      ja: "敵を打ち破って軍事紛争を成功裏に終結させること",
    },
    cluster: "victory",
    position: {
      en: [15, -10], de: [-35, 18], fr: [18, -12], es: [10, -6],
      zh: [-20, 10], ko: [-15, 5], ar: [-25, 12], pt: [12, -8],
      ru: [-30, 14], ja: [8, -10],
    },
    weight: {
      en: 0.85, de: 0.2, fr: 0.9, es: 0.35,
      zh: 0.15, ko: 0.15, ar: 0.1, pt: 0.55,
      ru: 0.1, ja: 0.6,
    },
    lacuna: noLacuna(),
    source: "curated",
  },
  {
    id: "peace",
    labels: {
      en: "peace", de: "Frieden", fr: "paix", es: "paz",
      zh: "和平", ko: "평화", ar: "سلام", pt: "paz", ru: "мир", ja: "平和",
    },
    definitions: {
      en: "The cessation of armed conflict and establishment of stable relations between nations",
      de: "Die Beendigung bewaffneter Konflikte und Herstellung stabiler Beziehungen zwischen Nationen",
      fr: "La cessation du conflit armé et l'établissement de relations stables entre nations",
      es: "El cese del conflicto armado y el establecimiento de relaciones estables entre naciones",
      zh: "武装冲突的停止和国家间稳定关系的建立",
      ko: "무력 충돌의 중단과 국가 간 안정적 관계의 수립",
      ar: "وقف النزاع المسلح وإقامة علاقات مستقرة بين الدول",
      pt: "A cessação do conflito armado e o estabelecimento de relações estáveis entre nações",
      ru: "Прекращение вооружённого конфликта и установление стабильных отношений между государствами",
      ja: "武力紛争の停止と国家間の安定した関係の構築",
    },
    cluster: "victory",
    position: {
      en: [18, -5], de: [-38, 22], fr: [20, -7], es: [14, -4],
      zh: [-18, 14], ko: [-12, 8], ar: [-22, 16], pt: [15, -5],
      ru: [-28, 18], ja: [12, -6],
    },
    weight: {
      en: 0.8, de: 0.15, fr: 0.75, es: 0.5,
      zh: 0.35, ko: 0.4, ar: 0.3, pt: 0.5,
      ru: 0.15, ja: 0.5,
    },
    lacuna: noLacuna(),
    source: "curated",
  },
  {
    id: "order",
    labels: {
      en: "order", de: "Ordnung", fr: "ordre", es: "orden",
      zh: "秩序", ko: "질서", ar: "نظام", pt: "ordem", ru: "порядок", ja: "秩序",
    },
    definitions: {
      en: "A stable arrangement of power and governance that prevents future conflict",
      de: "Eine stabile Ordnung von Macht und Regierung, die zukünftige Konflikte verhindert",
      fr: "Un arrangement stable de pouvoir et de gouvernance qui prévient les conflits futurs",
      es: "Un arreglo estable de poder y gobernanza que previene conflictos futuros",
      zh: "防止未来冲突的稳定权力和治理安排",
      ko: "미래의 갈등을 방지하는 안정된 권력과 통치의 배치",
      ar: "ترتيب مستقر للسلطة والحكم يمنع النزاعات المستقبلية",
      pt: "Um arranjo estável de poder e governança que previne conflitos futuros",
      ru: "Стабильное устройство власти и управления, предотвращающее будущие конфликты",
      ja: "将来の紛争を防ぐ安定した権力と統治の仕組み",
    },
    cluster: "victory",
    position: {
      en: [12, -16], de: [-40, 15], fr: [15, -18], es: [8, -12],
      zh: [-22, 8], ko: [-18, 3], ar: [-28, 10], pt: [10, -14],
      ru: [-35, 12], ja: [14, -15],
    },
    weight: {
      en: 0.7, de: 0.25, fr: 0.75, es: 0.4,
      zh: 0.3, ko: 0.3, ar: 0.2, pt: 0.45,
      ru: 0.15, ja: 0.6,
    },
    lacuna: noLacuna(),
    source: "curated",
  },
  {
    id: "triumph",
    labels: {
      en: "triumph", de: "Triumph", fr: "triomphe", es: "triunfo",
      zh: "凯旋", ko: "개선", ar: "انتصار", pt: "triunfo", ru: "триумф", ja: "凱旋",
    },
    definitions: {
      en: "A great achievement or success, especially in overcoming an adversary",
      de: "Ein großer Erfolg, besonders in der Überwindung eines Gegners",
      fr: "Un grand exploit ou succès, surtout dans la victoire sur un adversaire",
      es: "Un gran logro o éxito, especialmente al vencer a un adversario",
      zh: "一项伟大的成就或成功，尤其是在战胜对手方面",
      ko: "특히 적을 이기는 데 있어서의 위대한 성취나 성공",
      ar: "إنجاز عظيم أو نجاح خاصة في التغلب على خصم",
      pt: "Uma grande conquista ou sucesso, especialmente ao superar um adversário",
      ru: "Великое достижение или успех, особенно в победе над противником",
      ja: "特に敵を打ち負かすことにおける偉大な達成や成功",
    },
    cluster: "victory",
    position: {
      en: [20, -8], de: [-36, 25], fr: [22, -10], es: [12, -5],
      zh: [-24, 12], ko: [-16, 6], ar: [-30, 14], pt: [16, -7],
      ru: [-32, 20], ja: [10, -9],
    },
    weight: {
      en: 0.85, de: 0.2, fr: 0.85, es: 0.3,
      zh: 0.1, ko: 0.1, ar: 0.1, pt: 0.5,
      ru: 0.1, ja: 0.45,
    },
    lacuna: noLacuna(),
    hero: true,
    source: "curated",
  },
  {
    id: "sovereignty",
    labels: {
      en: "sovereignty", de: "Souveränität", fr: "souveraineté", es: "soberanía",
      zh: "主权", ko: "주권", ar: "سيادة", pt: "soberania", ru: "суверенитет", ja: "主権",
    },
    definitions: {
      en: "The supreme authority of a state to govern itself without external interference",
      de: "Die höchste Autorität eines Staates, sich ohne äußere Einmischung selbst zu regieren",
      fr: "L'autorité suprême d'un État de se gouverner sans ingérence extérieure",
      es: "La autoridad suprema de un estado para gobernarse sin interferencia externa",
      zh: "国家不受外来干涉、自主治理的最高权力",
      ko: "외부 간섭 없이 스스로를 통치하는 국가의 최고 권한",
      ar: "السلطة العليا للدولة في حكم نفسها دون تدخل خارجي",
      pt: "A autoridade suprema de um estado para se governar sem interferência externa",
      ru: "Верховная власть государства управлять собой без внешнего вмешательства",
      ja: "外部の干渉なく自国を統治する国家の最高権威",
    },
    cluster: "victory",
    position: {
      en: [14, -14], de: [-33, 20], fr: [16, -16], es: [9, -10],
      zh: [-15, 18], ko: [-10, 15], ar: [-20, 20], pt: [11, -12],
      ru: [-25, 16], ja: [15, -13],
    },
    weight: {
      en: 0.7, de: 0.25, fr: 0.65, es: 0.4,
      zh: 0.85, ko: 0.9, ar: 0.85, pt: 0.45,
      ru: 0.4, ja: 0.7,
    },
    lacuna: noLacuna(),
    source: "curated",
  },
  {
    id: "selfdetermination",
    labels: {
      en: "self-determination", de: "Selbstbestimmung", fr: "autodétermination", es: "autodeterminación",
      zh: "民族自决", ko: "민족자결", ar: "تقرير المصير", pt: "autodeterminação", ru: "самоопределение", ja: "民族自決",
    },
    definitions: {
      en: "The right of peoples to determine their own political status and form of government",
      de: "Das Recht der Völker, ihren eigenen politischen Status und ihre Regierungsform zu bestimmen",
      fr: "Le droit des peuples à déterminer leur propre statut politique et forme de gouvernement",
      es: "El derecho de los pueblos a determinar su propio estatus político y forma de gobierno",
      zh: "人民决定自己政治地位和政府形式的权利",
      ko: "국민이 자신의 정치적 지위와 정부 형태를 결정할 권리",
      ar: "حق الشعوب في تقرير مركزها السياسي وشكل حكومتها",
      pt: "O direito dos povos de determinar seu próprio status político e forma de governo",
      ru: "Право народов определять свой политический статус и форму правления",
      ja: "人民が自らの政治的地位と政府の形態を決定する権利",
    },
    cluster: "victory",
    position: {
      en: [16, -12], de: [-37, 16], fr: [18, -14], es: [11, -8],
      zh: [-12, 20], ko: [-8, 18], ar: [-18, 22], pt: [13, -10],
      ru: [-22, 15], ja: [12, -12],
    },
    weight: {
      en: 0.65, de: 0.2, fr: 0.6, es: 0.4,
      zh: 0.85, ko: 0.95, ar: 0.9, pt: 0.4,
      ru: 0.5, ja: 0.55,
    },
    lacuna: noLacuna(),
    source: "curated",
  },
  {
    id: "legitimacy",
    labels: {
      en: "legitimacy", de: "Legitimität", fr: "légitimité", es: "legitimidad",
      zh: "合法性", ko: "정당성", ar: "شرعية", pt: "legitimidade", ru: "легитимность", ja: "正統性",
    },
    definitions: {
      en: "The rightful authority to exercise power, recognized by other nations",
      de: "Die rechtmäßige Autorität zur Ausübung von Macht, anerkannt von anderen Nationen",
      fr: "L'autorité légitime d'exercer le pouvoir, reconnue par les autres nations",
      es: "La autoridad legítima para ejercer el poder, reconocida por otras naciones",
      zh: "被其他国家承认的行使权力的合法权威",
      ko: "다른 나라들이 인정하는 권력 행사의 정당한 권한",
      ar: "السلطة المشروعة لممارسة الحكم المعترف بها من الدول الأخرى",
      pt: "A autoridade legítima para exercer o poder, reconhecida por outras nações",
      ru: "Законная власть осуществлять управление, признанная другими государствами",
      ja: "他国に認められた権力を行使する正当な権威",
    },
    cluster: "victory",
    position: {
      en: [13, -7], de: [-34, 19], fr: [15, -9], es: [9, -5],
      zh: [-16, 14], ko: [-12, 10], ar: [-22, 18], pt: [10, -6],
      ru: [-28, 13], ja: [13, -8],
    },
    weight: {
      en: 0.6, de: 0.2, fr: 0.65, es: 0.35,
      zh: 0.45, ko: 0.4, ar: 0.35, pt: 0.4,
      ru: 0.15, ja: 0.6,
    },
    lacuna: noLacuna(),
    source: "curated",
  },
  {
    id: "diplomacy",
    labels: {
      en: "diplomacy", de: "Diplomatie", fr: "diplomatie", es: "diplomacia",
      zh: "外交", ko: "외교", ar: "دبلوماسية", pt: "diplomacia", ru: "дипломатия", ja: "外交",
    },
    definitions: {
      en: "The conduct of negotiations between nations to resolve disputes and establish agreements",
      de: "Die Führung von Verhandlungen zwischen Nationen zur Beilegung von Streitigkeiten",
      fr: "La conduite de négociations entre nations pour résoudre les différends et établir des accords",
      es: "La conducción de negociaciones entre naciones para resolver disputas",
      zh: "国家之间为解决争端和达成协议而进行的谈判",
      ko: "분쟁을 해결하고 협정을 수립하기 위한 국가 간 협상의 수행",
      ar: "إجراء المفاوضات بين الدول لحل النزاعات وإبرام الاتفاقات",
      pt: "A condução de negociações entre nações para resolver disputas e estabelecer acordos",
      ru: "Ведение переговоров между государствами для урегулирования споров и заключения соглашений",
      ja: "紛争を解決し協定を結ぶための国家間交渉の遂行",
    },
    cluster: "victory",
    position: {
      en: [17, -15], de: [-39, 17], fr: [19, -17], es: [12, -11],
      zh: [-20, 10], ko: [-14, 7], ar: [-26, 15], pt: [14, -13],
      ru: [-32, 11], ja: [16, -14],
    },
    weight: {
      en: 0.65, de: 0.15, fr: 0.7, es: 0.4,
      zh: 0.35, ko: 0.3, ar: 0.25, pt: 0.4,
      ru: 0.1, ja: 0.55,
    },
    lacuna: noLacuna(),
    source: "curated",
  },
  {
    id: "reconstruction",
    labels: {
      en: "reconstruction", de: "Wiederaufbau", fr: "reconstruction", es: "reconstrucción",
      zh: "重建", ko: "재건", ar: "إعادة بناء", pt: "reconstrução", ru: "реконструкция", ja: "復興",
    },
    definitions: {
      en: "The process of rebuilding a nation's infrastructure and institutions after war",
      de: "Der Prozess des Wiederaufbaus der Infrastruktur und Institutionen einer Nation nach dem Krieg",
      fr: "Le processus de reconstruction des infrastructures et des institutions d'une nation après la guerre",
      es: "El proceso de reconstrucción de la infraestructura e instituciones de una nación después de la guerra",
      zh: "战后重建国家基础设施和制度的过程",
      ko: "전쟁 후 국가의 기반 시설과 제도를 재건하는 과정",
      ar: "عملية إعادة بناء البنية التحتية والمؤسسات لدولة بعد الحرب",
      pt: "O processo de reconstrução da infraestrutura e instituições de uma nação após a guerra",
      ru: "Процесс восстановления инфраструктуры и институтов государства после войны",
      ja: "戦後の国家のインフラと制度の再建過程",
    },
    cluster: "victory",
    position: {
      en: [19, -6], de: [-36, 21], fr: [21, -8], es: [13, -4],
      zh: [-14, 16], ko: [-10, 12], ar: [-20, 18], pt: [16, -5],
      ru: [-26, 17], ja: [14, -7],
    },
    weight: {
      en: 0.6, de: 0.15, fr: 0.65, es: 0.35,
      zh: 0.3, ko: 0.3, ar: 0.25, pt: 0.4,
      ru: 0.2, ja: 0.4,
    },
    lacuna: noLacuna(),
    source: "curated",
  },

  // ══════════════════════════════════════════════════════════════
  // === HUMILIATION ===
  // ══════════════════════════════════════════════════════════════
  {
    id: "humiliation",
    labels: {
      en: "humiliation", de: "Demütigung", fr: "humiliation", es: "humillación",
      zh: "屈辱", ko: "굴욕", ar: "إذلال", pt: "humilhação", ru: "унижение", ja: "屈辱",
    },
    definitions: {
      en: "The act of causing someone to feel deeply ashamed or degraded",
      de: "Die Handlung, jemanden tief zu beschämen oder zu erniedrigen",
      fr: "L'acte de causer à quelqu'un un sentiment profond de honte ou de dégradation",
      es: "El acto de causar a alguien un sentimiento profundo de vergüenza o degradación",
      zh: "使人感到深深羞耻或被贬低的行为",
      ko: "누군가에게 깊은 수치감이나 모멸감을 느끼게 하는 행위",
      ar: "فعل التسبب لشخص بالشعور بالعار العميق أو الإهانة",
      pt: "O ato de causar a alguém um sentimento profundo de vergonha ou degradação",
      ru: "Действие, вызывающее у человека глубокое чувство стыда или унижения",
      ja: "人に深い恥辱や屈辱を感じさせる行為",
    },
    cluster: "humiliation",
    position: {
      en: [30, 22], de: [-2, 10], fr: [28, 20], es: [22, 15],
      zh: [5, 25], ko: [8, 22], ar: [10, 28], pt: [25, 18],
      ru: [15, 20], ja: [20, 16],
    },
    weight: {
      en: 0.15, de: 0.9, fr: 0.1, es: 0.3,
      zh: 0.85, ko: 0.8, ar: 0.85, pt: 0.2,
      ru: 0.6, ja: 0.3,
    },
    lacuna: noLacuna(),
    source: "curated",
  },
  {
    id: "betrayal",
    labels: {
      en: "betrayal", de: "Verrat", fr: "trahison", es: "traición",
      zh: "背叛", ko: "배신", ar: "خيانة", pt: "traição", ru: "предательство", ja: "裏切り",
    },
    definitions: {
      en: "The violation of trust or allegiance by those who were supposed to be allies",
      de: "Der Vertrauensbruch durch diejenigen, die Verbündete hätten sein sollen",
      fr: "La violation de la confiance par ceux qui étaient censés être des alliés",
      es: "La violación de la confianza por parte de quienes se suponía eran aliados",
      zh: "本应是盟友的人对信任或忠诚的背叛",
      ko: "동맹이어야 할 자들에 의한 신뢰나 충성의 배반",
      ar: "انتهاك الثقة من قبل من كان يفترض أنهم حلفاء",
      pt: "A violação da confiança por aqueles que deveriam ser aliados",
      ru: "Нарушение доверия теми, кто должен был быть союзником",
      ja: "同盟であるはずの者による信頼や忠誠の裏切り",
    },
    cluster: "humiliation",
    position: {
      en: [28, 25], de: [5, 15], fr: [26, 22], es: [20, 18],
      zh: [2, 28], ko: [6, 25], ar: [8, 30], pt: [23, 20],
      ru: [12, 22], ja: [18, 18],
    },
    weight: {
      en: 0.1, de: 0.95, fr: 0.1, es: 0.25,
      zh: 0.9, ko: 0.75, ar: 0.9, pt: 0.15,
      ru: 0.7, ja: 0.4,
    },
    lacuna: noLacuna(),
    hero: true,
    source: "curated",
  },
  {
    id: "injustice",
    labels: {
      en: "injustice", de: "Ungerechtigkeit", fr: "injustice", es: "injusticia",
      zh: "不公", ko: "불의", ar: "ظلم", pt: "injustiça", ru: "несправедливость", ja: "不正義",
    },
    definitions: {
      en: "An unfair or unjust act that violates principles of fairness and equity",
      de: "Eine unfaire Handlung, die Grundsätze der Gerechtigkeit und Gleichheit verletzt",
      fr: "Un acte injuste qui viole les principes d'équité et de justice",
      es: "Un acto injusto que viola los principios de equidad y justicia",
      zh: "违反公平和公正原则的不公正行为",
      ko: "공정성과 형평의 원칙을 위반하는 부당한 행위",
      ar: "فعل غير عادل ينتهك مبادئ الإنصاف والمساواة",
      pt: "Um ato injusto que viola princípios de justiça e equidade",
      ru: "Несправедливый поступок, нарушающий принципы справедливости и равенства",
      ja: "公正と平等の原則に反する不当な行為",
    },
    cluster: "humiliation",
    position: {
      en: [35, 20], de: [-8, 6], fr: [32, 18], es: [25, 14],
      zh: [8, 22], ko: [10, 20], ar: [12, 26], pt: [28, 16],
      ru: [18, 18], ja: [22, 14],
    },
    weight: {
      en: 0.2, de: 0.85, fr: 0.15, es: 0.35,
      zh: 0.85, ko: 0.75, ar: 0.85, pt: 0.25,
      ru: 0.75, ja: 0.35,
    },
    lacuna: noLacuna(),
    source: "curated",
  },
  {
    id: "revenge",
    labels: {
      en: "revenge", de: "Rache", fr: "vengeance", es: "venganza",
      zh: "复仇", ko: "복수", ar: "انتقام", pt: "vingança", ru: "месть", ja: "復讐",
    },
    definitions: {
      en: "Retaliation against those who have caused harm, seeking to inflict equivalent suffering",
      de: "Vergeltung gegen diejenigen, die Schaden verursacht haben, um gleichwertiges Leid zuzufügen",
      fr: "Représailles contre ceux qui ont causé du tort, cherchant à infliger une souffrance équivalente",
      es: "Represalias contra quienes han causado daño, buscando infligir un sufrimiento equivalente",
      zh: "对造成伤害者的报复，寻求施加同等的痛苦",
      ko: "해를 끼친 자에 대한 보복으로 동등한 고통을 가하려는 것",
      ar: "الانتقام ممن تسببوا في الأذى بإلحاق معاناة مماثلة",
      pt: "Retaliação contra aqueles que causaram dano, buscando infligir sofrimento equivalente",
      ru: "Возмездие тем, кто причинил вред, стремление причинить равноценные страдания",
      ja: "害を与えた者への報復、同等の苦痛を与えようとすること",
    },
    cluster: "humiliation",
    position: {
      en: [38, 30], de: [12, 20], fr: [35, 28], es: [28, 22],
      zh: [14, 30], ko: [16, 26], ar: [18, 32], pt: [30, 24],
      ru: [22, 25], ja: [25, 20],
    },
    weight: {
      en: 0.15, de: 0.9, fr: 0.2, es: 0.3,
      zh: 0.7, ko: 0.5, ar: 0.65, pt: 0.2,
      ru: 0.65, ja: 0.25,
    },
    lacuna: noLacuna(),
    hero: true,
    source: "curated",
  },
  {
    id: "resentment",
    labels: {
      en: "resentment", de: "Groll", fr: "ressentiment", es: "resentimiento",
      zh: "怨恨", ko: "원한", ar: "استياء", pt: "ressentimento", ru: "обида", ja: "怨恨",
    },
    definitions: {
      en: "Deep-seated anger and bitterness resulting from perceived unfair treatment",
      de: "Tief verwurzelter Zorn und Verbitterung aufgrund wahrgenommener ungerechter Behandlung",
      fr: "Colère et amertume profondes résultant d'un traitement perçu comme injuste",
      es: "Ira y amargura profundas resultantes de un trato percibido como injusto",
      zh: "因感受到不公正待遇而产生的深深的愤怒和痛苦",
      ko: "부당한 대우로 인한 깊은 분노와 쓴라림",
      ar: "غضب عميق ومرارة ناتجة عن معاملة غير عادلة",
      pt: "Raiva e amargura profundas resultantes de tratamento percebido como injusto",
      ru: "Глубоко укоренившийся гнев и горечь от воспринимаемого несправедливого обращения",
      ja: "不当な扱いに起因する根深い怒りと苦々しさ",
    },
    cluster: "humiliation",
    position: {
      en: [32, 28], de: [0, 18], fr: [30, 25], es: [24, 20],
      zh: [6, 26], ko: [8, 24], ar: [10, 30], pt: [27, 22],
      ru: [16, 22], ja: [21, 18],
    },
    weight: {
      en: 0.1, de: 0.85, fr: 0.1, es: 0.25,
      zh: 0.8, ko: 0.7, ar: 0.75, pt: 0.15,
      ru: 0.7, ja: 0.3,
    },
    lacuna: noLacuna(),
    source: "curated",
  },
  {
    id: "subjugation",
    labels: {
      en: "subjugation", de: "Unterwerfung", fr: "assujettissement", es: "subyugación",
      zh: "征服", ko: "종속", ar: "إخضاع", pt: "subjugação", ru: "подчинение", ja: "征服",
    },
    definitions: {
      en: "The forceful domination and control of a people or nation by another power",
      de: "Die gewaltsame Unterwerfung und Kontrolle eines Volkes oder einer Nation durch eine andere Macht",
      fr: "La domination et le contrôle forcé d'un peuple ou d'une nation par une autre puissance",
      es: "La dominación y control forzoso de un pueblo o nación por otra potencia",
      zh: "一个国家对另一个民族或国家的强制统治和控制",
      ko: "한 민족이나 국가를 다른 세력이 강제로 지배하고 통제하는 것",
      ar: "السيطرة القسرية على شعب أو أمة من قبل قوة أخرى",
      pt: "A dominação forçada e controle de um povo ou nação por outra potência",
      ru: "Насильственное подчинение и контроль народа или нации другой силой",
      ja: "他の勢力による民族や国家の強制的な支配と統制",
    },
    cluster: "humiliation",
    position: {
      en: [33, 35], de: [8, 25], fr: [30, 32], es: [25, 28],
      zh: [10, 32], ko: [12, 30], ar: [14, 35], pt: [28, 28],
      ru: [20, 28], ja: [22, 24],
    },
    weight: {
      en: 0.2, de: 0.8, fr: 0.15, es: 0.3,
      zh: 0.75, ko: 0.85, ar: 0.9, pt: 0.2,
      ru: 0.6, ja: 0.35,
    },
    lacuna: noLacuna(),
    source: "curated",
  },
  {
    id: "occupation",
    labels: {
      en: "occupation", de: "Besatzung", fr: "occupation", es: "ocupación",
      zh: "占领", ko: "점령", ar: "احتلال", pt: "ocupação", ru: "оккупация", ja: "占領",
    },
    definitions: {
      en: "The military control of a defeated nation's territory by foreign forces",
      de: "Die militärische Kontrolle des Territoriums einer besiegten Nation durch fremde Streitkräfte",
      fr: "Le contrôle militaire du territoire d'une nation vaincue par des forces étrangères",
      es: "El control militar del territorio de una nación derrotada por fuerzas extranjeras",
      zh: "外国军队对战败国领土的军事控制",
      ko: "외국 군대에 의한 패전국 영토의 군사적 통제",
      ar: "السيطرة العسكرية لقوات أجنبية على أراضي دولة مهزومة",
      pt: "O controle militar do território de uma nação derrotada por forças estrangeiras",
      ru: "Военный контроль территории побеждённого государства иностранными силами",
      ja: "外国軍による敗戦国の領土の軍事的支配",
    },
    cluster: "humiliation",
    position: {
      en: [36, 24], de: [-5, 12], fr: [33, 22], es: [26, 16],
      zh: [12, 24], ko: [14, 22], ar: [16, 28], pt: [30, 20],
      ru: [20, 20], ja: [24, 16],
    },
    weight: {
      en: 0.15, de: 0.8, fr: 0.2, es: 0.25,
      zh: 0.7, ko: 0.85, ar: 0.9, pt: 0.2,
      ru: 0.5, ja: 0.5,
    },
    lacuna: noLacuna(),
    source: "curated",
  },
  {
    id: "propaganda",
    labels: {
      en: "propaganda", de: "Propaganda", fr: "propagande", es: "propaganda",
      zh: "宣传", ko: "선전", ar: "دعاية", pt: "propaganda", ru: "пропаганда", ja: "プロパガンダ",
    },
    definitions: {
      en: "The systematic dissemination of information to promote a political cause or damage an opponent",
      de: "Die systematische Verbreitung von Informationen zur Förderung einer politischen Sache oder Schädigung eines Gegners",
      fr: "La diffusion systématique d'informations pour promouvoir une cause politique ou nuire à un adversaire",
      es: "La diseminación sistemática de información para promover una causa política o dañar a un oponente",
      zh: "为推进政治目标或损害对手而系统性传播信息",
      ko: "정치적 목적을 위해 또는 상대를 해치기 위해 체계적으로 정보를 유포하는 것",
      ar: "النشر المنهجي للمعلومات لتعزيز قضية سياسية أو الإضرار بالخصم",
      pt: "A disseminação sistemática de informações para promover uma causa política ou prejudicar um oponente",
      ru: "Систематическое распространение информации для продвижения политической цели или дискредитации противника",
      ja: "政治的目的の推進や敵対者への打撃のための組織的な情報発信",
    },
    cluster: "humiliation",
    position: {
      en: [34, 32], de: [3, 22], fr: [31, 28], es: [26, 24],
      zh: [8, 28], ko: [10, 26], ar: [12, 32], pt: [28, 26],
      ru: [18, 26], ja: [23, 22],
    },
    weight: {
      en: 0.15, de: 0.75, fr: 0.15, es: 0.25,
      zh: 0.6, ko: 0.55, ar: 0.6, pt: 0.15,
      ru: 0.8, ja: 0.4,
    },
    lacuna: noLacuna(),
    source: "curated",
  },
  {
    id: "nationalism",
    labels: {
      en: "nationalism", de: "Nationalismus", fr: "nationalisme", es: "nacionalismo",
      zh: "民族主义", ko: "민족주의", ar: "قومية", pt: "nacionalismo", ru: "национализм", ja: "ナショナリズム",
    },
    definitions: {
      en: "Strong identification with one's nation, often including the belief in its superiority",
      de: "Starke Identifikation mit der eigenen Nation, oft einschließlich des Glaubens an deren Überlegenheit",
      fr: "Forte identification à sa nation, incluant souvent la croyance en sa supériorité",
      es: "Fuerte identificación con la propia nación, incluyendo a menudo la creencia en su superioridad",
      zh: "对自己国家的强烈认同，常包括对其优越性的信念",
      ko: "자국에 대한 강한 동일시, 종종 우월성에 대한 믿음을 포함",
      ar: "تماهٍ قوي مع الأمة غالباً ما يتضمن الإيمان بتفوقها",
      pt: "Forte identificação com a própria nação, frequentemente incluindo a crença em sua superioridade",
      ru: "Сильная идентификация со своей нацией, часто включающая веру в её превосходство",
      ja: "自国への強い帰属意識、しばしばその優越性への信念を含む",
    },
    cluster: "humiliation",
    position: {
      en: [31, 26], de: [1, 16], fr: [28, 24], es: [23, 18],
      zh: [4, 24], ko: [6, 22], ar: [8, 28], pt: [26, 20],
      ru: [14, 24], ja: [20, 20],
    },
    weight: {
      en: 0.1, de: 0.85, fr: 0.15, es: 0.3,
      zh: 0.8, ko: 0.75, ar: 0.7, pt: 0.15,
      ru: 0.65, ja: 0.6,
    },
    lacuna: noLacuna(),
    source: "curated",
  },
  {
    id: "starvation",
    labels: {
      en: "starvation", de: "Hungersnot", fr: "famine", es: "hambruna",
      zh: "饥荒", ko: "기아", ar: "مجاعة", pt: "fome", ru: "голод", ja: "飢餓",
    },
    definitions: {
      en: "The deliberate deprivation of food supplies as a weapon of war or coercion",
      de: "Der absichtliche Entzug von Nahrungsmitteln als Kriegswaffe oder Zwangsmittel",
      fr: "La privation délibérée de nourriture comme arme de guerre ou de coercition",
      es: "La privación deliberada de alimentos como arma de guerra o coerción",
      zh: "故意剥夺食物供应作为战争武器或胁迫手段",
      ko: "전쟁 무기나 강압 수단으로서의 식량 공급의 고의적 박탈",
      ar: "الحرمان المتعمد من إمدادات الغذاء كسلاح حرب أو إكراه",
      pt: "A privação deliberada de suprimentos alimentares como arma de guerra ou coerção",
      ru: "Преднамеренное лишение продовольствия как оружие войны или принуждения",
      ja: "戦争の武器や強制手段としての食料供給の意図的な剥奪",
    },
    cluster: "humiliation",
    position: {
      en: [37, 33], de: [10, 24], fr: [34, 30], es: [28, 26],
      zh: [14, 32], ko: [16, 28], ar: [18, 34], pt: [30, 28],
      ru: [24, 28], ja: [26, 24],
    },
    weight: {
      en: 0.1, de: 0.8, fr: 0.1, es: 0.2,
      zh: 0.5, ko: 0.45, ar: 0.55, pt: 0.15,
      ru: 0.6, ja: 0.2,
    },
    lacuna: noLacuna(),
    source: "curated",
  },
  {
    id: "blockade",
    labels: {
      en: "blockade", de: "Blockade", fr: "blocus", es: "bloqueo",
      zh: "封锁", ko: "봉쇄", ar: "حصار", pt: "bloqueio", ru: "блокада", ja: "封鎖",
    },
    definitions: {
      en: "The naval prevention of goods reaching a nation, causing economic and humanitarian crisis",
      de: "Die Seeblockade zur Verhinderung von Warenlieferungen an eine Nation, die wirtschaftliche und humanitäre Krisen verursacht",
      fr: "L'empêchement naval de l'acheminement de marchandises, causant une crise économique et humanitaire",
      es: "La prevención naval de que bienes lleguen a una nación, causando crisis económica y humanitaria",
      zh: "通过海军阻止货物到达一国，造成经济和人道主义危机",
      ko: "물자가 한 나라에 도달하는 것을 해군이 차단하여 경제적, 인도주의적 위기를 초래하는 것",
      ar: "منع بحري لوصول البضائع إلى دولة مما يسبب أزمة اقتصادية وإنسانية",
      pt: "A prevenção naval de mercadorias chegarem a uma nação, causando crise econômica e humanitária",
      ru: "Морская блокада, препятствующая доставке товаров, вызывающая экономический и гуманитарный кризис",
      ja: "物資の到着を海軍で阻止し、経済的・人道的危機を引き起こすこと",
    },
    cluster: "humiliation",
    position: {
      en: [36, 29], de: [7, 19], fr: [33, 26], es: [27, 22],
      zh: [12, 28], ko: [14, 24], ar: [16, 30], pt: [29, 24],
      ru: [22, 24], ja: [24, 20],
    },
    weight: {
      en: 0.1, de: 0.75, fr: 0.1, es: 0.2,
      zh: 0.45, ko: 0.4, ar: 0.5, pt: 0.15,
      ru: 0.55, ja: 0.2,
    },
    lacuna: noLacuna(),
    source: "curated",
  },

  // ══════════════════════════════════════════════════════════════
  // === LACUNA-DE (exist in German, absent in most others) ===
  // ══════════════════════════════════════════════════════════════
  {
    id: "dolchstoss",
    labels: {
      en: "Dolchstoss", de: "Dolchstoß", fr: "coup de poignard", es: "puñalada por la espalda",
      zh: "刺背传说", ko: "등 뒤의 칼", ar: "طعنة في الظهر", pt: "punhalada nas costas", ru: "удар в спину", ja: "背後の一突き",
    },
    definitions: {
      en: "The conspiracy theory that Germany's military was betrayed by civilian politicians who surrendered unnecessarily",
      de: "Die Dolchstoßlegende, dass Deutschlands Militär von zivilen Politikern verraten wurde, die unnötig kapitulierten",
      fr: "La théorie du complot selon laquelle l'armée allemande fut trahie par les politiciens civils",
      es: "La teoría conspirativa de que el ejército alemán fue traicionado por los políticos civiles",
      zh: "一种阴谋论，认为德国军队被不必要投降的文官政客所背叛",
      ko: "독일 군대가 불필요하게 항복한 민간 정치인들에게 배신당했다는 음모론",
      ar: "نظرية المؤامرة بأن الجيش الألماني خُدع من قبل سياسيين مدنيين استسلموا دون ضرورة",
      pt: "A teoria conspiratória de que o exército alemão foi traído por políticos civis que se renderam desnecessariamente",
      ru: "Конспирологическая теория о предательстве германской армии гражданскими политиками",
      ja: "ドイツ軍が不必要に降伏した文民政治家に裏切られたという陰謀論",
    },
    cluster: "lacuna-de",
    position: {
      en: [20, 15], de: [15, 30], fr: [18, 14], es: [16, 12],
      zh: [18, 20], ko: [16, 18], ar: [20, 22], pt: [17, 13],
      ru: [22, 18], ja: [19, 15],
    },
    weight: {
      en: 0.0, de: 0.85, fr: 0.0, es: 0.0,
      zh: 0.0, ko: 0.0, ar: 0.0, pt: 0.0,
      ru: 0.0, ja: 0.0,
    },
    lacuna: lacunaExcept("de"),
    source: "curated",
  },
  {
    id: "schmach",
    labels: {
      en: "Schmach", de: "Schmach", fr: "Schmach", es: "Schmach",
      zh: "耻辱", ko: "치욕", ar: "عار", pt: "Schmach", ru: "позор", ja: "恥辱",
    },
    definitions: {
      en: "A deep national disgrace that stains collective honor and demands redress",
      de: "Eine tiefe nationale Schmach, die die kollektive Ehre befleckt und Wiedergutmachung verlangt",
      fr: "Une disgrâce nationale profonde qui entache l'honneur collectif et exige réparation",
      es: "Una profunda desgracia nacional que mancha el honor colectivo y exige reparación",
      zh: "玷污集体荣誉并要求纠正的深重国家耻辱",
      ko: "집단적 명예를 더럽히고 시정을 요구하는 깊은 국가적 치욕",
      ar: "عار وطني عميق يلطخ الشرف الجماعي ويتطلب التعويض",
      pt: "Uma profunda desgraça nacional que mancha a honra coletiva e exige reparação",
      ru: "Глубокий национальный позор, пятнающий коллективную честь и требующий возмещения",
      ja: "集団的名誉を汚し是正を求める深い国家的恥辱",
    },
    cluster: "lacuna-de",
    position: {
      en: [22, 18], de: [18, 28], fr: [20, 16], es: [18, 14],
      zh: [20, 22], ko: [18, 20], ar: [22, 24], pt: [19, 15],
      ru: [24, 20], ja: [21, 17],
    },
    weight: {
      en: 0.0, de: 0.8, fr: 0.0, es: 0.0,
      zh: 0.0, ko: 0.0, ar: 0.0, pt: 0.0,
      ru: 0.0, ja: 0.0,
    },
    lacuna: lacunaExcept("de"),
    source: "curated",
  },
  {
    id: "diktat",
    labels: {
      en: "Diktat", de: "Diktat", fr: "diktat", es: "dictado",
      zh: "强加和约", ko: "강제 조약", ar: "إملاء", pt: "ditado", ru: "диктат", ja: "命令的講和",
    },
    definitions: {
      en: "A dictated peace imposed without negotiation by the victorious powers",
      de: "Ein aufgezwungener Frieden, der von den Siegermächten ohne Verhandlung diktiert wurde",
      fr: "Une paix dictée imposée sans négociation par les puissances victorieuses",
      es: "Una paz dictada impuesta sin negociación por las potencias victoriosas",
      zh: "胜利国不经谈判强加的和平",
      ko: "승전국이 협상 없이 강요한 강제적 평화",
      ar: "سلام مفروض دون تفاوض من قبل القوى المنتصرة",
      pt: "Uma paz ditada imposta sem negociação pelas potências vitoriosas",
      ru: "Навязанный мир, продиктованный победителями без переговоров",
      ja: "勝利国が交渉なしに押し付けた講和",
    },
    cluster: "lacuna-de",
    position: {
      en: [18, 12], de: [20, 32], fr: [16, 10], es: [14, 10],
      zh: [16, 18], ko: [14, 16], ar: [18, 20], pt: [15, 11],
      ru: [20, 16], ja: [17, 13],
    },
    weight: {
      en: 0.0, de: 0.8, fr: 0.0, es: 0.0,
      zh: 0.0, ko: 0.0, ar: 0.0, pt: 0.0,
      ru: 0.0, ja: 0.0,
    },
    lacuna: lacunaExcept("de"),
    source: "curated",
  },
  {
    id: "kriegsschuld",
    labels: {
      en: "Kriegsschuld", de: "Kriegsschuld", fr: "culpabilité de guerre", es: "culpa de guerra",
      zh: "战争罪责", ko: "전쟁 죄책", ar: "ذنب الحرب", pt: "culpa de guerra", ru: "военная вина", ja: "戦争責任",
    },
    definitions: {
      en: "The assignment of sole war guilt to one nation as the legal basis for reparations",
      de: "Die Zuweisung der alleinigen Kriegsschuld an eine Nation als rechtliche Grundlage für Reparationen",
      fr: "L'attribution de la culpabilité exclusive de guerre à une nation comme base juridique des réparations",
      es: "La asignación de la culpa exclusiva de guerra a una nación como base legal para las reparaciones",
      zh: "将唯一的战争罪责归于一国作为赔偿的法律基础",
      ko: "배상의 법적 근거로서 한 나라에 단독 전쟁 죄책을 부과하는 것",
      ar: "إسناد ذنب الحرب الوحيد لدولة واحدة كأساس قانوني للتعويضات",
      pt: "A atribuição da culpa exclusiva de guerra a uma nação como base legal para reparações",
      ru: "Возложение единоличной вины за войну на одно государство как правовой основы для репараций",
      ja: "賠償の法的根拠として一国に戦争の単独責任を帰すこと",
    },
    cluster: "lacuna-de",
    position: {
      en: [24, 16], de: [22, 26], fr: [22, 14], es: [20, 12],
      zh: [22, 20], ko: [20, 18], ar: [24, 22], pt: [21, 13],
      ru: [26, 18], ja: [23, 15],
    },
    weight: {
      en: 0.0, de: 0.75, fr: 0.0, es: 0.0,
      zh: 0.0, ko: 0.0, ar: 0.0, pt: 0.0,
      ru: 0.0, ja: 0.0,
    },
    lacuna: lacunaExcept("de"),
    source: "curated",
  },
  {
    id: "volkszorn",
    labels: {
      en: "Volkszorn", de: "Volkszorn", fr: "colère populaire", es: "ira popular",
      zh: "民众愤怒", ko: "민중의 분노", ar: "غضب شعبي", pt: "ira popular", ru: "народный гнев", ja: "民衆の怒り",
    },
    definitions: {
      en: "The collective rage of a people against perceived national humiliation",
      de: "Der kollektive Zorn eines Volkes gegen empfundene nationale Demütigung",
      fr: "La rage collective d'un peuple contre l'humiliation nationale perçue",
      es: "La rabia colectiva de un pueblo contra la humillación nacional percibida",
      zh: "人民对国家屈辱的集体愤怒",
      ko: "국가적 굴욕에 대한 국민의 집단적 분노",
      ar: "غضب جماعي لشعب ضد الإذلال الوطني",
      pt: "A raiva coletiva de um povo contra a humilhação nacional percebida",
      ru: "Коллективный гнев народа против воспринимаемого национального унижения",
      ja: "国家的屈辱に対する人民の集団的怒り",
    },
    cluster: "lacuna-de",
    position: {
      en: [21, 20], de: [16, 34], fr: [19, 18], es: [17, 16],
      zh: [19, 24], ko: [17, 22], ar: [21, 26], pt: [18, 17],
      ru: [23, 22], ja: [20, 19],
    },
    weight: {
      en: 0.0, de: 0.7, fr: 0.0, es: 0.0,
      zh: 0.0, ko: 0.0, ar: 0.0, pt: 0.0,
      ru: 0.0, ja: 0.0,
    },
    lacuna: lacunaExcept("de"),
    source: "curated",
  },
  {
    id: "revanchism",
    labels: {
      en: "revanchism", de: "Revanchismus", fr: "revanchisme", es: "revanchismo",
      zh: "复仇主义", ko: "복수주의", ar: "نزعة انتقامية", pt: "revanchismo", ru: "реваншизм", ja: "報復主義",
    },
    definitions: {
      en: "A political movement seeking to reverse territorial losses through future conflict",
      de: "Eine politische Bewegung, die territoriale Verluste durch zukünftige Konflikte rückgängig machen will",
      fr: "Un mouvement politique cherchant à inverser les pertes territoriales par des conflits futurs",
      es: "Un movimiento político que busca revertir las pérdidas territoriales mediante conflictos futuros",
      zh: "通过未来冲突寻求逆转领土损失的政治运动",
      ko: "미래의 충돌을 통해 영토 손실을 되돌리려는 정치 운동",
      ar: "حركة سياسية تسعى لعكس الخسائر الإقليمية من خلال نزاعات مستقبلية",
      pt: "Um movimento político que busca reverter perdas territoriais através de conflitos futuros",
      ru: "Политическое движение, стремящееся отменить территориальные потери через будущие конфликты",
      ja: "将来の紛争を通じて領土の喪失を覆そうとする政治運動",
    },
    cluster: "lacuna-de",
    position: {
      en: [23, 14], de: [19, 31], fr: [21, 12], es: [19, 11],
      zh: [21, 18], ko: [19, 16], ar: [23, 20], pt: [20, 12],
      ru: [25, 16], ja: [22, 14],
    },
    weight: {
      en: 0.0, de: 0.75, fr: 0.0, es: 0.0,
      zh: 0.0, ko: 0.0, ar: 0.0, pt: 0.0,
      ru: 0.0, ja: 0.0,
    },
    lacuna: lacunaExcept("de"),
    source: "curated",
  },

  // ══════════════════════════════════════════════════════════════
  // === LACUNA-EN (exist in English/Allied, absent in others) ===
  // ══════════════════════════════════════════════════════════════
  {
    id: "magnanimity",
    labels: {
      en: "magnanimity", de: "Großmut", fr: "magnanimité", es: "magnanimidad",
      zh: "宽宏大量", ko: "관대함", ar: "كرم", pt: "magnanimidade", ru: "великодушие", ja: "寛大さ",
    },
    definitions: {
      en: "Generosity and nobility of spirit shown by the victor toward the defeated",
      de: "Großmut und Edelmut des Siegers gegenüber dem Besiegten",
      fr: "Générosité et noblesse d'esprit montrées par le vainqueur envers le vaincu",
      es: "Generosidad y nobleza de espíritu mostrada por el vencedor hacia el vencido",
      zh: "胜利者对失败者表现出的慷慨和高尚精神",
      ko: "승자가 패자에게 보여주는 관대함과 고귀한 정신",
      ar: "الكرم ونبل الروح الذي يظهره المنتصر تجاه المهزوم",
      pt: "Generosidade e nobreza de espírito mostrada pelo vencedor ao derrotado",
      ru: "Великодушие и благородство духа, проявленные победителем к побеждённому",
      ja: "勝者が敗者に示す寛大さと精神の高貴さ",
    },
    cluster: "lacuna-en",
    position: {
      en: [10, -20], de: [-30, 30], fr: [12, -22], es: [8, -16],
      zh: [-10, 25], ko: [-5, 20], ar: [-15, 28], pt: [9, -18],
      ru: [-20, 24], ja: [6, -15],
    },
    weight: {
      en: 0.6, de: 0.0, fr: 0.5, es: 0.0,
      zh: 0.0, ko: 0.0, ar: 0.0, pt: 0.4,
      ru: 0.0, ja: 0.0,
    },
    lacuna: lacunaExcept("en", "fr", "pt"),
    source: "curated",
  },
  {
    id: "civilizing",
    labels: {
      en: "civilizing mission", de: "Zivilisierungsmission", fr: "mission civilisatrice", es: "misión civilizadora",
      zh: "文明使命", ko: "문명화 사명", ar: "مهمة حضارية", pt: "missão civilizadora", ru: "цивилизаторская миссия", ja: "文明化の使命",
    },
    definitions: {
      en: "The belief that advanced nations have a duty to bring progress and order to others",
      de: "Der Glaube, dass fortgeschrittene Nationen die Pflicht haben, anderen Fortschritt und Ordnung zu bringen",
      fr: "La croyance que les nations avancées ont le devoir d'apporter le progrès et l'ordre aux autres",
      es: "La creencia de que las naciones avanzadas tienen el deber de llevar progreso y orden a otros",
      zh: "先进国家有义务向他国带去进步和秩序的信念",
      ko: "선진국이 다른 나라에 진보와 질서를 가져다줄 의무가 있다는 믿음",
      ar: "الاعتقاد بأن الدول المتقدمة عليها واجب نشر التقدم والنظام للآخرين",
      pt: "A crença de que nações avançadas têm o dever de trazer progresso e ordem a outros",
      ru: "Убеждение, что развитые нации обязаны нести прогресс и порядок другим",
      ja: "先進国が他国に進歩と秩序をもたらす義務があるという信念",
    },
    cluster: "lacuna-en",
    position: {
      en: [8, -18], de: [-28, 28], fr: [10, -20], es: [6, -14],
      zh: [-8, 22], ko: [-3, 18], ar: [-12, 26], pt: [7, -16],
      ru: [-18, 22], ja: [5, -13],
    },
    weight: {
      en: 0.55, de: 0.0, fr: 0.65, es: 0.0,
      zh: 0.0, ko: 0.45, ar: 0.5, pt: 0.0,
      ru: 0.0, ja: 0.5,
    },
    lacuna: lacunaExcept("en", "fr", "ko", "ar", "ja"),
    source: "curated",
  },
  {
    id: "mandate",
    labels: {
      en: "mandate", de: "Mandat", fr: "mandat", es: "mandato",
      zh: "委任统治", ko: "위임통치", ar: "انتداب", pt: "mandato", ru: "мандат", ja: "委任統治",
    },
    definitions: {
      en: "International authorization to govern a territory on behalf of the League of Nations",
      de: "Internationale Ermächtigung, ein Gebiet im Namen des Völkerbunds zu regieren",
      fr: "Autorisation internationale de gouverner un territoire au nom de la Société des Nations",
      es: "Autorización internacional para gobernar un territorio en nombre de la Sociedad de Naciones",
      zh: "代表国际联盟治理一个领土的国际授权",
      ko: "국제연맹을 대신하여 영토를 통치하는 국제적 권한",
      ar: "تفويض دولي لحكم إقليم نيابة عن عصبة الأمم",
      pt: "Autorização internacional para governar um território em nome da Liga das Nações",
      ru: "Международное полномочие управлять территорией от имени Лиги Наций",
      ja: "国際連盟に代わって領土を統治する国際的権限",
    },
    cluster: "lacuna-en",
    position: {
      en: [11, -22], de: [-32, 32], fr: [13, -24], es: [9, -18],
      zh: [-12, 28], ko: [-7, 22], ar: [-16, 30], pt: [10, -20],
      ru: [-22, 26], ja: [8, -17],
    },
    weight: {
      en: 0.5, de: 0.0, fr: 0.55, es: 0.0,
      zh: 0.5, ko: 0.0, ar: 0.85, pt: 0.0,
      ru: 0.0, ja: 0.45,
    },
    lacuna: lacunaExcept("en", "fr", "zh", "ar", "ja"),
    source: "curated",
  },
];
