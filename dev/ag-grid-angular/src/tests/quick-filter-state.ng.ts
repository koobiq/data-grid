import { ChangeDetectionStrategy, Component, inject, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KbqAgGridQuickFilterStateQueryParamsStore, KbqAgGridThemeModule } from '@koobiq/ag-grid-angular-theme';
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
    sortable: true,
    resizable: true
};

const STATE_KEY = 'dev-ag-grid-quick-filter-state';

@Component({
    standalone: true,
    imports: [AgGridModule, FormsModule, KbqAgGridThemeModule],
    selector: 'dev-quick-filter-state',
    template: `
        <input data-testid="e2eQuickFilterInput" placeholder="Quick filter..." [(ngModel)]="filterText" />
        <button type="button" data-testid="e2eResetQuickFilterState" (click)="quickFilterState.reset()">
            Reset state
        </button>
        <ag-grid-angular
            #quickFilterState="kbqAgGridQuickFilterState"
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            animateRows="false"
            [kbqAgGridQuickFilterState]="stateKey"
            [rowData]="rowData()"
            [columnDefs]="columnDefs"
            [defaultColDef]="defaultColDef"
            [(kbqAgGridQuickFilterStateValue)]="filterText"
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
export class DevQuickFilterState {
    readonly rowData = devInjectRowData();
    readonly stateKey = STATE_KEY;
    readonly filterText = model('');
    readonly columnDefs = COLUMN_DEFS;
    readonly defaultColDef = DEFAULT_COL_DEF;
}

@Component({
    standalone: true,
    imports: [AgGridModule, FormsModule, KbqAgGridThemeModule],
    selector: 'dev-quick-filter-state-query-params',
    template: `
        <input data-testid="e2eQuickFilterInput" placeholder="Quick filter..." [(ngModel)]="filterText" />
        <button type="button" data-testid="e2eResetQuickFilterState" (click)="quickFilterState.reset()">
            Reset state
        </button>
        <ag-grid-angular
            #quickFilterState="kbqAgGridQuickFilterState"
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            animateRows="false"
            [kbqAgGridQuickFilterState]="stateKey"
            [kbqAgGridQuickFilterStateStore]="store"
            [rowData]="rowData()"
            [columnDefs]="columnDefs"
            [defaultColDef]="defaultColDef"
            [(kbqAgGridQuickFilterStateValue)]="filterText"
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
export class DevQuickFilterStateQueryParams {
    readonly rowData = devInjectRowData();
    readonly store = inject(KbqAgGridQuickFilterStateQueryParamsStore);
    readonly stateKey = STATE_KEY;
    readonly filterText = model('');
    readonly columnDefs = COLUMN_DEFS;
    readonly defaultColDef = DEFAULT_COL_DEF;
}
