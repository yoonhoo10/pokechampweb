/**
 * PokeAPI 자동 매칭 실패/오매칭 수동 보정.
 * i18n ETL 마지막 단계에서 INSERT OR REPLACE 로 name_i18n 에 덮어씀.
 * category: pokemon / move / ability / item / nature
 * en: DB에 저장된 영어 키(정확히 일치), ko: 공식 한국어 이름
 */
export const NAME_OVERRIDES: { category: string; en: string; ko: string }[] = [
  // 실제 아이템이나 PokeAPI 한국어 미등록 (공식명 수동 보정)
  { category: 'item', en: 'Fairy Feather', ko: '페어리의 깃털' },

  // 챔피언스 오리지널 메가스톤: 공식 게임엔 없어 공식 한국어명이 없음.
  // 공식 메가스톤 명명규칙 '{종족한국어명}나이트' 를 그대로 적용 (종족명은 공식).
  { category: 'item', en: 'Barbaracite', ko: '거북손데스나이트' },
  { category: 'item', en: 'Chandelurite', ko: '샹델라나이트' },
  { category: 'item', en: 'Chesnaughtite', ko: '브리가론나이트' },
  { category: 'item', en: 'Chimechite', ko: '치렁나이트' },
  { category: 'item', en: 'Clefablite', ko: '픽시나이트' },
  { category: 'item', en: 'Crabominite', ko: '모단단게나이트' },
  { category: 'item', en: 'Delphoxite', ko: '마폭시나이트' },
  { category: 'item', en: 'Dragalgite', ko: '드래캄나이트' },
  { category: 'item', en: 'Dragoninite', ko: '망나뇽나이트' },
  { category: 'item', en: 'Drampanite', ko: '할비롱나이트' },
  { category: 'item', en: 'Emboarite', ko: '염무왕나이트' },
  { category: 'item', en: 'Eelektrossite', ko: '저리더프나이트' },
  { category: 'item', en: 'Falinksite', ko: '대여르나이트' },
  { category: 'item', en: 'Excadrite', ko: '몰드류나이트' },
  { category: 'item', en: 'Feraligite', ko: '장크로다일나이트' },
  { category: 'item', en: 'Floettite', ko: '플라엣테나이트' },
  { category: 'item', en: 'Froslassite', ko: '눈여아나이트' },
  { category: 'item', en: 'Glimmoranite', ko: '킬라플로르나이트' },
  { category: 'item', en: 'Golurkite', ko: '골루그나이트' },
  { category: 'item', en: 'Greninjite', ko: '개굴닌자나이트' },
  { category: 'item', en: 'Hawluchanite', ko: '루차불나이트' },
  { category: 'item', en: 'Malamarite', ko: '칼라마네로나이트' },
  { category: 'item', en: 'Meganiumite', ko: '메가니움나이트' },
  { category: 'item', en: 'Meowsticite', ko: '냐오닉스나이트' },
  { category: 'item', en: 'Pyroarite', ko: '화염레오나이트' },
  { category: 'item', en: 'Raichunite X', ko: '라이츄나이트X' },
  { category: 'item', en: 'Raichunite Y', ko: '라이츄나이트Y' },
  { category: 'item', en: 'Scolipite', ko: '펜드라나이트' },
  { category: 'item', en: 'Scovillainite', ko: '스코빌런나이트' },
  { category: 'item', en: 'Scraftinite', ko: '곤율거니나이트' },
  { category: 'item', en: 'Skarmorite', ko: '무장조나이트' },
  { category: 'item', en: 'Staraptite', ko: '찌르호크나이트' },
  { category: 'item', en: 'Starminite', ko: '아쿠스타나이트' },
  { category: 'item', en: 'Victreebelite', ko: '우츠보트나이트' },
];
