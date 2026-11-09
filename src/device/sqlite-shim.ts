// The slice of better-sqlite3's API that Drizzle and `openDb` use, over
// the official SQLite WASM build (oo1). Synchronous, as better-sqlite3 is: in a
// browser it must run in a dedicated worker (OPFS sync access handles).
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { installWithRetry } from './pool';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sqlite3 = any;
type PoolUtil = any;

let sqlite3: Sqlite3 | undefined;
let pool: PoolUtil | undefined;

export async function initDeviceSqlite(opts: { locateFile?: (f: string) => string } = {}) {
	if (sqlite3) return;
	sqlite3 = await (sqlite3InitModule as any)(
		opts.locateFile ? { locateFile: opts.locateFile } : undefined
	);
}

/**
 * Install the `opfs-sahpool` VFS (browser worker only). Files opened by path go
 * there. Tried again a few times, never deleting the files (`installWithRetry`).
 */
export async function openPool(name: string): Promise<PoolUtil> {
	const s = sqlite3;
	if (!s) throw new Error('initDeviceSqlite first');
	pool = await installWithRetry((opts) => s.installOpfsSAHPoolVfs(opts), name);
	return pool;
}

/** Gives the pool's files back, deleting nothing; every database on it must be closed. */
export function pausePool(): void {
	pool?.pauseVfs();
}

function lib(): Sqlite3 {
	if (!sqlite3) throw new Error('initDeviceSqlite has not run');
	return sqlite3;
}

/** better-sqlite3 errors carry `code` ('SQLITE_CONSTRAINT_UNIQUE'); trash.ts reads it. */
function translate(e: unknown): unknown {
	const rc = (e as { resultCode?: number }).resultCode;
	if (typeof rc === 'number' && !(e as { code?: unknown }).code) {
		(e as { code?: string }).code = lib().capi.sqlite3_js_rc_str(rc);
	}
	return e;
}

function bindable(params: unknown[]): unknown[] | undefined {
	// better-sqlite3 takes positional params spread, or one array/object.
	if (params.length === 0) return undefined;
	return params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));
}

class Statement {
	#raw = false;
	constructor(
		private readonly owner: Database,
		private readonly sql: string
	) {}

	raw(on = true) {
		this.#raw = on;
		return this;
	}

	#withStmt<T>(params: unknown[], fn: (s: any) => T): T {
		const s = this.owner._stmt(this.sql);
		try {
			s.reset(true);
			const b = bindable(params);
			if (b) s.bind(b);
			return fn(s);
		} catch (e) {
			throw translate(e);
		} finally {
			try {
				s.reset(true);
			} catch {
				/* a failed step leaves the error on reset too */
			}
		}
	}

	#row(s: any) {
		return this.#raw ? s.get([]) : s.get({});
	}

	run(...params: unknown[]) {
		return this.#withStmt(params, (s) => {
			while (s.step()) {
				/* drain: an INSERT … RETURNING run through run() */
			}
			const c = lib().capi;
			return {
				changes: c.sqlite3_changes(this.owner._db.pointer),
				lastInsertRowid: Number(c.sqlite3_last_insert_rowid(this.owner._db.pointer))
			};
		});
	}

	get(...params: unknown[]) {
		return this.#withStmt(params, (s) => (s.step() ? this.#row(s) : undefined));
	}

	all(...params: unknown[]) {
		return this.#withStmt(params, (s) => {
			const rows: unknown[] = [];
			while (s.step()) rows.push(this.#row(s));
			return rows;
		});
	}

	*iterate(...params: unknown[]) {
		yield* this.all(...params);
	}
}

/**
 * One SQLite connection per file, shared by every `Database` opened on it
 * (offline phase 3): the worker's own and the server code's `getDb()` are
 * then one connection, so a write the worker wraps in BEGIN … COMMIT is one
 * transaction with what the server code writes inside it, and the two never
 * lock each other out.
 */
const shared = new Map<string, { db: any; refs: number }>();

export default class Database {
	readonly _db: any;
	readonly #path: string | null;
	#stmts = new Map<string, any>();
	#depth = 0;

	constructor(path: string) {
		const s = lib();
		if (path === ':memory:' || !pool) {
			this.#path = null;
			this._db = new s.oo1.DB(':memory:', 'c');
			return;
		}
		this.#path = path;
		let open = shared.get(path);
		if (!open || !open.db.isOpen())
			shared.set(path, (open = { db: new pool.OpfsSAHPoolDb(path), refs: 0 }));
		open.refs++;
		this._db = open.db;
	}

	/** One compiled statement per SQL text, reused: oo1 statements are never GC-finalized. */
	_stmt(sql: string) {
		let s = this.#stmts.get(sql);
		if (!s) {
			try {
				s = this._db.prepare(sql);
			} catch (e) {
				throw translate(e);
			}
			this.#stmts.set(sql, s);
		}
		return s;
	}

	get open() {
		return this._db.isOpen();
	}

	get inTransaction() {
		return lib().capi.sqlite3_get_autocommit(this._db.pointer) === 0;
	}

	prepare(sql: string) {
		this._stmt(sql); // compile now, as better-sqlite3 does, so syntax errors throw here
		return new Statement(this, sql);
	}

	exec(sql: string) {
		try {
			this._db.exec(sql);
		} catch (e) {
			throw translate(e);
		}
		return this;
	}

	pragma(source: string, opts: { simple?: boolean } = {}) {
		const rows = this.prepare(`PRAGMA ${source}`).all() as Record<string, unknown>[];
		if (opts.simple) return rows[0] ? Object.values(rows[0])[0] : undefined;
		return rows;
	}

	transaction<A extends unknown[], R>(fn: (...args: A) => R) {
		const run =
			(mode: string) =>
			(...args: A): R => {
				if (this.#depth > 0 || this.inTransaction) {
					const name = `shim_sp_${this.#depth}`;
					this.exec(`SAVEPOINT ${name}`);
					this.#depth++;
					try {
						const r = fn(...args);
						this.exec(`RELEASE ${name}`);
						return r;
					} catch (e) {
						this.exec(`ROLLBACK TO ${name}`);
						this.exec(`RELEASE ${name}`);
						throw e;
					} finally {
						this.#depth--;
					}
				}
				this.exec(`BEGIN ${mode}`);
				this.#depth++;
				try {
					const r = fn(...args);
					this.exec('COMMIT');
					return r;
				} catch (e) {
					if (this.inTransaction) this.exec('ROLLBACK');
					throw e;
				} finally {
					this.#depth--;
				}
			};
		const f = run('DEFERRED') as ((...args: A) => R) & Record<string, (...args: A) => R>;
		f.deferred = run('DEFERRED');
		f.immediate = run('IMMEDIATE');
		f.exclusive = run('EXCLUSIVE');
		return f;
	}

	serialize(): Uint8Array {
		return lib().capi.sqlite3_js_db_export(this._db.pointer);
	}

	close() {
		for (const s of this.#stmts.values()) s.finalize();
		this.#stmts.clear();
		if (this.#path === null) return this._db.close();
		const open = shared.get(this.#path);
		if (open && --open.refs > 0) return;
		shared.delete(this.#path);
		this._db.close();
	}
}
