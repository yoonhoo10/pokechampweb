/** 종족값 분포 기반 역할 휴리스틱 */
import type { PokemonForm, Role } from '../types.js';

export function inferRoles(f: Pick<PokemonForm, 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe'>): Role[] {
  const roles: Role[] = [];
  const bulk = f.hp + f.def + f.spd;
  const offense = Math.max(f.atk, f.spa);

  const fast = f.spe >= 100;
  const bulky = f.hp >= 90 && (f.def >= 100 || f.spd >= 100);
  const veryBulky = f.hp >= 100 && f.def >= 100 && f.spd >= 100;

  if (fast && f.atk > f.spa && f.atk >= 100) roles.push('Physical Sweeper');
  if (fast && f.spa >= f.atk && f.spa >= 100) roles.push('Special Sweeper');
  if (veryBulky || (bulk >= 300 && offense < 90)) roles.push('Wall');
  if (bulky && offense >= 90) roles.push('Tank');

  // 서포터: 공격 낮고 스피드 애매, 내구 존재
  if (offense < 95 && (f.hp >= 70) && !fast) roles.push('Support');

  if (roles.length === 0) roles.push('Balanced');
  return Array.from(new Set(roles));
}

/** 역할 다양성 점수: 이미 뽑힌 역할과 겹치지 않을수록 높음 */
export function diversityScore(candRoles: Role[], existingRoles: Set<Role>): number {
  if (existingRoles.size === 0) return 1;
  let fresh = 0;
  for (const r of candRoles) if (!existingRoles.has(r)) fresh++;
  return candRoles.length > 0 ? fresh / candRoles.length : 0;
}
