import { emptyDatabase, SCHEMA_VERSION } from '../domain/model.ts';
import type { Database } from '../domain/model.ts';

const clone = <T>(value: T): T => structuredClone(value);
export interface NativeStorage { read(): Promise<Database>; transaction<T>(work: (db: Database) => T | Promise<T>): Promise<T> }
/** Browser tests use this adapter. Android calls the same all-or-nothing contract through its narrow SQLite plugin. */
export class MemoryNativeStorage implements NativeStorage {
  private database: Database;
  constructor(seed: Database = emptyDatabase()) { this.database = clone(seed); }
  async read(): Promise<Database> { return clone(this.database); }
  async transaction<T>(work: (db: Database) => T | Promise<T>): Promise<T> {
    if (this.database.schemaVersion > SCHEMA_VERSION) throw new Error('数据库版本较新，拒绝写入');
    const candidate = clone(this.database);
    if (candidate.schemaVersion < SCHEMA_VERSION) candidate.schemaVersion = SCHEMA_VERSION;
    const result = await work(candidate); // Commit happens only after every command/event mutation succeeded.
    candidate.revision += 1;
    this.database = candidate;
    return clone(result);
  }
}
