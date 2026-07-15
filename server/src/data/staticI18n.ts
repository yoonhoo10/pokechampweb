/**
 * PokeAPI로 수집하지 않는(또는 재조립이 필요한) 정적 한국어 매핑.
 * - 타입 18종: 고정 게임 규칙
 * - 능력치 약어: 성격 접미사(+공격/-스피드 등) 재조립용
 * - 폼 라벨: 실전에서 통용되는 확실한 공식 한국어만 등록.
 *   목록에 없는 장식 폼(비비용 무늬, 마피티프 트림 등)은 영어 라벨을 괄호로 유지 (임의 번역 금지)
 */

export const TYPE_KO: Record<string, string> = {
  Normal: '노말', Fire: '불꽃', Water: '물', Electric: '전기', Grass: '풀', Ice: '얼음',
  Fighting: '격투', Poison: '독', Ground: '땅', Flying: '비행', Psychic: '에스퍼', Bug: '벌레',
  Rock: '바위', Ghost: '고스트', Dragon: '드래곤', Dark: '악', Steel: '강철', Fairy: '페어리',
};

/** 성격 접미사 "(+Sp. Atk / -Speed)" 재조립용 능력치 약어 */
export const STAT_KO: Record<string, string> = {
  HP: 'HP',
  Attack: '공격',
  Defense: '방어',
  'Sp. Atk': '특공',
  'Sp. Def': '특방',
  Speed: '스피드',
};

/**
 * 폼 라벨 -> 한국어. prefix=true면 이름 앞에 붙임(알로라 나인테일),
 * false면 이름 뒤 괄호(이지스팀 (블레이드폼)).
 * Mega X/Y는 code에서 특수 처리.
 */
export const FORM_LABEL_KO: Record<string, { ko: string; prefix: boolean }> = {
  // 메가진화
  Mega: { ko: '메가', prefix: true },
  'Mega X': { ko: '메가', prefix: true },
  'Mega Y': { ko: '메가', prefix: true },
  // 리전폼
  Alolan: { ko: '알로라', prefix: true },
  Galarian: { ko: '가라르', prefix: true },
  Hisuian: { ko: '히스이', prefix: true },
  // 팔데아 켄타로스 3종
  'Paldean Combat Breed': { ko: '팔데아 콤배트종', prefix: true },
  'Paldean Blaze Breed': { ko: '팔데아 블레이즈종', prefix: true },
  'Paldean Aqua Breed': { ko: '팔데아 아쿠아종', prefix: true },
  // 로토무 폼
  Heat: { ko: '히트', prefix: true },
  Wash: { ko: '워시', prefix: true },
  Frost: { ko: '프로스트', prefix: true },
  Fan: { ko: '스핀', prefix: true },
  Mow: { ko: '커트', prefix: true },
  // 이지스팀
  'Shield Forme': { ko: '실드폼', prefix: false },
  'Blade Forme': { ko: '블레이드폼', prefix: false },
  // 루가루암
  'Midnight Form': { ko: '한밤중의 모습', prefix: false },
  'Dusk Form': { ko: '황혼의 모습', prefix: false },
  // 팔라플레
  'Zero Form': { ko: '노말폼', prefix: false },
  'Hero Form': { ko: '히어로폼', prefix: false },
  // 모르페코
  'Hangry Mode': { ko: '공복모드', prefix: false },
  // 대왕끼리동/블러디플레(성별 형태)
  Male: { ko: '수컷', prefix: false },
  Female: { ko: '암컷', prefix: false },
  // 캐스퐁
  'Sunny Form': { ko: '태양의 모습', prefix: false },
  'Rainy Form': { ko: '비의 모습', prefix: false },
  'Snowy Form': { ko: '설원의 모습', prefix: false },
};

/** 폼 라벨을 한국어 표시명으로 조립. 미등록 라벨은 영어 라벨을 괄호로 유지 */
export function composeFormKo(koBase: string, formLabel: string | null): string {
  if (!formLabel) return koBase;
  const entry = FORM_LABEL_KO[formLabel];
  if (!entry) return `${koBase} (${formLabel})`; // 미등록(장식 폼): 임의 번역 금지
  if (entry.prefix) {
    let out = `${entry.ko} ${koBase}`;
    if (formLabel === 'Mega X') out += ' X';
    else if (formLabel === 'Mega Y') out += ' Y';
    return out;
  }
  return `${koBase} (${entry.ko})`;
}
