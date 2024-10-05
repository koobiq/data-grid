import { isEqual } from 'lodash';
import { filter, Observable, startWith, Subject } from 'rxjs';
import { StorageNode } from './types';

/**
 * Class representing an API node for browser storage (localStorage or sessionStorage).
 * It provides methods to manipulate and observe key-value pairs in the storage.
 */
export class StorageApiNode implements StorageNode {
    private cache = new Map<string, any>();
    private change$ = new Subject<{ key: string; value: any }>();

    constructor(private storage: Storage) {}

    clear(): void {
        this.storage.clear();
    }

    keys(): string[] {
        return new Array(this.storage.length).fill(null).map((_, i) => this.storage.key(i));
    }

    get<T = any>(key: string): T {
        if (this.cache.has(key)) {
            return JSON.parse(JSON.stringify(this.cache.get(key)));
        }
        return JSON.parse(this.storage.getItem(key));
    }

    set(key: string, value: any): void {
        this.trackChange(key, () => {
            if (isEqual({}, value) || isEqual([], value) || value == null) {
                this.cache.delete(key);
                this.storage.removeItem(key);
            } else {
                const json = JSON.stringify(value);
                this.cache.set(key, JSON.parse(json));
                this.storage.setItem(key, json);
            }
        });
    }

    delete(key: string): void {
        this.trackChange(key, () => {
            this.cache.delete(key);
            this.storage.removeItem(key);
        });
    }

    observe<T>(key: string): Observable<{ key: string; value: T }> {
        return this.change$.pipe(filter((item) => item.key === key)).pipe(
            startWith({
                key: key,
                value: this.get(key)
            })
        );
    }

    private trackChange(key: string, fn: () => void) {
        const oldValue = this.get(key);
        fn();
        const newValue = this.get(key);
        if (!isEqual(newValue, oldValue)) {
            this.change$.next({ key, value: newValue });
        }
    }
}
