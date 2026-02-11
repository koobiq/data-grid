import { Clipboard } from '@angular/cdk/clipboard';
import { A, C, DOWN_ARROW, UP_ARROW } from '@angular/cdk/keycodes';
import { DOCUMENT } from '@angular/common';
import { booleanAttribute, Directive, inject, Injectable, input, NgModule } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular } from 'ag-grid-angular';
import {
    CellClickedEvent,
    CellKeyDownEvent,
    CellPosition,
    FullWidthCellKeyDownEvent,
    GridApi,
    IRowNode,
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
export type KbqAgGridCopyFormatter = (params: { selectedNodes: IRowNode[]; api: GridApi }) => string;

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
    copySelectedByCtrlC(
        { event, api }: CellKeyDownEvent | FullWidthCellKeyDownEvent,
        formatter: KbqAgGridCopyFormatter = this.defaultCopyFormatter
    ): void {
        if (!isKeyboardEvent(event)) return;

        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const { keyCode, metaKey, ctrlKey } = event;

        const targetShortcut = (ctrlKey || metaKey) && keyCode === C;

        if (!targetShortcut) return;

        const selection = this.document.defaultView?.getSelection();

        if (selection && selection.toString().length > 0) return;

        const selectedNodes = api.getSelectedNodes();

        if (selectedNodes.length === 0) return;

        event.preventDefault();

        const text = formatter({ selectedNodes, api });

        this.clipboard.copy(text);
    }

    /** Default copy formatter that produces TSV with column headers. */
    private readonly defaultCopyFormatter: KbqAgGridCopyFormatter = ({ selectedNodes, api }) => {
        const columns = api.getAllDisplayedColumns().filter((column) => !column.getColId().includes('ag-Grid-'));
        const headerRow = columns
            .map((column) => {
                const colDef = column.getColDef();
                return colDef.headerName ?? colDef.field ?? column.getColId();
            })
            .join('\t');

        const dataRows = selectedNodes.map((rowNode) =>
            columns.map((column) => api.getCellValue({ rowNode, colKey: column, useFormatter: true }) ?? '').join('\t')
        );

        return [headerRow, ...dataRows].join('\n');
    };
}

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
        '[class.ag-theme-koobiq_disable-cell-focus-styles]': 'disableCellFocusStyles()'
    }
})
export class KbqAgGridTheme {
    private readonly grid = inject(AgGridAngular);

    /**
     * Disables ag-grid cell focus styles (e.g. border-color).
     *
     * @default false
     */
    readonly disableCellFocusStyles = input(false, { transform: booleanAttribute });

    constructor() {
        // https://www.ag-grid.com/archive/33.3.2/angular-data-grid/errors/239/?_version_=33.3.2
        this.grid.theme = 'legacy';
    }
}

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
    private readonly shortcuts = inject(KbqAgGridShortcuts);

    /** Indicates whether the directive is enabled. */
    readonly enabled = input(true, { transform: booleanAttribute, alias: 'kbqAgGridSelectAllRowsByCtrlA' });

    constructor() {
        this.grid.cellKeyDown.pipe(takeUntilDestroyed()).subscribe((event) => {
            if (this.enabled()) this.shortcuts.selectAllRowsByCtrlA(event);
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
    private readonly shortcuts = inject(KbqAgGridShortcuts);

    /** Indicates whether the directive is enabled. */
    readonly enabled = input(true, { transform: booleanAttribute, alias: 'kbqAgGridSelectRowsByShiftArrow' });

    constructor() {
        this.grid.cellKeyDown.pipe(takeUntilDestroyed()).subscribe((event) => {
            if (this.enabled()) this.shortcuts.selectRowsByShiftArrow(event);
        });
    }
}

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
    private readonly shortcuts = inject(KbqAgGridShortcuts);

    /** Indicates whether the directive is enabled. */
    readonly enabled = input(true, { transform: booleanAttribute, alias: 'kbqAgGridSelectRowsByCtrlClick' });

    constructor() {
        this.grid.cellClicked.pipe(takeUntilDestroyed()).subscribe((event) => {
            if (this.enabled()) this.shortcuts.selectRowsByCtrlClick(event);
        });
    }
}

/**
 * Directive that enables copying selected content using Ctrl+C (or Cmd+C on Mac).
 *
 * If text is selected in the browser or grid (`enableCellTextSelection`), the native copy behavior is preserved.
 * Otherwise, the selected row(s) data is copied using the provided {@link KbqAgGridCopyFormatter}
 * or the default TSV format (with column headers).
 *
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme kbqAgGridCopyByCtrlC />
 *
 * <ag-grid-angular kbqAgGridTheme kbqAgGridCopyByCtrlC [kbqAgGridCopyFormatter]="myFormatter" />
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridCopyByCtrlC]'
})
export class KbqAgGridCopyByCtrlC {
    private readonly grid = inject(AgGridAngular);
    private readonly shortcuts = inject(KbqAgGridShortcuts);

    /** Indicates whether the directive is enabled. */
    readonly enabled = input(true, { transform: booleanAttribute, alias: 'kbqAgGridCopyByCtrlC' });

    /** Custom formatter for clipboard content. When not provided, the default TSV format is used. */
    readonly formatter = input<KbqAgGridCopyFormatter | undefined>(undefined, {
        // eslint-disable-next-line @angular-eslint/no-input-rename
        alias: 'kbqAgGridCopyFormatter'
    });

    constructor() {
        this.grid.cellKeyDown.pipe(takeUntilDestroyed()).subscribe((event) => {
            if (this.enabled()) this.shortcuts.copySelectedByCtrlC(event, this.formatter());
        });
    }
}

const COMPONENTS = [
    KbqAgGridTheme,
    KbqAgGridToNextRowByTab,
    KbqAgGridSelectAllRowsByCtrlA,
    KbqAgGridSelectRowsByShiftArrow,
    KbqAgGridSelectRowsByCtrlClick,
    KbqAgGridCopyByCtrlC
];

@NgModule({
    imports: COMPONENTS,
    exports: COMPONENTS,
    providers: [KbqAgGridShortcuts]
})
export class KbqAgGridThemeModule {}
