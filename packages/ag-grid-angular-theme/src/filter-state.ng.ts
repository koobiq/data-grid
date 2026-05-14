import { DestroyRef, Directive, inject, Injectable, InjectionToken, input, Provider, Type } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { AgEventListener, FilterModel, GridApi } from 'ag-grid-community';

type AsyncLike<T> = T | Promise<T>;

/**
 * Storage interface for persisting and retrieving ag-grid filter state.
 *
 * Supports both synchronous and Promise-based implementations.
 */
export type KbqAgGridFilterStateStore = {
    getItem: (key: string) => AsyncLike<FilterModel | null>;
    setItem: (key: string, value: FilterModel) => AsyncLike<void>;
    removeItem: (key: string) => AsyncLike<void>;
};

/**
 * {@link KbqAgGridFilterStateStore} implementation backed by `localStorage`.
 */
@Injectable({ providedIn: 'root' })
export class KbqAgGridFilterStateLocalStorageStore implements KbqAgGridFilterStateStore {
    // TODO: Should use KBQ_WINDOW token
    private readonly localStorage = window.localStorage;

    getItem(key: string): FilterModel | null {
        const item = this.localStorage.getItem(key);

        if (!item) return null;

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            return JSON.parse(item) as FilterModel;
        } catch {
            return null;
        }
    }

    setItem(key: string, value: FilterModel): void {
        this.localStorage.setItem(key, JSON.stringify(value));
    }

    removeItem(key: string): void {
        this.localStorage.removeItem(key);
    }
}

/**
 * {@link KbqAgGridFilterStateStore} implementation backed by URL query parameters.
 */
@Injectable({ providedIn: 'root' })
export class KbqAgGridFilterStateQueryParamsStore implements KbqAgGridFilterStateStore {
    private readonly router = inject(Router);
    // TODO: Should use KBQ_WINDOW token
    private readonly location = window.location;

    getItem(key: string): FilterModel | null {
        const item = new URLSearchParams(this.location.search).get(key);

        if (!item) return null;

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            return JSON.parse(item) as FilterModel;
        } catch {
            return null;
        }
    }

    async setItem(key: string, value: FilterModel): Promise<void> {
        await this.router.navigate([], {
            queryParams: { [key]: JSON.stringify(value) },
            queryParamsHandling: 'merge',
            replaceUrl: true
        });
    }

    async removeItem(key: string): Promise<void> {
        await this.router.navigate([], {
            queryParams: { [key]: null },
            queryParamsHandling: 'merge',
            replaceUrl: true
        });
    }
}

/**
 * Injection token for {@link KbqAgGridFilterStateStore}.
 *
 * Defaults to {@link KbqAgGridFilterStateLocalStorageStore}.
 * Override it with {@link kbqAgGridFilterStateStoreProvider}.
 */
export const KBQ_AG_GRID_FILTER_STATE_STORE = new InjectionToken<KbqAgGridFilterStateStore>(
    'KBQ_AG_GRID_FILTER_STATE_STORE',
    { factory: (): KbqAgGridFilterStateStore => inject(KbqAgGridFilterStateLocalStorageStore) }
);

/**
 * Creates an Angular {@link Provider} that binds {@link KBQ_AG_GRID_FILTER_STATE_STORE}
 * to the given store class or instance.
 *
 * @example
 * ```typescript
 * providers: [kbqAgGridFilterStateStoreProvider(KbqAgGridFilterStateQueryParamsStore)]
 * ```
 * @example
 * ```typescript
 * providers: [kbqAgGridFilterStateStoreProvider(myCustomStoreInstance)]
 * ```
 */
export const kbqAgGridFilterStateStoreProvider = (
    store: Type<KbqAgGridFilterStateStore> | KbqAgGridFilterStateStore
): Provider => {
    if (store instanceof Type) {
        return {
            provide: KBQ_AG_GRID_FILTER_STATE_STORE,
            useClass: store
        };
    }

    return {
        provide: KBQ_AG_GRID_FILTER_STATE_STORE,
        useValue: store
    };
};

/**
 * Directive that persists and restores ag-grid column filter state
 * using a configurable {@link KbqAgGridFilterStateStore}.
 *
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme [kbqAgGridFilterState]="{ store: kbqAgGridFilterStateLocalStorageStore, key: 'filters-state' }" />
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridFilterState]',
    exportAs: 'kbqAgGridFilterState'
})
export class KbqAgGridFilterState {
    private readonly grid = inject(AgGridAngular);
    private readonly destroyRef = inject(DestroyRef);

    /** Key under which filter state is stored. Must be unique per grid. */
    readonly key = input.required<string>({ alias: 'kbqAgGridFilterState' });

    /** Store used to persist and restore filter state. Defaults to {@link KBQ_AG_GRID_FILTER_STATE_STORE}. */
    readonly store = input(inject(KBQ_AG_GRID_FILTER_STATE_STORE), { alias: 'kbqAgGridFilterStateStore' });

    constructor() {
        this.grid.gridReady.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ api }) => void this.init(api));
    }

    /** Removes the stored filter state for the current key. */
    reset(): void {
        const store = this.store();
        const key = this.key();

        void store.removeItem(key);
        this.grid.api.setFilterModel(null);
    }

    private async init(api: GridApi): Promise<void> {
        const key = this.key();
        const store = this.store();

        const item = await store.getItem(key);

        if (item) {
            api.setFilterModel(item);
        }

        const save: AgEventListener<unknown, unknown, 'filterChanged'> = (event) => {
            // Skips saves triggered by api.setFilterModel() during init to avoid redundant writes.
            if (event.source === 'api') return;

            const model = api.getFilterModel();

            if (Object.keys(model).length === 0) {
                void store.removeItem(key);
            } else {
                void store.setItem(key, model);
            }
        };

        api.addEventListener('filterChanged', save);

        this.destroyRef.onDestroy(() => {
            api.removeEventListener('filterChanged', save);
        });
    }
}
