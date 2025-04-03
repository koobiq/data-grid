import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, model, Renderer2, Signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { KbqAgGridTheme } from '@koobiq/ag-grid-theme';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, ColumnApi, FirstDataRenderedEvent, GridApi, GridReadyEvent, ITooltipParams } from 'ag-grid-community';
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
    imports: [AgGridModule, KbqAgGridTheme, FormsModule],
    selector: 'dev-root',
    template: `
        <div class="dev-grid-options">
            <label>
                <input [(ngModel)]="lightTheme" type="checkbox" />
                Light Theme
            </label>
            <label>
                <input [(ngModel)]="checkboxSelection" type="checkbox" />
                Checkbox Selection
            </label>
            <label>
                <input [(ngModel)]="multipleRowSelection" type="checkbox" />
                Multiple Row Selection
            </label>
            <label>
                <input [(ngModel)]="editable" type="checkbox" />
                Editable
            </label>
            <label>
                <input [(ngModel)]="resizable" type="checkbox" />
                Resizable
            </label>
            <label>
                <input [(ngModel)]="floatingFilter" type="checkbox" />
                Floating Filter
            </label>
            <label>
                <input [(ngModel)]="sortable" type="checkbox" />
                Sortable
            </label>
            <label>
                <input [(ngModel)]="filter" type="checkbox" />
                Filter
            </label>
            <label>
                <input [(ngModel)]="pagination" type="checkbox" />
                Pagination
            </label>
            <label>
                <input [(ngModel)]="suppressMovable" type="checkbox" />
                Suppress Movable
            </label>
            <label>
                <input [(ngModel)]="enableRtl" type="checkbox" disabled="" />
                RTL
            </label>
            <label>
                <input [(ngModel)]="columnHoverHighlight" type="checkbox" />
                Column Hover Highlight
            </label>
            <label>
                <input [(ngModel)]="tooltip" type="checkbox" />
                Tooltip
            </label>
            <label>
                <input [(ngModel)]="suppressRowClickSelection" type="checkbox" />
                Suppress Row Click Selection
            </label>
        </div>

        <ag-grid-angular
            [columnDefs]="columnDefs()"
            [rowSelection]="rowSelection()"
            [defaultColDef]="defaultColDef()"
            [rowData]="rowData()"
            [pagination]="pagination()"
            [enableRtl]="enableRtl()"
            [columnHoverHighlight]="columnHoverHighlight()"
            [suppressRowClickSelection]="true"
            [tooltipShowDelay]="500"
            (gridReady)="onGridReady($event)"
            (firstDataRendered)="onFirstDataRendered($event)"
            kbqAgGridTheme
        />
    `,
    styles: `
        :host {
            display: flex;
            flex-direction: column;
            padding: var(--kbq-size-l);
            height: calc(100vh - calc(var(--kbq-size-l) * 2));
        }

        ag-grid-angular {
            width: 100%;
            height: 100%;
        }

        .dev-grid-options {
            display: flex;
            flex-wrap: wrap;
            gap: var(--kbq-size-s);
            margin-bottom: var(--kbq-size-m);
        }

        .dev-grid-options label {
            white-space: nowrap;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevApp {
    readonly lightTheme = model(true);
    readonly checkboxSelection = model(true);
    readonly multipleRowSelection = model(true);
    readonly editable = model(true);
    readonly resizable = model(true);
    readonly floatingFilter = model(true);
    readonly sortable = model(true);
    readonly filter = model(true);
    readonly pagination = model(true);
    readonly suppressMovable = model(false);
    readonly enableRtl = model(false);
    readonly columnHoverHighlight = model(true);
    readonly tooltip = model(true);
    readonly suppressRowClickSelection = model(true);

    private gridApi!: GridApi;
    private gridColumnApi!: ColumnApi;

    readonly rowSelection = computed(() => {
        return this.multipleRowSelection() ? 'multiple' : 'single';
    });

    readonly columnDefs = computed<ColDef[]>(() => {
        const checkboxSelection = this.checkboxSelection();
        const tooltip = this.tooltip();

        return [
            {
                hide: !checkboxSelection,
                headerCheckboxSelection: checkboxSelection,
                checkboxSelection: checkboxSelection,
                width: 41,
                headerName: '',
                sortable: false,
                filter: false,
                resizable: false,
                suppressMovable: true,
                editable: false
            },
            {
                field: 'athlete',
                headerTooltip: tooltip ? 'Tooltip for Athlete Column Header' : null,
                tooltipValueGetter: ({ data }: ITooltipParams<DevOlympicData>) =>
                    tooltip ? 'Tooltip for Athlete Cell: ' + data.country : null
            },
            {
                field: 'age',
                headerTooltip: tooltip ? 'Tooltip for Age Column Header' : null,
                tooltipValueGetter: ({ data }: ITooltipParams<DevOlympicData>) =>
                    tooltip ? 'Tooltip for Age Cell: ' + data.athlete : null
            },
            {
                field: 'country',
                headerTooltip: tooltip ? 'Tooltip for Country Column Header' : null,
                tooltipValueGetter: ({ data }: ITooltipParams<DevOlympicData>) =>
                    tooltip ? 'Tooltip for Country Cell: ' + data.athlete : null
            },
            {
                field: 'year',
                headerTooltip: tooltip ? 'Tooltip for Year Column Header' : null,
                tooltipValueGetter: ({ data }: ITooltipParams<DevOlympicData>) =>
                    tooltip ? 'Tooltip for Year Cell: ' + data.athlete : null
            },
            {
                field: 'date',
                headerTooltip: tooltip ? 'Tooltip for Date Column Header' : null,
                tooltipValueGetter: ({ data }: ITooltipParams<DevOlympicData>) =>
                    tooltip ? 'Tooltip for Date Cell: ' + data.athlete : null
            },
            {
                field: 'sport',
                headerTooltip: tooltip ? 'Tooltip for Sport Column Header' : null,
                tooltipValueGetter: ({ data }: ITooltipParams<DevOlympicData>) =>
                    tooltip ? 'Tooltip for Sport Cell: ' + data.athlete : null
            },
            {
                field: 'gold',
                headerTooltip: tooltip ? 'Tooltip for Gold Column Header' : null,
                tooltipValueGetter: ({ data }: ITooltipParams<DevOlympicData>) =>
                    tooltip ? 'Tooltip for Gold Cell: ' + data.athlete : null
            },
            {
                field: 'silver',
                headerTooltip: tooltip ? 'Tooltip for Silver Column Header' : null,
                tooltipValueGetter: ({ data }: ITooltipParams<DevOlympicData>) =>
                    tooltip ? 'Tooltip for Silver Cell: ' + data.athlete : null
            },
            {
                field: 'bronze',
                headerTooltip: tooltip ? 'Tooltip for Bronze Column Header' : null,
                tooltipValueGetter: ({ data }: ITooltipParams<DevOlympicData>) =>
                    tooltip ? 'Tooltip for Bronze Cell: ' + data.athlete : null
            },
            {
                field: 'total',
                headerTooltip: tooltip ? 'Tooltip for Total Column Header' : null,
                tooltipValueGetter: ({ data }: ITooltipParams<DevOlympicData>) =>
                    tooltip ? 'Tooltip for Total Cell: ' + data.athlete : null
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
            suppressMovable: this.suppressMovable()
        };
    });

    readonly rowData: Signal<DevOlympicData[]>;

    private readonly renderer = inject(Renderer2);
    private readonly document = inject(DOCUMENT);

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
                if (!this.gridApi) return;
                this.gridApi?.deselectAll();
            });

        toObservable(this.editable)
            .pipe(takeUntilDestroyed())
            .subscribe(() => {
                this.gridApi?.stopEditing();
            });

        toObservable(this.floatingFilter)
            .pipe(takeUntilDestroyed())
            .subscribe(() => {
                this.gridApi?.setFilterModel(null);
            });

        toObservable(this.sortable)
            .pipe(takeUntilDestroyed())
            .subscribe(() => {
                this.gridColumnApi?.applyColumnState({
                    defaultState: { sort: null }
                });
            });
    }

    onGridReady({ api, columnApi }: GridReadyEvent): void {
        this.gridApi = api;
        this.gridColumnApi = columnApi;
    }

    onFirstDataRendered({ api }: FirstDataRenderedEvent): void {
        // Set initial focused cell
        api.setFocusedCell(0, 'athlete');

        // Set initial selected rows
        api.forEachNode((node) => {
            if (node.rowIndex === 4 || node.rowIndex === 5) {
                node.setSelected(true);
            }
        });
    }
}
