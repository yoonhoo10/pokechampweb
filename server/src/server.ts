/** Express 서버 진입점 */
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { db, initSchema } from './db.js';
import { api } from './routes/api.js';
import { runEtl } from './etl.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

initSchema();

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

app.use('/api', api);

app.get('/health', (_req, res) => res.json({ ok: true }));

// 프로덕션: 빌드된 클라이언트를 같은 origin에서 정적 서빙 (client/dist)
const CLIENT_DIST = join(__dirname, '..', '..', 'client', 'dist');
if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  // SPA 폴백: /api 외 모든 GET은 index.html
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(join(CLIENT_DIST, 'index.html'));
  });
  console.log(`[server] 정적 클라이언트 서빙: ${CLIENT_DIST}`);
}

// DB가 비어 있으면(예: 배포 후 첫 부팅) 자동으로 ETL 1회 수행 — 작업용 캐시 복구
async function ensureData() {
  const row = db.prepare('SELECT COUNT(*) AS c FROM pokemon_forms').get() as { c: number };
  if (row.c === 0) {
    console.log('[server] DB가 비어 있음 → ETL 자동 수집 시작...');
    try {
      await runEtl();
    } catch (e) {
      console.error('[server] 자동 ETL 실패:', e);
    }
  }
}

app.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT} 실행 중`);
  void ensureData();
});
