import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    isDevMode,
    model,
    Renderer2,
    Signal
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
    KbqAgGridCopyFormatter,
    kbqAgGridCopyFormatterCsv,
    kbqAgGridCopyFormatterJson,
    KbqAgGridThemeModule
} from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import {
    AllCommunityModule,
    CellClickedEvent,
    CellKeyDownEvent,
    ColDef,
    DragStartedEvent,
    DragStoppedEvent,
    FirstDataRenderedEvent,
    FullWidthCellKeyDownEvent,
    GridApi,
    GridReadyEvent,
    ITooltipParams,
    ModuleRegistry,
    RowDragEvent,
    RowSelectionOptions
} from 'ag-grid-community';
import { catchError, of } from 'rxjs';

ModuleRegistry.registerModules([AllCommunityModule]);

type DevOlympicData = {
    athlete: string;
    age: number;
    country: string;
    year: number;
    date: string;
    sport: string;
    gold: number;
    silver: number;
    bronze: number;
    total: number;
};

enum DevThemeSelector {
    Light = 'kbq-light',
    Dark = 'kbq-dark'
}

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule, FormsModule],
    selector: 'dev-root',
    template: `
        <details class="dev-accordion" data-testid="e2eOptionsAccordion">
            <summary>Options</summary>
            <fieldset class="dev-options">
                <legend>Global</legend>
                <label data-testid="e2eLightThemeToggle">
                    <input type="checkbox" [(ngModel)]="lightTheme" />
                    Light Theme
                </label>
            </fieldset>
            <fieldset class="dev-options">
                <legend>AgGridAngular</legend>
                <label>
                    <input type="checkbox" [(ngModel)]="checkboxes" />
                    Checkboxes
                </label>
                <label>
                    <input type="checkbox" [(ngModel)]="multipleRowSelection" />
                    Multiple Row Selection
                </label>
                <label>
                    <input type="checkbox" [(ngModel)]="enableClickSelection" />
                    Enable Click Selection
                </label>
                <label>
                    <input type="checkbox" [(ngModel)]="editable" />
                    Editable Cell
                </label>
                <label>
                    <input type="checkbox" [(ngModel)]="resizable" />
                    Resizable Column
                </label>
                <label>
                    <input type="checkbox" [(ngModel)]="suppressMovable" />
                    Suppress Column Movable
                </label>
                <label>
                    <input type="checkbox" [disabled]="floatingFilter()" [(ngModel)]="filter" />
                    Filter
                </label>
                <label>
                    <input type="checkbox" [(ngModel)]="floatingFilter" />
                    Floating Filter
                </label>
                <label>
                    <input type="checkbox" [(ngModel)]="sortable" />
                    Sortable
                </label>
                <label data-testid="e2ePaginationToggle">
                    <input type="checkbox" [(ngModel)]="pagination" />
                    Pagination
                </label>
                <label>
                    <!-- TODO: grid does not support dynamic RTL change -->
                    <input type="checkbox" disabled="" [(ngModel)]="enableRtl" />
                    RTL
                </label>
                <label>
                    <input type="checkbox" [(ngModel)]="columnHoverHighlight" />
                    Column Hover Highlight
                </label>
                <label data-testid="e2eTooltipToggle">
                    <input type="checkbox" [(ngModel)]="tooltip" />
                    Tooltip
                </label>
                <label>
                    <input type="checkbox" [(ngModel)]="animateRows" />
                    Animate Rows
                </label>
                <label>
                    <input type="checkbox" [(ngModel)]="lockPinned" />
                    Lock Pinned
                </label>
                <label>
                    <input type="checkbox" [(ngModel)]="lockPosition" />
                    Lock Position
                </label>
                <label>
                    <input type="checkbox" [(ngModel)]="rowDrag" />
                    Row Drag
                </label>
                <label>
                    <input type="checkbox" [(ngModel)]="suppressMoveWhenRowDragging" />
                    Suppress Move When Row Dragging
                </label>
                <label data-testid="e2ePinFirstColumnToggle">
                    <input type="checkbox" [(ngModel)]="pinFirstColumn" />
                    Pin First Column
                </label>
                <label data-testid="e2ePinLastColumnToggle">
                    <input type="checkbox" [(ngModel)]="pinLastColumn" />
                    Pin Last Column
                </label>
                <label>
                    <input type="checkbox" [(ngModel)]="suppressCellFocus" />
                    Suppress Cell Focus
                </label>
                <label data-testid="e2eShowIndexColumnToggle">
                    <input type="checkbox" [(ngModel)]="showIndexColumn" />
                    Show Index Column
                </label>
                <label data-testid="e2eCellTextSelectionToggle">
                    <input type="checkbox" [(ngModel)]="cellTextSelection" />
                    Cell Text Selection
                </label>
            </fieldset>
            <fieldset class="dev-options">
                <legend>Keyboard</legend>
                <label>
                    <input type="checkbox" [(ngModel)]="selectAllRowsByCtrlA" />
                    Select All Rows by Ctrl+A
                </label>
                <label>
                    <input type="checkbox" [(ngModel)]="selectRowsByShiftArrow" />
                    Select Rows by Shift+Arrow
                </label>
                <label>
                    <input type="checkbox" [(ngModel)]="toNextRowByTab" />
                    To Next Row by Tab
                </label>
                <label>
                    <input type="checkbox" [(ngModel)]="selectRowsByCtrlClick" />
                    Select Row by Ctrl+Click
                </label>
                <label data-testid="e2eCopyByCtrlCToggle">
                    <input type="checkbox" [(ngModel)]="copyByCtrlC" />
                    Copy by Ctrl+C
                </label>
                <label>
                    Copy Format:
                    <select data-testid="e2eCopyFormatSelect" [disabled]="!copyByCtrlC()" [(ngModel)]="copyFormat">
                        @for (option of copyFormatOptions; track option) {
                            <option [value]="option">{{ option }}</option>
                        }
                    </select>
                </label>
            </fieldset>
            <fieldset class="dev-options">
                <legend>KbqAgGridAngularTheme</legend>
                <label>
                    <input type="checkbox" [(ngModel)]="disableCellFocusStyles" />
                    Disable cell focus styles
                </label>
            </fieldset>
        </details>

        <ag-grid-angular
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            [kbqAgGridToNextRowByTab]="toNextRowByTab()"
            [kbqAgGridSelectRowsByShiftArrow]="selectRowsByShiftArrow()"
            [kbqAgGridSelectAllRowsByCtrlA]="selectAllRowsByCtrlA()"
            [kbqAgGridSelectRowsByCtrlClick]="selectRowsByCtrlClick()"
            [kbqAgGridCopyByCtrlC]="copyByCtrlC()"
            [kbqAgGridCopyFormatter]="copyFormatter()"
            [disableCellFocusStyles]="disableCellFocusStyles()"
            [columnDefs]="columnDefs()"
            [rowSelection]="rowSelection()"
            [defaultColDef]="defaultColDef()"
            [rowData]="rowData()"
            [rowDragManaged]="rowDrag()"
            [rowDragMultiRow]="rowDrag()"
            [suppressMoveWhenRowDragging]="suppressMoveWhenRowDragging()"
            [pagination]="pagination()"
            [enableRtl]="enableRtl()"
            [columnHoverHighlight]="columnHoverHighlight()"
            [suppressCellFocus]="suppressCellFocus()"
            [tooltipShowDelay]="500"
            [animateRows]="animateRows()"
            [enableCellTextSelection]="cellTextSelection()"
            (gridReady)="onGridReady($event)"
            (firstDataRendered)="onFirstDataRendered($event)"
            (dragStarted)="onDragStarted($event)"
            (dragStopped)="onDragStopped($event)"
            (rowDragEnter)="onRowDragEnter($event)"
            (rowDragLeave)="onRowDragLeave($event)"
            (rowDragEnd)="onRowDragEnd($event)"
            (cellKeyDown)="onCellKeyDown($event)"
            (cellClicked)="onCellClicked($event)"
        />
    `,
    styles: `
        :host {
            display: flex;
            flex-direction: column;
            padding: var(--kbq-size-m);
            height: calc(100vh - calc(var(--kbq-size-l) * 2));
        }

        ag-grid-angular {
            height: 100%;
            max-width: 2036px;
        }

        .dev-accordion {
            margin-bottom: var(--kbq-size-s);
        }

        .dev-accordion > summary {
            user-select: none;
        }

        .dev-options {
            display: flex;
            flex-wrap: wrap;
            gap: var(--kbq-size-xs);
        }

        .dev-options > label {
            white-space: nowrap;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevApp {
    private readonly renderer = inject(Renderer2);
    private readonly document = inject(DOCUMENT);

    readonly copyFormatOptions = ['tsv', 'csv', 'json', 'custom'] as const;

    private gridApi!: GridApi | null;

    readonly lightTheme = model(true);
    readonly checkboxes = model(true);
    readonly multipleRowSelection = model(true);
    readonly editable = model(false);
    readonly resizable = model(true);
    readonly floatingFilter = model(false);
    readonly sortable = model(true);
    readonly filter = model(false);
    readonly pagination = model(false);
    readonly suppressMovable = model(false);
    readonly enableRtl = model(false);
    readonly columnHoverHighlight = model(false);
    readonly tooltip = model(false);
    readonly animateRows = model(false);
    readonly lockPinned = model(false);
    readonly lockPosition = model(false);
    readonly disableCellFocusStyles = model(true);
    readonly rowDrag = model(true);
    readonly suppressMoveWhenRowDragging = model(true);
    readonly pinFirstColumn = model(false);
    readonly pinLastColumn = model(false);
    readonly suppressCellFocus = model(false);
    readonly showIndexColumn = model(isDevMode());
    readonly selectAllRowsByCtrlA = model(true);
    readonly selectRowsByShiftArrow = model(true);
    readonly selectRowsByCtrlClick = model(true);
    readonly toNextRowByTab = model(true);
    readonly copyByCtrlC = model(true);
    readonly copyFormat = model<(typeof this.copyFormatOptions)[number]>('tsv');
    readonly enableClickSelection = model(false);
    readonly cellTextSelection = model(true);

    readonly copyFormatter = computed<KbqAgGridCopyFormatter | undefined>(() => {
        const format = this.copyFormat();

        switch (format) {
            case 'custom': {
                const customFormatter: KbqAgGridCopyFormatter = ({ selectedNodes }): string =>
                    `Custom Copy Formatter Output. Selected Nodes: ${selectedNodes.length}.`;
                return customFormatter;
            }
            case 'csv': {
                return kbqAgGridCopyFormatterCsv;
            }
            case 'json': {
                return kbqAgGridCopyFormatterJson;
            }
            case 'tsv':
            default: {
                return undefined;
            }
        }
    });

    readonly rowSelection = computed((): RowSelectionOptions => {
        const enableClickSelection = this.enableClickSelection();
        const hideDisabledCheckboxes = false;
        const checkboxes = this.checkboxes();

        return this.multipleRowSelection()
            ? {
                  mode: 'multiRow',
                  enableClickSelection,
                  hideDisabledCheckboxes,
                  checkboxes,
                  headerCheckbox: checkboxes
              }
            : {
                  mode: 'singleRow',
                  enableClickSelection,
                  hideDisabledCheckboxes,
                  checkboxes
              };
    });

    readonly columnDefs = computed<ColDef[]>(() => {
        const tooltip = this.tooltip();
        const rowDrag = this.rowDrag();
        const pinFirstColumn = this.pinFirstColumn();
        const pinLastColumn = this.pinLastColumn();
        const showIndexColumn = this.showIndexColumn();

        return [
            {
                hide: !showIndexColumn,
                headerName: 'index',
                valueGetter: 'node.rowIndex',
                width: 70,
                sortable: false,
                filter: false,
                resizable: false,
                suppressMovable: true,
                editable: false,
                lockPosition: true
            },
            {
                field: 'athlete',
                headerTooltip: tooltip ? 'Tooltip for Athlete Column Header' : undefined,
                tooltipValueGetter: ({ data }: ITooltipParams<DevOlympicData>): string | null =>
                    tooltip ? 'Tooltip for Athlete Cell: ' + data!.country : null,
                rowDrag: rowDrag
                    ? (parameter): boolean => {
                          const rowIndex = parameter.node.rowIndex!;
                          return rowIndex !== 1 && rowIndex !== 2;
                      }
                    : false,
                pinned: pinFirstColumn ? 'left' : false
            },
            {
                field: 'age',
                headerTooltip: tooltip ? 'Tooltip for Age Column Header' : undefined,
                tooltipValueGetter: ({ data }: ITooltipParams<DevOlympicData>): string | null =>
                    tooltip ? 'Tooltip for Age Cell: ' + data!.athlete : null,
                cellEditor: 'agNumberCellEditor'
            },
            {
                field: 'country',
                headerTooltip: tooltip ? 'Tooltip for Country Column Header' : undefined,
                tooltipValueGetter: ({ data }: ITooltipParams<DevOlympicData>): string | null =>
                    tooltip ? 'Tooltip for Country Cell: ' + data!.athlete : null
            },
            {
                field: 'year',
                headerTooltip: tooltip ? 'Tooltip for Year Column Header' : undefined,
                tooltipValueGetter: ({ data }: ITooltipParams<DevOlympicData>): string | null =>
                    tooltip ? 'Tooltip for Year Cell: ' + data!.athlete : null
            },
            {
                field: 'date',
                headerTooltip: tooltip ? 'Tooltip for Date Column Header' : undefined,
                tooltipValueGetter: ({ data }: ITooltipParams<DevOlympicData>): string | null =>
                    tooltip ? 'Tooltip for Date Cell: ' + data!.athlete : null,
                cellEditor: 'agDateCellEditor'
            },
            {
                field: 'sport',
                headerTooltip: tooltip ? 'Tooltip for Sport Column Header' : undefined,
                tooltipValueGetter: ({ data }: ITooltipParams<DevOlympicData>): string | null =>
                    tooltip ? 'Tooltip for Sport Cell: ' + data!.athlete : null,
                cellEditor: 'agLargeTextCellEditor'
            },
            {
                field: 'gold',
                headerTooltip: tooltip ? 'Tooltip for Gold Column Header' : undefined,
                tooltipValueGetter: ({ data }: ITooltipParams<DevOlympicData>): string | null =>
                    tooltip ? 'Tooltip for Gold Cell: ' + data!.athlete : null,
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: {
                    values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
                }
            },
            {
                field: 'silver',
                headerTooltip: tooltip ? 'Tooltip for Silver Column Header' : undefined,
                tooltipValueGetter: ({ data }: ITooltipParams<DevOlympicData>): string | null =>
                    tooltip ? 'Tooltip for Silver Cell: ' + data!.athlete : null,
                cellEditor: 'agNumberCellEditor'
            },
            {
                field: 'bronze',
                headerTooltip: tooltip ? 'Tooltip for Bronze Column Header' : undefined,
                tooltipValueGetter: ({ data }: ITooltipParams<DevOlympicData>): string | null =>
                    tooltip ? 'Tooltip for Bronze Cell: ' + data!.athlete : null,
                cellEditor: 'agNumberCellEditor'
            },
            {
                field: 'total',
                headerTooltip: tooltip ? 'Tooltip for Total Column Header' : undefined,
                tooltipValueGetter: ({ data }: ITooltipParams<DevOlympicData>): string | null =>
                    tooltip ? 'Tooltip for Total Cell: ' + data!.athlete : null,
                cellEditor: 'agNumberCellEditor',
                pinned: pinLastColumn ? 'right' : false
            }
        ];
    });

    readonly defaultColDef = computed<ColDef>(() => {
        return {
            editable: this.editable(),
            filter: this.filter(),
            sortable: this.sortable(),
            resizable: this.resizable(),
            floatingFilter: this.floatingFilter(),
            suppressMovable: this.suppressMovable(),
            lockPinned: this.lockPinned(),
            lockPosition: this.lockPosition()
        };
    });

    readonly rowData: Signal<DevOlympicData[]>;

    constructor() {
        this.rowData = toSignal(
            inject(HttpClient)
                .get<DevOlympicData[]>('/olympic-winners.json')
                .pipe(catchError(() => of([]))),
            { initialValue: [] }
        );

        toObservable(this.lightTheme)
            .pipe(takeUntilDestroyed())
            .subscribe((lightTheme) => {
                this.renderer.addClass(this.document.body, lightTheme ? DevThemeSelector.Light : DevThemeSelector.Dark);
                this.renderer.removeClass(
                    this.document.body,
                    lightTheme ? DevThemeSelector.Dark : DevThemeSelector.Light
                );
            });

        toObservable(this.multipleRowSelection)
            .pipe(takeUntilDestroyed())
            .subscribe(() => {
                this.gridApi?.deselectAll();
            });

        toObservable(this.editable)
            .pipe(takeUntilDestroyed())
            .subscribe(() => {
                this.gridApi?.stopEditing();
            });

        toObservable(this.floatingFilter)
            .pipe(takeUntilDestroyed())
            .subscribe((floatingFilter) => {
                if (floatingFilter && !this.filter()) this.filter.set(true);

                this.gridApi?.setFilterModel(null);
            });

        toObservable(this.sortable)
            .pipe(takeUntilDestroyed())
            .subscribe(() => {
                this.gridApi?.applyColumnState({
                    defaultState: { sort: null }
                });
            });

        toObservable(this.lockPinned)
            .pipe(takeUntilDestroyed())
            .subscribe(() => {
                this.gridApi?.applyColumnState({
                    defaultState: { pinned: null }
                });
            });
    }

    onGridReady(event: GridReadyEvent): void {
        console.debug('onGridReady:', event);

        const { api } = event;

        this.gridApi = api;

        this.gridApi.setColumnWidths([{ key: 'ag-Grid-SelectionColumn', newWidth: 36 }]);
    }

    onFirstDataRendered(event: FirstDataRenderedEvent): void {
        console.debug('onFirstDataRendered:', event);

        const { api } = event;

        api.setFocusedCell(0, 'athlete');

        api.forEachNode((node) => {
            if (node.rowIndex === 4 || node.rowIndex === 5) {
                node.setSelected(true);
            }
        });
    }

    onDragStarted(event: DragStartedEvent): void {
        console.debug('onDragStarted:', event);
    }

    onDragStopped(event: DragStoppedEvent): void {
        console.debug('onDragStopped:', event);
    }

    onRowDragEnter(event: RowDragEvent): void {
        console.debug('onRowDragEnter:', event);
    }

    onRowDragLeave(event: RowDragEvent): void {
        console.debug('onRowDragLeave:', event);
    }

    onRowDragEnd(event: RowDragEvent): void {
        console.debug('onRowDragEnd:', event);
    }

    onCellKeyDown(event: CellKeyDownEvent | FullWidthCellKeyDownEvent): void {
        console.debug('onCellKeyDown:', event);
    }

    onCellClicked(event: CellClickedEvent): void {
        console.debug('onCellClicked:', event);
    }
}
