import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { KbqAgGridFilterStateQueryParamsStore, KbqAgGridThemeModule } from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, ModuleRegistry } from 'ag-grid-community';
import { DEV_INCIDENT_COLUMNS, devInjectRowData } from '../row-data';

ModuleRegistry.registerModules([AllCommunityModule]);

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
        <div class="dev-toolbar">
            <button type="button" (click)="filterState.reset()">Reset state</button>
        </div>
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
export class DevFilterState {
    readonly rowData = devInjectRowData();
    readonly stateKey = STATE_KEY;
    readonly columnDefs = DEV_INCIDENT_COLUMNS;
    readonly defaultColDef = DEFAULT_COL_DEF;
}

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-filter-state-query-params',
    template: `
        <div class="dev-toolbar">
            <button type="button" (click)="filterState.reset()">Reset state</button>
        </div>
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
export class DevFilterStateQueryParams {
    readonly rowData = devInjectRowData();
    readonly store = inject(KbqAgGridFilterStateQueryParamsStore);
    readonly stateKey = STATE_KEY;
    readonly columnDefs = DEV_INCIDENT_COLUMNS;
    readonly defaultColDef = DEFAULT_COL_DEF;
}
