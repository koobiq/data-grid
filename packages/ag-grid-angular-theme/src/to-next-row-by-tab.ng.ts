import { booleanAttribute, Directive, inject, input } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { CellPosition, TabToNextCellParams } from 'ag-grid-community';
import { KbqAgGridShortcuts } from './shortcuts.ng';

/**
 * Directive that modifies TAB navigation to move focus to the next row instead of the next cell.
 *
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme kbqAgGridToNextRowByTab />
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridToNextRowByTab]'
})
export class KbqAgGridToNextRowByTab {
    private readonly grid = inject(AgGridAngular);
    private readonly shortcuts = inject(KbqAgGridShortcuts);

    /** Indicates whether the directive is enabled. */
    readonly enabled = input(true, { transform: booleanAttribute, alias: 'kbqAgGridToNextRowByTab' });

    constructor() {
        this.grid.tabToNextCell = (params: TabToNextCellParams): CellPosition | boolean => {
            return this.enabled() ? this.shortcuts.toNextRowByTab(params) : (params.nextCellPosition ?? false);
        };
    }
}
