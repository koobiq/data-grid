import { Dexie, liveQuery, PromiseExtended, Table, UpdateSpec } from 'dexie';
import { customAlphabet } from 'nanoid/non-secure';
import { defer, isObservable, of, Observable as RxObservable, switchMap } from 'rxjs';

import { AppDb, AppDbTable } from './app-db';
import { DBT_TABLE_PRESETS, DBT_TABLE_STATES } from './constants';

export class AppDbDexie extends AppDb {
    private tables: Record<string, AppDbDexieTable<any>> = {};

    readonly dexie: Dexie;

    /**
     * Constructor to initialize the Dexie database.
     * @param name - The name of the database.
     */
    constructor(name: string) {
        super();
        this.dexie = new Dexie(name);
        this.init(this.dexie);
    }

    override table(name: string) {
        this.tables[name] = this.tables[name] || new AppDbDexieTable(this, name);
        return this.tables[name];
    }

    async reset() {
        await this.dexie.open();
        await this.dexie.delete();
        await this.dexie.open();
    }

    /**
     * Initializes the database schema.
     * Defines the versions and structure of the database.
     *
     * @param db - The Dexie database instance.
     */
    private init(db: Dexie) {
        db.version(1).stores({
            [DBT_TABLE_PRESETS]: 'id,key',
            [DBT_TABLE_STATES]: 'id'
        });
    }
}

// https://github.com/ai/nanoid
// https://zelark.github.io/nano-id-cc/
const createId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz-_', 16);

export class AppDbDexieTable<T extends { id: string }> extends AppDbTable<T> {
    readonly db: AppDbDexie;
    private readonly table: Table<T>;

    constructor(db: AppDbDexie, name: string) {
        super();
        this.db = db;
        this.table = db.dexie.table(name);
    }

    async tx<R>(fn: () => Promise<R>): Promise<R> {
        return this.db.dexie.transaction('rw', this.table, fn);
    }

    async count(): Promise<number> {
        return this.table.count();
    }

    async keys(): Promise<string[]> {
        return this.table
            .toCollection()
            .keys()
            .then((list) => list as string[]);
    }

    list(): Promise<T[]> {
        return this.table.toArray();
    }

    async create(record: Partial<T>): Promise<T> {
        record = {
            ...record,
            id: record.id || createId()
        };
        const id = await this.table.add(record as T, record.id);
        return this.read(id as any);
    }

    read(id: string): Promise<T> {
        return this.table.get(id);
    }

    async update(id: string, record: UpdateSpec<T>): Promise<T> {
        await this.table.update(id, record);
        return this.read(id);
    }

    async destroy(id: string | string[]): Promise<void> {
        return this.table.delete(id);
    }

    async createOrUpdate(record: T): Promise<T> {
        if (record.id) {
            await this.table.put(record, record.id);
            return this.read(record.id);
        }
        return this.create(record);
    }

    live<R>(fn: (table: Table<T>) => PromiseExtended<R>) {
        return defer(
            () =>
                new RxObservable<R>((sub) => {
                    return liveQuery<R>(() => fn(this.table)).subscribe(sub);
                })
        );
    }

    observeAll(): RxObservable<T[]> {
        return this.live((t) => t.toArray());
    }

    observeById(id: string | RxObservable<string>): RxObservable<T> {
        return (isObservable(id) ? id : of(id)).pipe(
            switchMap((id) => {
                return id ? this.live((t) => t.get(id)) : of(null);
            })
        );
    }
}
