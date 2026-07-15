/** 18타입 상성표 (공격 타입 -> 방어 타입 배율). 1배는 생략, seed 시 전체 매트릭스 생성 */

export const TYPES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
  'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
  'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
] as const;

export type PokeType = (typeof TYPES)[number];

interface Effect {
  x2?: PokeType[];
  x05?: PokeType[];
  x0?: PokeType[];
}

// attacker -> defenders
const CHART: Record<PokeType, Effect> = {
  Normal: { x05: ['Rock', 'Steel'], x0: ['Ghost'] },
  Fire: { x2: ['Grass', 'Ice', 'Bug', 'Steel'], x05: ['Fire', 'Water', 'Rock', 'Dragon'] },
  Water: { x2: ['Fire', 'Ground', 'Rock'], x05: ['Water', 'Grass', 'Dragon'] },
  Electric: { x2: ['Water', 'Flying'], x05: ['Electric', 'Grass', 'Dragon'], x0: ['Ground'] },
  Grass: { x2: ['Water', 'Ground', 'Rock'], x05: ['Fire', 'Grass', 'Poison', 'Flying', 'Bug', 'Dragon', 'Steel'] },
  Ice: { x2: ['Grass', 'Ground', 'Flying', 'Dragon'], x05: ['Fire', 'Water', 'Ice', 'Steel'] },
  Fighting: { x2: ['Normal', 'Ice', 'Rock', 'Dark', 'Steel'], x05: ['Poison', 'Flying', 'Psychic', 'Bug', 'Fairy'], x0: ['Ghost'] },
  Poison: { x2: ['Grass', 'Fairy'], x05: ['Poison', 'Ground', 'Rock', 'Ghost'], x0: ['Steel'] },
  Ground: { x2: ['Fire', 'Electric', 'Poison', 'Rock', 'Steel'], x05: ['Grass', 'Bug'], x0: ['Flying'] },
  Flying: { x2: ['Grass', 'Fighting', 'Bug'], x05: ['Electric', 'Rock', 'Steel'] },
  Psychic: { x2: ['Fighting', 'Poison'], x05: ['Psychic', 'Steel'], x0: ['Dark'] },
  Bug: { x2: ['Grass', 'Psychic', 'Dark'], x05: ['Fire', 'Fighting', 'Poison', 'Flying', 'Ghost', 'Steel', 'Fairy'] },
  Rock: { x2: ['Fire', 'Ice', 'Flying', 'Bug'], x05: ['Fighting', 'Ground', 'Steel'] },
  Ghost: { x2: ['Psychic', 'Ghost'], x05: ['Dark'], x0: ['Normal'] },
  Dragon: { x2: ['Dragon'], x05: ['Steel'], x0: ['Fairy'] },
  Dark: { x2: ['Psychic', 'Ghost'], x05: ['Fighting', 'Dark', 'Fairy'] },
  Steel: { x2: ['Ice', 'Rock', 'Fairy'], x05: ['Fire', 'Water', 'Electric', 'Steel'] },
  Fairy: { x2: ['Fighting', 'Dragon', 'Dark'], x05: ['Fire', 'Poison', 'Steel'] },
};

export interface TypeChartRow {
  attacking_type: string;
  defending_type: string;
  multiplier: number;
}

/** 전체 18x18 매트릭스 생성 */
export function buildTypeChartRows(): TypeChartRow[] {
  const rows: TypeChartRow[] = [];
  for (const atk of TYPES) {
    const eff = CHART[atk];
    for (const def of TYPES) {
      let m = 1;
      if (eff.x2?.includes(def)) m = 2;
      else if (eff.x05?.includes(def)) m = 0.5;
      else if (eff.x0?.includes(def)) m = 0;
      rows.push({ attacking_type: atk, defending_type: def, multiplier: m });
    }
  }
  return rows;
}
