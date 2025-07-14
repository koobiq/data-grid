import { A, DOWN_ARROW, UP_ARROW } from '@angular/cdk/keycodes';
import { booleanAttribute, Directive, inject, Injectable, input, NgModule } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular } from 'ag-grid-angular';
import { CellKeyDownEvent, CellPosition, FullWidthCellKeyDownEvent, TabToNextCellParams } from 'ag-grid-community';

const isKeyboardEvent = (event: unknown): event is KeyboardEvent => event instanceof KeyboardEvent;

/**
 * Service that provides keyboard interaction functionalities for ag-grid-angular.
 */
@Injectable({ providedIn: 'root' })
export class KbqAgGridKeyboard {
    private selectionAnchorRowIndex: number | null = null;

    /**
     * Handles Shift+Arrow keyboard navigation to select multiple rows in the grid.
     *
     * @example
     * ```html
     * <ag-grid-angular kbqAgGridTheme (cellKeyDown)="keyboard.selectRowsByShiftArrow($event)" />
     * ```
     */
    selectRowsByShiftArrow({ event, node, api }: CellKeyDownEvent | FullWidthCellKeyDownEvent): void {
        if (!isKeyboardEvent(event)) return;

        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const { shiftKey, keyCode } = event;
        const targetShortcut = shiftKey && (keyCode === UP_ARROW || keyCode === DOWN_ARROW);

        if (!targetShortcut) {
            this.selectionAnchorRowIndex = null;
            return;
        }

        event.preventDefault();

        const currentRowIndex = node.rowIndex;

        if (currentRowIndex === null) return;

        const direction: 1 | -1 = keyCode === UP_ARROW ? -1 : 1;
        const selectedIndices = api
            .getSelectedNodes()
            .map(({ rowIndex }) => rowIndex)
            .filter((i) => i !== null);
        const selectedIndicesSet = new Set(selectedIndices);

        if (this.selectionAnchorRowIndex === null) {
            this.selectionAnchorRowIndex = currentRowIndex;

            if (
                selectedIndicesSet.size > 0 &&
                selectedIndicesSet.size < 100 &&
                selectedIndicesSet.has(currentRowIndex)
            ) {
                if (direction === -1) {
                    let blockEnd = currentRowIndex;
                    while (selectedIndicesSet.has(blockEnd + 1)) {
                        blockEnd++;
                    }
                    this.selectionAnchorRowIndex = blockEnd;
                } else {
                    let blockStart = currentRowIndex;
                    while (blockStart > 0 && selectedIndicesSet.has(blockStart - 1)) {
                        blockStart--;
                    }
                    this.selectionAnchorRowIndex = blockStart;
                }
            }
        }

        const nextRowIndex = currentRowIndex + direction;
        const totalRows = api.getDisplayedRowCount();

        if (nextRowIndex < 0 || nextRowIndex >= totalRows) return;

        const currentRangeStart = Math.min(this.selectionAnchorRowIndex, currentRowIndex);
        const currentRangeEnd = Math.max(this.selectionAnchorRowIndex, currentRowIndex);
        const isExpanding =
            (direction === -1 && currentRowIndex === currentRangeStart) ||
            (direction === 1 && currentRowIndex === currentRangeEnd);
        let targetRowIndex = nextRowIndex;

        if (isExpanding) {
            while (targetRowIndex >= 0 && targetRowIndex < totalRows && selectedIndicesSet.has(targetRowIndex)) {
                targetRowIndex += direction;
            }

            if (targetRowIndex < 0 || targetRowIndex >= totalRows) return;
        }

        const targetNode = api.getDisplayedRowAtIndex(targetRowIndex);

        if (!targetNode) return;

        const newRangeStart = Math.min(this.selectionAnchorRowIndex, targetRowIndex);
        const newRangeEnd = Math.max(this.selectionAnchorRowIndex, targetRowIndex);

        const toDeselect = selectedIndices.filter(
            (rowIndex) =>
                rowIndex >= currentRangeStart &&
                rowIndex <= currentRangeEnd &&
                (rowIndex < newRangeStart || rowIndex > newRangeEnd)
        );

        const toSelect: number[] = [];
        for (let i = newRangeStart; i <= newRangeEnd; i++) {
            if (!selectedIndicesSet.has(i)) toSelect.push(i);
        }

        toDeselect.forEach((rowIndex) => {
            const rowNode = api.getDisplayedRowAtIndex(rowIndex);
            if (rowNode) rowNode.setSelected(false);
        });

        toSelect.forEach((rowIndex) => {
            const rowNode = api.getDisplayedRowAtIndex(rowIndex);
            if (rowNode) rowNode.setSelected(true);
        });

        const focusedCell = api.getFocusedCell();
        if (focusedCell) {
            api.setFocusedCell(targetRowIndex, focusedCell.column);
        }
    }

    /**
     * Handles Ctrl+A (or Cmd+A on Mac) keyboard shortcut to select all rows in the grid.
     *
     * @example
     * ```html
     * <ag-grid-angular kbqAgGridTheme (cellKeyDown)="keyboard.selectAllRowsByCtrlA($event)" />
     * ```
     */
    selectAllRowsByCtrlA({ event, api }: CellKeyDownEvent | FullWidthCellKeyDownEvent): void {
        if (!isKeyboardEvent(event)) return;

        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const { keyCode, metaKey, ctrlKey } = event;

        const targetShortcut = (ctrlKey || metaKey) && keyCode === A;

        if (!targetShortcut) return;

        event.preventDefault();
        api.selectAll();
    }

    /**
     * Modifies tab navigation to move focus to the next row instead of the next cell in the same row.
     *
     * @example
     * ```html
     * <ag-grid-angular kbqAgGridTheme [tabToNextCell]="keyboard.toNextRowByTab.bind(this)" />
     * ```
     */
    toNextRowByTab({ previousCellPosition, api, backwards }: TabToNextCellParams): CellPosition | null {
        const { rowIndex, column, rowPinned } = previousCellPosition;
        const rowsCount = api.getModel().getRowCount();
        let nextRowIndex = backwards ? rowIndex - 1 : rowIndex + 1;

        if (nextRowIndex < 0) nextRowIndex = -1;
        if (nextRowIndex >= rowsCount) nextRowIndex = rowsCount - 1;

        const isLastRow = nextRowIndex === rowsCount - 1;

        return isLastRow ? null : { rowIndex: nextRowIndex, column, rowPinned };
    }
}

/**
 * Directive that applies the koobiq theme to ag-grid-angular.
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
        '[class.ag-theme-koobiq_disable-cell-focus-styles]': 'disableCellFocusStyles()'
    }
})
export class KbqAgGridTheme {
    /**
     * Disables ag-grid cell focus styles (e.g. border-color).
     *
     * @default false
     */
    readonly disableCellFocusStyles = input(false, { transform: booleanAttribute });
}

/**
 * Directive that modifies tab navigation to move focus to the next row instead of the next cell.
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
    private readonly keyboard = inject(KbqAgGridKeyboard);

    /** Indicates whether the directive is enabled. */
    readonly enabled = input(true, { transform: booleanAttribute, alias: 'kbqAgGridToNextRowByTab' });

    constructor() {
        this.grid.tabToNextCell = (params: TabToNextCellParams): CellPosition | null => {
            return this.enabled() ? this.keyboard.toNextRowByTab(params) : params.nextCellPosition;
        };
    }
}

/**
 * Directive that enables selecting all rows using Ctrl+A (or Cmd+A on Mac) keyboard shortcut.
 *
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme kbqAgGridSelectAllRowsByCtrlA />
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridSelectAllRowsByCtrlA]'
})
export class KbqAgGridSelectAllRowsByCtrlA {
    private readonly grid = inject(AgGridAngular);
    private readonly keyboard = inject(KbqAgGridKeyboard);

    /** Indicates whether the directive is enabled. */
    readonly enabled = input(true, { transform: booleanAttribute, alias: 'kbqAgGridSelectAllRowsByCtrlA' });

    constructor() {
        this.grid.cellKeyDown.pipe(takeUntilDestroyed()).subscribe((event) => {
            if (this.enabled()) this.keyboard.selectAllRowsByCtrlA(event);
        });
    }
}

/**
 * Directive that enables selecting multiple rows using Shift+Arrow keys.
 *
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme kbqAgGridSelectRowsByShiftArrow />
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridSelectRowsByShiftArrow]'
})
export class KbqAgGridSelectRowsByShiftArrow {
    private readonly grid = inject(AgGridAngular);
    private readonly keyboard = inject(KbqAgGridKeyboard);

    /** Indicates whether the directive is enabled. */
    readonly enabled = input(true, { transform: booleanAttribute, alias: 'kbqAgGridSelectRowsByShiftArrow' });

    constructor() {
        this.grid.cellKeyDown.pipe(takeUntilDestroyed()).subscribe((event) => {
            if (this.enabled()) this.keyboard.selectRowsByShiftArrow(event);
        });
    }
}

const COMPONENTS = [
    KbqAgGridTheme,
    KbqAgGridToNextRowByTab,
    KbqAgGridSelectAllRowsByCtrlA,
    KbqAgGridSelectRowsByShiftArrow
];

@NgModule({
    imports: COMPONENTS,
    exports: COMPONENTS,
    providers: [KbqAgGridKeyboard]
})
export class KbqAgGridThemeModule {}
