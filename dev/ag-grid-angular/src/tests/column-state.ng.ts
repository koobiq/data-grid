import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
    KbqAgGridColumnStateLocalStorageStore,
    KbqAgGridColumnStateQueryParamsStore,
    KbqAgGridThemeModule
} from '@koobiq/ag-grid-angular-theme';
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
    editable: true,
    filter: true,
    sortable: true,
    resizable: true,
    floatingFilter: false,
    suppressMovable: false,
    lockPinned: false,
    lockPosition: false
};

const STATE_KEY = 'dev-ag-grid-column-state';

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-column-state',
    template: `
        <button type="button" (click)="columnState.reset()">Reset state</button>
        <ag-grid-angular
            #columnState="kbqAgGridColumnState"
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            animateRows="false"
            [kbqAgGridColumnState]="stateKey"
            [kbqAgGridColumnStateStore]="store"
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
export class DevColumnState {
    readonly rowData = devInjectRowData();
    readonly store = inject(KbqAgGridColumnStateLocalStorageStore);
    readonly stateKey = STATE_KEY;
    readonly columnDefs = COLUMN_DEFS;
    readonly defaultColDef = DEFAULT_COL_DEF;
}

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-column-state-query-params',
    template: `
        <button type="button" (click)="columnState.reset()">Reset state</button>
        <ag-grid-angular
            #columnState="kbqAgGridColumnState"
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            animateRows="false"
            [kbqAgGridColumnState]="stateKey"
            [kbqAgGridColumnStateStore]="store"
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
export class DevColumnStateQueryParams {
    readonly rowData = devInjectRowData();
    readonly store = inject(KbqAgGridColumnStateQueryParamsStore);
    readonly stateKey = STATE_KEY;
    readonly columnDefs = COLUMN_DEFS;
    readonly defaultColDef = DEFAULT_COL_DEF;
}
