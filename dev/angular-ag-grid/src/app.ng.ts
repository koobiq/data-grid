import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, model, Signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { KbqAgGridTheme } from '@koobiq/ag-grid-theme';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, ColumnApi, GridApi, GridReadyEvent, ModuleRegistry } from 'ag-grid-community';
import { catchError } from 'rxjs';

ModuleRegistry.registerModules([]);

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

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridTheme, FormsModule],
    selector: 'dev-root',
    template: `
        <div class="dev-options">
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
                <input [(ngModel)]="enableRtl" type="checkbox" />
                RTL
            </label>
            <label>
                <input [(ngModel)]="columnHoverHighlight" type="checkbox" />
                Column Hover Highlight
            </label>
        </div>

        <ag-grid-angular
            [columnDefs]="columnDefs()"
            [rowSelection]="rowSelection()"
            [defaultColDef]="defaultColDef()"
            [rowData]="rowData()"
            [pagination]="pagination()"
            [enableRtl]="enableRtl()"
            [animateRows]="true"
            [columnHoverHighlight]="columnHoverHighlight()"
            (gridReady)="onGridReady($event)"
            kbqAgGridTheme
        />
    `,
    styles: `
        :host {
            display: flex;
            flex-direction: column;
            padding: 20px;
            height: calc(100vh - 40px);
        }

        ag-grid-angular {
            width: 100%;
            height: 100%;
        }

        .dev-options {
            display: flex;
            flex-wrap: wrap;
        }

        .dev-options label {
            white-space: nowrap;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevApp {
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

    private gridApi!: GridApi;
    private gridColumnApi!: ColumnApi;

    readonly rowSelection = computed(() => {
        return this.multipleRowSelection() ? 'multiple' : 'single';
    });

    readonly columnDefs = computed<ColDef[]>(() => {
        const checkboxSelection = this.checkboxSelection();
        return [
            {
                headerCheckboxSelection: checkboxSelection,
                checkboxSelection: checkboxSelection,
                width: 40,
                headerName: '',
                sortable: false,
                filter: false,
                resizable: false,
                hide: !checkboxSelection,
                suppressMovable: true
            },
            { field: 'athlete' },
            { field: 'age' },
            { field: 'country' },
            { field: 'year' },
            { field: 'date' },
            { field: 'sport' },
            { field: 'gold' },
            { field: 'silver' },
            { field: 'bronze' },
            { field: 'total' }
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

    constructor() {
        this.rowData = toSignal(
            inject(HttpClient)
                .get<DevOlympicData[]>('https://www.ag-grid.com/example-assets/olympic-winners.json')
                .pipe(catchError(() => [])),
            { initialValue: [] }
        );

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

    onGridReady({ api, columnApi }: GridReadyEvent) {
        this.gridApi = api;
        this.gridColumnApi = columnApi;
    }
}
