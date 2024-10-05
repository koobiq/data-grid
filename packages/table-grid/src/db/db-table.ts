import { UpdateSpec } from 'dexie';
import { Observable } from 'rxjs';
import { AppDbRecord, AppDbTable } from './app-db';

export abstract class DBTable<T extends AppDbRecord> extends AppDbTable<T> {
    abstract readonly table: AppDbTable<T>;

    tx<R>(fn: () => Promise<R>): Promise<R> {
        return this.table.tx(fn);
    }

    async count() {
        return this.table.count();
    }

    async keys() {
        return this.table.keys();
    }

    async list() {
        return this.table.list();
    }

    async create(record: Partial<T>) {
        return this.table.create(record);
    }

    async read(id: string) {
        return this.table.read(id);
    }

    async update(id: string, record: UpdateSpec<T>) {
        return this.table.update(id, record);
    }

    async destroy(id: string | string[]) {
        return this.table.destroy(id);
    }

    async createOrUpdate(record: T) {
        return this.table.createOrUpdate(record);
    }

    observeAll() {
        return this.table.observeAll();
    }

    observeById(id: string | Observable<string>) {
        return this.table.observeById(id);
    }
}
