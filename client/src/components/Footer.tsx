import { useEffect, useState } from 'react';
import { fetchAttribution } from '../api';
import type { Attribution } from '../types';

export function Footer() {
  const [attr, setAttr] = useState<Attribution | null>(null);
  useEffect(() => {
    fetchAttribution().then(setAttr).catch(() => {});
  }, []);

  return (
    <footer className="footer">
      <div>
        {attr?.dataSource || 'Battle data provided by Pokémon Champions Battle Data'}{' '}
        (<a href="https://championsbattledata.com/" target="_blank" rel="noreferrer">
          championsbattledata.com
        </a>)
      </div>
      <div style={{ marginTop: 6 }}>
        {attr?.disclaimer ||
          '본 서비스는 비공식이며 Pokémon, Nintendo, Creatures Inc., GAME FREAK, The Pokémon Company와 무관합니다.'}
      </div>
    </footer>
  );
}
