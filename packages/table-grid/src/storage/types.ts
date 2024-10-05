import { Observable } from 'rxjs';

/**
 * Interface representing the structure of a storage node.
 * It defines basic methods for manipulating key-value pairs and observing changes.
 *
 * @typeparam T - The type of the value stored in the storage node.
 */
export interface StorageNode<T = any> {
    clear(): void;
    keys(): string[];
    get<R = T>(key: string): R;
    set(key: string, value: T): void;
    delete(key: string): void;
    observe<R = T>(key: string): Observable<{ key: string; value: R }>;
}
