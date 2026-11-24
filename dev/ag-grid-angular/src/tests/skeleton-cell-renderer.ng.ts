import { ChangeDetectionStrategy, Component } from '@angular/core';
import { KbqAgGridSkeletonCellRenderer, KbqAgGridThemeModule } from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, ICellRendererParams, ModuleRegistry } from 'ag-grid-community';
import { devIncidentColumns, devInjectDatasource } from '../row-data';

ModuleRegistry.registerModules([AllCommunityModule]);

const COLUMN_DEFS: ColDef[] = devIncidentColumns(
    'title',
    'riskScore',
    'severity',
    'status',
    'attackType',
    'alerts',
    'reviewBy',
    'comment'
);

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-skeleton-cell-renderer',
    template: `
        <ag-grid-angular
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            rowModelType="infinite"
            animateRows="false"
            [columnDefs]="columnDefs"
            [datasource]="datasource()"
            [defaultColDef]="defaultColDef"
            [cacheBlockSize]="9"
            [cacheOverflowSize]="9"
            [maxBlocksInCache]="9"
            [infiniteInitialRowCount]="9"
        />
    `,
    styles: `
        ag-grid-angular {
            height: 400px;
            max-width: 100%;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevSkeletonCellRenderer {
    readonly columnDefs = COLUMN_DEFS;
    readonly datasource = devInjectDatasource();
    readonly defaultColDef: ColDef = {
        cellRendererSelector: (params: ICellRendererParams) =>
            params.data === undefined ? { component: KbqAgGridSkeletonCellRenderer } : undefined
    };
}
