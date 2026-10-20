import { DataSource } from 'typeorm';

type Log = (message: string) => void;

export interface SchemaDrift {
  /** Tables the code reads that the database doesn't have. */
  missingTables: string[];
  /** "table.column" the code reads that the database doesn't have. */
  missingColumns: string[];
  /** "enum_type: value" the code can write that the database doesn't allow. */
  missingEnumValues: string[];
}

/**
 * What the code expects that the database lacks. A database first built by `synchronize`
 * (production) can differ from one built by migrations, and a missing column fails every query
 * on its table with "Internal server error". Read-only.
 */
export async function schemaDrift(ds: DataSource): Promise<SchemaDrift> {
  const drift: SchemaDrift = { missingTables: [], missingColumns: [], missingEnumValues: [] };
  const columns: { table_name: string; column_name: string }[] = await ds.query(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`,
  );
  const have = new Map<string, Set<string>>();
  for (const c of columns) have.set(c.table_name, (have.get(c.table_name) ?? new Set()).add(c.column_name));
  const enums: { typname: string; enumlabel: string }[] = await ds.query(
    `SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid`,
  );
  const labels = new Map<string, Set<string>>();
  for (const e of enums) labels.set(e.typname, (labels.get(e.typname) ?? new Set()).add(e.enumlabel));

  for (const meta of ds.entityMetadatas) {
    const table = meta.tableName;
    const cols = have.get(table);
    if (!cols) {
      drift.missingTables.push(table);
      continue;
    }
    for (const col of meta.columns) {
      if (!cols.has(col.databaseName)) drift.missingColumns.push(`${table}.${col.databaseName}`);
      if (col.type === 'enum' && col.enum) {
        const typ = col.enumName ?? `${table}_${col.databaseName}_enum`;
        const allowed = labels.get(typ);
        if (allowed) for (const v of col.enum) if (!allowed.has(String(v))) drift.missingEnumValues.push(`${typ}: ${v}`);
      }
    }
  }
  return drift;
}

/**
 * Brings a drifted database closer to the code, adding only: missing tables, missing columns
 * and missing enum values, from TypeORM's own comparison. Nothing is dropped or changed. Each
 * statement runs on its own; one that can't (e.g. a required column on a table that has rows)
 * is logged and skipped, so start-up never fails because of it.
 */
export async function addMissingSchema(ds: DataSource, log: Log = console.log): Promise<void> {
  const before = await schemaDrift(ds);
  if (!before.missingTables.length && !before.missingColumns.length && !before.missingEnumValues.length) return;
  log(`[schema] Missing before repair: ${JSON.stringify(before)}`);

  // Enum values first, one by one: TypeORM would rebuild the whole type, which is riskier.
  for (const entry of before.missingEnumValues) {
    const [typ, value] = entry.split(': ');
    const q = `ALTER TYPE "${typ}" ADD VALUE IF NOT EXISTS '${value.replace(/'/g, "''")}'`;
    try {
      await ds.query(q);
      log(`[schema] Added: ${q}`);
    } catch (err) {
      log(`[schema] Skipped (${err instanceof Error ? err.message : err}): ${q}`);
    }
  }

  const sql = await ds.driver.createSchemaBuilder().log();
  const additive = sql.upQueries
    .map((q) => q.query)
    .filter((q) => /^\s*(CREATE TABLE|ALTER TABLE \S+ ADD "|ALTER TABLE \S+ ADD COLUMN)/i.test(q))
    .filter((q) => !/\bDROP\b/i.test(q));
  for (const q of additive) {
    try {
      await ds.query(q);
      log(`[schema] Added: ${q.slice(0, 200)}`);
    } catch (err) {
      log(`[schema] Skipped (${err instanceof Error ? err.message : err}): ${q.slice(0, 200)}`);
    }
  }
  const after = await schemaDrift(ds);
  log(`[schema] Still missing after repair: ${JSON.stringify(after)}`);
}
