import { DestroyRef, Directive, inject, Injectable, InjectionToken, input, Provider, Type } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { AgEventListener, GridApi } from 'ag-grid-community';
import { KbqAgGridStateStore } from './state-store';

/** Identifies the active (focused) cell by row id and column id. */
export type KbqAgGridRowFocusStateValue = {
    rowId: string;
    colId: string;
};

/**
 * Storage interface for persisting and retrieving ag-grid active cell state.
 *
 * Supports both synchronous and Promise-based implementations.
 */
export type KbqAgGridRowFocusStateStore = KbqAgGridStateStore<KbqAgGridRowFocusStateValue>;

/**
 * {@link KbqAgGridRowFocusStateStore} implementation backed by `localStorage`.
 */
@Injectable({ providedIn: 'root' })
export class KbqAgGridRowFocusStateLocalStorageStore implements KbqAgGridRowFocusStateStore {
    // TODO: Should use KBQ_WINDOW token
    private readonly localStorage = window.localStorage;

    getItem(key: string): KbqAgGridRowFocusStateValue | null {
        const item = this.localStorage.getItem(key);

        if (!item) return null;

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            return JSON.parse(item) as KbqAgGridRowFocusStateValue;
        } catch {
            return null;
        }
    }

    setItem(key: string, value: KbqAgGridRowFocusStateValue): void {
        this.localStorage.setItem(key, JSON.stringify(value));
    }

    removeItem(key: string): void {
        this.localStorage.removeItem(key);
    }
}

/**
 * {@link KbqAgGridRowFocusStateStore} implementation backed by URL query parameters.
 *
 * @example
 * ```typescript
 * providers: [kbqAgGridRowFocusStateStoreProvider(KbqAgGridRowFocusStateQueryParamsStore)]
 * ```
 */
@Injectable({ providedIn: 'root' })
export class KbqAgGridRowFocusStateQueryParamsStore implements KbqAgGridRowFocusStateStore {
    private readonly router = inject(Router);
    // TODO: Should use KBQ_WINDOW token
    private readonly location = window.location;

    getItem(key: string): KbqAgGridRowFocusStateValue | null {
        const item = new URLSearchParams(this.location.search).get(key);

        if (!item) return null;

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            return JSON.parse(item) as KbqAgGridRowFocusStateValue;
        } catch {
            return null;
        }
    }

    async setItem(key: string, value: KbqAgGridRowFocusStateValue): Promise<void> {
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
 * Injection token for {@link KbqAgGridRowFocusStateStore}.
 *
 * Defaults to {@link KbqAgGridRowFocusStateLocalStorageStore}.
 * Override it with {@link kbqAgGridRowFocusStateStoreProvider}.
 */
export const KBQ_AG_GRID_ROW_FOCUS_STATE_STORE = new InjectionToken<KbqAgGridRowFocusStateStore>(
    'KBQ_AG_GRID_ROW_FOCUS_STATE_STORE',
    { factory: (): KbqAgGridRowFocusStateStore => inject(KbqAgGridRowFocusStateLocalStorageStore) }
);

/**
 * Creates an Angular {@link Provider} that binds {@link KBQ_AG_GRID_ROW_FOCUS_STATE_STORE}
 * to the given store class or instance.
 *
 * @example
 * ```typescript
 * providers: [kbqAgGridRowFocusStateStoreProvider(KbqAgGridRowFocusStateQueryParamsStore)]
 * ```
 * @example
 * ```typescript
 * providers: [kbqAgGridRowFocusStateStoreProvider(myCustomStoreInstance)]
 * ```
 */
export const kbqAgGridRowFocusStateStoreProvider = (
    store: Type<KbqAgGridRowFocusStateStore> | KbqAgGridRowFocusStateStore
): Provider => {
    return store instanceof Type
        ? { provide: KBQ_AG_GRID_ROW_FOCUS_STATE_STORE, useClass: store }
        : { provide: KBQ_AG_GRID_ROW_FOCUS_STATE_STORE, useValue: store };
};

/**
 * Directive that persists and restores ag-grid's active (focused) cell
 * using a configurable {@link KbqAgGridRowFocusStateStore}.
 *
 * Requires `getRowId` to be set in `gridOptions` so row identity survives a page reload —
 * without it, ag-grid assigns row ids internally and a restored row id will not match any row.
 *
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme
 *                  [getRowId]="getRowId"
 *                  [kbqAgGridRowFocusState]="'row-focus-state'"
 *                  [kbqAgGridRowFocusStateStore]="myRowFocusStore" />
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridRowFocusState]',
    exportAs: 'kbqAgGridRowFocusState'
})
export class KbqAgGridRowFocusState {
    private readonly grid = inject(AgGridAngular);
    private readonly destroyRef = inject(DestroyRef);

    /** Key under which the active cell state is stored. Must be unique per grid. */
    readonly key = input.required<string>({ alias: 'kbqAgGridRowFocusState' });

    /** Store used to persist and restore the active cell state. Defaults to {@link KBQ_AG_GRID_ROW_FOCUS_STATE_STORE}. */
    readonly store = input(inject(KBQ_AG_GRID_ROW_FOCUS_STATE_STORE), { alias: 'kbqAgGridRowFocusStateStore' });

    private restoring = false;

    constructor() {
        this.grid.gridReady.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ api }) => this.initSave(api));

        // Subscribes here, in the constructor, rather than registering a native
        // `api.addEventListener('firstDataRendered', ...)` from inside the `gridReady` callback above.
        // ag-grid-angular defers emitting both `gridReady` and `firstDataRendered` until after its own
        // `ngAfterViewInit`, but only for outputs that already have a subscriber at the moment the
        // *native* grid event fires. Since directive constructors always run before the host
        // component's `ngAfterViewInit`, this subscription is guaranteed to be attached in time. Doing
        // this from inside the `gridReady` callback instead is not safe: when row data is available at
        // grid creation, the native `firstDataRendered` event fires synchronously inside `createGrid()`
        // — before `gridReady`'s own deferred emission (and therefore this listener registration) ever
        // runs — so the event would be missed permanently.
        this.grid.firstDataRendered.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => void this.restore());
    }

    /** Removes the stored active cell state for the current key and clears grid focus. */
    reset(): void {
        const store = this.store();
        const key = this.key();

        void store.removeItem(key);
        this.grid.api.clearFocusedCell();
    }

    private async restore(): Promise<void> {
        const { api } = this.grid;
        const key = this.key();
        const store = this.store();

        const item = await store.getItem(key);

        if (!item) return;

        const node = api.getRowNode(item.rowId);

        if (node?.rowIndex === null || node?.rowIndex === undefined) return;

        this.restoring = true;
        api.setFocusedCell(node.rowIndex, item.colId);
        this.restoring = false;
    }

    private initSave(api: GridApi): void {
        const key = this.key();
        const store = this.store();

        const save: AgEventListener<unknown, unknown, 'cellFocused'> = (event) => {
            // Skips saves triggered by our own restore call to avoid redundant writes.
            if (this.restoring) return;

            if (event.rowIndex === null || event.column === null || event.rowPinned) {
                void store.removeItem(key);
                return;
            }

            const rowId = api.getDisplayedRowAtIndex(event.rowIndex)?.id;

            if (rowId === undefined) {
                void store.removeItem(key);
                return;
            }

            const colId = typeof event.column === 'string' ? event.column : event.column.getColId();

            void store.setItem(key, { rowId, colId });
        };

        api.addEventListener('cellFocused', save);

        this.destroyRef.onDestroy(() => {
            api.removeEventListener('cellFocused', save);
        });
    }
}
