import { booleanAttribute, DestroyRef, Directive, ElementRef, inject, input, NgZone } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular } from 'ag-grid-angular';
import { GridApi, IRowNode } from 'ag-grid-community';

/**
 * Directive that enables selecting/deselecting a range of rows by holding Shift and clicking a row's selection checkbox.
 *
 * Overrides the default AG Grid Shift+Click behavior on checkboxes.
 *
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme kbqAgGridSelectRowsByShiftClick />
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridSelectRowsByShiftClick]'
})
export class KbqAgGridSelectRowsByShiftClick {
    private readonly grid = inject(AgGridAngular);
    private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly destroyRef = inject(DestroyRef);
    private readonly zone = inject(NgZone);

    /** Indicates whether the directive is enabled. */
    readonly enabled = input(true, { transform: booleanAttribute, alias: 'kbqAgGridSelectRowsByShiftClick' });

    private anchorRowIndex: number | null = null;
    /** Intended selection state for the next shift+click range operation. */
    private anchorIntent = true;

    constructor() {
        this.grid.gridReady.pipe(takeUntilDestroyed()).subscribe(({ api }) => this.init(api));
    }

    private init(api: GridApi): void {
        const root = this.elementRef.nativeElement;

        const handler = (event: MouseEvent): void => {
            if (!this.enabled()) return;

            const { target } = event;

            if (!(target instanceof Element)) return;

            if (!target.closest('.ag-selection-checkbox')) return;

            const rowIndexStr = target.closest('[row-index]')?.getAttribute('row-index');

            if (rowIndexStr == null) return;

            const rowIndex = parseInt(rowIndexStr, 10);

            if (isNaN(rowIndex)) return;

            if (!event.shiftKey) {
                this.anchorRowIndex = rowIndex;
                // node.isSelected() is the state BEFORE AG Grid toggles it on this click
                const node = api.getDisplayedRowAtIndex(rowIndex);
                this.anchorIntent = !(node?.isSelected() ?? false);
                return;
            }

            // Intercept shift+click before AG Grid processes it
            event.stopPropagation();

            const anchorIndex = this.anchorRowIndex ?? rowIndex;
            const rangeStart = Math.min(anchorIndex, rowIndex);
            const rangeEnd = Math.max(anchorIndex, rowIndex);
            const totalRows = api.getDisplayedRowCount();

            const rangeNodes: IRowNode[] = [];

            for (let i = rangeStart; i <= rangeEnd; i++) {
                if (i >= 0 && i < totalRows) {
                    const node = api.getDisplayedRowAtIndex(i);

                    if (node) rangeNodes.push(node);
                }
            }

            const allSelected = rangeNodes.every((node) => node.isSelected());
            // If all rows in range are already selected, deselect (toggle).
            // Otherwise apply the stored intent and flip it for the next shift+click.
            const shouldSelect = allSelected ? false : this.anchorIntent;

            rangeNodes.forEach((node) => {
                if (node.selectable) node.setSelected(shouldSelect);
            });

            this.anchorRowIndex = rowIndex;
            this.anchorIntent = !shouldSelect;
        };

        this.zone.runOutsideAngular(() => root.addEventListener('click', handler, true));
        this.destroyRef.onDestroy(() => root.removeEventListener('click', handler, true));
    }
}
