import { booleanAttribute, DestroyRef, Directive, ElementRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular } from 'ag-grid-angular';
import { EMPTY, filter, startWith, switchMap } from 'rxjs';

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

    private observeColumnsOverflow(): void {
        this.grid.gridReady
            .pipe(
                switchMap(() =>
                    this.grid.columnPinned.pipe(
                        startWith(null),
                        switchMap(() => {
                            if (!this.grid.api.isPinning()) {
                                this.columnsOverflowLeft.set(false);
                                this.columnsOverflowRight.set(false);
                                return EMPTY;
                            }
                            return this.grid.bodyScroll.pipe(
                                startWith({ direction: 'horizontal' }),
                                filter(({ direction }) => direction === 'horizontal')
                            );
                        })
                    )
                ),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe(() => {
                const viewport = this.elementRef.nativeElement.querySelector<HTMLElement>(
                    '.ag-body-horizontal-scroll-viewport'
                );

                if (!viewport) return;

                const { scrollLeft, scrollWidth, clientWidth } = viewport;

                this.columnsOverflowLeft.set(scrollLeft > 0);
                this.columnsOverflowRight.set(Math.round(scrollLeft + clientWidth) < scrollWidth);
            });
    }
}
