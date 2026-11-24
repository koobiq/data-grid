import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { kbqAgGridLoadingOverlayConfigProvider, KbqAgGridThemeModule } from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { DEV_INCIDENT_COLUMNS, devInjectRowData } from '../row-data';

ModuleRegistry.registerModules([AllCommunityModule]);

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
    readonly columnDefs = DEV_INCIDENT_COLUMNS;
    readonly loading = signal(true);

    toggleLoading(): void {
        this.loading.update((v) => !v);
    }
}
