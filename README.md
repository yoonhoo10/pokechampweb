# 포켓몬 챔피언스 파티 추천 웹

코어 포켓몬 1~3마리를 선택하면 실전 사용률 데이터를 바탕으로 **나머지 파티원 · 기술 · 특성 · 노력치/성격 · 아이템 · 운용 플랜**을 추천하는 웹 앱입니다. (싱글 배틀)

> 본 서비스는 비공식이며 Pokémon, Nintendo, Creatures Inc., GAME FREAK, The Pokémon Company와 무관합니다.
> Battle data provided by Pokémon Champions Battle Data (https://championsbattledata.com/)

## 구성

| 영역 | 스택 |
|---|---|
| 프론트엔드 | React 18 + Vite + TypeScript (`client/`) |
| 백엔드 | Node.js + Express + TypeScript (`server/`) |
| DB | SQLite (Node 내장 `node:sqlite`, 파일 `server/data.db`) |

> 참고: 원래 계획은 `better-sqlite3`였으나 Windows 네이티브 빌드 도구(Visual Studio)가 없어,
> 네이티브 컴파일이 필요 없는 Node 24 내장 `node:sqlite` 모듈로 대체했습니다.
> 실행 시 `--experimental-sqlite` 플래그가 필요합니다(각 npm 스크립트에 포함됨).

## 사전 요구사항

- Node.js 22.5+ (권장 24+, `node:sqlite` 사용)

## 설치 & 실행

### 1) 백엔드

```bash
cd server
npm install
npm run etl     # 최초 1회: API에서 데이터 수집 → data.db 생성 (약 10~15초)
npm run dev     # http://localhost:4000
```

- `npm run seed` — 정적 데이터(타입 상성표, 기술 태그)만 재시드
- `npm run etl` — 전체 재수집 (idempotent: 기존 데이터 삭제 후 재삽입). 주기 실행 가능.

### 2) 프론트엔드

```bash
cd client
npm install
npm run dev     # http://localhost:5173  (/api 요청은 4000으로 프록시)
```

브라우저에서 http://localhost:5173 접속.

## 화면 흐름

1. **포켓몬 선택** — 검색 + 그리드에서 코어 1~3마리 선택
2. **파티 추천 결과** — 균형형 / 메타 시너지형 / 상성 안정형 옵션 비교
3. **파티 상세** — 멤버별 기술·특성·노력치·아이템 사용률 + 운용 플랜
4. **내보내기** — Pokémon Showdown 유사 텍스트 복사

## API 엔드포인트 (백엔드)

- `GET  /api/pokemon` — 전체 포켓몬(폼) 목록
- `GET  /api/pokemon/:savedName` — 단일 폼 상세 + 사용률 전체
- `POST /api/recommend` — `{ "cores": ["Garchomp", ...] }` → 파티 옵션 2~3개
- `GET  /api/attribution` — 출처/면책 문구

## 추천 알고리즘 요약

1. 코어의 타입 약점 프로필 계산 (`type_chart` 조인, 공유 약점 가중)
2. 후보 생성: 실전 `teammate` 상관 + 약점 커버 타입 후보
3. 가중 스코어링: `팀메이트 상관 + 타입 커버리지 + 역할 다양성 − 약점 중첩 + 종족값`
4. 그리디로 슬롯을 채우며 매번 약점 프로필 재계산 → 가중치 프리셋별 옵션 2~3개
5. 기술/특성/성격/노력치/아이템은 사용률 순위 그대로 노출
6. `move_tags` + 종족값으로 리드/스피드컨트롤/윈컨디션 플랜 텍스트 생성

## 배포 (Render)

프론트(정적 빌드)와 백엔드(Express)를 **하나의 웹 서비스**로 배포합니다.
루트 `package.json`이 `build`(client·server 설치 → 프론트 빌드 → ETL로 `data.db` 생성)와
`start`(Express 실행, 프론트도 같은 서버가 서빙)를 대신 처리합니다.

> `data.db`는 배포 시 build 단계에서 새로 생성되며, 비어 있으면 서버 첫 부팅 때 자동으로 ETL이 1회 돕니다(작업용 캐시).
> ETL 마지막에 i18n(PokeAPI 한국어 이름 매핑)까지 자동 수집합니다.

### Render
1. GitHub에 저장소 push
2. Render → **New +** → **Blueprint** → 저장소 선택 (루트 `render.yaml` 자동 인식)
3. 배포 완료 후 부여된 URL 접속
4. 이후 `main` 브랜치에 push하면 자동 재배포

- `PORT` 환경변수를 자동 주입 → 서버가 이를 사용 (`process.env.PORT`)
- Node 22.5+ 필요 (`engines` 및 `render.yaml`의 `NODE_VERSION`에 명시)
- 로컬 통합 실행 테스트: `npm run build && npm start`

## MVP 이후 과제

- 기술 타입/분류/위력 테이블 → 추천 설명 근거
- spread 문자열 파싱 → 정밀 스피드/데미지 계산
- 다중 시즌 누적, 카운터 팀 추천, 파티 저장/공유, 더블 배틀
