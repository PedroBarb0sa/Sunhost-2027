/**
 * Camada de persistência do SunHost.
 *
 * A aplicação usa PostgreSQL. Quando o banco não está disponível (ou com
 * DEMO_MODE=true) ela usa um arquivo JSON local com a mesma interface, para
 * que o projeto rode em qualquer computador sem configuração.
 */
import pg from "pg";
import type { Pool } from "pg";
import fs from "fs/promises";
import { existsSync } from "fs";
import crypto from "crypto";

export type Row = Record<string, any>;
export type Where = Record<string, unknown>;
export type FindOptions = { orderBy?: string; desc?: boolean; limit?: number };

export interface Driver {
  kind: "postgresql" | "local-demo";
  find<T = Row>(table: Table, where?: Where, options?: FindOptions): Promise<T[]>;
  findOne<T = Row>(table: Table, where: Where): Promise<T | null>;
  insert<T = Row>(table: Table, row: Row): Promise<T>;
  update<T = Row>(table: Table, where: Where, patch: Row): Promise<T[]>;
  remove(table: Table, where: Where): Promise<number>;
  count(table: Table, where?: Where): Promise<number>;
}

export const TABLES = [
  "users",
  "sessions",
  "accommodations",
  "accommodation_photos",
  "uploads",
  "redemptions",
  "reservations",
  "messages",
  "reviews",
  "favorites",
  "reports",
] as const;
export type Table = (typeof TABLES)[number];

/** Tabelas com chave numérica sequencial (BIGSERIAL). */
const SERIAL_TABLES: Table[] = [
  "accommodations",
  "accommodation_photos",
  "uploads",
  "redemptions",
  "reservations",
  "messages",
  "reviews",
  "reports",
];

/** Colunas de data/hora preenchidas automaticamente. */
const TIMESTAMP_DEFAULTS: Partial<Record<Table, string[]>> = {
  users: ["created_at"],
  sessions: ["created_at"],
  accommodations: ["created_at", "updated_at"],
  accommodation_photos: ["created_at"],
  uploads: ["created_at"],
  redemptions: ["created_at"],
  reservations: ["created_at", "updated_at"],
  messages: ["created_at"],
  reviews: ["created_at", "updated_at"],
  favorites: ["created_at"],
  reports: ["created_at"],
};

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
function ident(name: string) {
  if (!IDENTIFIER.test(name)) throw new Error(`Identificador inválido: ${name}`);
  return name;
}

// -----------------------------------------------------------------------------
// PostgreSQL
// -----------------------------------------------------------------------------

// Tipos convertidos para valores JavaScript simples e previsíveis.
pg.types.setTypeParser(20, value => Number(value)); // BIGINT
pg.types.setTypeParser(1700, value => Number(value)); // NUMERIC
pg.types.setTypeParser(1082, value => value); // DATE como 'AAAA-MM-DD'
pg.types.setTypeParser(1184, value => new Date(value).toISOString()); // TIMESTAMPTZ
pg.types.setTypeParser(1114, value => new Date(`${value}Z`).toISOString()); // TIMESTAMP

export class PgDriver implements Driver {
  kind = "postgresql" as const;
  pool: Pool;

  constructor(connectionString?: string) {
    this.pool = new pg.Pool({
      connectionString,
      connectionTimeoutMillis: 2500,
      idleTimeoutMillis: 10000,
    });
  }

  async init(schemaSql: string) {
    await this.pool.query("SELECT 1");
    await this.pool.query(schemaSql);
  }

  private whereClause(where: Where = {}, startAt = 1) {
    const params: unknown[] = [];
    const parts = Object.entries(where).map(([column, value]) => {
      const col = ident(column);
      if (value === null) return `${col} IS NULL`;
      if (Array.isArray(value)) {
        if (value.length === 0) return "FALSE";
        params.push(value);
        return `${col} = ANY($${startAt + params.length - 1})`;
      }
      params.push(value);
      return `${col} = $${startAt + params.length - 1}`;
    });
    return { sql: parts.length ? ` WHERE ${parts.join(" AND ")}` : "", params };
  }

  async find<T = Row>(table: Table, where?: Where, options: FindOptions = {}) {
    const { sql, params } = this.whereClause(where);
    let query = `SELECT * FROM ${ident(table)}${sql}`;
    if (options.orderBy) query += ` ORDER BY ${ident(options.orderBy)} ${options.desc ? "DESC" : "ASC"}`;
    if (options.limit) query += ` LIMIT ${Math.max(1, Math.floor(options.limit))}`;
    const result = await this.pool.query(query, params);
    return result.rows as T[];
  }

  async findOne<T = Row>(table: Table, where: Where) {
    const rows = await this.find<T>(table, where, { limit: 1 });
    return rows[0] ?? null;
  }

  async insert<T = Row>(table: Table, row: Row) {
    const entries = Object.entries(row).filter(([, value]) => value !== undefined);
    const columns = entries.map(([column]) => ident(column)).join(", ");
    const placeholders = entries.map((_, index) => `$${index + 1}`).join(", ");
    const result = await this.pool.query(
      `INSERT INTO ${ident(table)} (${columns}) VALUES (${placeholders}) RETURNING *`,
      entries.map(([, value]) => value)
    );
    return result.rows[0] as T;
  }

  async update<T = Row>(table: Table, where: Where, patch: Row) {
    const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
    if (!entries.length) return this.find<T>(table, where);
    const set = entries.map(([column], index) => `${ident(column)} = $${index + 1}`).join(", ");
    const { sql, params } = this.whereClause(where, entries.length + 1);
    const result = await this.pool.query(
      `UPDATE ${ident(table)} SET ${set}${sql} RETURNING *`,
      [...entries.map(([, value]) => value), ...params]
    );
    return result.rows as T[];
  }

  async remove(table: Table, where: Where) {
    const { sql, params } = this.whereClause(where);
    if (!sql) throw new Error("Remoção sem filtro não é permitida.");
    const result = await this.pool.query(`DELETE FROM ${ident(table)}${sql}`, params);
    return result.rowCount ?? 0;
  }

  async count(table: Table, where?: Where) {
    const { sql, params } = this.whereClause(where);
    const result = await this.pool.query(`SELECT COUNT(*)::int AS total FROM ${ident(table)}${sql}`, params);
    return Number(result.rows[0]?.total ?? 0);
  }
}

// -----------------------------------------------------------------------------
// Modo demonstração (arquivo JSON)
// -----------------------------------------------------------------------------

type JsonData = {
  version: 2;
  counters: Partial<Record<Table, number>>;
  tables: Record<Table, Row[]>;
};

function emptyData(): JsonData {
  return {
    version: 2,
    counters: {},
    tables: Object.fromEntries(TABLES.map(table => [table, []])) as unknown as Record<Table, Row[]>,
  };
}

function matches(row: Row, where: Where = {}) {
  return Object.entries(where).every(([column, value]) => {
    if (value === null) return row[column] === null || row[column] === undefined;
    if (Array.isArray(value)) return value.some(item => item === row[column]);
    return row[column] === value;
  });
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export class JsonDriver implements Driver {
  kind = "local-demo" as const;
  private data: JsonData = emptyData();
  private writing: Promise<void> = Promise.resolve();

  constructor(private file: string) {}

  async init(migrateLegacy: (legacy: any) => JsonData["tables"] | null) {
    if (!existsSync(this.file)) {
      this.data = emptyData();
      await this.persist();
      return;
    }
    try {
      const parsed = JSON.parse(await fs.readFile(this.file, "utf8"));
      if (parsed?.version === 2 && parsed.tables) {
        this.data = { ...emptyData(), ...parsed, tables: { ...emptyData().tables, ...parsed.tables } };
      } else {
        // Arquivo da versão anterior: guarda uma cópia e migra o que for possível.
        await fs.copyFile(this.file, `${this.file}.v1.bak`);
        this.data = emptyData();
        const migrated = migrateLegacy(parsed);
        if (migrated) {
          for (const table of TABLES) this.data.tables[table] = migrated[table] || [];
          for (const table of SERIAL_TABLES)
            this.data.counters[table] = this.data.tables[table].reduce((max, row) => Math.max(max, Number(row.id) || 0), 0);
        }
        await this.persist();
      }
    } catch {
      await fs.copyFile(this.file, `${this.file}.corrompido.bak`).catch(() => undefined);
      this.data = emptyData();
      await this.persist();
    }
  }

  private persist() {
    const snapshot = JSON.stringify(this.data, null, 1);
    this.writing = this.writing.then(async () => {
      const temp = `${this.file}.tmp`;
      await fs.writeFile(temp, snapshot, "utf8");
      await fs.rename(temp, this.file);
    });
    return this.writing;
  }

  async find<T = Row>(table: Table, where?: Where, options: FindOptions = {}) {
    let rows = this.data.tables[table].filter(row => matches(row, where));
    if (options.orderBy) {
      const key = options.orderBy;
      rows = [...rows].sort((a, b) => {
        const left = a[key];
        const right = b[key];
        const result = left === right ? 0 : left > right ? 1 : -1;
        return options.desc ? -result : result;
      });
    }
    if (options.limit) rows = rows.slice(0, options.limit);
    return clone(rows) as T[];
  }

  async findOne<T = Row>(table: Table, where: Where) {
    const row = this.data.tables[table].find(item => matches(item, where));
    return row ? (clone(row) as T) : null;
  }

  async insert<T = Row>(table: Table, row: Row) {
    const now = new Date().toISOString();
    const next: Row = {};
    for (const column of TIMESTAMP_DEFAULTS[table] || []) next[column] = now;
    Object.assign(next, Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined)));
    if (SERIAL_TABLES.includes(table) && next.id === undefined) {
      next.id = (this.data.counters[table] || 0) + 1;
      this.data.counters[table] = next.id;
    }
    if (table === "users" && !next.id) next.id = crypto.randomUUID();
    this.data.tables[table].push(next);
    await this.persist();
    return clone(next) as T;
  }

  async update<T = Row>(table: Table, where: Where, patch: Row) {
    const changed: Row[] = [];
    for (const row of this.data.tables[table]) {
      if (!matches(row, where)) continue;
      for (const [column, value] of Object.entries(patch)) if (value !== undefined) row[column] = value;
      changed.push(row);
    }
    if (changed.length) await this.persist();
    return clone(changed) as T[];
  }

  async remove(table: Table, where: Where) {
    if (!Object.keys(where).length) throw new Error("Remoção sem filtro não é permitida.");
    const before = this.data.tables[table].length;
    this.data.tables[table] = this.data.tables[table].filter(row => !matches(row, where));
    const removed = before - this.data.tables[table].length;
    if (removed) {
      this.cascade(table);
      await this.persist();
    }
    return removed;
  }

  /** Reproduz as regras ON DELETE CASCADE / SET NULL do PostgreSQL. */
  private cascade(table: Table) {
    const t = this.data.tables;
    const ids = (name: Table) => new Set(t[name].map(row => row.id));
    if (table === "users") {
      const users = ids("users");
      t.sessions = t.sessions.filter(row => users.has(row.user_id));
      t.accommodations = t.accommodations.filter(row => users.has(row.owner_id));
      t.reservations = t.reservations.filter(row => users.has(row.guest_id));
      t.messages = t.messages.filter(row => users.has(row.sender_id));
      t.reviews = t.reviews.filter(row => users.has(row.user_id));
      t.favorites = t.favorites.filter(row => users.has(row.user_id));
      t.redemptions = t.redemptions.filter(row => users.has(row.user_id));
      t.reports = t.reports.filter(row => users.has(row.user_id));
      for (const row of t.uploads) if (!users.has(row.owner_id)) row.owner_id = null;
    }
    const accommodations = ids("accommodations");
    t.accommodation_photos = t.accommodation_photos.filter(row => accommodations.has(row.accommodation_id));
    t.reservations = t.reservations.filter(row => accommodations.has(row.accommodation_id));
    t.reviews = t.reviews.filter(row => accommodations.has(row.accommodation_id));
    t.favorites = t.favorites.filter(row => accommodations.has(row.accommodation_id));
    t.reports = t.reports.filter(row => accommodations.has(row.accommodation_id));
    const reservations = ids("reservations");
    t.messages = t.messages.filter(row => reservations.has(row.reservation_id));
    for (const row of t.reviews) if (row.reservation_id && !reservations.has(row.reservation_id)) row.reservation_id = null;
    const redemptions = ids("redemptions");
    for (const row of t.reservations) if (row.redemption_id && !redemptions.has(row.redemption_id)) row.redemption_id = null;
  }

  async count(table: Table, where?: Where) {
    return this.data.tables[table].filter(row => matches(row, where)).length;
  }
}
