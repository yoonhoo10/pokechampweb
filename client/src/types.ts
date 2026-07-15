export interface ListItem {
  saved_name: string;
  base_name: string;
  title: string | null;
  form_label: string | null;
  type1: string;
  type2: string | null;
  total: number;
  image_path: string | null;
}

export interface UsageRow {
  category?: string;
  rank: number;
  name: string;
  percentage: number | null;
}

export interface PokemonForm {
  saved_name: string;
  base_name: string;
  title: string | null;
  form_label: string | null;
  type1: string;
  type2: string | null;
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
  total: number;
  image_path: string | null;
  abilities: string[];
}

export interface RecommendedMember {
  form: PokemonForm;
  roles: string[];
  moves: UsageRow[];
  ability: UsageRow | null;
  abilityAlternatives: UsageRow[];
  nature: UsageRow | null;
  spread: UsageRow | null;
  item: UsageRow | null;
  reason: string;
}

export interface PartyPlan {
  lead: { name: string; reason: string } | null;
  speedControl: string[];
  hazards: string[];
  winConditions: string[];
  summary: string;
}

export interface PartyOption {
  id: string;
  label: string;
  members: RecommendedMember[];
  weaknessProfile: Record<string, number>;
  coverageNote: string;
  plan: PartyPlan;
}

export interface RecommendResult {
  cores: string[];
  season: string;
  options: PartyOption[];
}

export interface Attribution {
  dataSource: string;
  disclaimer: string;
}
