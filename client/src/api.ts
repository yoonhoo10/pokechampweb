import type { ListItem, RecommendResult, Attribution } from './types';

async function jget<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`요청 실패: ${res.status}`);
  return res.json();
}

export function fetchPokemonList(): Promise<ListItem[]> {
  return jget<ListItem[]>('/api/pokemon');
}

export function fetchAttribution(): Promise<Attribution> {
  return jget<Attribution>('/api/attribution');
}

export async function recommend(cores: string[]): Promise<RecommendResult> {
  const res = await fetch('/api/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cores }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `추천 실패: ${res.status}`);
  }
  return res.json();
}
