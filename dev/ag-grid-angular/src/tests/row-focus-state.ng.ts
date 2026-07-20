import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
    KbqAgGridRowFocusStateLocalStorageStore,
    KbqAgGridRowFocusStateQueryParamsStore,
    KbqAgGridThemeModule
} from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, GetRowIdFunc, ModuleRegistry } from 'ag-grid-community';
import { DevRowData, devInjectRowData } from '../row-data';

ModuleRegistry.registerModules([AllCommunityModule]);

const COLUMN_DEFS: ColDef[] = [
    { field: 'athlete', headerName: 'Athlete' },
    { field: 'age', headerName: 'Age' },
    { field: 'country', headerName: 'Country' },
    { field: 'year', headerName: 'Year' },
    { field: 'date', headerName: 'Date' },
    { field: 'sport', headerName: 'Sport' }
];

const DEFAULT_COL_DEF: ColDef = {
    editable: true
};

const GET_ROW_ID: GetRowIdFunc<DevRowData> = (params) => params.data.id;

const STATE_KEY = 'dev-ag-grid-row-focus-state';

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-row-focus-state',
    template: `
        <button type="button" (click)="rowFocusState.reset()">Reset state</button>
        <ag-grid-angular
            #rowFocusState="kbqAgGridRowFocusState"
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            animateRows="false"
            [getRowId]="getRowId"
            [kbqAgGridRowFocusState]="stateKey"
            [kbqAgGridRowFocusStateStore]="store"
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
export class DevRowFocusState {
    readonly rowData = devInjectRowData();
    readonly store = inject(KbqAgGridRowFocusStateLocalStorageStore);
    readonly stateKey = STATE_KEY;
    readonly columnDefs = COLUMN_DEFS;
    readonly defaultColDef = DEFAULT_COL_DEF;
    readonly getRowId = GET_ROW_ID;
}

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-row-focus-state-query-params',
    template: `
        <button type="button" (click)="rowFocusState.reset()">Reset state</button>
        <ag-grid-angular
            #rowFocusState="kbqAgGridRowFocusState"
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            animateRows="false"
            [getRowId]="getRowId"
            [kbqAgGridRowFocusState]="stateKey"
            [kbqAgGridRowFocusStateStore]="store"
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
export class DevRowFocusStateQueryParams {
    readonly rowData = devInjectRowData();
    readonly store = inject(KbqAgGridRowFocusStateQueryParamsStore);
    readonly stateKey = STATE_KEY;
    readonly columnDefs = COLUMN_DEFS;
    readonly defaultColDef = DEFAULT_COL_DEF;
    readonly getRowId = GET_ROW_ID;
}
