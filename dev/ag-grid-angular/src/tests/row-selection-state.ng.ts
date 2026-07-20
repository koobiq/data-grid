import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
    KbqAgGridRowSelectionStateLocalStorageStore,
    KbqAgGridRowSelectionStateQueryParamsStore,
    KbqAgGridThemeModule
} from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, GetRowIdFunc, ModuleRegistry, RowSelectionOptions } from 'ag-grid-community';
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

const ROW_SELECTION: RowSelectionOptions = {
    mode: 'multiRow',
    checkboxes: true,
    headerCheckbox: true
};

const GET_ROW_ID: GetRowIdFunc<DevRowData> = (params) => params.data.id;

const STATE_KEY = 'dev-ag-grid-row-selection-state';

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-row-selection-state',
    template: `
        <button type="button" (click)="rowSelectionState.reset()">Reset state</button>
        <ag-grid-angular
            #rowSelectionState="kbqAgGridRowSelectionState"
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            animateRows="false"
            [getRowId]="getRowId"
            [kbqAgGridRowSelectionState]="stateKey"
            [kbqAgGridRowSelectionStateStore]="store"
            [rowData]="rowData()"
            [columnDefs]="columnDefs"
            [rowSelection]="rowSelection"
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
export class DevRowSelectionState {
    readonly rowData = devInjectRowData();
    readonly store = inject(KbqAgGridRowSelectionStateLocalStorageStore);
    readonly stateKey = STATE_KEY;
    readonly columnDefs = COLUMN_DEFS;
    readonly rowSelection = ROW_SELECTION;
    readonly getRowId = GET_ROW_ID;
}

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-row-selection-state-query-params',
    template: `
        <button type="button" (click)="rowSelectionState.reset()">Reset state</button>
        <ag-grid-angular
            #rowSelectionState="kbqAgGridRowSelectionState"
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            animateRows="false"
            [getRowId]="getRowId"
            [kbqAgGridRowSelectionState]="stateKey"
            [kbqAgGridRowSelectionStateStore]="store"
            [rowData]="rowData()"
            [columnDefs]="columnDefs"
            [rowSelection]="rowSelection"
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
export class DevRowSelectionStateQueryParams {
    readonly rowData = devInjectRowData();
    readonly store = inject(KbqAgGridRowSelectionStateQueryParamsStore);
    readonly stateKey = STATE_KEY;
    readonly columnDefs = COLUMN_DEFS;
    readonly rowSelection = ROW_SELECTION;
    readonly getRowId = GET_ROW_ID;
}
