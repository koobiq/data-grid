import { A } from '@angular/cdk/keycodes';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    Directive,
    inject,
    input,
    output,
    signal,
    Signal
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { AgGridAngular, IHeaderAngularComp } from 'ag-grid-angular';
import { IDatasource, IGetRowsParams, IHeaderParams, IRowNode } from 'ag-grid-community';
import { combineLatest } from 'rxjs';

/**
 * Represents inverse selection state: all rows selected with optional exclusions.
 * Suitable for sending to a backend as `WHERE id NOT IN (excludedIds)`.
 */
export type KbqAgGridInfiniteSelectionState = {
    /** Whether all rows are selected. */
    selectAll: boolean;
    /** Row IDs excluded from selection. Only meaningful when `selectAll` is `true`. */
    excludedIds: readonly string[];
};

type KbqAgGridInfiniteSelectionHeaderParams = {
    state: Signal<KbqAgGridInfiniteSelectionState>;
    toggle: () => void;
} & IHeaderParams;

@Component({
    standalone: true,
    selector: 'kbq-ag-grid-select-all-header',
    template: `
        <div
            role="presentation"
            class="ag-labeled ag-label-align-right ag-checkbox ag-input-field ag-header-select-all"
        >
            <div
                role="presentation"
                class="ag-wrapper ag-input-wrapper ag-checkbox-input-wrapper"
                [class.ag-checked]="params.state().selectAll && params.state().excludedIds.length === 0"
                [class.ag-indeterminate]="params.state().selectAll && params.state().excludedIds.length > 0"
            >
                <input
                    class="ag-input-field-input ag-checkbox-input"
                    type="checkbox"
                    tabindex="-1"
                    [indeterminate]="params.state().selectAll && params.state().excludedIds.length > 0"
                    (click)="onToggle($event)"
                />
            </div>
        </div>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class KbqAgGridInfiniteSelectionHeaderComponent implements IHeaderAngularComp {
    protected params!: KbqAgGridInfiniteSelectionHeaderParams;

    agInit(params: KbqAgGridInfiniteSelectionHeaderParams): void {
        this.params = params;
    }

    refresh(): boolean {
        return false;
    }

    protected onToggle(event: Event): void {
        event.preventDefault();
        this.params.toggle();
    }
}

/**
 * Directive that implements inverse selection (select-all with exclusions) for `InfiniteRowModel`.
 *
 * Exposes a reactive {@link KbqAgGridInfiniteSelectionState} signal representing the backend-friendly
 * selection as `{ selectAll, excludedIds }` — equivalent to `WHERE id NOT IN (excludedIds)`.
 *
 * The directive automatically configures `rowSelection` (`mode: 'multiRow'`, `checkboxes: true`,
 * `headerCheckbox: false`) and injects a select-all header checkbox into the selection column.
 * Ctrl+A (Cmd+A on Mac) selects all rows; pressing it again when all are already selected does nothing.
 *
 * **Requirements:**
 * - Pass the datasource via `[kbqAgGridInfiniteSelectionDatasource]` instead of `[datasource]` —
 *   the directive wraps it to auto-select rows as blocks load.
 * - `[getRowId]` must be set on the grid to produce stable unique IDs (`node.id` is used internally).
 *
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme
 *                  kbqAgGridInfiniteSelection
 *                  #selection="kbqAgGridInfiniteSelection"
 *                  rowModelType="infinite"
 *                  [kbqAgGridInfiniteSelectionDatasource]="myDatasource"
 *                  [getRowId]="getRowId"
 *                  (kbqAgGridInfiniteSelectionStateChange)="onStateChange($event)" />
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridInfiniteSelection]',
    exportAs: 'kbqAgGridInfiniteSelection'
})
export class KbqAgGridInfiniteSelection {
    private readonly grid = inject(AgGridAngular);
    private readonly destroyRef = inject(DestroyRef);
    private readonly _state = signal<KbqAgGridInfiniteSelectionState>({ selectAll: false, excludedIds: [] });
    private applyingSelection = false;

    /**
     * Datasource for the infinite grid.
     * The directive wraps it to auto-select rows as blocks load.
     * Use this instead of `[datasource]`.
     */
    readonly datasource = input.required<IDatasource>({ alias: 'kbqAgGridInfiniteSelectionDatasource' });

    /** Reactive signal reflecting the current selection state. */
    readonly state = this._state.asReadonly();

    /** Emitted whenever the selection state changes. */
    readonly stateChange = output<KbqAgGridInfiniteSelectionState>({ alias: 'kbqAgGridInfiniteSelectionStateChange' });

    constructor() {
        this.grid.rowModelType = 'infinite';
        this.grid.datasource = undefined;

        this.grid.gridReady.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
            this.configureRowSelection();
            this.configureSelectionColumn();
        });

        this.grid.selectionChanged.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
            this.onSelectionChanged();
        });

        this.grid.cellKeyDown.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ event }) => {
            if (!(event instanceof KeyboardEvent)) return;
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            if ((event.ctrlKey || event.metaKey) && event.keyCode === A) {
                event.preventDefault();
                const state = this._state();
                if (state.selectAll && state.excludedIds.length === 0) return;
                this.applySelectAll();
            }
        });

        // Separate input prevents Angular binding from replacing the wrapped datasource
        // when the upstream creates a new object reference on each data load (e.g. computed()).
        combineLatest([toObservable(this.datasource), this.grid.gridReady])
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(([datasource, { api }]) => {
                api.setGridOption('datasource', this.wrapDatasource(datasource));
            });
    }

    /**
     * Toggles the select-all state.
     * Selects all currently loaded rows and marks all future rows for selection;
     * deselects all otherwise.
     */
    toggle(): void {
        if (this._state().selectAll) {
            this.applyingSelection = true;
            this.grid.api.deselectAll();
            this.applyingSelection = false;
            this.setState({ selectAll: false, excludedIds: [] });
        } else {
            this.applySelectAll();
        }
    }

    private applySelectAll(): void {
        this.setState({ selectAll: true, excludedIds: [] });
        this.applyingSelection = true;
        const nodes: IRowNode[] = [];
        this.grid.api.forEachNode((n) => {
            if (n.data) nodes.push(n);
        });
        this.grid.api.setNodesSelected({ nodes, newValue: true });
        this.applyingSelection = false;
    }

    private configureRowSelection(): void {
        const rowSelection = this.grid.api.getGridOption('rowSelection') ?? {};
        this.grid.api.setGridOption('rowSelection', {
            ...rowSelection,
            mode: 'multiRow',
            checkboxes: true,
            headerCheckbox: false
        });
    }

    private configureSelectionColumn(): void {
        const columnDef = this.grid.api.getGridOption('selectionColumnDef') ?? {};
        this.grid.api.setGridOption('selectionColumnDef', {
            ...columnDef,
            headerComponent: KbqAgGridInfiniteSelectionHeaderComponent,
            headerComponentParams: {
                state: this.state,
                toggle: (): void => this.toggle()
            } satisfies Partial<KbqAgGridInfiniteSelectionHeaderParams>
        });
    }

    private setState(state: KbqAgGridInfiniteSelectionState): void {
        this._state.set(state);
        this.stateChange.emit(state);
    }

    private onSelectionChanged(): void {
        if (this.applyingSelection || !this._state().selectAll) return;

        const excluded = new Set(this._state().excludedIds);

        this.grid.api.forEachNode((node) => {
            if (!node.id || !node.data) return;
            if (!node.isSelected()) excluded.add(node.id);
            else excluded.delete(node.id);
        });

        this.setState({ ...this._state(), excludedIds: [...excluded] });
    }

    private wrapDatasource(datasource: IDatasource): IDatasource {
        return {
            ...datasource,
            getRows: (params: IGetRowsParams): void => {
                datasource.getRows({
                    ...params,
                    successCallback: (rows, lastRow) => {
                        params.successCallback(rows, lastRow);
                        queueMicrotask(() => {
                            if (!this._state().selectAll) return;

                            const excludedIds = new Set(this._state().excludedIds);
                            const nodesToSelect: IRowNode[] = [];
                            const endRow =
                                lastRow != null && lastRow >= 0 ? Math.min(params.endRow, lastRow) : params.endRow;

                            for (let i = params.startRow; i < endRow; i++) {
                                const node = this.grid.api.getDisplayedRowAtIndex(i);

                                if (node?.id && !excludedIds.has(node.id) && !node.isSelected()) {
                                    nodesToSelect.push(node);
                                }
                            }

                            if (nodesToSelect.length > 0) {
                                this.applyingSelection = true;
                                this.grid.api.setNodesSelected({ nodes: nodesToSelect, newValue: true });
                                this.applyingSelection = false;
                            }
                        });
                    }
                });
            }
        };
    }
}
