import { Clipboard } from '@angular/cdk/clipboard';
import { A, C, DOWN_ARROW, UP_ARROW } from '@angular/cdk/keycodes';
import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import {
    CellClickedEvent,
    CellKeyDownEvent,
    CellPosition,
    FullWidthCellKeyDownEvent,
    GridApi,
    TabToNextCellParams
} from 'ag-grid-community';

const isKeyboardEvent = (event: unknown): event is KeyboardEvent => event instanceof KeyboardEvent;
const isMouseEvent = (event: unknown): event is MouseEvent => event instanceof MouseEvent;

/**
 * Custom formatter function for {@link KbqAgGridCopyByCtrlC}.
 *
 * Receives selected nodes and the grid API.
 * Returns a string that will be written to the clipboard.
 */
export type KbqAgGridCopyFormatter = (api: GridApi) => string;

/** Result of a clipboard copy operation performed by {@link KbqAgGridCopyByCtrlC}. */
export type KbqAgGridCopyEvent = {
    /** Whether the text was successfully written to the clipboard. */
    success: boolean;
    /** The text that was attempted to be copied. */
    text: string;
};

/** Formats selected rows as tab-separated values (TSV). */
export const kbqAgGridCopyFormatterTsv: KbqAgGridCopyFormatter = (api) =>
    api
        .getSelectedNodes()
        .sort((r1, r2) => (r1.rowIndex ?? 0) - (r2.rowIndex ?? 0))
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .map((row) => Object.values(row.data).join('\t'))
        .join('\n');

/** Formats selected rows as comma-separated values (CSV). */
export const kbqAgGridCopyFormatterCsv: KbqAgGridCopyFormatter = (api) =>
    api
        .getSelectedNodes()
        .sort((r1, r2) => (r1.rowIndex ?? 0) - (r2.rowIndex ?? 0))
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .map((row) => Object.values(row.data).join(','))
        .join('\n');

/** Formats selected rows as a JSON array. */
export const kbqAgGridCopyFormatterJson: KbqAgGridCopyFormatter = (api) =>
    JSON.stringify(
        api
            .getSelectedNodes()
            .sort((r1, r2) => (r1.rowIndex ?? 0) - (r2.rowIndex ?? 0))
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            .map((row) => row.data),
        null,
        2
    );

/**
 * Service that provides keyboard interaction functionalities for ag-grid-angular.
 */
@Injectable({ providedIn: 'root' })
export class KbqAgGridShortcuts {
    private readonly clipboard = inject(Clipboard);
    private readonly document = inject(DOCUMENT);
    private selectionAnchorRowIndex: number | null = null;

    /**
     * Handles Shift+Arrow to select/deselect multiple rows.
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
     * Handles Ctrl+A (or Cmd+A on Mac) to select all rows.
     *
     * @example
     * ```html
     * <ag-grid-angular kbqAgGridTheme (cellKeyDown)="keyboard.selectAllRowsByCtrlA($event)" />
     * ```
     *
     * @deprecated AG Grid provides built-in Ctrl+A support for multi-row selection. Use `rowSelection: { mode: 'multiRow', selectAll: 'all' }` instead. Will be removed in the next major release.
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
     * Modifies TAB navigation to move focus to the next row instead of the next cell (in the same row).
     *
     * @example
     * ```html
     * <ag-grid-angular kbqAgGridTheme [tabToNextCell]="keyboard.toNextRowByTab.bind(this)" />
     * ```
     */
    toNextRowByTab({ previousCellPosition, api, backwards }: TabToNextCellParams): CellPosition | boolean {
        const { rowIndex, column, rowPinned } = previousCellPosition;
        const rowsCount = api.getDisplayedRowCount();
        let nextRowIndex = backwards ? rowIndex - 1 : rowIndex + 1;

        if (nextRowIndex < 0) nextRowIndex = -1;
        if (nextRowIndex >= rowsCount) nextRowIndex = rowsCount - 1;

        const isLastRow = nextRowIndex === rowsCount - 1;

        return isLastRow ? false : { rowIndex: nextRowIndex, column, rowPinned };
    }

    /**
     * Handles Ctrl+Click (or Cmd+Click on Mac) to select/deselect a rows.
     *
     * @example
     * ```html
     * <ag-grid-angular kbqAgGridTheme (cellClicked)="keyboard.selectRowsByCtrlClick($event)" />
     * ```
     */
    selectRowsByCtrlClick({ event, node }: CellClickedEvent): void {
        if (!isMouseEvent(event) || !node.selectable) return;

        const { metaKey, ctrlKey } = event;

        const targetShortcut = (ctrlKey || metaKey) && event.type === 'click';

        if (!targetShortcut) return;

        event.preventDefault();
        event.stopPropagation();

        node.setSelected(!node.isSelected());
    }

    /**
     * Handles Ctrl+C (or Cmd+C on Mac) to copy selected content.
     *
     * If text is selected in the browser, allows native copy behavior.
     * Otherwise, copies selected row(s) data using the provided formatter
     * or the default TSV format (with column headers).
     *
     * @example
     * ```html
     * <ag-grid-angular kbqAgGridTheme (cellKeyDown)="keyboard.copySelectedByCtrlC($event)" />
     * ```
     */
    async copySelectedByCtrlC(
        { event, api }: CellKeyDownEvent | FullWidthCellKeyDownEvent,
        formatter: KbqAgGridCopyFormatter = kbqAgGridCopyFormatterTsv
    ): Promise<KbqAgGridCopyEvent | null> {
        if (!isKeyboardEvent(event)) return null;

        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const { keyCode, metaKey, ctrlKey } = event;

        const targetShortcut = (ctrlKey || metaKey) && keyCode === C;

        if (!targetShortcut) return null;

        const selection = this.document.getSelection();

        if (selection && selection.toString().length > 0) return null;

        if (api.getSelectedNodes().length === 0) return null;

        event.preventDefault();

        const text = formatter(api);

        return new Promise((resolve) => {
            // Deferring clipboard.copy to the next tick prevents AG Grid's internal
            // keyboard handling from interfering with the clipboard operation.
            setTimeout(() => resolve({ success: this.clipboard.copy(text), text }));
        });
    }
}
