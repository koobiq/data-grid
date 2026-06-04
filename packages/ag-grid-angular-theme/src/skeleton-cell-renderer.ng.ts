import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ILoadingCellRendererAngularComp } from 'ag-grid-angular';
import { ILoadingCellRendererParams } from 'ag-grid-community';

/**
 * Skeleton cell renderer for use with Infinite Row Model (`rowModelType="infinite"`).
 * Renders an animated skeleton placeholder inside each unloaded grid cell.
 *
 * Use via `cellRendererSelector` in `defaultColDef`: return this component when `params.data`
 * is `undefined` (row not yet fetched) and `undefined` otherwise to fall back to default rendering.
 *
 * @example
 * ```typescript
 * readonly defaultColDef: ColDef = {
 *   cellRendererSelector: (params) =>
 *     params.data === undefined ? { component: KbqAgGridSkeletonCellRenderer } : undefined
 * };
 * ```
 */
@Component({
    standalone: true,
    selector: 'kbq-ag-grid-skeleton-cell-renderer',
    host: {
        class: 'kbq-ag-grid-skeleton-cell-renderer'
    },
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="kbq-ag-grid-skeleton-cell"></div>
    `
})
export class KbqAgGridSkeletonCellRenderer implements ILoadingCellRendererAngularComp {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    agInit(_params: ILoadingCellRendererParams): void {}
}
