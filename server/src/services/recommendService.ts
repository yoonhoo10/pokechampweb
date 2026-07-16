/** 파티 구축 추천 알고리즘 */
import type { PokemonForm, RecommendedMember, PartyOption, Role } from '../types.js';
import {
  getForm, getUsage, getTeammates, getAllFormsForScoring, buildNameIndex,
} from './repo.js';
import {
  teamWeaknessProfile, topThreats, coverageScore, stackedWeaknessPenalty,
} from './typeService.js';
import { inferRoles, diversityScore } from './roleService.js';
import { buildPlan } from './planService.js';
import { koType } from './i18nRepo.js';

const TEAM_SIZE = 6;

interface WeightPreset {
  id: string;
  label: string;
  team: number;
  cover: number;
  diverse: number;
  stack: number;
  stat: number;
}

const PRESETS: WeightPreset[] = [
  { id: 'balanced', label: '균형형 (실전 시너지 + 상성 보완)', team: 1.0, cover: 1.0, diverse: 0.6, stack: 0.8, stat: 0.3 },
  { id: 'synergy', label: '메타 시너지 중심 (실전 사용 팀메이트 우선)', team: 1.6, cover: 0.6, diverse: 0.5, stack: 0.6, stat: 0.3 },
  { id: 'defense', label: '상성 안정형 (약점 보완 우선)', team: 0.6, cover: 1.6, diverse: 0.7, stack: 1.2, stat: 0.2 },
];

/** teammate 이름 -> 대표 form 해석 */
function resolveTeammate(name: string, index: Map<string, PokemonForm[]>): PokemonForm | null {
  // 1) saved_name 정확 일치
  const direct = getForm(name);
  if (direct) return direct;
  // 2) base_name 일치 -> 기본형 우선, 없으면 종족값 최고
  const forms = index.get(name);
  if (forms && forms.length) {
    const base = forms.find((f) => f.saved_name === f.base_name);
    if (base) return base;
    return [...forms].sort((a, b) => b.total - a.total)[0];
  }
  return null;
}

interface Candidate {
  form: PokemonForm;
  teammateScore: number; // 0..1
  roles: Role[];
  source: 'teammate' | 'coverage';
}

/** 후보 풀 생성: 코어들의 teammate 상관 + 상성 보완 후보 */
function buildCandidatePool(cores: PokemonForm[]): Map<string, Candidate> {
  const index = buildNameIndex();
  const pool = new Map<string, Candidate>();
  const coreBaseNames = new Set(cores.map((c) => c.base_name));

  // teammate 기반
  for (const core of cores) {
    const teammates = getTeammates(core.saved_name);
    const n = teammates.length || 1;
    for (const tm of teammates) {
      const form = resolveTeammate(tm.name, index);
      if (!form || coreBaseNames.has(form.base_name)) continue;
      const norm = 1 - (tm.rank - 1) / n; // rank1 -> 1.0
      const existing = pool.get(form.base_name);
      if (existing) {
        existing.teammateScore = Math.min(1, existing.teammateScore + norm * 0.6);
      } else {
        pool.set(form.base_name, {
          form,
          teammateScore: norm,
          roles: inferRoles(form),
          source: 'teammate',
        });
      }
    }
  }

  // 상성 보완 후보: 코어 위협을 저항하는 실전급(총합 높은) 폼 일부 추가
  const coreProfile = teamWeaknessProfile(cores);
  const threats = topThreats(coreProfile, 1);
  if (threats.length) {
    const all = getAllFormsForScoring()
      .filter((f) => f.total >= 500 && !coreBaseNames.has(f.base_name))
      .sort((a, b) => b.total - a.total);
    for (const f of all) {
      if (pool.has(f.base_name)) continue;
      const cov = coverageScore(f, threats, coreProfile);
      if (cov >= 0.34) {
        pool.set(f.base_name, { form: f, teammateScore: 0, roles: inferRoles(f), source: 'coverage' });
      }
      if (pool.size >= 60) break;
    }
  }

  return pool;
}

/** 그리디로 슬롯 채우기 */
function fillTeam(cores: PokemonForm[], pool: Map<string, Candidate>, w: WeightPreset): PokemonForm[] {
  const team = [...cores];
  const usedBases = new Set(cores.map((c) => c.base_name));
  const existingRoles = new Set<Role>();
  for (const c of cores) for (const r of inferRoles(c)) existingRoles.add(r);

  while (team.length < TEAM_SIZE) {
    const profile = teamWeaknessProfile(team);
    const threats = topThreats(profile, 1);

    let best: { cand: Candidate; score: number } | null = null;
    for (const cand of pool.values()) {
      if (usedBases.has(cand.form.base_name)) continue;
      const cover = coverageScore(cand.form, threats, profile);
      const stack = stackedWeaknessPenalty(cand.form, threats);
      const diverse = diversityScore(cand.roles, existingRoles);
      const statBonus = cand.form.total / 720;

      const score =
        w.team * cand.teammateScore +
        w.cover * cover +
        w.diverse * diverse -
        w.stack * (stack / Math.max(1, threats.length)) +
        w.stat * statBonus;

      if (!best || score > best.score) best = { cand, score };
    }
    if (!best) break;
    team.push(best.cand.form);
    usedBases.add(best.cand.form.base_name);
    for (const r of best.cand.roles) existingRoles.add(r);
  }
  return team;
}

/** form -> 상세 추천 멤버 (기술/특성/성격/노력치/아이템) */
function enrichMember(form: PokemonForm, isCore: boolean, source: string): RecommendedMember {
  const full = getForm(form.saved_name)!;
  const moves = getUsage(form.saved_name, 'move').slice(0, 4);
  const abilities = getUsage(form.saved_name, 'ability');
  const nature = getUsage(form.saved_name, 'nature')[0] || null;
  const spread = getUsage(form.saved_name, 'spread')[0] || null;
  const item = getUsage(form.saved_name, 'item')[0] || null;
  const roles = inferRoles(form);

  let reason: string;
  if (isCore) {
    reason = '사용자가 선택한 코어 포켓몬입니다.';
  } else if (source === 'teammate') {
    reason = '실전 데이터에서 코어와 함께 자주 채용되는 팀메이트입니다.';
  } else {
    reason = '코어의 공유 약점을 방어적으로 보완하는 상성 커버 포켓몬입니다.';
  }

  return {
    form: full,
    roles,
    moves,
    ability: abilities[0] || null,
    abilityAlternatives: abilities.slice(1, 3),
    nature,
    spread,
    item,
    reason,
  };
}

export interface RecommendResult {
  cores: string[];
  season: string;
  options: PartyOption[];
}

export function recommendParties(coreSavedNames: string[]): RecommendResult {
  const cores = coreSavedNames.map((n) => getForm(n)).filter((f): f is NonNullable<typeof f> => !!f);
  if (cores.length === 0) throw new Error('유효한 코어 포켓몬이 없습니다.');

  const pool = buildCandidatePool(cores);
  const sourceByBase = new Map<string, string>();
  for (const c of pool.values()) sourceByBase.set(c.form.base_name, c.source);

  const options: PartyOption[] = [];
  const seenTeams = new Set<string>();

  for (const preset of PRESETS) {
    const team = fillTeam(cores, pool, preset);
    const key = team.map((t) => t.saved_name).sort().join('|');
    if (seenTeams.has(key)) continue; // 동일 팀 중복 방지
    seenTeams.add(key);

    const members = team.map((f, i) =>
      enrichMember(f, i < cores.length, sourceByBase.get(f.base_name) || 'core')
    );
    const weaknessProfile = teamWeaknessProfile(team);
    const remaining = topThreats(weaknessProfile, 2);
    const coverageNote =
      remaining.length > 0
        ? `주의 타입: ${remaining.slice(0, 4).map(koType).join(', ')} (2마리 이상이 약점)`
        : '2마리 이상이 공유하는 뚜렷한 약점이 없습니다. 상성 밸런스가 안정적입니다.';

    options.push({
      id: preset.id,
      label: preset.label,
      members,
      weaknessProfile,
      coverageNote,
      plan: buildPlan(members, new Set(cores.map((c) => c.saved_name))),
    });
  }

  return { cores: cores.map((c) => c.saved_name), season: 'Current', options };
}
