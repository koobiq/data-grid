import { DestroyRef, Directive, inject, Injectable, InjectionToken, input, Provider, Type } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { AgEventListener, GridApi, IRowNode } from 'ag-grid-community';
import { KbqAgGridStateStore } from './state-store';

/**
 * Storage interface for persisting and retrieving ag-grid row selection state.
 *
 * Supports both synchronous and Promise-based implementations.
 */
export type KbqAgGridRowSelectionStateStore = KbqAgGridStateStore<string[]>;

/**
 * {@link KbqAgGridRowSelectionStateStore} implementation backed by `localStorage`.
 */
@Injectable({ providedIn: 'root' })
export class KbqAgGridRowSelectionStateLocalStorageStore implements KbqAgGridRowSelectionStateStore {
    // TODO: Should use KBQ_WINDOW token
    private readonly localStorage = window.localStorage;

    getItem(key: string): string[] | null {
        const item = this.localStorage.getItem(key);

        if (!item) return null;

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            return JSON.parse(item) as string[];
        } catch {
            return null;
        }
    }

    setItem(key: string, value: string[]): void {
        this.localStorage.setItem(key, JSON.stringify(value));
    }

    removeItem(key: string): void {
        this.localStorage.removeItem(key);
    }
}

/**
 * {@link KbqAgGridRowSelectionStateStore} implementation backed by URL query parameters.
 *
 * @example
 * ```typescript
 * providers: [kbqAgGridRowSelectionStateStoreProvider(KbqAgGridRowSelectionStateQueryParamsStore)]
 * ```
 */
@Injectable({ providedIn: 'root' })
export class KbqAgGridRowSelectionStateQueryParamsStore implements KbqAgGridRowSelectionStateStore {
    private readonly router = inject(Router);
    // TODO: Should use KBQ_WINDOW token
    private readonly location = window.location;

    getItem(key: string): string[] | null {
        const item = new URLSearchParams(this.location.search).get(key);

        if (!item) return null;

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            return JSON.parse(item) as string[];
        } catch {
            return null;
        }
    }

    async setItem(key: string, value: string[]): Promise<void> {
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
 * Injection token for {@link KbqAgGridRowSelectionStateStore}.
 *
 * Defaults to {@link KbqAgGridRowSelectionStateLocalStorageStore}.
 * Override it with {@link kbqAgGridRowSelectionStateStoreProvider}.
 */
export const KBQ_AG_GRID_ROW_SELECTION_STATE_STORE = new InjectionToken<KbqAgGridRowSelectionStateStore>(
    'KBQ_AG_GRID_ROW_SELECTION_STATE_STORE',
    { factory: (): KbqAgGridRowSelectionStateStore => inject(KbqAgGridRowSelectionStateLocalStorageStore) }
);

/**
 * Creates an Angular {@link Provider} that binds {@link KBQ_AG_GRID_ROW_SELECTION_STATE_STORE}
 * to the given store class or instance.
 *
 * @example
 * ```typescript
 * providers: [kbqAgGridRowSelectionStateStoreProvider(KbqAgGridRowSelectionStateQueryParamsStore)]
 * ```
 * @example
 * ```typescript
 * providers: [kbqAgGridRowSelectionStateStoreProvider(myCustomStoreInstance)]
 * ```
 */
export const kbqAgGridRowSelectionStateStoreProvider = (
    store: Type<KbqAgGridRowSelectionStateStore> | KbqAgGridRowSelectionStateStore
): Provider => {
    return store instanceof Type
        ? { provide: KBQ_AG_GRID_ROW_SELECTION_STATE_STORE, useClass: store }
        : { provide: KBQ_AG_GRID_ROW_SELECTION_STATE_STORE, useValue: store };
};

/**
 * Directive that persists and restores ag-grid row selection state
 * using a configurable {@link KbqAgGridRowSelectionStateStore}.
 *
 * Requires `getRowId` to be set in `gridOptions` so row identity survives a page reload —
 * without it, ag-grid assigns row ids internally and restored ids will not match any row.
 *
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme
 *                  [getRowId]="getRowId"
 *                  [kbqAgGridRowSelectionState]="'rows-selection-state'"
 *                  [kbqAgGridRowSelectionStateStore]="myRowSelectionStore" />
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridRowSelectionState]',
    exportAs: 'kbqAgGridRowSelectionState'
})
export class KbqAgGridRowSelectionState {
    private readonly grid = inject(AgGridAngular);
    private readonly destroyRef = inject(DestroyRef);

    /** Key under which row selection state is stored. Must be unique per grid. */
    readonly key = input.required<string>({ alias: 'kbqAgGridRowSelectionState' });

    /** Store used to persist and restore row selection state. Defaults to {@link KBQ_AG_GRID_ROW_SELECTION_STATE_STORE}. */
    readonly store = input(inject(KBQ_AG_GRID_ROW_SELECTION_STATE_STORE), {
        alias: 'kbqAgGridRowSelectionStateStore'
    });

    private destroyed = false;

    constructor() {
        this.destroyRef.onDestroy(() => {
            this.destroyed = true;
        });

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

    /** Removes the stored row selection state for the current key and clears the current selection. */
    reset(): void {
        const store = this.store();
        const key = this.key();

        void store.removeItem(key);
        this.grid.api.deselectAll();
    }

    private initSave(api: GridApi): void {
        const key = this.key();
        const store = this.store();

        const save: AgEventListener<unknown, unknown, 'selectionChanged'> = (event) => {
            // Skips saves triggered by our own restore call to avoid redundant writes.
            if (event.source === 'api') return;

            const ids = api
                .getSelectedNodes()
                .map((node) => node.id)
                .filter((id): id is string => id !== undefined);

            if (ids.length === 0) {
                void store.removeItem(key);
            } else {
                void store.setItem(key, ids);
            }
        };

        api.addEventListener('selectionChanged', save);

        this.destroyRef.onDestroy(() => {
            api.removeEventListener('selectionChanged', save);
        });
    }

    private async restore(): Promise<void> {
        const { api } = this.grid;
        const key = this.key();
        const store = this.store();

        const ids = await store.getItem(key);

        // The store's `getItem` can be a slow, consumer-provided Promise (e.g. a network round
        // trip) that resolves after this directive — and the grid api along with it — has already
        // been torn down; bail out before touching either.
        if (this.destroyed) return;

        const idSet = new Set(ids ?? []);

        // Persisted selection is the source of truth — reconcile the grid's current selection to
        // match it exactly, rather than only adding matches. Only adding would leave any
        // pre-existing selection (e.g. a default rowSelection config, or a click that raced ahead
        // of firstDataRendered) stuck selected alongside the restored rows.
        const toSelect: IRowNode[] = [];
        const toDeselect: IRowNode[] = [];

        api.forEachNode((node) => {
            const shouldBeSelected = node.id !== undefined && idSet.has(node.id);
            if (shouldBeSelected && !node.isSelected()) {
                toSelect.push(node);
            } else if (!shouldBeSelected && node.isSelected()) {
                toDeselect.push(node);
            }
        });

        if (toDeselect.length > 0) {
            api.setNodesSelected({ nodes: toDeselect, newValue: false, source: 'api' });
        }
        if (toSelect.length > 0) {
            api.setNodesSelected({ nodes: toSelect, newValue: true, source: 'api' });
        }
    }
}
