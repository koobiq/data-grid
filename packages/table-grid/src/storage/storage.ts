import { isEqual } from 'lodash';
import { distinctUntilChanged, map, Observable } from 'rxjs';
import { StorageNode } from './types';

/**
 * Class representing a property in the storage.
 * Provides getter, setter, and observable methods for a specific key.
 *
 * @typeparam T - The type of the value stored.
 */
export class StorageProperty<T> {
    constructor(
        private storage: StorageNode,
        private key: string,
        private defaultValue?: T
    ) {}

    get value(): T {
        return this.get();
    }
    set value(v: T) {
        this.set(v);
    }

    get(): T {
        return this.storage.get<T>(this.key) ?? this.defaultValue;
    }

    set(value: T) {
        this.storage.set(this.key, value);
    }

    observe() {
        return this.storage
            .observe(this.key)
            .pipe(map((item) => (item.value as T) ?? this.defaultValue))
            .pipe(distinctUntilChanged());
    }
}

/**
 * Class representing a storage node scoped to an object.
 * Provides methods to manipulate key-value pairs within a specific scope.
 */
export class StorageObjectNode implements StorageNode {
    constructor(
        private node: StorageNode,
        private scope: string
    ) {}

    storageScope(scope: string) {
        return new StorageObjectNode(this, scope);
    }

    storageObject(scope: string) {
        return new StorageObjectNode(this, scope);
    }

    storageProperty<T>(key: string, defaultValue?: T) {
        return new StorageProperty<T>(this, key, defaultValue);
    }

    clear(): void {
        for (const key of this.keys()) {
            this.delete(key);
        }
    }

    delete(key: string) {
        const obj = this.readObject();
        delete obj[key];
        this.writeObject(obj);
    }

    keys(): string[] {
        return Object.keys(this.readObject());
    }

    get<T>(key: string): T {
        return this.readObject()[key];
    }

    set(key: string, value: any): void {
        return this.writeObject({
            ...this.readObject(),
            [key]: value
        });
    }

    observe<T>(key: string): Observable<{ key: string; value: T }> {
        return this.node
            .observe(this.scope)
            .pipe(
                map(() => ({
                    key,
                    value: this.get(key)
                }))
            )
            .pipe(distinctUntilChanged(isEqual));
    }

    private readObject() {
        return this.node.get(this.scope) || {};
    }

    private writeObject(obj: any) {
        this.node.set(this.scope, obj);
    }
}

/**
 * Class representing a storage node scoped by a prefix.
 * Provides methods to manipulate key-value pairs with a specific prefix in the key.
 */
export class StorageScopeNode implements StorageNode {
    constructor(
        private node: StorageNode,
        private scope: string
    ) {
        //
    }

    storageScope(scope: string) {
        return new StorageScopeNode(this, scope);
    }

    storageObject(scope: string) {
        return new StorageObjectNode(this, scope);
    }

    storageProperty<T>(key: string, defaultValue?: T) {
        return new StorageProperty<T>(this, key, defaultValue);
    }

    clear(): void {
        for (const key of this.keys()) {
            this.delete(key);
        }
    }

    delete(key: string) {
        this.node.delete(this.makeKey(key));
    }

    keys(): string[] {
        return this.node
            .keys()
            .filter((it) => it.startsWith(this.scope))
            .map((it) => it.substring(this.scope.length));
    }

    get<T>(key: string): T {
        return this.node.get<T>(this.makeKey(key));
    }

    set(key: string, value: any): void {
        return this.node.set(this.makeKey(key), value);
    }

    observe<T>(key: string): Observable<{ key: string; value: T }> {
        return this.node
            .observe(this.makeKey(key))
            .pipe(
                map((it) => ({
                    key,
                    value: it.value
                }))
            )
            .pipe(distinctUntilChanged(isEqual));
    }

    private makeKey(key: string): string {
        return this.scope ? `${this.scope}${key}` : key;
    }
}
