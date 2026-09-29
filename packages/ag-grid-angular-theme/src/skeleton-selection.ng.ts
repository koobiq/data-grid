import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { KbqAgGridSkeletonCellRenderer } from './skeleton-cell-renderer.ng';

/**
 * Skeleton placeholder shown in the selection column of a row that has not loaded yet: a square the
 * size of the checkbox it stands in for. Wire it up through `cellRendererSelector` in
 * `selectionColumnDef`, and pair it with {@link KbqAgGridSkeletonCellRenderer} on the data columns.
 *
 * The selection column is AG Grid's own, so `selectionColumnDef` is the only way into it, and the
 * theme deliberately leaves that wiring to you. A directive doing it for you would have to merge its
 * renderer into the option after the grid is ready, and AG Grid replaces the option wholesale
 * whenever the Angular input emits a new reference — a `computed()` rebuilding `selectionColumnDef`
 * would drop the renderer and silently bring the real checkbox back.
 *
 * @example
 * ```typescript
 * readonly selectionColumnDef: SelectionColumnDef = {
 *   cellRendererSelector: ({ data }: ICellRendererParams) =>
 *     data === undefined ? { component: KbqAgGridSkeletonSelectionCellComponent } : undefined
 * };
 * ```
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
