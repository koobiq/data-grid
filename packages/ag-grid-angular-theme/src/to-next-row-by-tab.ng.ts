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
        const rowsCount = api.getDisplayedRowCount();
        let nextRowIndex = backwards ? rowIndex - 1 : rowIndex + 1;

        if (nextRowIndex < 0) nextRowIndex = -1;
        if (nextRowIndex >= rowsCount) nextRowIndex = rowsCount - 1;

        const isLastRow = nextRowIndex === rowsCount - 1;

        return isLastRow ? false : { rowIndex: nextRowIndex, column, rowPinned };
    }
}
