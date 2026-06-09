import { ChangeDetectionStrategy, Component } from '@angular/core';
import { KbqAgGridSkeletonCellRenderer, KbqAgGridThemeModule } from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, ICellRendererParams, ModuleRegistry } from 'ag-grid-community';
import { devInjectDatasource } from '../row-data';

ModuleRegistry.registerModules([AllCommunityModule]);

const COLUMN_DEFS: ColDef[] = [
    { field: 'athlete', headerName: 'Athlete' },
    { field: 'age', headerName: 'Age' },
    { field: 'country', headerName: 'Country' },
    { field: 'year', headerName: 'Year' },
    { field: 'sport', headerName: 'Sport' },
    { field: 'gold', headerName: 'Gold' },
    { field: 'silver', headerName: 'Silver' },
    { field: 'bronze', headerName: 'Bronze' }
];

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-lazy-loading',
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
export class DevLazyLoading {
    readonly columnDefs = COLUMN_DEFS;
    readonly datasource = devInjectDatasource();
    readonly defaultColDef: ColDef = {
        cellRendererSelector: (params: ICellRendererParams) =>
            params.data === undefined ? { component: KbqAgGridSkeletonCellRenderer } : undefined
    };
}
