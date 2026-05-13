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
import { GridApi, IRowNode } from 'ag-grid-community';

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
 * protected readonly filterPass = (node: IRowNode) => node.data?.value === this.filterValue();
 * ```
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme [kbqAgGridExternalFilterState]="state.key" [kbqAgGridExternalFilterStateStore]="state.store" [kbqAgGridExternalFilterStatePass]="filterPass" />
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
 * protected readonly filterPass = (node: IRowNode) => node.data?.value === this.filterValue();
 * ```
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme [kbqAgGridExternalFilterState]="state.key" [kbqAgGridExternalFilterStateStore]="state.store" [kbqAgGridExternalFilterStatePass]="filterPass" />
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
 * The directive manages the persistence layer and wires `isExternalFilterPresent`
 * and `doesExternalFilterPass` into ag-grid automatically. The host component provides
 * the row predicate via `[kbqAgGridExternalFilterStatePass]` and two-way binds the
 * filter value via `[(kbqAgGridExternalFilterStateValue)]`.
 *
 * @example Signals / ngModel
 * ```typescript
 * readonly filterValue = model<string | null>(null);
 * readonly filterPass = (node: IRowNode) => node.data?.sport === this.filterValue();
 * ```
 * ```html
 * <select [(ngModel)]="filterValue">...</select>
 * <ag-grid-angular
 *   kbqAgGridTheme
 *   [kbqAgGridExternalFilterState]="'external-filter-state'"
 *   [kbqAgGridExternalFilterStatePass]="filterPass"
 *   [(kbqAgGridExternalFilterStateValue)]="filterValue"
 * />
 * ```
 * @example Reactive forms
 * ```typescript
 * readonly control = new FormControl<string | null>(null);
 * readonly filterValue = toSignal(this.control.valueChanges, { initialValue: null });
 * readonly filterPass = (node: IRowNode) => node.data?.sport === this.control.value;
 * ```
 * ```html
 * <select [formControl]="control">...</select>
 * <ag-grid-angular
 *   kbqAgGridTheme
 *   [kbqAgGridExternalFilterState]="'external-filter-state'"
 *   [kbqAgGridExternalFilterStatePass]="filterPass"
 *   [kbqAgGridExternalFilterStateValue]="filterValue()"
 *   (kbqAgGridExternalFilterStateRestored)="control.setValue($event)"
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
    private readonly api = signal<GridApi | null>(null);

    /** Key under which external filter state is stored. Must be unique per grid. */
    readonly key = input.required<string>({ alias: 'kbqAgGridExternalFilterState' });

    /** Store used to persist and restore external filter state. Defaults to {@link KBQ_AG_GRID_EXTERNAL_FILTER_STATE_STORE}. */
    readonly store = input(inject(KBQ_AG_GRID_EXTERNAL_FILTER_STATE_STORE), {
        // eslint-disable-next-line @angular-eslint/no-input-rename
        alias: 'kbqAgGridExternalFilterStateStore'
    });

    /** Predicate called by ag-grid to decide whether a row passes the external filter. */
    readonly doesExternalFilterPass = input.required<(node: IRowNode) => boolean>({
        // eslint-disable-next-line @angular-eslint/no-input-rename
        alias: 'kbqAgGridExternalFilterStatePass'
    });

    /** Current external filter value — two-way bindable. */
    readonly value = model<unknown>(null, { alias: 'kbqAgGridExternalFilterStateValue' });

    /** Emitted once after state is restored from the store. Useful for bridging with reactive forms. */
    // eslint-disable-next-line @angular-eslint/no-output-rename
    readonly restored = output<unknown>({ alias: 'kbqAgGridExternalFilterStateRestored' });

    constructor() {
        effect(() => {
            const api = this.api();
            if (!api) return;

            const value = this.value();
            const key = untracked(this.key);
            const store = untracked(this.store);

            if (this.hasValue(value)) void store.setItem(key, value);
            else void store.removeItem(key);

            api.onFilterChanged();
        });

        this.grid.gridReady.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ api }) => void this.init(api));
    }

    /** Removes the stored external filter state and clears the filter. */
    reset(): void {
        this.value.set(null);
    }

    private hasValue(value: unknown): boolean {
        return value !== null && value !== undefined && value !== '';
    }

    private async init(api: GridApi): Promise<void> {
        const item = await this.store().getItem(this.key());

        if (item !== null && item !== undefined) {
            this.value.set(item);
            this.restored.emit(item);
        }

        api.setGridOption('isExternalFilterPresent', () => this.hasValue(this.value()));
        api.setGridOption('doesExternalFilterPass', (node: IRowNode) => this.doesExternalFilterPass()(node));

        this.api.set(api);
    }
}
