/** DB 접근 계층 */
import { db } from '../db.js';
import type { PokemonForm, UsageRow } from '../types.js';
import { formKo, usageKo } from './i18nRepo.js';

export interface FormWithAbilities extends PokemonForm {
  abilities: string[];
}

const qForm = db.prepare(`SELECT * FROM pokemon_forms WHERE saved_name = ?`);
const qAbilities = db.prepare(`SELECT ability_name FROM pokemon_abilities WHERE saved_name = ? ORDER BY ability_name`);
const qUsage = db.prepare(
  `SELECT category, rank, name, percentage FROM battle_usage_rows
   WHERE saved_name = ? AND category = ? ORDER BY rank ASC`
);
const qList = db.prepare(`
  SELECT saved_name, base_name, title, form_label, type1, type2, total, image_path
  FROM pokemon_forms ORDER BY base_name, saved_name
`);

// 타입 상성표를 메모리에 로드: chart[atk][def] = multiplier
const typeChart: Record<string, Record<string, number>> = {};
{
  const rows = db.prepare(`SELECT attacking_type, defending_type, multiplier FROM type_chart`).all() as {
    attacking_type: string; defending_type: string; multiplier: number;
  }[];
  for (const r of rows) {
    (typeChart[r.attacking_type] ||= {})[r.defending_type] = r.multiplier;
  }
}

export function getTypeChart() {
  return typeChart;
}

export function getForm(savedName: string): FormWithAbilities | null {
  const form = qForm.get(savedName) as PokemonForm | undefined;
  if (!form) return null;
  const abilities = (qAbilities.all(savedName) as { ability_name: string }[]).map((r) => r.ability_name);
  return { ...form, abilities, name_ko: formKo(form.base_name, form.form_label) };
}

export function getUsage(savedName: string, category: string): UsageRow[] {
  const rows = qUsage.all(savedName, category) as UsageRow[];
  for (const r of rows) r.name_ko = usageKo(category, r.name);
  return rows;
}

export interface ListItem {
  saved_name: string;
  base_name: string;
  title: string | null;
  form_label: string | null;
  type1: string;
  type2: string | null;
  total: number;
  image_path: string | null;
  name_ko: string;
}

export function listForms(): ListItem[] {
  const rows = qList.all() as ListItem[];
  for (const r of rows) r.name_ko = formKo(r.base_name, r.form_label);
  return rows;
}

/** 모든 폼의 요약(추천 후보 풀). 특성 포함 여부 옵션 */
export function getAllFormsForScoring(): PokemonForm[] {
  return db.prepare(`SELECT * FROM pokemon_forms`).all() as PokemonForm[];
}

/** 특정 saved_name의 teammate 후보 (rank 순) */
export function getTeammates(savedName: string): { name: string; rank: number }[] {
  return db
    .prepare(
      `SELECT name, rank FROM battle_usage_rows
       WHERE saved_name = ? AND category = 'teammate' ORDER BY rank ASC`
    )
    .all(savedName) as { name: string; rank: number }[];
}

/** base_name -> 대표 saved_name 매핑 (teammate 이름은 base_name 기준일 수 있어 매칭용) */
export function buildNameIndex(): Map<string, PokemonForm[]> {
  const all = getAllFormsForScoring();
  const idx = new Map<string, PokemonForm[]>();
  for (const f of all) {
    if (!idx.has(f.base_name)) idx.set(f.base_name, []);
    idx.get(f.base_name)!.push(f);
  }
  return idx;
}
