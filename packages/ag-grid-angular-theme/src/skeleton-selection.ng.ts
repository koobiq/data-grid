import { ChangeDetectionStrategy, Component, DestroyRef, Directive, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular, ICellRendererAngularComp } from 'ag-grid-angular';
import { CellRendererSelectorResult, GridApi, ICellRendererParams } from 'ag-grid-community';
import { KbqAgGridSkeletonCellRenderer } from './skeleton-cell-renderer.ng';

/**
 * Skeleton placeholder shown in the selection column of a row that has not loaded yet.
 * Used internally by the {@link KbqAgGridSkeletonSelection} directive.
 */
@Component({
    standalone: true,
    imports: [KbqAgGridSkeletonCellRenderer],
    selector: 'kbq-ag-grid-skeleton-selection-cell',
    host: {
        class: 'kbq-ag-grid-skeleton-selection-cell'
    },
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <kbq-ag-grid-skeleton-cell-renderer />
    `
})
export class KbqAgGridSkeletonSelectionCellComponent implements ICellRendererAngularComp {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    agInit(_params: ICellRendererParams): void {}

    refresh(): boolean {
        return false;
    }
}

/**
 * Renders a skeleton in place of the selection checkbox while a row is still loading, so that the
 * checkbox column matches the skeleton cells next to it instead of showing an interactive checkbox
 * for a row that has no data.
 *
 * Intended for `rowModelType="infinite"`, alongside {@link KbqAgGridSkeletonCellRenderer} on the
 * data columns. Rows are considered unloaded when `params.data` is `undefined`.
 *
 * @example
 * ```html
 * <ag-grid-angular
 *     kbqAgGridTheme
 *     kbqAgGridSkeletonSelection
 *     rowModelType="infinite"
 *     [rowSelection]="rowSelection"
 *     [datasource]="datasource"
 * />
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridSkeletonSelection]'
})
export class KbqAgGridSkeletonSelection {
    private readonly grid = inject(AgGridAngular);
    private readonly destroyRef = inject(DestroyRef);

    constructor() {
        this.grid.gridReady
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(({ api }: { api: GridApi }) => this.configureSelectionColumn(api));
    }

    /**
     * Merges into `selectionColumnDef` rather than replacing it: `KbqAgGridTheme` sets the column
     * width there and `KbqAgGridRowGroup` sets its own renderers, and the order in which the
     * `gridReady` handlers run is not defined.
     */
    private configureSelectionColumn(api: GridApi): void {
        const existing = api.getGridOption('selectionColumnDef') ?? {};
        const existingSelector = existing.cellRendererSelector;

        api.setGridOption('selectionColumnDef', {
            ...existing,
            cellRendererSelector: (params: ICellRendererParams): CellRendererSelectorResult | undefined =>
                params.data === undefined
                    ? { component: KbqAgGridSkeletonSelectionCellComponent }
                    : existingSelector?.(params)
        });
    }
}
