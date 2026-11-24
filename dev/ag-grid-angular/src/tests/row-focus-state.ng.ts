import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
    KbqAgGridRowFocusStateLocalStorageStore,
    KbqAgGridRowFocusStateQueryParamsStore,
    KbqAgGridThemeModule
} from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, GetRowIdFunc, ModuleRegistry } from 'ag-grid-community';
import { devIncidentColumns, devInjectRowData, DevRowData } from '../row-data';

ModuleRegistry.registerModules([AllCommunityModule]);

const COLUMN_DEFS: ColDef[] = devIncidentColumns(
    'title',
    'riskScore',
    'severity',
    'status',
    'detectedOn',
    'attackType'
);

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
        <div class="dev-toolbar">
            <button type="button" (click)="rowFocusState.reset()">Reset state</button>
        </div>
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
        :host {
            display: flex;
            flex-direction: column;
        }

        ag-grid-angular {
            flex: 1;
            min-height: 0;
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
        <div class="dev-toolbar">
            <button type="button" (click)="rowFocusState.reset()">Reset state</button>
        </div>
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
        :host {
            display: flex;
            flex-direction: column;
        }

        ag-grid-angular {
            flex: 1;
            min-height: 0;
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
