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
import { GridApi } from 'ag-grid-community';

type AsyncLike<T> = T | Promise<T>;

/**
 * Storage interface for persisting and retrieving ag-grid external filter state.
 *
 * Supports both synchronous and Promise-based implementations.
 */
export type KbqAgGridExternalFilterStateStore<T = unknown> = {
    getItem: (key: string) => AsyncLike<T | null>;
    setItem: (key: string, value: T) => AsyncLike<void>;
    removeItem: (key: string) => AsyncLike<void>;
};

/**
 * {@link KbqAgGridExternalFilterStateStore} implementation backed by `localStorage`.
 *
 * @example
 * ```typescript
 * protected readonly state = { store: inject(KbqAgGridExternalFilterStateLocalStorageStore), key: 'external-filter-state' };
 * ```
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme [kbqAgGridExternalFilterState]="state.key" [kbqAgGridExternalFilterStateStore]="state.store" />
 * ```
 */
@Injectable({ providedIn: 'root' })
export class KbqAgGridExternalFilterStateLocalStorageStore<
    T = unknown
> implements KbqAgGridExternalFilterStateStore<T> {
    // TODO: Should use KBQ_WINDOW token
    private readonly localStorage = window.localStorage;

    getItem(key: string): T | null {
        const item = this.localStorage.getItem(key);

        if (!item) return null;

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            return JSON.parse(item) as T;
        } catch {
            return null;
        }
    }

    setItem(key: string, value: T): void {
        this.localStorage.setItem(key, JSON.stringify(value));
    }

    removeItem(key: string): void {
        this.localStorage.removeItem(key);
    }
}

/**
 * {@link KbqAgGridExternalFilterStateStore} implementation backed by URL query parameters.
 *
 * Uses Angular's {@link Router} to read and write query params.
 * Calls `router.navigate` with `replaceUrl: true` so filter changes
 * do not push entries into the browser history.
 *
 * @example
 * ```typescript
 * protected readonly state = { store: inject(KbqAgGridExternalFilterStateQueryParamsStore), key: 'external-filter-state' };
 * ```
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme [kbqAgGridExternalFilterState]="state.key" [kbqAgGridExternalFilterStateStore]="state.store" />
 * ```
 */
@Injectable({ providedIn: 'root' })
export class KbqAgGridExternalFilterStateQueryParamsStore<T = unknown> implements KbqAgGridExternalFilterStateStore<T> {
    private readonly router = inject(Router);
    // TODO: Should use KBQ_WINDOW token
    private readonly location = window.location;

    getItem(key: string): T | null {
        const item = new URLSearchParams(this.location.search).get(key);

        if (!item) return null;

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            return JSON.parse(item) as T;
        } catch {
            return null;
        }
    }

    async setItem(key: string, value: T): Promise<void> {
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
 * Injection token for {@link KbqAgGridExternalFilterStateStore}.
 *
 * Defaults to {@link KbqAgGridExternalFilterStateLocalStorageStore}.
 * Override it with {@link kbqAgGridExternalFilterStateStoreProvider}.
 */
export const KBQ_AG_GRID_EXTERNAL_FILTER_STATE_STORE = new InjectionToken<KbqAgGridExternalFilterStateStore>(
    'KBQ_AG_GRID_EXTERNAL_FILTER_STATE_STORE',
    { factory: (): KbqAgGridExternalFilterStateStore => inject(KbqAgGridExternalFilterStateLocalStorageStore) }
);

/**
 * Creates an Angular {@link Provider} that binds {@link KBQ_AG_GRID_EXTERNAL_FILTER_STATE_STORE}
 * to the given store class or instance.
 *
 * @example
 * ```typescript
 * providers: [kbqAgGridExternalFilterStateStoreProvider(KbqAgGridExternalFilterStateQueryParamsStore)]
 * ```
 * @example
 * ```typescript
 * providers: [kbqAgGridExternalFilterStateStoreProvider(myCustomStoreInstance)]
 * ```
 */
export const kbqAgGridExternalFilterStateStoreProvider = (
    store: Type<KbqAgGridExternalFilterStateStore> | KbqAgGridExternalFilterStateStore
): Provider => {
    if (store instanceof Type) {
        return {
            provide: KBQ_AG_GRID_EXTERNAL_FILTER_STATE_STORE,
            useClass: store
        };
    }

    return {
        provide: KBQ_AG_GRID_EXTERNAL_FILTER_STATE_STORE,
        useValue: store
    };
};

/**
 * Directive that persists and restores ag-grid external filter state
 * using a configurable {@link KbqAgGridExternalFilterStateStore}.
 *
 * The directive manages only the persistence layer. The host component is
 * responsible for wiring `[isExternalFilterPresent]` and `[doesExternalFilterPass]`
 * based on the exposed {@link value} signal, and must call {@link set} whenever
 * the filter value changes so the directive can persist the new value and
 * notify ag-grid via `api.onFilterChanged()`.
 *
 * @example
 * ```typescript
 * protected readonly state = viewChild.required(KbqAgGridExternalFilterState);
 * protected readonly isExternalFilterPresent = () => !!this.state().value();
 * protected readonly doesExternalFilterPass = (node: IRowNode) => node.data?.sport === this.state().value();
 * ```
 * @example
 * ```html
 * <select (change)="state().set($event.target.value || null)">...</select>
 * <ag-grid-angular
 *   #state="kbqAgGridExternalFilterState"
 *   kbqAgGridTheme
 *   [kbqAgGridExternalFilterState]="'external-filter-state'"
 *   [isExternalFilterPresent]="isExternalFilterPresent"
 *   [doesExternalFilterPass]="doesExternalFilterPass"
 * />
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridExternalFilterState]',
    exportAs: 'kbqAgGridExternalFilterState'
})
export class KbqAgGridExternalFilterState {
    private readonly grid = inject(AgGridAngular);
    private readonly destroyRef = inject(DestroyRef);

    private api: GridApi | null = null;

    /** Key under which external filter state is stored. Must be unique per grid. */
    readonly key = input.required<string>({ alias: 'kbqAgGridExternalFilterState' });

    /** Store used to persist and restore external filter state. Defaults to {@link KBQ_AG_GRID_EXTERNAL_FILTER_STATE_STORE}. */
    readonly store = input(inject(KBQ_AG_GRID_EXTERNAL_FILTER_STATE_STORE), {
        // eslint-disable-next-line @angular-eslint/no-input-rename
        alias: 'kbqAgGridExternalFilterStateStore'
    });

    private readonly _value = signal<unknown>(null);

    /**
     * Current external filter value. Updated on restore and on every {@link set} call.
     * Use it in `isExternalFilterPresent` and `doesExternalFilterPass` callbacks.
     */
    readonly value = this._value.asReadonly();

    constructor() {
        this.grid.gridReady.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ api }) => {
            this.api = api;
            void this.init(api);
        });
    }

    /**
     * Updates the external filter value, persists it to the store,
     * and notifies ag-grid to re-evaluate the filter.
     *
     * Pass `null` to clear the filter (equivalent to calling {@link reset}).
     */
    set(value: unknown): void {
        const store = this.store();
        const key = this.key();

        if (value === null || value === undefined) {
            void store.removeItem(key);
            this._value.set(null);
        } else {
            void store.setItem(key, value);
            this._value.set(value);
        }

        this.api?.onFilterChanged();
    }

    /** Removes the stored external filter state and clears the filter. */
    reset(): void {
        void this.store().removeItem(this.key());
        this._value.set(null);
        this.api?.onFilterChanged();
    }

    private async init(api: GridApi): Promise<void> {
        const key = this.key();
        const store = this.store();

        const item = await store.getItem(key);

        if (item !== null && item !== undefined) {
            this._value.set(item);
            api.onFilterChanged();
        }
    }
}
