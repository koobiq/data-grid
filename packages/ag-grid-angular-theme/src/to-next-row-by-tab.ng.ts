import { booleanAttribute, Directive, inject, input } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { CellPosition, TabToNextCellParams } from 'ag-grid-community';

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

    /** Indicates whether the directive is enabled. */
    readonly enabled = input(true, { transform: booleanAttribute, alias: 'kbqAgGridToNextRowByTab' });

    constructor() {
        this.grid.tabToNextCell = (params: TabToNextCellParams): CellPosition | boolean => {
            return this.enabled() ? this.toNextRowByTab(params) : (params.nextCellPosition ?? false);
        };
    }

    private toNextRowByTab({ previousCellPosition, api, backwards }: TabToNextCellParams): CellPosition | boolean {
        const { rowIndex, column, rowPinned } = previousCellPosition;

        // Moving forward from the last row leaves Tab to the browser. Moving backwards from the first row
        // returns row -1, which AG Grid resolves to the header.
        if (!backwards && rowIndex >= api.getDisplayedRowCount() - 1) return false;

        return { rowIndex: backwards ? rowIndex - 1 : rowIndex + 1, column, rowPinned };
    }
}
