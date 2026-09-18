import { ChangeDetectionStrategy, Component } from '@angular/core';
import { KbqAgGridThemeModule } from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, ModuleRegistry, RowSelectionOptions } from 'ag-grid-community';
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

const COLUMN_DEFS: ColDef[] = [
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

/** Columns the pinned columns page pins, by field. */
const PINNED_COLUMNS: Record<string, ColDef['pinned']> = { athlete: 'left', total: 'right' };

const PAGE_STYLES = `
    :host {
        display: flex;
        flex-direction: column;
        padding: var(--kbq-size-m);
        height: calc(100vh - calc(var(--kbq-size-l) * 2));
    }

    ag-grid-angular {
        height: 100%;
    }
`;

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
    readonly columnDefs = COLUMN_DEFS;
}

/** Grid with columns pinned from the first render, covering the shadows of the pinned columns. */
@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-theme-pinned-columns',
    template: `
        <ag-grid-angular
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            animateRows="false"
            [rowData]="rowData()"
            [columnDefs]="columnDefs"
            [defaultColDef]="defaultColDef"
        />
    `,
    styles: PAGE_STYLES,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevThemePinnedColumns {
    readonly rowData = devInjectRowData();
    readonly defaultColDef = DEFAULT_COL_DEF;
    readonly columnDefs: ColDef[] = COLUMN_DEFS.map((colDef) => ({
        ...colDef,
        pinned: PINNED_COLUMNS[colDef.field ?? '']
    }));
}
