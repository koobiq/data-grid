import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { KbqAgGridFilterStateQueryParamsStore, KbqAgGridThemeModule } from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, ModuleRegistry } from 'ag-grid-community';
import { devInjectRowData } from '../row-data';

ModuleRegistry.registerModules([AllCommunityModule]);

const COLUMN_DEFS: ColDef[] = [
    { field: 'athlete', headerName: 'Athlete' },
    { field: 'age', headerName: 'Age' },
    { field: 'country', headerName: 'Country' },
    { field: 'year', headerName: 'Year' },
    { field: 'date', headerName: 'Date' },
    { field: 'sport', headerName: 'Sport' },
    { field: 'gold', headerName: 'Gold' },
    { field: 'silver', headerName: 'Silver' },
    { field: 'bronze', headerName: 'Bronze' },
    { field: 'total', headerName: 'Total' }
];

const DEFAULT_COL_DEF: ColDef = {
    filter: true,
    floatingFilter: true,
    sortable: true,
    resizable: true
};

const STATE_KEY = 'dev-ag-grid-filter-state';

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-filter-state',
    template: `
        <button type="button" (click)="filterState.reset()">Reset state</button>
        <ag-grid-angular
            #filterState="kbqAgGridFilterState"
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            animateRows="false"
            [kbqAgGridFilterState]="stateKey"
            [rowData]="rowData()"
            [columnDefs]="columnDefs"
            [defaultColDef]="defaultColDef"
        />
    `,
    styles: `
        ag-grid-angular {
            height: 100%;
            max-width: 2036px;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevFilterState {
    readonly rowData = devInjectRowData();
    readonly stateKey = STATE_KEY;
    readonly columnDefs = COLUMN_DEFS;
    readonly defaultColDef = DEFAULT_COL_DEF;
}

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-filter-state-query-params',
    template: `
        <button type="button" (click)="filterState.reset()">Reset state</button>
        <ag-grid-angular
            #filterState="kbqAgGridFilterState"
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            animateRows="false"
            [kbqAgGridFilterState]="stateKey"
            [kbqAgGridFilterStateStore]="store"
            [rowData]="rowData()"
            [columnDefs]="columnDefs"
            [defaultColDef]="defaultColDef"
        />
    `,
    styles: `
        ag-grid-angular {
            height: 100%;
            max-width: 2036px;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevFilterStateQueryParams {
    readonly rowData = devInjectRowData();
    readonly store = inject(KbqAgGridFilterStateQueryParamsStore);
    readonly stateKey = STATE_KEY;
    readonly columnDefs = COLUMN_DEFS;
    readonly defaultColDef = DEFAULT_COL_DEF;
}
