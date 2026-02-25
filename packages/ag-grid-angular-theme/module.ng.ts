import { Clipboard } from '@angular/cdk/clipboard';
import { A, C, DOWN_ARROW, UP_ARROW } from '@angular/cdk/keycodes';
import { DOCUMENT } from '@angular/common';
import {
    ApplicationRef,
    booleanAttribute,
    createComponent,
    DestroyRef,
    Directive,
    ElementRef,
    EnvironmentInjector,
    inject,
    Injectable,
    InjectionToken,
    Injector,
    input,
    NgModule,
    output,
    Type
} from '@angular/core';
import {
    ApplicationRef,
    booleanAttribute,
    ComponentRef,
    createComponent,
    Directive,
    ElementRef,
    EnvironmentInjector,
    inject,
    Injectable,
    InjectionToken,
    Injector,
    input,
    NgModule,
    output,
    Type
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular } from 'ag-grid-angular';
import {
    CellClickedEvent,
    CellKeyDownEvent,
    CellMouseOverEvent,
    CellPosition,
    FullWidthCellKeyDownEvent,
    GridApi,
    GridReadyEvent,
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

/** Formats selected rows as tab-separated values (TSV) with a header row. */
export const kbqAgGridCopyFormatterTsv: KbqAgGridCopyFormatter = ({ selectedNodes, api }) => {
    const columns = api.getAllDisplayedColumns().filter((column) => !column.getColId().includes('ag-Grid-'));
    const headerRow = columns
        .map((column) => {
            const colDef = column.getColDef();
            return colDef.headerName ?? colDef.field ?? column.getColId();
        })
        .join('\t');
    const rows = selectedNodes.map((rowNode) =>
        columns.map((column) => api.getCellValue({ rowNode, colKey: column, useFormatter: true }) ?? '').join('\t')
    );

    return [headerRow, ...rows].join('\n');
};

/** Formats selected rows as comma-separated values (CSV) with a header row. */
export const kbqAgGridCopyFormatterCsv: KbqAgGridCopyFormatter = ({ selectedNodes, api }) => {
    const columns = api.getAllDisplayedColumns().filter((column) => !column.getColId().includes('ag-Grid-'));
    const headerRow = columns
        .map((column) => {
            const colDef = column.getColDef();
            return colDef.headerName ?? colDef.field ?? column.getColId();
        })
        .join(',');
    const rows = selectedNodes.map((rowNode) =>
        columns.map((column) => api.getCellValue({ rowNode, colKey: column, useFormatter: true }) ?? '').join(',')
    );

    return [headerRow, ...rows].join('\n');
};

/** Formats selected rows as a JSON array of objects keyed by field names. */
export const kbqAgGridCopyFormatterJson: KbqAgGridCopyFormatter = ({ selectedNodes, api }) => {
    const columns = api.getAllDisplayedColumns().filter((column) => !column.getColId().includes('ag-Grid-'));
    const rows = selectedNodes.map((rowNode) =>
        Object.fromEntries(
            columns.map((column) => {
                const colDef = column.getColDef();
                const key = colDef.field ?? column.getColId();
                const value = api.getCellValue({ rowNode, colKey: column, useFormatter: true }) ?? '';
                return [key, value];
            })
        )
    );

    return JSON.stringify(rows, null, 2);
};

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
    async copySelectedByCtrlC(
        { event, api }: CellKeyDownEvent | FullWidthCellKeyDownEvent,
        formatter: KbqAgGridCopyFormatter = kbqAgGridCopyFormatterTsv
    ): Promise<boolean> {
        if (!isKeyboardEvent(event)) return Promise.resolve(false);

        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const { keyCode, metaKey, ctrlKey } = event;

        const targetShortcut = (ctrlKey || metaKey) && keyCode === C;

        if (!targetShortcut) return Promise.resolve(false);

        const selection = this.document.getSelection();

        if (selection && selection.toString().length > 0) return Promise.resolve(false);

        const selectedNodes = api.getSelectedNodes();

        if (selectedNodes.length === 0) return Promise.resolve(false);

        event.preventDefault();

        const text = formatter({ selectedNodes, api });

        return new Promise((resolve) => {
            // Deferring clipboard.copy to the next tick prevents AG Grid's internal
            // keyboard handling from interfering with the clipboard operation.
            setTimeout(() => resolve(this.clipboard.copy(text)));
        });
    }
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

    /** Emits the result of the clipboard copy operation. */
    readonly copied = output<boolean>({
        // eslint-disable-next-line @angular-eslint/no-output-rename
        alias: 'kbqAgGridCopyDone'
    });

    constructor() {
        this.grid.cellKeyDown.pipe(takeUntilDestroyed()).subscribe((event) => {
            if (this.enabled()) {
                void this.shortcuts
                    .copySelectedByCtrlC(event, this.formatter())
                    .then((result) => this.copied.emit(result));
            }
        });
    }
}

/** Parameters provided to a status bar component via {@link KBQ_AG_GRID_STATUS_BAR_PARAMS}. */
export type KbqAgGridStatusBarParams = {
    api: GridApi;
};

/**
 * Injection token that provides {@link KbqAgGridStatusBarParams} to the status bar component.
 *
 * @example
 * ```typescript
 * @Component({ ... })
 * export class MyStatusBarComponent {
 *     private readonly params = inject(KBQ_AG_GRID_STATUS_BAR_PARAMS);
 * }
 * ```
 */
export const KBQ_AG_GRID_STATUS_BAR_PARAMS = new InjectionToken<KbqAgGridStatusBarParams>(
    'KBQ_AG_GRID_STATUS_BAR_PARAMS'
);

/**
 * Directive that renders a custom component as a status bar inside ag-grid-angular.
 *
 * The component is injected into the grid DOM below the grid body and above the pagination panel.
 * It receives {@link KbqAgGridStatusBarParams} via the {@link KBQ_AG_GRID_STATUS_BAR_PARAMS} injection token.
 *
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme [kbqAgGridStatusBar]="myStatusBarComponent" />
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridStatusBar]'
})
export class KbqAgGridStatusBar {
    private readonly grid = inject(AgGridAngular);
    private readonly applicationRef = inject(ApplicationRef);
    private readonly environmentInjector = inject(EnvironmentInjector);
    private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly destroyRef = inject(DestroyRef);

    readonly component = input.required<Type<unknown>>({ alias: 'kbqAgGridStatusBar' });

    constructor() {
        this.grid.gridReady.pipe(takeUntilDestroyed()).subscribe((event: GridReadyEvent) => this.init(event.api));
    }

    private init(api: GridApi): void {
        const componentRef = createComponent(this.component(), {
            environmentInjector: this.environmentInjector,
            elementInjector: Injector.create({
                providers: [{ provide: KBQ_AG_GRID_STATUS_BAR_PARAMS, useValue: { api } }]
            })
        });

        this.applicationRef.attachView(componentRef.hostView);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const componentElement: HTMLElement = componentRef.location.nativeElement;
        const { nativeElement } = this.elementRef;
        const rootWrapper = nativeElement.querySelector<HTMLElement>('.ag-root-wrapper');
        const pagingPanel = nativeElement.querySelector<HTMLElement>('.ag-paging-panel');

        if (pagingPanel) {
            rootWrapper?.insertBefore(componentElement, pagingPanel);
        } else {
            rootWrapper?.appendChild(componentElement);
        }

        this.destroyRef.onDestroy(() => {
            componentRef.destroy();
            componentElement.remove();
        });
    }
}

/** Parameters provided to an actions column component via {@link KBQ_AG_GRID_ACTIONS_COLUMN_PARAMS}. */
export type KbqAgGridRowActionsParams = {
    api: GridApi;
    node: IRowNode;
    data: unknown;
    rowIndex: number | null;
};

/**
 * Injection token that provides {@link KbqAgGridRowActionsParams} to the actions column component.
 *
 * @example
 * ```typescript
 * @Component({ ... })
 * export class MyActionsComponent {
 *     private readonly params = inject(KBQ_AG_GRID_ACTIONS_COLUMN_PARAMS);
 * }
 * ```
 */
export const KBQ_AG_GRID_ROW_ACTIONS_PARAMS = new InjectionToken<KbqAgGridRowActionsParams>(
    'KBQ_AG_GRID_ROW_ACTIONS_PARAMS'
);

/**
 * Directive that renders a custom component as an overlay on the hovered row inside ag-grid-angular.
 *
 * The component is created on `cellMouseOver` and destroyed when the mouse leaves the row or the grid.
 * It receives {@link KbqAgGridRowActionsParams} via the {@link KBQ_AG_GRID_ROW_ACTIONS_PARAMS}
 * injection token.
 *
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme [kbqAgGridRowActions]="myRowActionsComponent" />
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridRowActions]',
    host: {
        '(mouseleave)': 'clearOverlay()'
    }
})
export class KbqAgGridRowActions {
    private readonly grid = inject(AgGridAngular);
    private readonly applicationRef = inject(ApplicationRef);
    private readonly environmentInjector = inject(EnvironmentInjector);
    private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly document = inject(DOCUMENT);

    readonly component = input.required<Type<unknown>>({ alias: 'kbqAgGridRowActions' });

    private activeComponentRef: ComponentRef<unknown> | null = null;
    private activeWrapperElement: HTMLElement | null = null;
    private hoveredRowId: string | null = null;

    constructor() {
        this.grid.cellMouseOver
            .pipe(takeUntilDestroyed())
            .subscribe((event: CellMouseOverEvent) => this.onCellMouseOver(event));
    }

    protected clearOverlay(): void {
        if (!this.activeComponentRef || !this.activeWrapperElement) return;

        this.activeComponentRef.destroy();
        this.activeComponentRef = null;

        this.activeWrapperElement.remove();
        this.activeWrapperElement = null;
        this.hoveredRowId = null;
    }

    private onCellMouseOver(event: CellMouseOverEvent): void {
        const rowId = event.node.id ?? null;

        if (rowId === this.hoveredRowId) return;

        this.clearOverlay();

        if (event.node.rowPinned) return;

        const rowElement = this.elementRef.nativeElement.querySelector(`.ag-row[row-id="${rowId}"]`);

        if (!rowElement) return;

        this.hoveredRowId = rowId;

        const componentRef = createComponent(this.component(), {
            environmentInjector: this.environmentInjector,
            elementInjector: Injector.create({
                providers: [
                    {
                        provide: KBQ_AG_GRID_ROW_ACTIONS_PARAMS,
                        useValue: {
                            api: event.api,
                            node: event.node,
                            data: event.data,
                            rowIndex: event.rowIndex
                        } satisfies KbqAgGridRowActionsParams
                    }
                ]
            })
        });

        this.applicationRef.attachView(componentRef.hostView);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const componentElement: HTMLElement = componentRef.location.nativeElement;

        // Create wrapper element with the overlay class
        const wrapperElement = this.document.createElement('div');
        wrapperElement.classList.add('kbq-ag-grid-row-actions-overlay');
        wrapperElement.appendChild(componentElement);

        rowElement.appendChild(wrapperElement);
        this.activeComponentRef = componentRef;
        this.activeWrapperElement = wrapperElement;
    }
}

const COMPONENTS = [
    KbqAgGridTheme,
    KbqAgGridToNextRowByTab,
    KbqAgGridSelectAllRowsByCtrlA,
    KbqAgGridSelectRowsByShiftArrow,
    KbqAgGridSelectRowsByCtrlClick,
    KbqAgGridCopyByCtrlC,
    KbqAgGridStatusBar
    KbqAgGridCopyByCtrlC,
    KbqAgGridRowActions
];

@NgModule({
    imports: COMPONENTS,
    exports: COMPONENTS,
    providers: [KbqAgGridShortcuts]
})
export class KbqAgGridThemeModule {}
