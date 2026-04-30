import { booleanAttribute, DestroyRef, Directive, ElementRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular } from 'ag-grid-angular';
import { debounceTime, delay, filter, startWith } from 'rxjs';

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
        '[class.ag-theme-koobiq_disable-cell-focus-styles]': 'disableCellFocusStyles()',
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
     */
    readonly disableCellFocusStyles = input(false, { transform: booleanAttribute });

    protected readonly columnsOverflowLeft = signal(false);
    protected readonly columnsOverflowRight = signal(false);

    constructor() {
        // https://www.ag-grid.com/archive/33.3.2/angular-data-grid/errors/239/?_version_=33.3.2
        this.grid.theme = 'legacy';

        this.observeColumnsOverflow();
    }

    private observeColumnsOverflow(): void {
        this.grid.bodyScroll
            .pipe(
                startWith({ direction: 'horizontal' }),
                delay(100),
                debounceTime(100),
                filter(({ direction }) => direction === 'horizontal'),
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
