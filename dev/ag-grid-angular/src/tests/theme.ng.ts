import { ChangeDetectionStrategy, Component, computed, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KbqAgGridThemeModule } from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import {
    AllCommunityModule,
    ColDef,
    FirstDataRenderedEvent,
    GridReadyEvent,
    ModuleRegistry,
    RowSelectionOptions
} from 'ag-grid-community';
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
    imports: [AgGridModule, KbqAgGridThemeModule, FormsModule],
    selector: 'dev-theme',
    template: `
        <div>
            <label data-testid="e2ePaginationToggle">
                <input type="checkbox" [(ngModel)]="pagination" />
                Pagination
            </label>
            <label data-testid="e2ePinFirstColumnToggle">
                <input type="checkbox" [(ngModel)]="pinFirstColumn" />
                Pin First Column
            </label>
            <label data-testid="e2ePinLastColumnToggle">
                <input type="checkbox" [(ngModel)]="pinLastColumn" />
                Pin Last Column
            </label>
        </div>
        <ag-grid-angular
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            animateRows="false"
            [rowData]="rowData()"
            [columnDefs]="columnDefs()"
            [rowDragManaged]="true"
            [rowSelection]="rowSelection"
            [defaultColDef]="defaultColDef"
            [pagination]="pagination()"
            (gridReady)="onGridReady($event)"
            (firstDataRendered)="onFirstDataRendered($event)"
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
    readonly pagination = model(false);
    readonly pinFirstColumn = model(false);
    readonly pinLastColumn = model(false);
    readonly columnDefs = computed<ColDef[]>(() => [
        { field: 'athlete', headerName: 'Athlete', pinned: this.pinFirstColumn() ? 'left' : false },
        { field: 'age', headerName: 'Age' },
        { field: 'country', headerName: 'Country' },
        { field: 'year', headerName: 'Year' },
        { field: 'date', headerName: 'Date' },
        { field: 'sport', headerName: 'Sport' },
        { field: 'gold', headerName: 'Gold' },
        { field: 'silver', headerName: 'Silver' },
        { field: 'bronze', headerName: 'Bronze' },
        { field: 'total', headerName: 'Total', pinned: this.pinLastColumn() ? 'right' : false }
    ]);

    onGridReady({ api }: GridReadyEvent): void {
        api.setColumnWidths([{ key: 'ag-Grid-SelectionColumn', newWidth: 36 }]);
    }

    onFirstDataRendered({ api }: FirstDataRenderedEvent): void {
        api.setFocusedCell(0, 'athlete');

        api.forEachNode((node) => {
            if (node.rowIndex === 4 || node.rowIndex === 5) {
                node.setSelected(true);
            }
        });
    }
}
