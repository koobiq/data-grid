import { isPlatformServer } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { memStorage, StorageApiNode } from '../storage';
import { StorageScopeNode } from '../storage/storage';

const PREFIX = 'kbq:';

@Injectable({ providedIn: 'root' })
export class PreferencesService {
    readonly storage: StorageScopeNode;
    readonly session: StorageScopeNode;

    constructor() {
        const isServer = isPlatformServer(inject(PLATFORM_ID));
        const storage = isServer ? memStorage() : localStorage;
        const session = isServer ? memStorage() : sessionStorage;
        this.storage = new StorageScopeNode(new StorageApiNode(storage), PREFIX);
        this.session = new StorageScopeNode(new StorageApiNode(session), PREFIX);
    }

    export() {
        const result: Record<string, any> = {};
        for (const key of this.storage.keys()) {
            result[PREFIX + key] = this.storage.get(key);
        }
        return result;
    }

    import(data: Record<string, any>) {
        for (const key of Array.from(Object.keys(data))) {
            if (key.startsWith(PREFIX)) {
                const keyIntern = key.replace(PREFIX, '');
                this.storage.set(keyIntern, data[key]);
            }
        }
    }
}
