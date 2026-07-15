/**
 * ETL: Pokémon Champions Battle Data API -> SQLite (작업용 캐시)
 * 실행: npm run etl
 * idempotent — 기존 데이터를 지우고 다시 채움 (영구 미러 아님, 재수집 전제)
 */
import { db, initSchema, tx } from './db.js';
import { seedStatic } from './seed.js';

const API = 'https://championsbattledata.com/api';
const ASSET_BASE = 'https://championsbattledata.com';
const FORMAT = 'Singles';
const CONCURRENCY = 8;

// 실제 API category -> CLAUDE.md 스키마 category 매핑
const CATEGORY_MAP: Record<string, string> = {
  move: 'move',
  held_item: 'item',
  ability: 'ability',
  teammate: 'teammate',
  stat_alignment: 'nature',
  stat_points: 'spread',
};

interface FetchResult<T> {
  ok: boolean;
  data?: T;
}

async function fetchJson<T>(url: string, retries = 3): Promise<FetchResult<T>> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'pokechampweb-etl/1.0' } });
      if (!res.ok) {
        if (res.status === 404) return { ok: false };
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as T;
      return { ok: true, data };
    } catch (err) {
      if (attempt === retries) {
        console.warn(`  [fail] ${url} -> ${(err as Error).message}`);
        return { ok: false };
      }
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  return { ok: false };
}

/** 간단한 동시성 풀 */
async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const cur = idx++;
      results[cur] = await fn(items[cur], cur);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function toImageUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const rel = raw.replace(/\\/g, '/');
  return `${ASSET_BASE}/${rel.split('/').map(encodeURIComponent).join('/')}`;
}

// ---- API 응답 타입 ----
interface IndexResp {
  defaultSeason: string;
  pokemon: { name: string; battleName: string }[];
}
interface MetadataRow {
  title: string;
  base_name: string;
  saved_name: string;
  types: string;
  abilities: string;
  image_path: string;
  form: string;
  hp: number; atk: number; def: number; spa: number; spd: number; spe: number; total: number;
}
interface MetadataResp { rows: MetadataRow[] }
interface BattleRow {
  category: string;
  rank: number;
  name: string;
  percentage_value: number | null;
  stat_up?: string;
  stat_down?: string;
  hp_points?: number | string;
  attack_points?: number | string;
  defense_points?: number | string;
  sp_atk_points?: number | string;
  sp_def_points?: number | string;
  speed_points?: number | string;
}
interface BattleResp { season: string; rows: BattleRow[] }

export async function runEtl() {
  console.time('ETL');
  initSchema();
  seedStatic();

  console.log('[1/3] /api/index 수집...');
  const idxRes = await fetchJson<IndexResp>(`${API}/index`);
  if (!idxRes.ok || !idxRes.data) throw new Error('index 수집 실패');
  const season = idxRes.data.defaultSeason || 'Current';
  const bases = idxRes.data.pokemon.map((p) => p.name);
  console.log(`  base 포켓몬 ${bases.length}종, season=${season}`);

  // 기존 데이터 초기화 (idempotent 재수집)
  db.exec('DELETE FROM battle_usage_rows; DELETE FROM pokemon_abilities; DELETE FROM pokemon_forms;');

  const upForm = db.prepare(`
    INSERT OR REPLACE INTO pokemon_forms
      (saved_name, base_name, title, form_label, type1, type2, hp, atk, def, spa, spd, spe, total, image_path)
    VALUES (@saved_name, @base_name, @title, @form_label, @type1, @type2, @hp, @atk, @def, @spa, @spd, @spe, @total, @image_path)
  `);
  const upAbility = db.prepare(`INSERT OR IGNORE INTO pokemon_abilities (saved_name, ability_name) VALUES (?, ?)`);
  const upUsage = db.prepare(`
    INSERT OR REPLACE INTO battle_usage_rows (saved_name, format, season, category, rank, name, percentage)
    VALUES (@saved_name, @format, @season, @category, @rank, @name, @percentage)
  `);

  // [2/3] metadata
  console.log('[2/3] /api/metadata 수집...');
  const allSavedNames: string[] = [];
  let metaOk = 0;
  const metaResults = await pool(bases, CONCURRENCY, (base) =>
    fetchJson<MetadataResp>(`${API}/metadata/${encodeURIComponent(base)}`)
  );

  tx(() => {
    for (const res of metaResults) {
      if (!res.ok || !res.data) continue;
      metaOk++;
      for (const row of res.data.rows) {
        const [type1, type2] = row.types.split('/');
        upForm.run({
          saved_name: row.saved_name,
          base_name: row.base_name,
          title: row.title || null,
          form_label: row.form || null,
          type1: (type1 || '').trim(),
          type2: type2 ? type2.trim() : null,
          hp: row.hp, atk: row.atk, def: row.def, spa: row.spa, spd: row.spd, spe: row.spe, total: row.total,
          image_path: toImageUrl(row.image_path),
        });
        for (const ab of (row.abilities || '').split('|').map((s) => s.trim()).filter(Boolean)) {
          upAbility.run(row.saved_name, ab);
        }
        allSavedNames.push(row.saved_name);
      }
    }
  });
  console.log(`  metadata ${metaOk}/${bases.length} 성공, 폼 ${allSavedNames.length}종`);

  // [3/3] battle usage
  console.log('[3/3] /api/battle 수집...');
  let battleOk = 0;
  let processed = 0;
  await pool(allSavedNames, CONCURRENCY, async (savedName) => {
    const res = await fetchJson<BattleResp>(
      `${API}/battle/${FORMAT}/${encodeURIComponent(savedName)}?season=${encodeURIComponent(season)}`
    );
    processed++;
    if (processed % 50 === 0) console.log(`  ...${processed}/${allSavedNames.length}`);
    if (!res.ok || !res.data) return;
    battleOk++;
    const seasonLabel = res.data.season || season;
    const rows = res.data.rows;

    tx(() => {
      for (const r of rows) {
        const mapped = CATEGORY_MAP[r.category];
        if (!mapped) continue;

        let name = r.name;
        if (mapped === 'nature') {
          const up = (r.stat_up || '').trim();
          const down = (r.stat_down || '').trim();
          if (up && down) name = `${r.name} (+${up} / -${down})`;
        } else if (mapped === 'spread') {
          const nums = [r.hp_points, r.attack_points, r.defense_points, r.sp_atk_points, r.sp_def_points, r.speed_points]
            .map((n) => (n === '' || n == null ? 0 : Number(n)));
          name = nums.join('/'); // HP/Atk/Def/SpA/SpD/Spe
        }
        if (name === '' && mapped !== 'spread') continue;

        upUsage.run({
          saved_name: savedName,
          format: FORMAT,
          season: seasonLabel,
          category: mapped,
          rank: r.rank,
          name,
          percentage: r.percentage_value,
        });
      }
    });
  });
  console.log(`  battle ${battleOk}/${allSavedNames.length} 성공`);

  const counts = db.prepare('SELECT category, COUNT(*) c FROM battle_usage_rows GROUP BY category').all();
  console.log('  usage rows:', counts);
  console.timeEnd('ETL');
  console.log('ETL 완료.');
}

// CLI로 직접 실행할 때만 수행 (import 시에는 실행 안 함)
import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runEtl().catch((e) => {
    console.error('ETL 실패:', e);
    process.exit(1);
  });
}
