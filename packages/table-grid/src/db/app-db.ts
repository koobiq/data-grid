import { UpdateSpec } from 'dexie';
import { Observable } from 'rxjs';

/**
 * Base type for database records.
 * Each record must have a unique `id` of type string.
 */
export type AppDbRecord = { id: string };

/**
 * Abstract class representing the application database.
 * Provides methods for resetting the database and accessing tables.
 */
export abstract class AppDb {
    abstract reset(): Promise<void>;

    /**
     * Returns an interface to work with a specific table in the database.
     * @typeparam T - The type of records in the table, extending `AppDbRecord`.
     * @param name - The name of the table.
     * @returns An instance of `AppDbTable` to interact with the specified table.
     */
    abstract table<T extends AppDbRecord>(name: string): AppDbTable<T>;
}

/**
 * Abstract class representing a table in the application database.
 * Provides methods for CRUD operations and observing changes to the data.
 *
 * @typeparam T - The type of records in the table, extending `AppDbRecord`.
 */
export abstract class AppDbTable<T extends AppDbRecord> {
    abstract readonly db: AppDb;

    abstract tx<R>(fn: () => Promise<R>): Promise<R>;
    abstract count(): Promise<number>;
    abstract keys(): Promise<string[]>;

    abstract list(): Promise<T[]>;
    abstract create(record: Partial<T>): Promise<T>;
    abstract read(id: string): Promise<T>;
    abstract update(id: string, record: UpdateSpec<T>): Promise<T>;
    abstract destroy(id: string | string[]): Promise<void>;

    abstract createOrUpdate(record: T): Promise<T>;

    abstract observeAll(): Observable<T[]>;
    abstract observeById(id: string | Observable<string>): Observable<T>;
}
