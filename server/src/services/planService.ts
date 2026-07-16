/** 파티 운용 플랜 텍스트 생성 (move_tags + ability_tags + 종족값 근사)
 *  팀 아키타입(재생력 사이클/날씨/트릭룸/벽깔이 스윕/해저드 도배/스톨/밸런스 스윕)을
 *  감지해 코어 활용 전략과 아키타입별 승리 플랜을 만든다. */
import { db } from '../db.js';
import type { RecommendedMember, Role } from '../types.js';
import { ABILITY_TAG_BY_NAME } from '../data/abilityTags.js';

// move -> tags 맵 로드
const moveTagMap: Record<string, string[]> = {};
{
  const rows = db.prepare(`SELECT move_name, tag FROM move_tags`).all() as { move_name: string; tag: string }[];
  for (const r of rows) (moveTagMap[r.move_name] ||= []).push(r.tag);
}

type Weather = 'rain' | 'sun' | 'sand' | 'snow';
const WEATHER_BY_MOVE: Record<string, Weather> = {
  'Rain Dance': 'rain',
  'Sunny Day': 'sun',
  Sandstorm: 'sand',
  Snowscape: 'snow',
};
const WEATHER_BY_ABILITY_TAG: Record<string, Weather> = {
  weather_rain: 'rain',
  weather_sun: 'sun',
  weather_sand: 'sand',
  weather_snow: 'snow',
};
const WEATHER_KO: Record<Weather, string> = { rain: '비', sun: '쾌청', sand: '모래바람', snow: '싸라기눈' };

const ROLE_KO: Record<Role, string> = {
  'Physical Sweeper': '물리 스위퍼',
  'Special Sweeper': '특수 스위퍼',
  Wall: '벽',
  Tank: '탱크',
  Support: '서포터',
  Balanced: '밸런스',
};

function tagsOf(member: RecommendedMember): Set<string> {
  const tags = new Set<string>();
  for (const mv of member.moves) {
    for (const t of moveTagMap[mv.name] || []) tags.add(t);
  }
  return tags;
}

/** 사용률 1위 특성을 우선, 없으면 보유 특성 전체를 태그로 변환 */
function abilityTagsOf(member: RecommendedMember): Set<string> {
  const tags = new Set<string>();
  const names = member.ability?.name ? [member.ability.name] : member.form.abilities || [];
  for (const n of names) {
    for (const t of ABILITY_TAG_BY_NAME[n.toLowerCase()] || []) tags.add(t);
  }
  return tags;
}

function displayName(member: RecommendedMember): string {
  return member.form.name_ko || member.form.title || member.form.saved_name;
}

/** 한글 조사 선택: 마지막 글자 받침 유무로 결정. 괄호 보조 라벨(예: "(수컷)")은 무시.
 *  한글이 아니면(영문/숫자 폴백) 무받침 형태로 근사. */
function pickJosa(word: string, withBatchim: string, without: string, rieulToWithout = false): string {
  const base = word.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const code = base.charCodeAt(base.length - 1);
  if (!(code >= 0xac00 && code <= 0xd7a3)) return without;
  const jong = (code - 0xac00) % 28;
  if (jong === 0) return without;
  if (rieulToWithout && jong === 8) return without; // 받침 ㄹ -> '로'
  return withBatchim;
}
const subj = (s: string) => `${s}${pickJosa(s, '이', '가')}`; // 이/가
const obj = (s: string) => `${s}${pickJosa(s, '을', '를')}`; // 을/를
const via = (s: string) => `${s}${pickJosa(s, '으로', '로', true)}`; // 으로/로

function hasMove(member: RecommendedMember, name: string): boolean {
  return member.moves.some((mv) => mv.name === name);
}

interface MemberProfile {
  m: RecommendedMember;
  moveTags: Set<string>;
  abilityTags: Set<string>;
  isCore: boolean;
  off: number; // max(atk, spa)
  spe: number;
  isSweeper: boolean;
  isBulky: boolean; // Wall / Tank / Support
}

function profileOf(member: RecommendedMember, coreNames: Set<string>): MemberProfile {
  const roles = new Set(member.roles);
  return {
    m: member,
    moveTags: tagsOf(member),
    abilityTags: abilityTagsOf(member),
    isCore: coreNames.has(member.form.saved_name),
    off: Math.max(member.form.atk, member.form.spa),
    spe: member.form.spe,
    isSweeper: roles.has('Physical Sweeper') || roles.has('Special Sweeper'),
    isBulky: roles.has('Wall') || roles.has('Tank') || roles.has('Support'),
  };
}

/** 코어의 날씨 종류 판정 (특성 우선, 없으면 날씨 기술) */
function coreWeatherKind(p: MemberProfile): Weather | null {
  for (const [tag, kind] of Object.entries(WEATHER_BY_ABILITY_TAG)) {
    if (p.abilityTags.has(tag)) return kind;
  }
  for (const mv of p.m.moves) {
    const k = WEATHER_BY_MOVE[mv.name];
    if (k) return k;
  }
  return null;
}

export interface Plan {
  archetype: { id: string; label: string; description: string };
  coreStrategies: { name: string; role: string; strategy: string }[];
  lead: { name: string; reason: string } | null;
  speedControl: string[];
  hazards: string[];
  winConditions: string[];
  summary: string;
}

export function buildPlan(members: RecommendedMember[], coreNames: Set<string>): Plan {
  const profiles = members.map((m) => profileOf(m, coreNames));
  const names = (ps: MemberProfile[]) => ps.map((p) => displayName(p.m));
  const join = (arr: string[], fallback: string) => (arr.length ? arr.join(', ') : fallback);

  // 팀 시그널
  const hazardSetters = profiles.filter((p) => p.moveTags.has('hazard_set'));
  const hazardRemovers = profiles.filter((p) => p.moveTags.has('hazard_remove'));
  const screenSetters = profiles.filter((p) => p.moveTags.has('screen_set'));
  const speedCtrl = profiles.filter((p) => p.moveTags.has('speed_control'));
  const recoverers = profiles.filter((p) => p.moveTags.has('recovery'));
  const pivots = profiles.filter((p) => p.moveTags.has('pivot'));
  const regenerators = profiles.filter((p) => p.abilityTags.has('regenerator'));
  const weatherAbusers = profiles.filter((p) => p.abilityTags.has('weather_abuser'));
  const sweepers = profiles.filter((p) => p.isSweeper);
  const bulky = profiles.filter((p) => p.isBulky);
  const slowHeavy = profiles.filter((p) => p.spe <= 60 && p.off >= 100);
  const trSetters = profiles.filter((p) => hasMove(p.m, 'Trick Room'));

  // 날씨 세터 감지 (특성 우선)
  let weather: { kind: Weather; setter: string } | null = null;
  for (const p of profiles) {
    const k = coreWeatherKind(p);
    if (k) {
      weather = { kind: k, setter: displayName(p.m) };
      break;
    }
  }

  const topAttackers = [...profiles].sort((a, b) => b.off + b.spe - (a.off + a.spe)).slice(0, 2);

  // 아키타입 스코어링
  const scores: { id: string; score: number }[] = [];
  if (weather) scores.push({ id: 'weather', score: 3 + weatherAbusers.length + sweepers.length * 0.3 });
  if (trSetters.length && slowHeavy.length >= 2) scores.push({ id: 'trick_room', score: 3 + slowHeavy.length * 0.5 });
  if (regenerators.length >= 2 || (regenerators.length >= 1 && pivots.length >= 2))
    scores.push({ id: 'regen_cycle', score: regenerators.length * 1.5 + pivots.length * 0.5 + hazardSetters.length * 0.3 });
  if (screenSetters.length >= 1 && sweepers.length >= 2)
    scores.push({ id: 'screen_offense', score: 2 + sweepers.length * 0.6 });
  if (hazardSetters.length >= 2)
    scores.push({ id: 'hazard_stack', score: hazardSetters.length * 1.2 + (hazardRemovers.length ? 0.3 : 0) });
  if (bulky.length >= 3 && recoverers.length >= 2 && sweepers.length <= 1)
    scores.push({ id: 'stall', score: bulky.length * 0.7 + recoverers.length * 0.6 });
  scores.push({ id: 'balance_sweep', score: 1 + sweepers.length * 0.5 });

  const chosen = scores.sort((a, b) => b.score - a.score)[0].id;

  // 아키타입별 라벨/설명/윈컨디션
  let archetype: Plan['archetype'];
  let winConditions: string[] = [];

  const attackerLine = (p: MemberProfile) => {
    const kind = p.m.form.atk >= p.m.form.spa ? '물리' : '특수';
    return `${displayName(p.m)} — ${kind} 어태커(공격 ${p.off}, 스피드 ${p.spe})`;
  };

  switch (chosen) {
    case 'weather': {
      const w = weather!;
      const ko = WEATHER_KO[w.kind];
      const abusers = weatherAbusers.length ? names(weatherAbusers) : names(sweepers);
      archetype = {
        id: chosen,
        label: `날씨(${ko}) 팟`,
        description: `${subj(w.setter)} ${ko} 날씨를 켜고, 날씨 이점을 받는 어태커로 몰아치는 팀입니다.`,
      };
      winConditions = [
        `${via(w.setter)} ${ko} 날씨를 유지하며 ${join(abusers, '날씨 수혜 어태커')}의 강화된 화력·속도로 스윕합니다.`,
        '상대 날씨 세터를 견제해 날씨 주도권을 유지하는 것이 승패의 핵심입니다.',
      ];
      if (hazardSetters.length)
        winConditions.push(`${join(names(hazardSetters), '해저드 세터')}의 해저드로 상대 교체를 압박하며 날씨 턴을 벌 수 있습니다.`);
      break;
    }
    case 'trick_room': {
      const trSetter = displayName(trSetters[0].m);
      archetype = {
        id: chosen,
        label: '트릭룸 팟',
        description: '트릭룸으로 스피드를 역전시켜, 느리지만 강한 어태커가 선공으로 몰아치는 팀입니다.',
      };
      winConditions = [
        `${subj(trSetter)} 트릭룸을 전개한 뒤 ${via(join(names(slowHeavy), '저속 고화력 어태커'))} 선공 스윕합니다.`,
        '트릭룸 5턴 안에 최대 화력을 퍼부어, 지속 시간이 끝나기 전에 상대 핵심을 정리하는 것이 관건입니다.',
      ];
      break;
    }
    case 'regen_cycle': {
      archetype = {
        id: chosen,
        label: '재생력 사이클 팟',
        description: '재생력 받이와 피벗 기술로 교체 사이클을 돌리며, 해저드·상태이상으로 상대를 서서히 깎는 소모전 팀입니다.',
      };
      winConditions = [
        `${via(join(names(regenerators), '재생력 받이'))} 상대 어태커를 반복 흡수하고 체력을 회복하며 유리한 대면을 강요합니다.`,
      ];
      if (hazardSetters.length)
        winConditions.push(`${join(names(hazardSetters), '해저드 세터')}의 해저드로 교체마다 상대를 깎아 소모전 우위를 굳힙니다.`);
      winConditions.push(`상대 주력이 소모되면 ${via(join(names(topAttackers), '에이스'))} 마무리 스윕합니다.`);
      break;
    }
    case 'screen_offense': {
      archetype = {
        id: chosen,
        label: '벽깔이 스윕 팟',
        description: '리플렉터·빛의장막·오로라베일로 벽을 세워 아군의 셋업과 스윕을 안전하게 통과시키는 팀입니다.',
      };
      winConditions = [
        `${via(join(names(screenSetters), '벽 세터'))} 벽을 세운 뒤 ${subj(join(names(sweepers), '에이스'))} 능력 상승을 쌓고 스윕합니다.`,
        '벽이 유지되는 동안 셋업을 완성해 상대 파티 전체를 관통하는 것이 목표입니다.',
      ];
      break;
    }
    case 'hazard_stack': {
      archetype = {
        id: chosen,
        label: '해저드 도배 팟',
        description: '스텔스록·압정뿌리기 등 진입 데미지를 여러 겹 깔아, 교체마다 상대를 깎는 팀입니다.',
      };
      winConditions = [
        `${via(join(names(hazardSetters), '해저드 세터'))} 해저드를 여러 겹 깔아 상대 교체를 강하게 압박합니다.`,
      ];
      if (hazardRemovers.length)
        winConditions.push(`${via(join(names(hazardRemovers), '해저드 제거원'))} 아군 필드는 정리하며 해저드 우위를 유지합니다.`);
      winConditions.push(`해저드 데미지가 누적되면 ${join(names(topAttackers), '에이스')}의 공격 한 방이 확정타로 들어가 스윕으로 이어집니다.`);
      break;
    }
    case 'stall': {
      archetype = {
        id: chosen,
        label: '스톨(받이) 팟',
        description: '높은 내구와 회복기로 버티며, 해저드·상태이상 등 지속 데미지로 상대를 서서히 눕히는 지구전 팀입니다.',
      };
      winConditions = [
        `${subj(join(names(bulky), '받이'))} 회복기로 버티며 상대 공격을 무력화합니다.`,
        '해저드·독·화상 등 지속 데미지로 상대를 하나씩 눕혀 물량 우위로 승리합니다.',
      ];
      break;
    }
    default: {
      archetype = {
        id: 'balance_sweep',
        label: '밸런스 스윕 팟',
        description: '상성 균형을 갖춘 구성에서 상대 위협을 정리한 뒤 주력 어태커로 마무리하는 팀입니다.',
      };
      winConditions = topAttackers.map(
        (p) => `${attackerLine(p)}. 상대 위협을 정리한 뒤 전개하면 게임을 끝낼 수 있습니다.`
      );
      break;
    }
  }

  // 해저드 / 스피드 컨트롤 목록
  const hazards = names(hazardSetters);
  const speedControl = names(speedCtrl);

  // 리드 추천: 아키타입 우선 → hazard_set → pivot → 최고 스피드
  let lead: Plan['lead'] = null;
  if (chosen === 'weather' && weather) {
    lead = { name: weather.setter, reason: `개막에 ${WEATHER_KO[weather.kind]} 날씨를 켜 팀의 전개 기반을 마련합니다.` };
  } else if (chosen === 'trick_room' && trSetters.length) {
    lead = { name: displayName(trSetters[0].m), reason: '개막에 트릭룸을 전개해 스피드를 역전시키고 저속 어태커의 활로를 엽니다.' };
  } else if (hazardSetters.length) {
    lead = { name: displayName(hazardSetters[0].m), reason: '개막에 스텔스록/스파이크 등 진입 데미지를 깔아 상대 교체를 압박할 수 있습니다.' };
  } else if (pivots.length) {
    lead = { name: displayName(pivots[0].m), reason: 'U턴/볼트체인지 등 피벗 기술로 유리한 대면을 만들며 주도권을 잡기 좋습니다.' };
  } else {
    const fastest = [...members].sort((a, b) => b.form.spe - a.form.spe)[0];
    if (fastest) {
      lead = {
        name: fastest.form.name_ko || fastest.form.title || fastest.form.saved_name,
        reason: `팀 내 최고 스피드(기준 종족값 ${fastest.form.spe})로 초반 주도권을 잡기 좋습니다.`,
      };
    }
  }

  // 코어 활용 전략
  const setupMeans: string[] = [];
  if (screenSetters.length) setupMeans.push('벽');
  if (hazardSetters.length) setupMeans.push('해저드');
  if (speedCtrl.length || trSetters.length) setupMeans.push('스피드 컨트롤');
  const setupPhrase = setupMeans.length ? `${setupMeans.join('/')}로 기점이 마련되면` : '상대 위협을 정리한 뒤';

  const coreStrategies = profiles
    .filter((p) => p.isCore)
    .map((p) => {
      const name = displayName(p.m);
      const role = p.m.roles.map((r) => ROLE_KO[r] || r).join('/');
      const wk = coreWeatherKind(p);
      let strategy: string;
      if (wk) {
        strategy = `이 팀의 ${WEATHER_KO[wk]} 날씨 세터입니다. 등장만으로 날씨를 켜 팀의 화력·속도를 지탱합니다.`;
      } else if (p.abilityTags.has('regenerator')) {
        strategy = '재생력 받이 축입니다. 피벗·교체로 체력을 회복하며 상대 어태커를 반복해서 받아냅니다.';
      } else if (p.moveTags.has('hazard_set')) {
        strategy = '개막 리드로 스텔스록 등 해저드를 깔아 상대 교체를 압박하고 기점을 마련합니다.';
      } else if (p.moveTags.has('screen_set')) {
        strategy = '리플렉터·오로라베일 등으로 벽을 세워 아군의 셋업·스윕이 지나갈 기점을 만듭니다.';
      } else if (hasMove(p.m, 'Trick Room')) {
        strategy = '트릭룸을 전개해 팀의 저속 어태커에게 선공권을 넘겨주는 축입니다.';
      } else if (p.moveTags.has('speed_control')) {
        strategy = '바람타기·전기자석파 등으로 팀의 스피드 라인을 보정하는 서포터입니다.';
      } else if (p.moveTags.has('pivot')) {
        strategy = '피벗 기술로 유리한 대면을 만들며 팀의 교체 사이클을 돌리는 축입니다.';
      } else if (p.isSweeper) {
        const kind = p.m.form.atk >= p.m.form.spa ? '물리' : '특수';
        strategy = `팀의 주력 ${kind} 어태커입니다. ${setupPhrase} 셋업 후 스윕합니다.`;
      } else if (p.isBulky) {
        strategy = '내구 축으로 상대 어태커를 받아내고 회복기·변화기로 장기전을 유도합니다.';
      } else if (p.off >= 100) {
        strategy = '상황에 따라 어태커로 화력을 담당하며 팀의 공격 축을 보조합니다.';
      } else {
        strategy = '균형 잡힌 스탯으로 어태커와 받이 양면으로 유연하게 활용합니다.';
      }
      return { name, role, strategy };
    });

  // 요약
  const parts: string[] = [`이 파티는 '${archetype.label}' 성향입니다. ${archetype.description}`];
  if (lead) parts.push(`리드로는 ${obj(lead.name)} 추천합니다.`);
  if (hazards.length) parts.push(`진입 데미지(해저드)는 ${subj(hazards.join(', '))} 담당합니다.`);
  if (speedControl.length) parts.push(`스피드 컨트롤 수단으로 ${obj(speedControl.join(', '))} 활용할 수 있습니다.`);
  else parts.push('전용 스피드 컨트롤 기술이 적으므로, 스카프/우선도 기술로 속도 열세를 보완하는 것을 고려하세요.');

  return {
    archetype,
    coreStrategies,
    lead,
    speedControl,
    hazards,
    winConditions,
    summary: parts.join(' '),
  };
}
