import { DestroyRef, Directive, inject, Injectable, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { AgEventListener, ColumnState, GridApi } from 'ag-grid-community';

type AsyncLike<T> = T | Promise<T>;

/**
 * Storage interface for persisting and retrieving ag-grid column state.
 *
 * Supports both synchronous and Promise-based implementations.
 */
export type KbqAgGridColumnStateStore = {
    getItem: (key: string) => AsyncLike<ColumnState[] | null>;
    setItem: (key: string, value: ColumnState[]) => AsyncLike<void>;
    removeItem: (key: string) => AsyncLike<void>;
};

/**
 * {@link KbqAgGridColumnStateStore} implementation backed by `localStorage`.
 *
 * @example
 * ```typescript
 * protected readonly state = { store: inject(KbqAgGridColumnStateLocalStorageStore), key: 'columns' };
 * ```
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme [kbqAgGridColumnState]="state" />
 * ```
 */
@Injectable({ providedIn: 'root' })
export class KbqAgGridColumnStateLocalStorageStore implements KbqAgGridColumnStateStore {
    // TODO: Should use KBQ_WINDOW token
    private readonly localStorage = window.localStorage;

    getItem(key: string): ColumnState[] | null {
        const item = this.localStorage.getItem(key);

        if (!item) return null;

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            return JSON.parse(item) as ColumnState[];
        } catch {
            return null;
        }
    }

    setItem(key: string, value: ColumnState[]): void {
        this.localStorage.setItem(key, JSON.stringify(value));
    }

    removeItem(key: string): void {
        this.localStorage.removeItem(key);
    }
}

/**
 * {@link KbqAgGridColumnStateStore} implementation backed by URL query parameters.
 *
 * Uses Angular's {@link Router} to read and write query params.
 * Calls `router.navigate` with `replaceUrl: true` so column changes
 * do not push entries into the browser history.
 *
 * @example
 * ```typescript
 * protected readonly state = { store: inject(KbqAgGridColumnStateQueryParamsStore), key: 'columns' };
 * ```
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme [kbqAgGridColumnState]="state" />
 * ```
 */
@Injectable({ providedIn: 'root' })
export class KbqAgGridColumnStateQueryParamsStore implements KbqAgGridColumnStateStore {
    private readonly router = inject(Router);
    // TODO: Should use KBQ_WINDOW token
    private readonly window = window;

    getItem(key: string): ColumnState[] | null {
        const item = new URLSearchParams(this.window.location.search).get(key);

        if (!item) return null;

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            return JSON.parse(item) as ColumnState[];
        } catch {
            return null;
        }
    }

    async setItem(key: string, value: ColumnState[]): Promise<void> {
        await this.router.navigate([], {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            queryParams: { [key]: JSON.stringify(value, (_, v) => (v === null || v === false ? undefined : v)) },
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
 * Configuration object for {@link KbqAgGridColumnState}.
 */
export type KbqAgGridColumnStateConfig = {
    /** Store instance used to read and write column state. */
    store: KbqAgGridColumnStateStore;
    /** Key under which column state is stored. Must be unique per grid. */
    key: string;
};

/**
 * Directive that persists and restores ag-grid column state (sort, order, visibility, width)
 * using a configurable {@link KbqAgGridColumnStateStore}.
 *
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme [kbqAgGridColumnState]="{ store: kbqAgGridColumnStateLocalStorageStore, key: 'columns' }" />
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridColumnState]'
})
export class KbqAgGridColumnState {
    private readonly grid = inject(AgGridAngular);
    private readonly destroyRef = inject(DestroyRef);

    /** Column state configuration: store and storage key. */
    readonly state = input.required<KbqAgGridColumnStateConfig>({ alias: 'kbqAgGridColumnState' });

    constructor() {
        this.grid.gridReady.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ api }) => void this.init(api));
    }

    private async init(api: GridApi): Promise<void> {
        const { store, key } = this.state();

        const item = await store.getItem(key);

        if (item) {
            // Defer to the next event loop turn so AG Grid finishes column initialization
            // before applying state (including column order).
            await new Promise<void>((resolve) => void setTimeout(resolve));

            api.applyColumnState({ state: item, applyOrder: true });
        }

        const save: AgEventListener = () => {
            void store.setItem(key, api.getColumnState());
        };

        const saveOnResizeFinished: AgEventListener<unknown, unknown, 'columnResized'> = (event) => {
            if (event.finished) save(event);
        };

        api.addEventListener('sortChanged', save);
        api.addEventListener('columnMoved', save);
        api.addEventListener('columnVisible', save);
        api.addEventListener('columnResized', saveOnResizeFinished);

        this.destroyRef.onDestroy(() => {
            api.removeEventListener('sortChanged', save);
            api.removeEventListener('columnMoved', save);
            api.removeEventListener('columnVisible', save);
            api.removeEventListener('columnResized', saveOnResizeFinished);
        });
    }
}
