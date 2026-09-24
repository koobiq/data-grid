import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { ILoadingCellRendererAngularComp } from 'ag-grid-angular';
import { ILoadingCellRendererParams } from 'ag-grid-community';

/** Narrowest and widest a bar may get, in percent of the cell. */
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
 * Width of a bar for a given seed. Bars have to vary so that the placeholder reads as text of
 * different lengths, but the variation must be a pure function of the cell's position: random
 * widths would make every screenshot test flaky, and would change on each re-render.
 */
const skeletonBarWidth = (seed: number): string =>
    `${Math.round(MIN_BAR_WIDTH + BAR_WIDTH_RANGE * pseudoRandom(seed))}%`;

/** Spreads columns apart in the seed space, so that neighbouring cells do not get equal widths. */
const hashColumnId = (colId: string): number => {
    let hash = 0;

    for (const character of colId) {
        hash = (hash * 31 + character.charCodeAt(0)) % 997;
    }

    return hash;
};

/**
 * Skeleton cell renderer for use with Infinite Row Model (`rowModelType="infinite"`).
 * Renders an animated skeleton placeholder inside each unloaded grid cell.
 *
 * Use via `cellRendererSelector` in `defaultColDef`: return this component when `params.data`
 * is `undefined` (row not yet fetched) and `undefined` otherwise to fall back to default rendering.
 *
 * Bar widths vary from cell to cell to imitate real content. Outside a grid cell — as in
 * {@link KbqAgGridLoadingOverlayComponent} — the variation comes from the `seed` input instead.
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
     * Seed for the bar width, for use outside a grid cell. Left unset, the bar fills its container
     * instead of varying — which is what a caller sizing the bar itself wants.
     */
    readonly seed = input<number | null>(null);

    /** Seed taken from the cell's own position, once AG Grid has supplied it. */
    private readonly cellSeed = signal<number | null>(null);

    protected readonly barWidth = computed(() => {
        const seed = this.cellSeed() ?? this.seed();

        return seed === null ? '100%' : skeletonBarWidth(seed);
    });

    agInit(params: ILoadingCellRendererParams): void {
        this.cellSeed.set((params.node.rowIndex ?? 0) + hashColumnId(params.column?.getColId() ?? ''));
    }
}
