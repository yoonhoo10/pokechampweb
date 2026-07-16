import type { RecommendResult, PartyOption } from '../types';

interface Props {
  result: RecommendResult;
  coreSavedNames: string[];
  onOpenDetail: (option: PartyOption) => void;
}

export function ResultsScreen({ result, coreSavedNames, onOpenDetail }: Props) {
  const coreSet = new Set(coreSavedNames);

  return (
    <>
      <div className="section-title">
        추천 파티 옵션 <span className="tag">시즌: {result.season} · 싱글 배틀</span>
      </div>
      <div className="options">
        {result.options.map((opt) => {
          const hasThreat = opt.coverageNote.includes('주의');
          return (
            <div className="option" key={opt.id}>
              <h3>
                {opt.label}
                {opt.plan?.archetype && <span className="archetype-badge">{opt.plan.archetype.label}</span>}
              </h3>
              <p className="note">
                6마리 구성 ·{' '}
                {coreSavedNames.length > 0
                  ? `코어 ${coreSavedNames.length}마리 포함`
                  : '완전 무작위 편성'}
              </p>

              <div className="team-row">
                {opt.members.map((m) => (
                  <div key={m.form.saved_name} className={`mini ${coreSet.has(m.form.saved_name) ? 'core' : ''}`}>
                    {m.form.image_path && <img src={m.form.image_path} alt={m.form.saved_name} loading="lazy" />}
                    <div className="mn">{m.form.name_ko || m.form.title || m.form.saved_name}</div>
                  </div>
                ))}
              </div>

              <div className="coverage">
                <span className={hasThreat ? 'danger' : ''}>■</span> {opt.coverageNote}
              </div>

              <button className="btn-primary" onClick={() => onOpenDetail(opt)}>
                상세 보기 & 운용 플랜
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
