/** 정적 데이터 seed: type_chart, move_tags (idempotent) */
import { db, initSchema, tx } from './db.js';
import { buildTypeChartRows } from './data/typeChart.js';
import { buildMoveTagRows } from './data/moveTags.js';

export function seedStatic(): void {
  initSchema();

  const typeRows = buildTypeChartRows();
  const moveRows = buildMoveTagRows();

  const insertType = db.prepare(
    `INSERT OR REPLACE INTO type_chart (attacking_type, defending_type, multiplier) VALUES (?, ?, ?)`
  );
  const insertTag = db.prepare(
    `INSERT OR REPLACE INTO move_tags (move_name, tag) VALUES (?, ?)`
  );

  tx(() => {
    db.exec('DELETE FROM type_chart; DELETE FROM move_tags;');
    for (const r of typeRows) insertType.run(r.attacking_type, r.defending_type, r.multiplier);
    for (const r of moveRows) insertTag.run(r.move_name, r.tag);
  });

  console.log(`[seed] type_chart: ${typeRows.length} rows, move_tags: ${moveRows.length} rows`);
}

// 직접 실행 시에만 seed 수행 (import 시에는 실행 안 함)
import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedStatic();
}
