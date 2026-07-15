import { useState } from 'react';
import { SelectScreen } from './components/SelectScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { DetailScreen } from './components/DetailScreen';
import { Footer } from './components/Footer';
import { recommend } from './api';
import type { ListItem, RecommendResult, PartyOption } from './types';

type View = 'select' | 'results' | 'detail';

export default function App() {
  const [view, setView] = useState<View>('select');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [cores, setCores] = useState<string[]>([]);
  const [activeOption, setActiveOption] = useState<PartyOption | null>(null);

  const handleRecommend = async (selected: ListItem[]) => {
    setLoading(true);
    setError(null);
    const names = selected.map((s) => s.saved_name);
    try {
      const r = await recommend(names);
      setResult(r);
      setCores(names);
      setView('results');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (opt: PartyOption) => {
    setActiveOption(opt);
    setView('detail');
    window.scrollTo(0, 0);
  };

  return (
    <div className="app">
      <header className="header">
        <h1>
          포켓몬 <span className="accent">챔피언스</span> 파티 추천
        </h1>
        <p>코어 포켓몬을 고르면 실전 사용률 데이터로 파티·기술·특성·노력치·운용 플랜을 추천합니다 · 싱글 배틀</p>
      </header>

      {view !== 'select' && (
        <div className="topnav">
          <button className="btn-ghost" onClick={() => setView('select')}>
            ← 포켓몬 다시 선택
          </button>
          {view === 'detail' && (
            <button className="btn-ghost" onClick={() => setView('results')}>
              ← 파티 옵션 목록
            </button>
          )}
          <span className="crumbs">
            선택한 코어: {cores.join(', ') || '-'}
          </span>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {loading && (
        <div className="center">
          <div className="spinner" />
          실전 데이터를 분석해 파티를 구성하는 중...
        </div>
      )}

      {!loading && view === 'select' && <SelectScreen onRecommend={handleRecommend} />}
      {!loading && view === 'results' && result && (
        <ResultsScreen result={result} coreSavedNames={cores} onOpenDetail={openDetail} />
      )}
      {!loading && view === 'detail' && activeOption && (
        <DetailScreen option={activeOption} coreSavedNames={cores} />
      )}

      <Footer />
    </div>
  );
}
