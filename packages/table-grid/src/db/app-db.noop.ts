import { of, Observable as RxObservable } from 'rxjs';

import { UpdateSpec } from 'dexie';
import { AppDb, AppDbTable } from './app-db';

export class AppDbNoop extends AppDb {
    private tables: Record<string, AppDbNoopTable<any>> = {};

    constructor(name: string) {
        super();
    }

    override table(name: string) {
        this.tables[name] = this.tables[name] || new AppDbNoopTable(this, name);
        return this.tables[name];
    }

    async reset() {
        //
    }
}

export class AppDbNoopTable<T extends { id: string }> extends AppDbTable<T> {
    db: AppDb;

    constructor(db: AppDb, name: string) {
        super();
        this.db = db;
    }

    async tx<R>(fn: () => Promise<R>): Promise<R> {
        return null;
    }

    async count(): Promise<number> {
        return 0;
    }

    async keys(): Promise<string[]> {
        return [];
    }

    async list(): Promise<T[]> {
        return [];
    }

    async create(record: Partial<T>): Promise<T> {
        return null;
    }

    async read(id: string): Promise<T> {
        return null;
    }

    async update(id: string, record: UpdateSpec<T>): Promise<T> {
        return null;
    }

    async destroy(id: string | string[]): Promise<void> {
        //
    }

    async createOrUpdate(record: T): Promise<T> {
        return null;
    }

    observeAll(): RxObservable<T[]> {
        return of([]);
    }
    observeById(id: string | RxObservable<string>): RxObservable<T> {
        return of(null);
    }
}
