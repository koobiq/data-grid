import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { CellRendererSelectorResult, ICellRendererParams } from 'ag-grid-community';
import { KbqAgGridSkeletonCellRenderer } from './skeleton-cell-renderer.ng';

/**
 * Skeleton placeholder shown in the selection column of a row that has not loaded yet.
 * Rendered through {@link kbqAgGridSkeletonCheckbox}.
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
 * `cellRendererSelector` for `selectionColumnDef`, drawing a skeleton square the size of the
 * checkbox while the row has no data. Pair it with {@link kbqAgGridSkeletonCells} on the data
 * columns; rows are considered unloaded when `params.data` is `undefined`.
 *
 * The selection column is AG Grid's own, so `selectionColumnDef` is the only way into it. Wiring it
 * here rather than from a directive keeps the column definition yours: a directive would have to
 * merge into that grid option after the grid is ready, and AG Grid replaces the option wholesale
 * whenever the Angular input emits a new reference — which would drop the renderer and silently
 * bring the real checkbox back.
 *
 * @example
 * ```typescript
 * readonly selectionColumnDef: SelectionColumnDef = {
 *   cellRendererSelector: kbqAgGridSkeletonCheckbox()
 * };
 * ```
 */
export const kbqAgGridSkeletonCheckbox =
    () =>
    (params: ICellRendererParams): CellRendererSelectorResult | undefined =>
        params.data === undefined ? { component: KbqAgGridSkeletonSelectionCellComponent } : undefined;
