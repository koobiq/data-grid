import { ChangeDetectionStrategy, Component } from '@angular/core';
import { KbqAgGridThemeModule } from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, GridReadyEvent, ModuleRegistry, RowSelectionOptions } from 'ag-grid-community';
import { devInjectRowData } from '../row-data';

ModuleRegistry.registerModules([AllCommunityModule]);

const ROW_SELECTION: RowSelectionOptions = {
    mode: 'multiRow',
    checkboxes: true,
    headerCheckbox: true
};

const DEFAULT_COL_DEF: ColDef = {
    filter: true,
    sortable: true,
    resizable: true
};

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-theme',
    template: `
        <ag-grid-angular
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            kbqAgGridThemeDisableCellFocusStyles
            animateRows="false"
            [rowData]="rowData()"
            [columnDefs]="columnDefs"
            [alwaysMultiSort]="true"
            [rowDragManaged]="true"
            [rowSelection]="rowSelection"
            [defaultColDef]="defaultColDef"
            [pagination]="false"
            (gridReady)="onGridReady($event)"
        />
    `,
    styles: `
        :host {
            display: flex;
            flex-direction: column;
            padding: var(--kbq-size-m);
            height: calc(100vh - calc(var(--kbq-size-l) * 2));
        }

        ag-grid-angular {
            height: 100%;
            max-width: 2036px;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevTheme {
    readonly rowData = devInjectRowData();
    readonly rowSelection = ROW_SELECTION;
    readonly defaultColDef = DEFAULT_COL_DEF;
    readonly columnDefs: ColDef[] = [
        { field: 'athlete', headerName: 'Athlete' },
        { field: 'year', headerName: 'Year' },
        { field: 'date', headerName: 'Date' },
        { field: 'country', headerName: 'Country' },
        { field: 'age', headerName: 'Age' },
        { field: 'sport', headerName: 'Sport' },
        { field: 'gold', headerName: 'Gold' },
        { field: 'silver', headerName: 'Silver' },
        { field: 'bronze', headerName: 'Bronze' },
        { field: 'total', headerName: 'Total' }
    ];

    onGridReady({ api }: GridReadyEvent): void {
        api.setColumnWidths([{ key: 'ag-Grid-SelectionColumn', newWidth: 36 }]);
    }
}
