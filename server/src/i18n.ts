/**
 * i18n ETL: DB의 영어 이름 -> PokeAPI 공식 한국어 이름 수집 -> name_i18n 저장
 * 실행: npm run i18n  (반드시 npm run etl 로 데이터가 채워진 뒤 실행)
 * 자동 번역이 아니라 PokeAPI(공식 로컬라이제이션)의 ko 이름을 1:1 매칭한다.
 * idempotent — name_i18n 을 지우고 다시 채움 (작업용 캐시, 영구 미러 아님)
 */
import { db, initSchema, tx } from './db.js';
import { TYPE_KO, STAT_KO } from './data/staticI18n.js';
import { NAME_OVERRIDES } from './data/nameOverrides.js';

const POKEAPI = 'https://pokeapi.co/api/v2';
const CONCURRENCY = 8;

/** 영어 이름 -> PokeAPI 슬러그. 소문자화, 공백->하이픈, 마침표/따옴표/쉼표 제거 */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’.,:]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

interface PokeApiNamed {
  names?: { name: string; language: { name: string } }[];
}

async function fetchKo(endpoint: string, slug: string, retries = 2): Promise<string | null> {
  const url = `${POKEAPI}/${endpoint}/${slug}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'pokechampweb-i18n/1.0' } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as PokeApiNamed;
      const ko = (data.names || []).find((n) => n.language.name === 'ko');
      return ko ? ko.name : null;
    } catch (err) {
      if (attempt === retries) {
        console.warn(`  [fail] ${url} -> ${(err as Error).message}`);
        return null;
      }
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  return null;
}

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

function distinct(sql: string): string[] {
  return (db.prepare(sql).all() as { v: string }[]).map((r) => r.v).filter(Boolean);
}

/** 성격 "Quiet (+Sp. Atk / -Speed)" -> { base:'Quiet', suffix:' (+특공 / -스피드)' } */
function parseNature(full: string): { base: string; suffix: string } {
  const m = full.match(/^(.+?)\s*\(\+(.+?)\s*\/\s*-(.+?)\)$/);
  if (!m) return { base: full.trim(), suffix: '' }; // 무보정 성격 (Serious 등)
  const base = m[1].trim();
  const up = STAT_KO[m[2].trim()] || m[2].trim();
  const down = STAT_KO[m[3].trim()] || m[3].trim();
  return { base, suffix: ` (+${up} / -${down})` };
}

export async function runI18n() {
  console.time('i18n');
  initSchema();

  const rows: { category: string; en: string; ko: string }[] = [];
  const misses: { category: string; en: string; slug: string }[] = [];

  // 1) 타입 (정적)
  for (const [en, ko] of Object.entries(TYPE_KO)) rows.push({ category: 'type', en, ko });

  // 2) 포켓몬 종족명 (base_name -> pokemon-species)
  console.log('[1/5] 포켓몬 종족명...');
  const bases = distinct('SELECT DISTINCT base_name v FROM pokemon_forms');
  const baseKo = await pool(bases, CONCURRENCY, (b) => fetchKo('pokemon-species', toSlug(b)));
  bases.forEach((b, i) => {
    if (baseKo[i]) rows.push({ category: 'pokemon', en: b, ko: baseKo[i]! });
    else misses.push({ category: 'pokemon', en: b, slug: toSlug(b) });
  });

  // 3) 기술
  console.log('[2/5] 기술...');
  const moves = distinct("SELECT DISTINCT name v FROM battle_usage_rows WHERE category='move'");
  const moveKo = await pool(moves, CONCURRENCY, (m) => fetchKo('move', toSlug(m)));
  moves.forEach((m, i) => {
    if (moveKo[i]) rows.push({ category: 'move', en: m, ko: moveKo[i]! });
    else misses.push({ category: 'move', en: m, slug: toSlug(m) });
  });

  // 4) 특성
  console.log('[3/5] 특성...');
  const abilities = distinct("SELECT DISTINCT name v FROM battle_usage_rows WHERE category='ability'");
  const abKo = await pool(abilities, CONCURRENCY, (a) => fetchKo('ability', toSlug(a)));
  abilities.forEach((a, i) => {
    if (abKo[i]) rows.push({ category: 'ability', en: a, ko: abKo[i]! });
    else misses.push({ category: 'ability', en: a, slug: toSlug(a) });
  });

  // 5) 아이템
  console.log('[4/5] 아이템...');
  const items = distinct("SELECT DISTINCT name v FROM battle_usage_rows WHERE category='item'");
  const itemKo = await pool(items, CONCURRENCY, (it) => fetchKo('item', toSlug(it)));
  items.forEach((it, i) => {
    if (itemKo[i]) rows.push({ category: 'item', en: it, ko: itemKo[i]! });
    else misses.push({ category: 'item', en: it, slug: toSlug(it) });
  });

  // 6) 성격 (base word 만 fetch, 접미사는 STAT_KO 로 재조립)
  console.log('[5/5] 성격...');
  const natures = distinct("SELECT DISTINCT name v FROM battle_usage_rows WHERE category='nature'");
  const parsed = natures.map((n) => ({ full: n, ...parseNature(n) }));
  const uniqueBases = [...new Set(parsed.map((p) => p.base))];
  const natBaseKo = await pool(uniqueBases, CONCURRENCY, (b) => fetchKo('nature', toSlug(b)));
  const natMap = new Map<string, string | null>();
  uniqueBases.forEach((b, i) => natMap.set(b, natBaseKo[i]));
  for (const p of parsed) {
    const ko = natMap.get(p.base);
    if (ko) rows.push({ category: 'nature', en: p.full, ko: `${ko}${p.suffix}` });
    else misses.push({ category: 'nature', en: p.full, slug: toSlug(p.base) });
  }

  // 7) 수동 오버라이드 (있으면 자동 매칭 위에 덮어씀)
  for (const o of NAME_OVERRIDES) rows.push(o);

  // 저장
  const upsert = db.prepare('INSERT OR REPLACE INTO name_i18n (category, en, ko) VALUES (?, ?, ?)');
  tx(() => {
    db.exec('DELETE FROM name_i18n');
    for (const r of rows) upsert.run(r.category, r.en, r.ko);
  });

  // 리포트
  const byCat = db
    .prepare('SELECT category, COUNT(*) c FROM name_i18n GROUP BY category')
    .all() as { category: string; c: number }[];
  console.log('  name_i18n:', byCat.map((x) => `${x.category}=${x.c}`).join(', '));
  if (misses.length) {
    console.log(`\n  [매칭 실패 ${misses.length}건] nameOverrides.ts 에 수동 등록 필요:`);
    for (const m of misses) console.log(`    - [${m.category}] "${m.en}"  (시도 슬러그: ${m.slug})`);
  } else {
    console.log('  매칭 실패 없음 ✓');
  }
  console.timeEnd('i18n');
}

import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runI18n().catch((e) => {
    console.error('i18n 실패:', e);
    process.exit(1);
  });
}
