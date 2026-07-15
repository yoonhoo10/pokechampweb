/** 공용 타입 정의 */

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
  name_ko?: string; // 한국어 표시명 (종족+폼)
}

export interface UsageRow {
  category: string; // move / item / ability / nature / spread / teammate
  rank: number;
  name: string;
  name_ko?: string; // 한국어 표시명
  percentage: number | null;
}

export type Role = 'Physical Sweeper' | 'Special Sweeper' | 'Wall' | 'Tank' | 'Support' | 'Balanced';

export interface RecommendedMember {
  form: PokemonForm & { abilities: string[] };
  roles: Role[];
  moves: UsageRow[];
  ability: UsageRow | null;
  abilityAlternatives: UsageRow[];
  nature: UsageRow | null;
  spread: UsageRow | null;
  item: UsageRow | null;
  reason: string;
}

export interface PartyOption {
  id: string;
  label: string;
  members: RecommendedMember[];
  weaknessProfile: Record<string, number>;
  coverageNote: string;
  plan: {
    lead: { name: string; reason: string } | null;
    speedControl: string[];
    hazards: string[];
    winConditions: string[];
    summary: string;
  };
}
