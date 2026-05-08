import {
    DestroyRef,
    Directive,
    inject,
    Injectable,
    InjectionToken,
    input,
    Provider,
    signal,
    Type
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { AgEventListener, GridApi } from 'ag-grid-community';

type AsyncLike<T> = T | Promise<T>;

/**
 * Storage interface for persisting and retrieving ag-grid quick filter state.
 *
 * Supports both synchronous and Promise-based implementations.
 */
export type KbqAgGridQuickFilterStateStore = {
    getItem: (key: string) => AsyncLike<string | null>;
    setItem: (key: string, value: string) => AsyncLike<void>;
    removeItem: (key: string) => AsyncLike<void>;
};

/**
 * {@link KbqAgGridQuickFilterStateStore} implementation backed by `localStorage`.
 *
 * @example
 * ```typescript
 * protected readonly state = { store: inject(KbqAgGridQuickFilterStateLocalStorageStore), key: 'quick-filter' };
 * ```
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme [kbqAgGridQuickFilterState]="state.key" [kbqAgGridQuickFilterStateStore]="state.store" />
 * ```
 */
@Injectable({ providedIn: 'root' })
export class KbqAgGridQuickFilterStateLocalStorageStore implements KbqAgGridQuickFilterStateStore {
    // TODO: Should use KBQ_WINDOW token
    private readonly localStorage = window.localStorage;

    getItem(key: string): string | null {
        return this.localStorage.getItem(key);
    }

    setItem(key: string, value: string): void {
        this.localStorage.setItem(key, value);
    }

    removeItem(key: string): void {
        this.localStorage.removeItem(key);
    }
}

/**
 * {@link KbqAgGridQuickFilterStateStore} implementation backed by URL query parameters.
 *
 * Uses Angular's {@link Router} to read and write query params.
 * Calls `router.navigate` with `replaceUrl: true` so filter changes
 * do not push entries into the browser history.
 *
 * @example
 * ```typescript
 * protected readonly state = { store: inject(KbqAgGridQuickFilterStateQueryParamsStore), key: 'quick-filter' };
 * ```
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme [kbqAgGridQuickFilterState]="state.key" [kbqAgGridQuickFilterStateStore]="state.store" />
 * ```
 */
@Injectable({ providedIn: 'root' })
export class KbqAgGridQuickFilterStateQueryParamsStore implements KbqAgGridQuickFilterStateStore {
    private readonly router = inject(Router);
    // TODO: Should use KBQ_WINDOW token
    private readonly location = window.location;

    getItem(key: string): string | null {
        return new URLSearchParams(this.location.search).get(key);
    }

    async setItem(key: string, value: string): Promise<void> {
        await this.router.navigate([], {
            queryParams: { [key]: value },
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
 * Injection token for {@link KbqAgGridQuickFilterStateStore}.
 *
 * Defaults to {@link KbqAgGridQuickFilterStateLocalStorageStore}.
 * Override it with {@link kbqAgGridQuickFilterStateStoreProvider}.
 */
export const KBQ_AG_GRID_QUICK_FILTER_STATE_STORE = new InjectionToken<KbqAgGridQuickFilterStateStore>(
    'KBQ_AG_GRID_QUICK_FILTER_STATE_STORE',
    { factory: (): KbqAgGridQuickFilterStateStore => inject(KbqAgGridQuickFilterStateLocalStorageStore) }
);

/**
 * Creates an Angular {@link Provider} that binds {@link KBQ_AG_GRID_QUICK_FILTER_STATE_STORE}
 * to the given store class or instance.
 *
 * @example
 * ```typescript
 * providers: [kbqAgGridQuickFilterStateStoreProvider(KbqAgGridQuickFilterStateQueryParamsStore)]
 * ```
 * @example
 * ```typescript
 * providers: [kbqAgGridQuickFilterStateStoreProvider(myCustomStoreInstance)]
 * ```
 */
export const kbqAgGridQuickFilterStateStoreProvider = (
    store: Type<KbqAgGridQuickFilterStateStore> | KbqAgGridQuickFilterStateStore
): Provider => {
    if (store instanceof Type) {
        return {
            provide: KBQ_AG_GRID_QUICK_FILTER_STATE_STORE,
            useClass: store
        };
    }

    return {
        provide: KBQ_AG_GRID_QUICK_FILTER_STATE_STORE,
        useValue: store
    };
};

/**
 * Directive that persists and restores ag-grid quick filter state
 * using a configurable {@link KbqAgGridQuickFilterStateStore}.
 *
 * Exposes a {@link value} signal with the current filter value so the host
 * component can keep its search input in sync with the restored state.
 *
 * @example
 * ```html
 * <input [value]="qf.value()" (input)="api.setGridOption('quickFilterText', $event.target.value)" />
 * <ag-grid-angular kbqAgGridTheme #qf="kbqAgGridQuickFilterState" [kbqAgGridQuickFilterState]="'quick-filter'" />
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridQuickFilterState]',
    exportAs: 'kbqAgGridQuickFilterState'
})
export class KbqAgGridQuickFilterState {
    private readonly grid = inject(AgGridAngular);
    private readonly destroyRef = inject(DestroyRef);

    /** Key under which quick filter state is stored. Must be unique per grid. */
    readonly key = input.required<string>({ alias: 'kbqAgGridQuickFilterState' });

    /** Store used to persist and restore quick filter state. Defaults to {@link KBQ_AG_GRID_QUICK_FILTER_STATE_STORE}. */
    readonly store = input(inject(KBQ_AG_GRID_QUICK_FILTER_STATE_STORE), {
        // eslint-disable-next-line @angular-eslint/no-input-rename
        alias: 'kbqAgGridQuickFilterStateStore'
    });

    private readonly _value = signal('');

    /**
     * Current quick filter text. Updated on restore and on every user change.
     * Bind to the search input's `[value]` to keep it in sync after state restore.
     */
    readonly value = this._value.asReadonly();

    constructor() {
        this.grid.gridReady.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ api }) => void this.init(api));
    }

    /** Removes the stored quick filter state and clears the grid filter. */
    reset(): void {
        const store = this.store();
        const key = this.key();

        void store.removeItem(key);
        this.grid.api.setGridOption('quickFilterText', '');
        this._value.set('');
    }

    private async init(api: GridApi): Promise<void> {
        const key = this.key();
        const store = this.store();

        const item = await store.getItem(key);

        if (item) {
            api.setGridOption('quickFilterText', item);
            this._value.set(item);
        }

        const save: AgEventListener<unknown, unknown, 'filterChanged'> = (event) => {
            // Skips saves triggered by api.setGridOption('quickFilterText') during init to avoid redundant writes.
            if (event.source === 'api') return;

            const text = api.getQuickFilter() ?? '';

            if (!text) {
                void store.removeItem(key);
            } else {
                void store.setItem(key, text);
            }

            this._value.set(text);
        };

        api.addEventListener('filterChanged', save);

        this.destroyRef.onDestroy(() => {
            api.removeEventListener('filterChanged', save);
        });
    }
}
