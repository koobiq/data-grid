import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { KBQ_AG_GRID_STATUS_BAR_PARAMS, KbqAgGridThemeModule } from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, ModuleRegistry, RowSelectionOptions } from 'ag-grid-community';
import { devInjectRowData } from '../row-data';

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
    standalone: true,
    selector: 'dev-status-bar-cell',
    template: `
        <div>Total rows: {{ totalRows() }}</div>
        <div data-testid="e2eStatusBarSelected">Selected: {{ selectedRows() }}</div>
    `,
    styles: `
        :host {
            display: flex;
            align-items: center;
            gap: var(--kbq-size-l);
            height: var(--kbq-size-4xl);
            padding: 0 var(--kbq-size-l);
            border-top: var(--kbq-size-border-width) solid var(--kbq-line-contrast-less);
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevStatusBarCellComponent {
    private readonly params = inject(KBQ_AG_GRID_STATUS_BAR_PARAMS);
    private readonly destroyRef = inject(DestroyRef);

    readonly totalRows = signal(0);
    readonly selectedRows = signal(0);

    constructor() {
        const { api } = this.params;

        const updateTotal = (): void => this.totalRows.set(api.getDisplayedRowCount());
        const updateSelected = (): void => this.selectedRows.set(api.getSelectedNodes().length);

        api.addEventListener('modelUpdated', updateTotal);
        api.addEventListener('selectionChanged', updateSelected);

        this.destroyRef.onDestroy(() => {
            api.removeEventListener('modelUpdated', updateTotal);
            api.removeEventListener('selectionChanged', updateSelected);
        });
    }
}

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

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-status-bar',
    template: `
        <ag-grid-angular
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            kbqAgGridThemeDisableCellFocusStyles
            animateRows="false"
            [kbqAgGridStatusBar]="statusBarComponent"
            [rowData]="rowData()"
            [columnDefs]="columnDefs"
            [rowSelection]="rowSelection"
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
export class DevStatusBar {
    readonly rowData = devInjectRowData();
    readonly statusBarComponent = DevStatusBarCellComponent;
    readonly columnDefs = COLUMN_DEFS;
    readonly rowSelection = ROW_SELECTION;
}
