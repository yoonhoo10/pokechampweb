/** 유틸리티 기술 태그 (정적, 소규모) — 파티 플랜 판단용 */

export const MOVE_TAGS: Record<string, string[]> = {
  hazard_set: ['Stealth Rock', 'Spikes', 'Toxic Spikes', 'Sticky Web'],
  hazard_remove: ['Rapid Spin', 'Defog', 'Court Change'],
  weather_set: ['Sunny Day', 'Rain Dance', 'Sandstorm', 'Snowscape'],
  screen_set: ['Reflect', 'Light Screen', 'Aurora Veil'],
  speed_control: ['Tailwind', 'Trick Room', 'Thunder Wave', 'Icy Wind'],
  recovery: ['Recover', 'Roost', 'Slack Off', 'Synthesis', 'Moonlight', 'Wish'],
  pivot: ['U-turn', 'Volt Switch', 'Flip Turn', 'Teleport', 'Baton Pass'],
};

export interface MoveTagRow {
  move_name: string;
  tag: string;
}

export function buildMoveTagRows(): MoveTagRow[] {
  const rows: MoveTagRow[] = [];
  for (const [tag, moves] of Object.entries(MOVE_TAGS)) {
    for (const move of moves) rows.push({ move_name: move, tag });
  }
  return rows;
}
