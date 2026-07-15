/** name_i18n 로드 + 한국어 이름 조회 헬퍼 (메모리 캐시) */
import { db } from '../db.js';
import { composeFormKo } from '../data/staticI18n.js';

// map[category][en] = ko
const map: Record<string, Record<string, string>> = {};
{
  const rows = db.prepare('SELECT category, en, ko FROM name_i18n').all() as {
    category: string; en: string; ko: string;
  }[];
  for (const r of rows) (map[r.category] ||= {})[r.en] = r.ko;
}

/** category 의 영어 이름 -> 한국어. 없으면 영어 그대로 fallback */
export function koName(category: string, en: string | null | undefined): string {
  if (!en) return '';
  return map[category]?.[en] ?? en;
}

export function koType(en: string): string {
  return koName('type', en);
}

/** 폼 한국어 표시명: 종족 한국어 + 폼 라벨 조합 */
export function formKo(baseName: string, formLabel: string | null): string {
  return composeFormKo(koName('pokemon', baseName), formLabel);
}

/**
 * 사용률 row 의 name 을 category 에 맞게 한국어로.
 * teammate 는 포켓몬 종족명, spread(노력치 숫자)는 그대로 둔다.
 */
export function usageKo(category: string, name: string): string {
  if (category === 'teammate') return koName('pokemon', name);
  if (category === 'spread') return name;
  return koName(category, name);
}
