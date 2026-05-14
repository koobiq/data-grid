import {
    DestroyRef,
    Directive,
    effect,
    inject,
    Injectable,
    InjectionToken,
    input,
    model,
    output,
    Provider,
    signal,
    Type,
    untracked
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { AgEventListener, GridApi } from 'ag-grid-community';
import { KbqAgGridStateStore } from './state-store';

/**
 * Storage interface for persisting and retrieving ag-grid quick filter state.
 *
 * Supports both synchronous and Promise-based implementations.
 */
export type KbqAgGridQuickFilterStateStore = KbqAgGridStateStore<string>;

/**
 * {@link KbqAgGridQuickFilterStateStore} implementation backed by `localStorage`.
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
 * @example
 * ```typescript
 * providers: [kbqAgGridQuickFilterStateStoreProvider(KbqAgGridQuickFilterStateQueryParamsStore)]
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
    return store instanceof Type
        ? { provide: KBQ_AG_GRID_QUICK_FILTER_STATE_STORE, useClass: store }
        : { provide: KBQ_AG_GRID_QUICK_FILTER_STATE_STORE, useValue: store };
};

/**
 * Directive that persists and restores ag-grid quick filter state
 * using a configurable {@link KbqAgGridQuickFilterStateStore}.
 *
 * Exposes a two-way bindable {@link value} model so the host component
 * can keep its search input in sync without accessing the grid API directly.
 *
 * @example Signals / ngModel
 * ```html
 * <input [(ngModel)]="filterText" />
 * <ag-grid-angular kbqAgGridTheme
 *                  [kbqAgGridQuickFilterState]="'quick-filter-state'"
 *                  [kbqAgGridQuickFilterStateStore]="myQuickFilterStore"
 *                  [(kbqAgGridQuickFilterStateValue)]="filterText" />
 * ```
 * @example Reactive forms
 * ```html
 * <input [formControl]="control" />
 * <ag-grid-angular kbqAgGridTheme
 *                  [kbqAgGridQuickFilterState]="'quick-filter-state'"
 *                  [kbqAgGridQuickFilterStateStore]="myQuickFilterStore"
 *                  (kbqAgGridQuickFilterStateValueChange)="control.setValue($event)"
 *                  (kbqAgGridQuickFilterStateRestored)="control.setValue($event)" />
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
    private readonly api = signal<GridApi | null>(null);

    /** Key under which quick filter state is stored. Must be unique per grid. */
    readonly key = input.required<string>({ alias: 'kbqAgGridQuickFilterState' });

    /** Store used to persist and restore quick filter state. Defaults to {@link KBQ_AG_GRID_QUICK_FILTER_STATE_STORE}. */
    readonly store = input(inject(KBQ_AG_GRID_QUICK_FILTER_STATE_STORE), {
        alias: 'kbqAgGridQuickFilterStateStore'
    });

    /**
     * Current quick filter text — two-way bindable.
     * Bind to the search input's `[value]` to keep it in sync after state restore.
     */
    readonly value = model('', { alias: 'kbqAgGridQuickFilterStateValue' });

    /** Emitted once after state is restored from the store. Useful for bridging with reactive forms. */
    readonly restored = output<string>({ alias: 'kbqAgGridQuickFilterStateRestored' });

    constructor() {
        effect(() => {
            const api = this.api();
            if (!api) return;

            const value = this.value();
            api.setGridOption('quickFilterText', value);

            const key = untracked(this.key);
            const store = untracked(this.store);

            if (value) void store.setItem(key, value);
            else void store.removeItem(key);
        });

        this.grid.gridReady.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ api }) => void this.init(api));
    }

    /** Removes the stored quick filter state and clears the grid filter. */
    reset(): void {
        this.value.set('');
    }

    private async init(api: GridApi): Promise<void> {
        this.api.set(api);
        const item = await this.store().getItem(this.key());
        if (item) {
            this.value.set(item);
            this.restored.emit(item);
        }

        const filterChanged: AgEventListener<unknown, unknown, 'filterChanged'> = ({ source }) => {
            if (source !== 'quickFilter') return;
            this.value.set(api.getQuickFilter() ?? '');
        };

        api.addEventListener('filterChanged', filterChanged);
        this.destroyRef.onDestroy(() => api.removeEventListener('filterChanged', filterChanged));
    }
}
