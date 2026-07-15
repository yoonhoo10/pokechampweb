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
- `GET /api/metadata/:base_name` — 폼별 종족값/타입/특성 (예: `/api/metadata/tauros`)
- `GET /api/battle/:format/:saved_name?season=...` — 시즌별 사용률 데이터 (rank+percentage)
  - ⚠️ API 실제 category 이름은 스키마와 달라 ETL에서 매핑함: `held_item→item`, `stat_alignment→nature`, `stat_points→spread` (`move`/`ability`/`teammate`는 동일). `nature`는 `stat_up`/`stat_down`을, `spread`는 `*_points` 필드를 조합해 문자열로 저장.

**API 이용약관 (반드시 준수)**
- 캐싱은 허용되나 **영구 미러/아카이브 금지** → 로컬 DB는 "작업용 캐시"로 취급, 주기적 재수집 스크립트 전제로 설계
- **출처 표기 필수**: 사이트 어딘가에 `Battle data provided by Pokémon Champions Battle Data (https://championsbattledata.com/)` 명시
- 재판매/재배포 금지 (원본 API 응답을 그대로 파는 서비스 금지, 가공된 추천 결과 제공은 문제 없음)
- 상업적 이용 가능, 단 공식 서비스로 오인되게 하면 안 됨

### 자체 정적 데이터 (직접 구축, API에 없음)
1. **타입 상성표** (18타입 x 18타입 배율) — 고정 게임 규칙
2. **유틸리티 기술 태그** — 파티 플랜(리드/윈컨디션) 판단용, 아래 소규모 목록만 사용 (전체 무브덱스 X)

| 태그 | 기술 |
|---|---|
| `hazard_set` | Stealth Rock, Spikes, Toxic Spikes, Sticky Web |
| `hazard_remove` | Rapid Spin, Defog, Court Change |
| `weather_set` | Sunny Day, Rain Dance, Sandstorm, Snowscape |
| `screen_set` | Reflect, Light Screen, Aurora Veil |
| `speed_control` | Tailwind, Trick Room, Thunder Wave, Icy Wind |
| `recovery` | Recover, Roost, Slack Off, Synthesis, Moonlight, Wish |
| `pivot` | U-turn, Volt Switch, Flip Turn, Teleport, Baton Pass |

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

### 5. 파티 플랜 생성
- `move_tags` 매핑으로 각 멤버 기술 중 리드 후보(hazard_set 등), 스피드 컨트롤 여부(speed_control) 판별
- base spe 비교로 근사 스피드 서열 판단 (정밀 계산은 spread 파싱 이후 과제)
- 위 정보를 조합해 "리드 추천 + 이유", "윈 컨디션 시나리오" 텍스트 템플릿 생성

---

## 화면 흐름 (User Flow)

```
[포켓몬 선택 화면] → 코어 포켓몬 1~3마리 선택 (색/무늬만 다른 장식 폼은 대표 1마리로 통합 표시, 이름·한국어 검색 지원)
   ↓
[파티 추천 결과 화면] → 파티 옵션 2~3개 카드 형태로 비교
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
