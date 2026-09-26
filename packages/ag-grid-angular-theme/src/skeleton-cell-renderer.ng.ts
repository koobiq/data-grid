import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ILoadingCellRendererAngularComp } from 'ag-grid-angular';
import { ILoadingCellRendererParams } from 'ag-grid-community';

/** Narrowest and widest a bar may get, in percent of its container. */
const MIN_BAR_WIDTH = 45;
const BAR_WIDTH_RANGE = 55;

/**
 * Evenly spread value in `[0, 1)` for a given seed. Taking the fractional part matters: `sin` alone
 * bunches consecutive integers up near its extremes, which left almost every bar at full width.
 */
const pseudoRandom = (seed: number): number => {
    const value = Math.sin(seed * 12.9898) * 43758.5453;

    return value - Math.floor(value);
};

/**
 * Width of a bar for a given seed. The variation must be a pure function of the seed: random widths
 * would make every screenshot test flaky, and would change on each re-render.
 */
const skeletonBarWidth = (seed: number): string =>
    `${Math.round(MIN_BAR_WIDTH + BAR_WIDTH_RANGE * pseudoRandom(seed))}%`;

/**
 * Skeleton cell renderer for use with Infinite Row Model (`rowModelType="infinite"`).
 * Renders an animated skeleton placeholder inside each unloaded grid cell.
 *
 * Use via `cellRendererSelector` in `defaultColDef`: return this component when `params.data`
 * is `undefined` (row not yet fetched) and `undefined` otherwise to fall back to default rendering.
 *
 * In a grid cell every bar fills its cell. Bars of differing width belong to the cold start, where
 * the placeholder stands in for a grid that is not there yet and has to read as content; a page
 * arriving under rows that are already on screen has real columns to line up with, so uneven bars
 * only make it look unsettled. A caller that wants the variation asks for it with `seed`, as
 * {@link KbqAgGridLoadingOverlayComponent} does.
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
        class: 'kbq-ag-grid-skeleton-cell-renderer',
        '[style.--kbq-ag-grid-skeleton-bar-width]': 'barWidth()'
    },
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="kbq-ag-grid-skeleton-cell"></div>
    `
})
export class KbqAgGridSkeletonCellRenderer implements ILoadingCellRendererAngularComp {
    /**
     * Seed for the bar width. Left unset — as it is when AG Grid renders this in a cell — the bar
     * fills its container instead of varying.
     */
    readonly seed = input<number | null>(null);

    protected readonly barWidth = computed(() => {
        const seed = this.seed();

        return seed === null ? '100%' : skeletonBarWidth(seed);
    });

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    agInit(_params: ILoadingCellRendererParams): void {}
}
