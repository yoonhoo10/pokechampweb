import { useMemo, useState } from 'react';
import type { PartyOption, RecommendedMember } from '../types';
import { TypeRow } from './TypeBadge';

interface Props {
  option: PartyOption;
  coreSavedNames: string[];
}

function pct(v: number | null): string {
  return v == null ? '' : `${v.toFixed(1)}%`;
}

function buildExport(option: PartyOption): string {
  return option.members
    .map((m) => {
      const lines: string[] = [];
      const name = m.form.title || m.form.saved_name;
      lines.push(m.item ? `${name} @ ${m.item.name}` : name);
      if (m.ability) lines.push(`Ability: ${m.ability.name}`);
      if (m.spread) lines.push(`EVs (usage HP/Atk/Def/SpA/SpD/Spe): ${m.spread.name}`);
      if (m.nature) lines.push(`Nature: ${m.nature.name}`);
      for (const mv of m.moves) lines.push(`- ${mv.name}`);
      return lines.join('\n');
    })
    .join('\n\n');
}

function MemberCard({ m, isCore }: { m: RecommendedMember; isCore: boolean }) {
  return (
    <div className="member">
      <div className="avatar">
        {m.form.image_path && <img src={m.form.image_path} alt={m.form.saved_name} />}
        <TypeRow t1={m.form.type1} t2={m.form.type2} />
        <div className="role">{m.roles.join(' / ')}</div>
      </div>
      <div>
        <h4>
          {m.form.name_ko || m.form.title || m.form.saved_name}
          {isCore && <span className="core-badge">코어</span>}
        </h4>
        <div className="reason">{m.reason}</div>

        <div className="kv">
          <div className="box">
            <div className="label">기술 (사용률 상위 4)</div>
            <div className="movelist">
              {m.moves.length === 0 && <span className="alt">데이터 없음</span>}
              {m.moves.map((mv) => (
                <span className="move-chip" key={mv.name}>
                  {mv.name_ko || mv.name} <span className="pct">{pct(mv.percentage)}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="box">
            <div className="label">특성</div>
            <div className="val">
              {m.ability ? (
                <>
                  <strong>{m.ability.name_ko || m.ability.name}</strong>{' '}
                  <span className="pct">{pct(m.ability.percentage)}</span>
                  {m.abilityAlternatives.length > 0 && (
                    <div className="alt">
                      대안: {m.abilityAlternatives.map((a) => `${a.name_ko || a.name} (${pct(a.percentage)})`).join(', ')}
                    </div>
                  )}
                </>
              ) : (
                <span className="alt">데이터 없음</span>
              )}
            </div>
          </div>

          <div className="box">
            <div className="label">성격 / 노력치</div>
            <div className="val">
              {m.nature ? <strong>{m.nature.name_ko || m.nature.name}</strong> : <span className="alt">성격 데이터 없음</span>}
              <div className="alt">
                노력치(사용률 1위): {m.spread ? m.spread.name : '데이터 없음'}
                <br />
                <span style={{ fontSize: 11 }}>순서: HP/공격/방어/특공/특방/스피드</span>
              </div>
            </div>
          </div>

          <div className="box">
            <div className="label">지닌 물건</div>
            <div className="val">
              {m.item ? (
                <>
                  <strong>{m.item.name_ko || m.item.name}</strong> <span className="pct">{pct(m.item.percentage)}</span>
                </>
              ) : (
                <span className="alt">데이터 없음</span>
              )}
            </div>
          </div>

          <div className="box">
            <div className="label">종족값</div>
            <div className="val" style={{ fontSize: 13 }}>
              HP {m.form.hp} · 공 {m.form.atk} · 방 {m.form.def} · 특공 {m.form.spa} · 특방 {m.form.spd} · 스피드{' '}
              {m.form.spe} · <strong>총 {m.form.total}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DetailScreen({ option, coreSavedNames }: Props) {
  const coreSet = new Set(coreSavedNames);
  const [copied, setCopied] = useState(false);
  const exportText = useMemo(() => buildExport(option), [option]);
  const plan = option.plan;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <div className="section-title">{option.label}</div>

      {/* 운용 플랜 */}
      <div className="plan">
        <h3>🎯 파티 운용 플랜</h3>
        <div className="summary">{plan.summary}</div>
        <div className="grid2">
          <div className="pbox">
            <div className="h">추천 리드</div>
            {plan.lead ? (
              <div style={{ fontSize: 13 }}>
                <strong>{plan.lead.name}</strong>
                <div className="alt" style={{ marginTop: 4 }}>{plan.lead.reason}</div>
              </div>
            ) : (
              <div className="empty">추천 리드 없음</div>
            )}
          </div>
          <div className="pbox">
            <div className="h">진입 데미지 (해저드)</div>
            {plan.hazards.length ? (
              <ul>{plan.hazards.map((h) => <li key={h}>{h}</li>)}</ul>
            ) : (
              <div className="empty">해저드 세터가 없습니다.</div>
            )}
          </div>
          <div className="pbox">
            <div className="h">스피드 컨트롤</div>
            {plan.speedControl.length ? (
              <ul>{plan.speedControl.map((s) => <li key={s}>{s}</li>)}</ul>
            ) : (
              <div className="empty">전용 스피드 컨트롤 수단이 적습니다.</div>
            )}
          </div>
          <div className="pbox">
            <div className="h">윈 컨디션</div>
            {plan.winConditions.length ? (
              <ul>{plan.winConditions.map((w, i) => <li key={i}>{w}</li>)}</ul>
            ) : (
              <div className="empty">-</div>
            )}
          </div>
        </div>
        <div className="coverage" style={{ marginTop: 14, marginBottom: 0 }}>
          {option.coverageNote}
        </div>
      </div>

      {/* 멤버 상세 */}
      <div className="section-title">멤버 상세 <span className="tag">기술/특성/노력치 사용률</span></div>
      {option.members.map((m) => (
        <MemberCard key={m.form.saved_name} m={m} isCore={coreSet.has(m.form.saved_name)} />
      ))}

      {/* 내보내기 */}
      <div className="section-title">
        내보내기 <span className="tag">Pokémon Showdown 유사 포맷</span>
      </div>
      <textarea className="export-box" readOnly value={exportText} />
      <div style={{ marginTop: 10 }}>
        <button className="btn-primary" onClick={copy}>
          {copied ? '복사됨! ✓' : '클립보드에 복사'}
        </button>
      </div>
    </>
  );
}
