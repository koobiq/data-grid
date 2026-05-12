import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
    KbqAgGridQuickFilterStateLocalStorageStore,
    KbqAgGridQuickFilterStateQueryParamsStore,
    KbqAgGridThemeModule
} from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, GridApi, GridReadyEvent, ModuleRegistry } from 'ag-grid-community';
import { devInjectRowData } from '../data';

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-quick-filter-state',
    template: `
        <input
            #quickFilterInput
            data-testid="e2eQuickFilterInput"
            placeholder="Quick filter..."
            [value]="quickFilterState.value()"
            (input)="onQuickFilterInput(quickFilterInput.value)"
        />
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
            [columnDefs]="columnDefs()"
            [defaultColDef]="defaultColDef()"
            (gridReady)="onGridReady($event)"
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
    private gridApi: GridApi | null = null;
    readonly rowData = devInjectRowData();
    readonly store = inject(KbqAgGridQuickFilterStateLocalStorageStore);
    readonly stateKey = 'dev-ag-grid-quick-filter-state';
    readonly columnDefs = computed<ColDef[]>(() => {
        return [
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
    });
    readonly defaultColDef = computed<ColDef>(() => {
        return {
            filter: true,
            sortable: true,
            resizable: true
        };
    });

    onGridReady(event: GridReadyEvent): void {
        this.gridApi = event.api;
    }

    onQuickFilterInput(value: string): void {
        this.gridApi?.setGridOption('quickFilterText', value);
    }
}

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-quick-filter-state-query-params',
    template: `
        <input
            #quickFilterInput
            data-testid="e2eQuickFilterInput"
            placeholder="Quick filter..."
            [value]="quickFilterState.value()"
            (input)="onQuickFilterInput(quickFilterInput.value)"
        />
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
            [columnDefs]="columnDefs()"
            [defaultColDef]="defaultColDef()"
            (gridReady)="onGridReady($event)"
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
    private gridApi: GridApi | null = null;
    readonly rowData = devInjectRowData();
    readonly store = inject(KbqAgGridQuickFilterStateQueryParamsStore);
    readonly stateKey = 'dev-ag-grid-quick-filter-state';
    readonly columnDefs = computed<ColDef[]>(() => {
        return [
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
    });
    readonly defaultColDef = computed<ColDef>(() => {
        return {
            filter: true,
            sortable: true,
            resizable: true
        };
    });

    onGridReady(event: GridReadyEvent): void {
        this.gridApi = event.api;
    }

    onQuickFilterInput(value: string): void {
        this.gridApi?.setGridOption('quickFilterText', value);
    }
}
