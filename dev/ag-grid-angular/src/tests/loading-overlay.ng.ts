import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { kbqAgGridLoadingOverlayConfigProvider, KbqAgGridThemeModule } from '@koobiq/ag-grid-angular-theme';
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

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-loading-overlay',
    template: `
        <button type="button" (click)="toggleLoading()">
            {{ loading() ? 'Hide Loading' : 'Show Loading' }}
        </button>

        <ag-grid-angular
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            animateRows="false"
            [kbqAgGridLoadingOverlay]="loading()"
            [rowData]="rowData()"
            [columnDefs]="columnDefs"
        />
    `,
    styles: `
        ag-grid-angular {
            height: 60%;
            max-width: 100%;
        }
    `,
    providers: [kbqAgGridLoadingOverlayConfigProvider({ rows: 5, cols: 6 })],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevLoadingOverlay {
    readonly rowData = devInjectRowData();
    readonly columnDefs = COLUMN_DEFS;
    readonly loading = signal(true);

    toggleLoading(): void {
        this.loading.update((v) => !v);
    }
}
