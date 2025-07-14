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
import { KbqAgGridThemeModule } from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import {
    CellKeyDownEvent,
    ColDef,
    ColumnApi,
    DragStartedEvent,
    DragStoppedEvent,
    FirstDataRenderedEvent,
    FullWidthCellKeyDownEvent,
    GridApi,
    GridReadyEvent,
    ITooltipParams,
    RowDragEvent
} from 'ag-grid-community';
import { catchError, of } from 'rxjs';

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
        <details class="dev-accordion">
            <summary>Options</summary>
            <fieldset class="dev-options">
                <legend>Global</legend>
                <label>
                    <input type="checkbox" [(ngModel)]="lightTheme" />
                    Light Theme
                </label>
            </fieldset>
            <fieldset class="dev-options">
                <legend>AgGridAngular</legend>
                <label>
                    <input type="checkbox" [(ngModel)]="checkboxSelection" />
                    Checkbox Selection
                </label>
                <label>
                    <input type="checkbox" [(ngModel)]="multipleRowSelection" />
                    Multiple Row Selection
                </label>
                <label>
                    <input type="checkbox" [(ngModel)]="suppressRowClickSelection" />
                    Suppress Row Click Selection
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
                <label>
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
                <label>
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
                <label>
                    <input type="checkbox" [(ngModel)]="pinFirstColumn" />
                    Pin First Column
                </label>
                <label>
                    <input type="checkbox" [(ngModel)]="pinLastColumn" />
                    Pin Last Column
                </label>
                <label>
                    <input type="checkbox" [(ngModel)]="suppressCellFocus" />
                    Suppress Cell Focus
                </label>
                <label>
                    <input type="checkbox" [(ngModel)]="showIndexColumn" />
                    Show Index Column
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
            kbqAgGridTheme
            kbqAgGridToNextRowByTab
            kbqAgGridSelectAllRowsByCtrlA
            kbqAgGridSelectRowsByShiftArrow
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
            [suppressRowClickSelection]="suppressRowClickSelection()"
            [suppressCellFocus]="suppressCellFocus()"
            [tooltipShowDelay]="500"
            [animateRows]="animateRows()"
            (gridReady)="onGridReady($event)"
            (firstDataRendered)="onFirstDataRendered($event)"
            (dragStarted)="onDragStarted($event)"
            (dragStopped)="onDragStopped($event)"
            (rowDragEnter)="onRowDragEnter($event)"
            (rowDragLeave)="onRowDragLeave($event)"
            (rowDragEnd)="onRowDragEnd($event)"
            (cellKeyDown)="onCellKeyDown($event)"
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

    private gridApi!: GridApi | null;
    private gridColumnApi!: ColumnApi | null;

    readonly lightTheme = model(true);
    readonly checkboxSelection = model(true);
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
    readonly suppressRowClickSelection = model(true);
    readonly animateRows = model(false);
    readonly lockPinned = model(false);
    readonly lockPosition = model(false);
    readonly disableCellFocusStyles = model(false);
    readonly rowDrag = model(true);
    readonly suppressMoveWhenRowDragging = model(true);
    readonly pinFirstColumn = model(false);
    readonly pinLastColumn = model(false);
    readonly suppressCellFocus = model(false);
    readonly showIndexColumn = model(isDevMode());

    readonly rowSelection = computed(() => {
        return this.multipleRowSelection() ? 'multiple' : 'single';
    });

    readonly columnDefs = computed<ColDef[]>(() => {
        const checkboxSelection = this.checkboxSelection();
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
                lockPosition: true,
                pinned: pinFirstColumn ? 'left' : false
            },
            {
                hide: !checkboxSelection,
                headerCheckboxSelection: checkboxSelection,
                checkboxSelection: checkboxSelection,
                showDisabledCheckboxes: true,
                width: 34,
                headerName: '',
                sortable: false,
                filter: false,
                resizable: false,
                suppressMovable: true,
                editable: false,
                lockPosition: true,
                pinned: pinFirstColumn ? 'left' : false
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
                .get<DevOlympicData[]>('https://www.ag-grid.com/example-assets/olympic-winners.json')
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
                this.gridColumnApi?.applyColumnState({
                    defaultState: { sort: null }
                });
            });

        toObservable(this.lockPinned)
            .pipe(takeUntilDestroyed())
            .subscribe(() => {
                this.gridColumnApi?.applyColumnState({
                    defaultState: { pinned: null }
                });
            });
    }

    onGridReady(event: GridReadyEvent): void {
        console.debug('onGridReady:', event);

        const { api, columnApi } = event;

        this.gridApi = api;
        this.gridColumnApi = columnApi;
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
}
