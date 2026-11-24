import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
    KbqAgGridRowSelectionStateLocalStorageStore,
    KbqAgGridRowSelectionStateQueryParamsStore,
    KbqAgGridThemeModule
} from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, GetRowIdFunc, ModuleRegistry, RowSelectionOptions } from 'ag-grid-community';
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
        <div class="dev-toolbar">
            <button type="button" (click)="rowSelectionState.reset()">Reset state</button>
        </div>
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
        <div class="dev-toolbar">
            <button type="button" (click)="rowSelectionState.reset()">Reset state</button>
        </div>
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
export class DevRowSelectionStateQueryParams {
    readonly rowData = devInjectRowData();
    readonly store = inject(KbqAgGridRowSelectionStateQueryParamsStore);
    readonly stateKey = STATE_KEY;
    readonly columnDefs = COLUMN_DEFS;
    readonly rowSelection = ROW_SELECTION;
    readonly getRowId = GET_ROW_ID;
}
