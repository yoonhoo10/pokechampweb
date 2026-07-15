const KO: Record<string, string> = {
  Normal: '노말', Fire: '불꽃', Water: '물', Electric: '전기', Grass: '풀', Ice: '얼음',
  Fighting: '격투', Poison: '독', Ground: '땅', Flying: '비행', Psychic: '에스퍼', Bug: '벌레',
  Rock: '바위', Ghost: '고스트', Dragon: '드래곤', Dark: '악', Steel: '강철', Fairy: '페어리',
};

export function TypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  return <span className={`type type-${type}`}>{KO[type] || type}</span>;
}

export function TypeRow({ t1, t2 }: { t1: string; t2: string | null }) {
  return (
    <div className="types">
      <TypeBadge type={t1} />
      {t2 && <TypeBadge type={t2} />}
    </div>
  );
}
