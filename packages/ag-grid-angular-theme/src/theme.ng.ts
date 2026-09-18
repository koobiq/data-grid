import { SharedResizeObserver } from '@angular/cdk/observers/private';
import { booleanAttribute, DestroyRef, Directive, ElementRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular } from 'ag-grid-angular';
import { GridApi } from 'ag-grid-community';
import { filter, merge } from 'rxjs';

/** Default width (px) of AG Grid's auto-generated selection checkbox column, matching the
 * Koobiq design system's checkbox column sizing (AG's own default is wider). */
const SELECTION_COLUMN_WIDTH = 36;

/**
 * Directive that applies the koobiq theme for ag-grid-angular.
 *
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme />
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridTheme]',
    host: {
        class: 'ag-theme-koobiq',
        '[class.ag-theme-koobiq_disable-cell-focus-styles]': 'disableCellFocusStyles() || _disableCellFocusStyles()',
        '[class.ag-theme-koobiq_pinned-left-cols-overflow]': 'columnsOverflowLeft()',
        '[class.ag-theme-koobiq_pinned-right-cols-overflow]': 'columnsOverflowRight()'
    }
})
export class KbqAgGridTheme {
    private readonly grid = inject(AgGridAngular);
    private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly destroyRef = inject(DestroyRef);
    private readonly sharedResizeObserver = inject(SharedResizeObserver);

    /**
     * Disables ag-grid cell focus styles (e.g. border-color).
     *
     * @default false
     *
     * @deprecated Will be removed in next major release. Use the `kbqAgGridThemeDisableCellFocusStyles` input instead.
     */
    readonly disableCellFocusStyles = input(false, { transform: booleanAttribute });

    /**
     * Disables ag-grid cell focus styles (e.g. border-color).
     *
     * @default false
     */
    readonly _disableCellFocusStyles = input(false, {
        transform: booleanAttribute,
        alias: 'kbqAgGridThemeDisableCellFocusStyles'
    });

    protected readonly columnsOverflowLeft = signal(false);
    protected readonly columnsOverflowRight = signal(false);

    constructor() {
        // https://www.ag-grid.com/archive/33.3.2/angular-data-grid/errors/239/?_version_=33.3.2
        this.grid.theme = 'legacy';

        this.observeColumnsOverflow();
        this.applyDefaultSelectionColumnWidth();
    }

    /**
     * Defaults the auto-generated selection checkbox column to `SELECTION_COLUMN_WIDTH`. Merges
     * with — never overrides — any `width` already present on `selectionColumnDef`, whether from
     * the consumer's own `[selectionColumnDef]` input or another directive on the same grid (e.g.
     * `KbqAgGridRowGroup`, which also touches `selectionColumnDef` for its own renderers). Reading
     * the current value via `getGridOption` right before writing, rather than assuming an empty
     * starting point, keeps this correct regardless of which directive's `gridReady` handler
     * happens to run first — see `KbqAgGridRowGroup`'s own `selectionColumnDef` merge for the
     * matching half of this.
     */
    private applyDefaultSelectionColumnWidth(): void {
        this.grid.gridReady.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ api }) => {
            const existing = api.getGridOption('selectionColumnDef');
            api.setGridOption('selectionColumnDef', { width: SELECTION_COLUMN_WIDTH, ...existing });
        });
    }

    /**
     * Subscribed here rather than from a `gridReady` handler, because `ag-grid-angular` forwards an
     * event only while the output it belongs to already has a subscriber, and the events of the grid
     * initialisation are replayed before that handler runs.
     */
    private observeColumnsOverflow(): void {
        merge(
            // The grid is still laying its body out when `gridReady` fires, so the columns measure as
            // fitting. The observer delivers the measurement of the finished layout, and of every later
            // one, so that the shadows do not wait for the first scroll.
            this.sharedResizeObserver.observe(this.elementRef.nativeElement),
            this.grid.gridReady,
            // Emitted once the grid has laid its own body out for the new size, which the resize
            // observer above reports before the grid reacts to it.
            this.grid.gridSizeChanged,
            this.grid.bodyScroll.pipe(filter(({ direction }) => direction === 'horizontal')),
            // Columns change what is scrollable without resizing the grid itself.
            this.grid.columnPinned,
            this.grid.columnResized,
            this.grid.displayedColumnsChanged
        )
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => this.updateColumnsOverflow());
    }

    /** Marks the sides where pinned columns cover scrolled-out ones, which the theme shades. */
    private updateColumnsOverflow(): void {
        // The grid has no api until it is ready, and rejects every call once it is destroyed, which the
        // resize observer can outlive while the grid is torn down.
        const api = this.grid.api as GridApi | undefined;

        if (!api || api.isDestroyed()) return;

        if (!api.isPinning()) {
            this.columnsOverflowLeft.set(false);
            this.columnsOverflowRight.set(false);

            return;
        }

        // Read from the api rather than from the DOM of the grid: the scrolled range and the width of
        // the scrollable columns are the same numbers the body is laid out with.
        const { left, right } = api.getHorizontalPixelRange();
        const columnsWidth = api
            .getDisplayedCenterColumns()
            .reduce((width, column) => width + column.getActualWidth(), 0);

        // A grid that is hidden or not laid out yet scrolls nowhere, which would otherwise read as
        // columns hidden behind both of its sides.
        if (right <= left) return;

        this.columnsOverflowLeft.set(left > 0);
        this.columnsOverflowRight.set(Math.round(right) < columnsWidth);
    }
}
