# 포켓몬 챔피언스 파티 추천 웹사이트

## 프로젝트 개요

사용자가 코어 포켓몬 1~3마리를 선택하면, 실전 데이터와 밸런스 이론을 바탕으로 **나머지 파티원, 기술, 특성, 노력치/성격, 운용 플랜**까지 한 번에 추천해주는 웹 애플리케이션.

- 타겟 포맷: **싱글 배틀**
- 비공식 서비스이며 Pokémon, Nintendo, Creatures Inc., GAME FREAK, The Pokémon Company와 무관함 (푸터/문서에 명시 필요)

---

## 기술 스택

| 영역 | 선택 |
|---|---|
| 프론트엔드 | React (SPA), Vite, TypeScript |
| 백엔드 | Node.js + Express + TypeScript (tsx로 실행, 별도 빌드 없음) |
| DB | SQLite (파일 기반). Node 내장 `node:sqlite`의 `DatabaseSync` 사용 (실행 시 `--experimental-sqlite` 플래그, Node ≥ 22.5) |
| 배포 | Render 단독 배포 (`render.yaml`). 서버가 빌드된 클라이언트(`client/dist`)를 정적 서빙 + `/api/*` 제공 |

---

## 데이터 소스

### Pokémon Champions Battle Data API — https://championsbattledata.com/

인증 불필요, 고정 rate limit 없음. 아래 엔드포인트 사용:

- `GET /api` 또는 `/api/index` — 전체 포켓몬 인덱스 (= 화이트리스트 역할, 챔피언스에 실제 존재하는 포켓몬만 여기 나옴)
- `GET /api/metadata/:base_name` — 폼별 능력치/타입/특성 (예: `/api/metadata/tauros`)
  - ⚠️ 여기서 오는 `hp/atk/def/spa/spd/spe/total`은 **종족값이 아니라 레벨50 실능력치**(IV31/EV0/무보정)다. DB엔 원본 그대로 저장하고, 종족값 변환(HP-75 / 그 외 -20, total은 합 재계산)은 `repo.ts`의 `toBaseStats`에서 읽는 시점에 수행한다.
- `GET /api/battle/:format/:saved_name?season=...` — 시즌별 사용률 데이터 (rank+percentage)
  - ⚠️ API 실제 category 이름은 스키마와 달라 ETL에서 매핑함: `held_item→item`, `stat_alignment→nature`, `stat_points→spread` (`move`/`ability`/`teammate`는 동일). `nature`는 `stat_up`/`stat_down`을, `spread`는 `*_points` 필드를 조합해 문자열로 저장.

**API 이용약관 (반드시 준수)**
- 캐싱은 허용되나 **영구 미러/아카이브 금지** → 로컬 DB는 "작업용 캐시"로 취급, 주기적 재수집 스크립트 전제로 설계
- **출처 표기 필수**: 사이트 어딘가에 `Battle data provided by Pokémon Champions Battle Data (https://championsbattledata.com/)` 명시
- 재판매/재배포 금지 (원본 API 응답을 그대로 파는 서비스 금지, 가공된 추천 결과 제공은 문제 없음)
- 상업적 이용 가능, 단 공식 서비스로 오인되게 하면 안 됨

### 자체 정적 데이터 (직접 구축, API에 없음)
1. **타입 상성표** (18타입 x 18타입 배율) — 고정 게임 규칙
2. **유틸리티 기술 태그** — 파티 플랜(선봉/승리 플랜) 판단용, 아래 소규모 목록만 사용 (전체 무브덱스 X)

| 태그 | 기술 |
|---|---|
| `hazard_set` | Stealth Rock, Spikes, Toxic Spikes, Sticky Web |
| `hazard_remove` | Rapid Spin, Defog, Court Change |
| `weather_set` | Sunny Day, Rain Dance, Sandstorm, Snowscape |
| `screen_set` | Reflect, Light Screen, Aurora Veil |
| `speed_control` | Tailwind, Trick Room, Thunder Wave, Icy Wind |
| `recovery` | Recover, Roost, Slack Off, Synthesis, Moonlight, Wish |
| `pivot` | U-turn, Volt Switch, Flip Turn, Teleport, Baton Pass |

3. **전략 특성 태그** — 팀 아키타입 판단용 소규모 특성 큐레이션 맵 (`server/src/data/abilityTags.ts`의 `ABILITY_TAGS`). 특성명은 API 원본대로 **영어 title-case**. move_tags와 달리 **DB에 넣지 않고** `planService`에서 런타임 분류에만 사용 (특성은 이미 `pokemon_abilities`/사용률 row에 있음).

| 태그 | 특성 |
|---|---|
| `weather_rain/sun/sand/snow` | Drizzle / Drought·Orichalcum Pulse / Sand Stream / Snow Warning |
| `regenerator` | Regenerator |
| `weather_abuser` | Swift Swim, Chlorophyll, Sand Rush, Slush Rush, Sand Force, Solar Power |
| `setup_sweeper` | Speed Boost, Protean, Libero, Moody |

> ⚠️ 기술의 타입/분류/위력 등 상세 스펙 정적 테이블은 **MVP에서 의도적으로 생략**. 기술 추천은 API의 사용률 순위(rank+percentage)만 그대로 노출하고, "왜 이 기술인지"에 대한 설명 근거는 MVP 이후 과제.

---

## 데이터베이스 스키마 (SQLite)

```sql
-- 포켓몬 폼별 기본 정보
CREATE TABLE pokemon_forms (
  saved_name    TEXT PRIMARY KEY,   -- 예: "Paldean Tauros Aqua Breed"
  base_name     TEXT NOT NULL,      -- 예: "Tauros"
  title         TEXT,
  form_label    TEXT,
  type1         TEXT NOT NULL,
  type2         TEXT,
  hp INTEGER, atk INTEGER, def INTEGER, spa INTEGER, spd INTEGER, spe INTEGER, total INTEGER,
  image_path    TEXT,
  fetched_at    TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_pokemon_base_name ON pokemon_forms(base_name);

-- 특성 (다대다)
CREATE TABLE pokemon_abilities (
  saved_name    TEXT NOT NULL REFERENCES pokemon_forms(saved_name),
  ability_name  TEXT NOT NULL,
  PRIMARY KEY (saved_name, ability_name)
);

-- 시즌별 사용률 데이터 (최신 시즌 1개만 유지, 갱신 시 덮어씀)
CREATE TABLE battle_usage_rows (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  saved_name    TEXT NOT NULL REFERENCES pokemon_forms(saved_name),
  format        TEXT NOT NULL,      -- "Singles"
  season        TEXT NOT NULL,
  category      TEXT NOT NULL,      -- move / item / ability / nature / spread / teammate
  rank          INTEGER,
  name          TEXT NOT NULL,      -- 기술명/아이템명/팀메이트명/"252/0/0/0/0/252" 문자열 그대로
  percentage    REAL,
  fetched_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (saved_name, format, season, category, rank)
);
CREATE INDEX idx_battle_lookup ON battle_usage_rows(saved_name, format, category);

-- 타입 상성표 (정적)
CREATE TABLE type_chart (
  attacking_type TEXT NOT NULL,
  defending_type TEXT NOT NULL,
  multiplier     REAL NOT NULL,
  PRIMARY KEY (attacking_type, defending_type)
);

-- 유틸리티 기술 태그 (정적, 소규모)
CREATE TABLE move_tags (
  move_name TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (move_name, tag)
);

-- 영어 -> 한국어 공식 이름 매핑 (작업용 캐시, PokeAPI + 정적 seed)
CREATE TABLE name_i18n (
  category TEXT NOT NULL,   -- pokemon / move / ability / item / nature / type / form_label
  en TEXT NOT NULL,         -- 데이터에 저장된 영어 키
  ko TEXT NOT NULL,
  PRIMARY KEY (category, en)
);
```

**설계 원칙**
- spread(노력치)는 문자열 그대로 저장 (파싱은 MVP 이후 과제, 컬럼 순서는 HP/Atk/Def/SpA/SpD/Spe로 추정되나 실제 API 응답으로 재확인 필요)
- 시즌은 최신 1개만 유지, 갱신 시 `battle_usage_rows`를 통째로 지우고 다시 채우는 방식
- 역할군(스위퍼/벽/서포터) 태그, 실질 스피드 계산 등은 DB에 저장하지 않고 서비스 레이어에서 요청 시 계산
- **종족값 변환**: `pokemon_forms`의 스탯 컬럼엔 API 원본(레벨50 실능력치)이 저장돼 있고, 진짜 종족값은 읽는 시점에 `repo.ts`의 `toBaseStats`가 역산한다(HP-75 / 그 외 -20). 역할·스코어링·화면 표시 모두 이 변환된 값을 사용 (원본 저장은 "작업용 캐시" 원칙 유지, 파생값은 서비스 레이어 계산)
- **장식 전용 폼 통합**: 색/무늬만 다른 폼(트리미앙·비비용·마휘핑·플라제스 등)은 DB에 개별 행으로 그대로 두되, **선택 화면 목록에서만 대표폼 1개로 접어서** 노출한다. DB를 건드리지 않으므로 재수집(ETL) 후에도 유지됨.
  - 판별: 한 `base_name`의 모든 폼이 타입/종족값/특성까지 완전히 동일하면 "장식 폼"으로 간주 (하드코딩 목록 아님, 데이터 기반 자동 감지 — `repo.ts`의 `cosmeticRepByBase`)
  - 대표폼: 기본형(`title === base_name`) > `form_label` 없는 것 > 첫 번째. 목록에서는 무늬 라벨을 떼고 종족명만 표시(예: "비비용")
  - 추천 로직은 이미 `base_name` 단위로 후보를 관리하므로 별도 처리 불필요

---

## 데이터 수집 (ETL) 절차

1. `/api/index` 호출 → `base_name` 목록 확보
2. 각 `base_name`으로 `/api/metadata/:base_name` 호출 → `pokemon_forms` + `pokemon_abilities` upsert
3. 모든 `saved_name`에 대해 `/api/battle/Singles/:saved_name?season={defaultSeason}` 호출 → `battle_usage_rows` upsert
4. 위 과정 실패 시 재시도 로직 필요 (saved_name에 공백/특수문자 있으므로 URL 인코딩 필수)
5. `type_chart`, `move_tags`는 정적 JSON에서 1회 seed
6. 재수집 스크립트는 주기 실행 가능하도록 idempotent하게 작성 (기존 데이터 삭제 후 재삽입)
7. ETL 완료 직후 **한국어 이름 매핑 수집**(`runI18n`) 실행 → `name_i18n` 채움. `npm run i18n`로 단독 실행도 가능 (데이터가 채워진 뒤여야 함)

### 한국어 이름(i18n) 매핑
- 자동 번역이 아니라 **PokeAPI 공식 로컬라이제이션(ko)**을 1:1 매칭 (`i18n.ts`). 포켓몬 종족명/기술/특성/아이템/성격 base word를 슬러그로 변환해 조회
- 타입 18종·능력치 약어·확실한 폼 라벨은 정적 seed(`data/staticI18n.ts`), PokeAPI 매칭 실패 건은 수동 등록(`data/nameOverrides.ts`)
- 성격은 base word만 매칭하고 접미사(+특공/-스피드)는 `STAT_KO`로 재조립. 미등록 장식 폼 라벨은 임의 번역하지 않고 영어 라벨을 괄호로 유지
- `name_i18n`도 작업용 캐시(영구 미러 아님) — 갱신 시 통째로 지우고 재삽입

---

## 추천 알고리즘

### 1. 파티 구축
- **Step 1**: 코어 포켓몬들의 타입 약점 프로필 계산 (`type1/type2` + `type_chart` 조인, 공유 약점일수록 가중치 ↑)
- **Step 2**: 후보군 생성
  - 코어 각각의 `battle_usage_rows WHERE category='teammate'` → 실전 상관관계 기반 후보
  - 코어의 공유 약점을 커버하는 타입을 가진 포켓몬 → 상성 보완 후보
- **Step 3**: 스코어링 (가중합)
  ```
  score = w1 * 팀메이트_상관점수
        + w2 * 타입_커버리지_점수
        + w3 * 역할_다양성_점수 (종족값 분포 기반 휴리스틱, 이미 뽑힌 멤버와 역할 안 겹치면 가점)
  ```
- **Step 4**: 슬롯을 하나씩 그리디하게 채우고, 채울 때마다 약점 프로필 재계산 → 이 과정을 다르게 반복해 파티 옵션 세트 2~3개 생성

### 2. 기술 추천
- `category='move'` 상위 4개를 사용률 순으로 그대로 노출 (설명 근거 없음, MVP 범위)

### 3. 특성 추천
- `category='ability'` 1위 기본 추천 + 2~3위 대안 노출

### 4. 성격/노력치 추천
- `category='nature'` 1위, `category='spread'` 1위 문자열 그대로 노출

### 5. 파티 플랜 생성 (`server/src/services/planService.ts`의 `buildPlan(members, coreNames)`)
멤버별로 `move_tags`(기술)와 `ABILITY_TAGS`(특성 — 사용률 1위 특성 우선, 없으면 보유 특성) 태그 + 역할(`inferRoles`) + 종족값을 집계해 팀 시그널을 만들고, 이를 스코어링해 **팀 아키타입 1개**를 선택한다. 미달 시 `balance_sweep` 폴백.

| 아키타입 | 트리거(요지) |
|---|---|
| `weather` | 날씨 세터(특성 `weather_*` 또는 날씨 기술) 존재 |
| `trick_room` | Trick Room 기술 + 저속고화력(spe≤60 & off≥100) 2마리+ |
| `regen_cycle` | 재생력 2마리+, 또는 재생력 1 + 피벗 2마리+ |
| `screen_offense` | 스크린 세터 1+ & 스위퍼 2마리+ |
| `hazard_stack` | 함정 세터 2마리+ |
| `stall` | 내구(Wall/Tank/Support) 3+ & 회복기 2+ & 스위퍼 ≤1 |
| `balance_sweep` | 폴백 (고화력 어태커 2마리 스윕) |

- **코어 활용 전략**(`coreStrategies`): `coreNames`로 코어를 식별해, 각 코어의 태그/특성/역할을 아키타입 맥락에서 1문장으로 서술 (날씨세터→재생력→함정→스크린→트릭룸→스피드컨트롤→피벗→스위퍼→받이→밸런스 우선순위). **코어가 받이·세터여도 플랜에 반드시 등장**한다(이전엔 어태커만 뽑혀 코어가 누락됐음).
- **승리 플랜**: 아키타입별로 다른 시나리오 텍스트 생성 (스윕 일변도 X — 사이클/지구전/날씨/도배 등). 선봉/함정/스피드컨트롤 목록과 요약(summary)도 아키타입 인식.
- base spe 비교로 근사 스피드 서열 판단 (정밀 계산은 spread 파싱 이후 과제)
- 한글 조사(이/가·을/를·으로/로)는 받침 유무로 자동 선택(`pickJosa`/`subj`/`obj`/`via`), 이름 뒤 괄호 라벨(예: "(수컷)")은 무시하고 판정
- **한국어 UI 용어 방침**: 대전 커뮤니티에서 실제로 쓰는 외래어(사이클·스피드 컨트롤·스위퍼·스윕·셋업·어태커·피벗·세터)는 그대로 두고, 잘 안 쓰거나 어색한 외래어만 순화한다 — 리드→선봉, 해저드→함정, 진입 데미지(해저드)→진입 함정, 윈 컨디션→승리 플랜, 스톨→지구전. 아키타입 라벨·플랜 텍스트를 새로 작성할 때 이 방침을 따른다(과거 표기가 섞이지 않도록)
- 반환 타입 `Plan`(planService) = `PartyOption.plan`(server `types.ts`) = `PartyPlan`(client `types.ts`) 3곳 수기 미러이므로 필드 추가 시 함께 동기화. 상세 화면은 아키타입 배지 + 코어 전략 박스, 결과 비교 카드는 아키타입 배지를 노출

### 6. 랜덤 파티 (코어 선택 없이 시작)
선택 화면 "🎲 랜덤으로 시작하기" 버튼 2종. 결과/상세/플랜 화면은 일반 추천과 동일하게 재사용한다.
- **랜덤 코어로 파티 추천**: 클라이언트가 목록에서 무작위 1마리를 골라 그대로 기존 `POST /api/recommend`에 코어로 넘긴다. 나머지 5마리는 위 1~4 알고리즘이 채운다. **백엔드/서버 로직 변경 없음** — 코어 소스만 랜덤일 뿐 흐름은 일반 추천과 동일.
- **6마리 완전 랜덤 파티**(`POST /api/random-party` → `recommendService.recommendRandomParty`): 파티 구축 알고리즘을 돌리지 않고 6마리를 통째로 무작위 고정한 뒤, 각 멤버의 기술/특성/노력치와 운용 플랜만 채운다.
  - 후보는 `repo.ts`의 `getRandomForms(n)` — **선택 화면 목록과 동일한 대표폼 집합**(장식폼 통합·정렬됨, `listForms()` 재사용)에서 Fisher–Yates 셔플로 뽑되 **같은 `base_name`(종족) 중복은 배제**. 영어 라벨 붙은 장식 폼이 튀어나오지 않는다.
  - 코어가 없으므로 `buildPlan`에 **빈 집합**을 넘긴다 → `coreStrategies`는 비고 "코어 활용 전략" 박스는 자동 생략. 나머지 아키타입 감지·선봉·승리 플랜은 무작위로 뽑힌 6마리 기준으로 그대로 동작(우연히 나온 팀 성향을 알려주는 셈).
  - `RecommendResult` 형태(옵션 1개)로 반환하고 `cores: []`. 멤버 `reason`은 `enrichMember(..., 'random')` → "완전 무작위로 편성된 파티원입니다."
  - 클라이언트는 `cores.length === 0`이면 결과 카드 노트를 "완전 무작위 편성", 상단 크럼을 "🎲 완전 랜덤 파티"로 표시.

---

## 화면 흐름 (User Flow)

```
[포켓몬 선택 화면] → 코어 포켓몬 1~3마리 선택 (색/무늬만 다른 장식 폼은 대표 1마리로 통합 표시, 이름·한국어 검색 지원)
   │  └─ 🎲 랜덤으로 시작하기: ① 랜덤 코어로 추천(무작위 1마리→일반 추천)  ② 6마리 완전 랜덤 파티
   ↓
[파티 추천 결과 화면] → 파티 옵션 2~3개 카드 형태로 비교 (완전 랜덤은 옵션 1개)
   ↓
[파티 상세 화면] → 포켓몬별 기술/특성/노력치 + 사용률 수치, 운용 플랜 텍스트
   ↓
[내보내기] → 텍스트 export (Pokemon Showdown 포맷 유사)
```

---

## MVP 범위

파티 구축 + 기술 배치 + 특성 추천 + 성격/노력치 추천 + 파티 플랜, 전체를 한 번에 포함.

## MVP 이후 과제 (지금은 의도적으로 보류)
- 기술 타입/분류/위력 정적 테이블 구축 → 기술 추천 설명 근거 제공
- spread 문자열 파싱(숫자화) → 정밀 스피드 계산, 데미지 계산
- 여러 시즌 누적 저장 → 트렌드 분석
- 카운터 팀 추천, 유저 파티 저장/공유 커뮤니티 기능
- Doubles(더블 배틀) 포맷 지원

---

## 법적/표기 요구사항 (개발 시 반드시 반영)
- 사이트 푸터 또는 별도 출처 페이지에 명시: `Battle data provided by Pokémon Champions Battle Data (https://championsbattledata.com/)`
- "본 서비스는 비공식이며 Pokémon, Nintendo, Creatures Inc., GAME FREAK, The Pokémon Company와 무관합니다" 문구 삽입
