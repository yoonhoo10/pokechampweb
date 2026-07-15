import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = join(__dirname, '..', 'data.db');

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

/** node:sqlite에는 db.transaction()이 없으므로 수동 트랜잭션 헬퍼 제공 */
export function tx(fn: () => void): void {
  db.exec('BEGIN');
  try {
    fn();
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** 스키마 생성 (idempotent) */
export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pokemon_forms (
      saved_name    TEXT PRIMARY KEY,
      base_name     TEXT NOT NULL,
      title         TEXT,
      form_label    TEXT,
      type1         TEXT NOT NULL,
      type2         TEXT,
      hp INTEGER, atk INTEGER, def INTEGER, spa INTEGER, spd INTEGER, spe INTEGER, total INTEGER,
      image_path    TEXT,
      fetched_at    TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pokemon_base_name ON pokemon_forms(base_name);

    CREATE TABLE IF NOT EXISTS pokemon_abilities (
      saved_name    TEXT NOT NULL REFERENCES pokemon_forms(saved_name),
      ability_name  TEXT NOT NULL,
      PRIMARY KEY (saved_name, ability_name)
    );

    CREATE TABLE IF NOT EXISTS battle_usage_rows (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      saved_name    TEXT NOT NULL REFERENCES pokemon_forms(saved_name),
      format        TEXT NOT NULL,
      season        TEXT NOT NULL,
      category      TEXT NOT NULL,
      rank          INTEGER,
      name          TEXT NOT NULL,
      percentage    REAL,
      fetched_at    TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (saved_name, format, season, category, rank)
    );
    CREATE INDEX IF NOT EXISTS idx_battle_lookup ON battle_usage_rows(saved_name, format, category);

    CREATE TABLE IF NOT EXISTS type_chart (
      attacking_type TEXT NOT NULL,
      defending_type TEXT NOT NULL,
      multiplier     REAL NOT NULL,
      PRIMARY KEY (attacking_type, defending_type)
    );

    CREATE TABLE IF NOT EXISTS move_tags (
      move_name TEXT NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (move_name, tag)
    );

    -- 영어 -> 한국어 공식 이름 매핑 (작업용 캐시, PokeAPI + 정적 seed)
    CREATE TABLE IF NOT EXISTS name_i18n (
      category TEXT NOT NULL,   -- pokemon / move / ability / item / nature / type / form_label
      en TEXT NOT NULL,         -- 데이터에 저장된 영어 키
      ko TEXT NOT NULL,
      PRIMARY KEY (category, en)
    );
  `);
}

export default db;
