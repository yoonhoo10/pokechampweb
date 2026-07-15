/** 파티 운용 플랜 텍스트 생성 (move_tags + 종족값 근사) */
import { db } from '../db.js';
import type { RecommendedMember } from '../types.js';

// move -> tags 맵 로드
const moveTagMap: Record<string, string[]> = {};
{
  const rows = db.prepare(`SELECT move_name, tag FROM move_tags`).all() as { move_name: string; tag: string }[];
  for (const r of rows) (moveTagMap[r.move_name] ||= []).push(r.tag);
}

function tagsOf(member: RecommendedMember): Set<string> {
  const tags = new Set<string>();
  for (const mv of member.moves) {
    for (const t of moveTagMap[mv.name] || []) tags.add(t);
  }
  return tags;
}

function displayName(member: RecommendedMember): string {
  return member.form.title || member.form.saved_name;
}

export interface Plan {
  lead: { name: string; reason: string } | null;
  speedControl: string[];
  hazards: string[];
  winConditions: string[];
  summary: string;
}

export function buildPlan(members: RecommendedMember[]): Plan {
  const withTags = members.map((m) => ({ m, tags: tagsOf(m) }));

  // 해저드 세터
  const hazards = withTags
    .filter((x) => x.tags.has('hazard_set'))
    .map((x) => displayName(x.m));

  // 스피드 컨트롤 (기술 태그 or Trick Room 등)
  const speedControl = withTags
    .filter((x) => x.tags.has('speed_control'))
    .map((x) => `${displayName(x.m)}`);

  // 리드 추천: hazard_set > pivot > 최고 스피드 어태커
  let lead: Plan['lead'] = null;
  const hazardLead = withTags.find((x) => x.tags.has('hazard_set'));
  const pivotLead = withTags.find((x) => x.tags.has('pivot'));
  if (hazardLead) {
    lead = {
      name: displayName(hazardLead.m),
      reason: '개막에 스텔스록/스파이크 등 진입 데미지를 깔아 상대 교체를 압박할 수 있습니다.',
    };
  } else if (pivotLead) {
    lead = {
      name: displayName(pivotLead.m),
      reason: 'U턴/볼트체인지 등 피벗 기술로 유리한 대면을 만들며 주도권을 잡기 좋습니다.',
    };
  } else {
    // 스피드 가장 높은 멤버
    const fastest = [...members].sort((a, b) => b.form.spe - a.form.spe)[0];
    if (fastest) {
      lead = {
        name: displayName(fastest),
        reason: `팀 내 최고 스피드(기준 종족값 ${fastest.form.spe})로 초반 주도권을 잡기 좋습니다.`,
      };
    }
  }

  // 윈 컨디션: 공격 종족값 높은 상위 2마리 (스위퍼)
  const attackers = [...members]
    .map((m) => ({ m, off: Math.max(m.form.atk, m.form.spa), spe: m.form.spe }))
    .sort((a, b) => b.off + b.spe - (a.off + a.spe))
    .slice(0, 2);
  const winConditions = attackers.map((a) => {
    const kind = a.m.form.atk >= a.m.form.spa ? '물리' : '특수';
    return `${displayName(a.m)} — ${kind} 어태커(공격 ${Math.max(a.m.form.atk, a.m.form.spa)}, 스피드 ${a.m.form.spe}). 상대 위협을 정리한 뒤 전개하면 게임을 끝낼 수 있습니다.`;
  });

  // 요약
  const parts: string[] = [];
  if (lead) parts.push(`리드로는 ${lead.name}를 추천합니다.`);
  if (hazards.length) parts.push(`진입 데미지(해저드)는 ${hazards.join(', ')}가 담당합니다.`);
  if (speedControl.length) parts.push(`스피드 컨트롤 수단으로 ${speedControl.join(', ')}를 활용할 수 있습니다.`);
  else parts.push('전용 스피드 컨트롤 기술이 적으므로, 스카프/우선도 기술로 속도 열세를 보완하는 것을 고려하세요.');
  if (winConditions.length) parts.push(`최종 승리 플랜은 ${attackers.map((a) => displayName(a.m)).join(', ')}의 스윕입니다.`);

  return {
    lead,
    speedControl,
    hazards,
    winConditions,
    summary: parts.join(' '),
  };
}
