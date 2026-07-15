/** 타입 약점 프로필 계산 */
import { getTypeChart } from './repo.js';
import { TYPES } from '../data/typeChart.js';

export interface Defender {
  type1: string;
  type2: string | null;
}

/** 단일 포켓몬이 각 공격 타입에 대해 받는 배율 */
export function defensiveMultipliers(def: Defender): Record<string, number> {
  const chart = getTypeChart();
  const out: Record<string, number> = {};
  for (const atk of TYPES) {
    let m = chart[atk]?.[def.type1] ?? 1;
    if (def.type2) m *= chart[atk]?.[def.type2] ?? 1;
    out[atk] = m;
  }
  return out;
}

/**
 * 팀(또는 코어) 약점 프로필: 공격 타입별로 2배 이상 받는 멤버 수의 가중합.
 * 공유 약점(여러 멤버가 함께 약함)일수록 값이 커진다.
 */
export function teamWeaknessProfile(members: Defender[]): Record<string, number> {
  const profile: Record<string, number> = {};
  for (const atk of TYPES) profile[atk] = 0;
  for (const m of members) {
    const mult = defensiveMultipliers(m);
    for (const atk of TYPES) {
      if (mult[atk] >= 2) profile[atk] += mult[atk] >= 4 ? 2 : 1;
    }
  }
  return profile;
}

/** 프로필에서 위협적인 타입(값 큰 순) 목록 */
export function topThreats(profile: Record<string, number>, min = 1): string[] {
  return Object.entries(profile)
    .filter(([, v]) => v >= min)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);
}

/**
 * 후보가 주어진 위협 타입들을 얼마나 커버(저항/무효)하는지 점수화.
 * 위협 타입에 대해 0.5배 이하로 받으면 커버로 간주.
 */
export function coverageScore(cand: Defender, threats: string[], profile: Record<string, number>): number {
  if (threats.length === 0) return 0;
  const mult = defensiveMultipliers(cand);
  let score = 0;
  let totalWeight = 0;
  for (const t of threats) {
    const weight = profile[t] || 1;
    totalWeight += weight;
    if (mult[t] <= 0.5) score += weight; // 저항/무효
  }
  return totalWeight > 0 ? score / totalWeight : 0;
}

/** 후보 자신이 새로운 공유 약점을 더하는지 페널티 (이미 약한 타입에 같이 약하면 감점) */
export function stackedWeaknessPenalty(cand: Defender, threats: string[]): number {
  const mult = defensiveMultipliers(cand);
  let penalty = 0;
  for (const t of threats) {
    if (mult[t] >= 2) penalty += 1;
  }
  return penalty;
}
