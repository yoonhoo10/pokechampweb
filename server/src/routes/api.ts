/** API 라우트 */
import { Router } from 'express';
import { listForms, getForm, getUsage } from '../services/repo.js';
import { recommendParties, recommendRandomParty } from '../services/recommendService.js';

export const api = Router();

/** 출처/저작권 표기 */
api.get('/attribution', (_req, res) => {
  res.json({
    dataSource: 'Battle data provided by Pokémon Champions Battle Data (https://championsbattledata.com/)',
    disclaimer:
      '본 서비스는 비공식이며 Pokémon, Nintendo, Creatures Inc., GAME FREAK, The Pokémon Company와 무관합니다.',
  });
});

/** 포켓몬(폼) 전체 목록 — 선택 화면용 */
api.get('/pokemon', (_req, res) => {
  res.json(listForms());
});

/** 단일 폼 상세 (기술/특성/성격/노력치/아이템 사용률 포함) */
api.get('/pokemon/:savedName', (req, res) => {
  const form = getForm(req.params.savedName);
  if (!form) return res.status(404).json({ error: 'not found' });
  res.json({
    form,
    moves: getUsage(form.saved_name, 'move'),
    abilities: getUsage(form.saved_name, 'ability'),
    natures: getUsage(form.saved_name, 'nature'),
    spreads: getUsage(form.saved_name, 'spread'),
    items: getUsage(form.saved_name, 'item'),
    teammates: getUsage(form.saved_name, 'teammate'),
  });
});

/** 파티 추천 — body: { cores: string[] } (saved_name 1~3개) */
api.post('/recommend', (req, res) => {
  const cores = req.body?.cores;
  if (!Array.isArray(cores) || cores.length < 1 || cores.length > 3) {
    return res.status(400).json({ error: '코어 포켓몬은 1~3마리여야 합니다.' });
  }
  try {
    const result = recommendParties(cores.map(String));
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/** 완전 무작위 6마리 파티 추천 (코어 선택 없음) */
api.post('/random-party', (_req, res) => {
  try {
    res.json(recommendRandomParty());
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
