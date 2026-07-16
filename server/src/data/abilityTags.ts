/** 전략 판단용 특성 태그 (정적, 소규모) — 팀 아키타입 감지용
 *  특성명은 API 원본대로 영어 title-case. move_tags 와 달리 DB에 넣지 않고
 *  planService 에서 런타임 분류에만 사용한다. */

export const ABILITY_TAGS: Record<string, string[]> = {
  weather_rain: ['Drizzle'],
  weather_sun: ['Drought', 'Orichalcum Pulse'],
  weather_sand: ['Sand Stream'],
  weather_snow: ['Snow Warning'],
  regenerator: ['Regenerator'],
  weather_abuser: ['Swift Swim', 'Chlorophyll', 'Sand Rush', 'Slush Rush', 'Sand Force', 'Solar Power'],
  setup_sweeper: ['Speed Boost', 'Protean', 'Libero', 'Moody'],
};

/** 특성명(소문자 정규화) -> 태그 목록 역인덱스 */
export const ABILITY_TAG_BY_NAME: Record<string, string[]> = {};
for (const [tag, names] of Object.entries(ABILITY_TAGS)) {
  for (const n of names) (ABILITY_TAG_BY_NAME[n.toLowerCase()] ||= []).push(tag);
}
