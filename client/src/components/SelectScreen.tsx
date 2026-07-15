import { useEffect, useMemo, useState } from 'react';
import { fetchPokemonList } from '../api';
import type { ListItem } from '../types';
import { TypeRow } from './TypeBadge';

interface Props {
  onRecommend: (cores: ListItem[]) => void;
}

const MAX = 3;

export function SelectScreen({ onRecommend }: Props) {
  const [list, setList] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ListItem[]>([]);

  useEffect(() => {
    fetchPokemonList()
      .then((d) => setList(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? list.filter(
          (p) =>
            p.saved_name.toLowerCase().includes(q) ||
            p.base_name.toLowerCase().includes(q) ||
            (p.title || '').toLowerCase().includes(q) ||
            (p.name_ko || '').toLowerCase().includes(q)
        )
      : list;
    return base.slice(0, 300);
  }, [list, query]);

  const isSelected = (p: ListItem) => selected.some((s) => s.saved_name === p.saved_name);

  const toggle = (p: ListItem) => {
    if (isSelected(p)) {
      setSelected(selected.filter((s) => s.saved_name !== p.saved_name));
    } else if (selected.length < MAX) {
      setSelected([...selected, p]);
    }
  };

  if (loading) {
    return (
      <div className="center">
        <div className="spinner" />
        포켓몬 목록을 불러오는 중...
      </div>
    );
  }
  if (error) return <div className="error">목록 로드 실패: {error}</div>;

  return (
    <>
      <div className="selectbar">
        <div className="slots">
          {Array.from({ length: MAX }).map((_, i) => {
            const s = selected[i];
            return (
              <div key={i} className={`slot ${s ? 'filled' : ''}`}>
                {s ? (
                  <>
                    {s.image_path && <img src={s.image_path} alt={s.saved_name} />}
                    <span>{s.name_ko || s.title || s.saved_name}</span>
                    <button className="rm" onClick={() => toggle(s)} title="제거">
                      ×
                    </button>
                  </>
                ) : (
                  <span className="placeholder">코어 {i + 1} 선택</span>
                )}
              </div>
            );
          })}
        </div>
        <button
          className="btn-primary"
          disabled={selected.length === 0}
          onClick={() => onRecommend(selected)}
        >
          파티 추천 받기 ({selected.length}/{MAX})
        </button>
      </div>

      <input
        className="search"
        placeholder="포켓몬 이름 검색 (예: 한카리아스, 켄타로스, 리자몽 / Garchomp)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="grid">
        {filtered.map((p) => {
          const sel = isSelected(p);
          const disabled = !sel && selected.length >= MAX;
          return (
            <div
              key={p.saved_name}
              className={`pcard ${sel ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
              onClick={() => !disabled && toggle(p)}
            >
              {p.image_path && <img src={p.image_path} alt={p.saved_name} loading="lazy" />}
              <div className="name">{p.name_ko || p.title || p.saved_name}</div>
              <div className="bst">종족값 {p.total}</div>
              <TypeRow t1={p.type1} t2={p.type2} />
            </div>
          );
        })}
      </div>
    </>
  );
}
