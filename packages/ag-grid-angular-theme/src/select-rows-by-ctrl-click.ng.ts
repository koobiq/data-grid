import { booleanAttribute, Directive, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular } from 'ag-grid-angular';
import { CellClickedEvent } from 'ag-grid-community';

/**
 * Directive that enables selecting multiple rows using Ctrl+Click (or Cmd+Click on Mac).
 *
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme kbqAgGridSelectRowsByCtrlClick />
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridSelectRowsByCtrlClick]'
})
export class KbqAgGridSelectRowsByCtrlClick {
    private readonly grid = inject(AgGridAngular);

    /** Indicates whether the directive is enabled. */
    readonly enabled = input(true, { transform: booleanAttribute, alias: 'kbqAgGridSelectRowsByCtrlClick' });

    constructor() {
        this.grid.cellClicked.pipe(takeUntilDestroyed()).subscribe((event) => {
            if (this.enabled()) this.selectRowsByCtrlClick(event);
        });
    }

    private selectRowsByCtrlClick({ event, node }: CellClickedEvent): void {
        if (!(event instanceof MouseEvent) || !node.selectable) return;

        const { metaKey, ctrlKey } = event;

        if (!(ctrlKey || metaKey) || event.type !== 'click') return;

        event.preventDefault();
        event.stopPropagation();

        node.setSelected(!node.isSelected());
    }
}
