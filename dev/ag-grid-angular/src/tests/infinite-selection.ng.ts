import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    KbqAgGridInfiniteSelectionState,
    KbqAgGridSkeletonCellRenderer,
    KbqAgGridThemeModule
} from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, GetRowIdFunc, ICellRendererParams, ModuleRegistry } from 'ag-grid-community';
import { devInjectDatasource, DevRowData } from '../row-data';

ModuleRegistry.registerModules([AllCommunityModule]);

const COLUMN_DEFS: ColDef[] = [
    { field: 'athlete', headerName: 'Athlete' },
    { field: 'age', headerName: 'Age' },
    { field: 'country', headerName: 'Country' },
    { field: 'year', headerName: 'Year' },
    { field: 'sport', headerName: 'Sport' }
];

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule, JsonPipe],
    selector: 'dev-infinite-selection',
    template: `
        <ag-grid-angular
            #selection="kbqAgGridInfiniteSelection"
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            kbqAgGridInfiniteSelection
            animateRows="false"
            [columnDefs]="columnDefs"
            [defaultColDef]="defaultColDef"
            [kbqAgGridInfiniteSelectionDatasource]="datasource()"
            [getRowId]="getRowId"
            [cacheBlockSize]="10"
            (kbqAgGridInfiniteSelectionStateChange)="onSelectAllChange($event)"
        />
        <pre><code data-testid="e2eInfiniteSelectionState">{{ selection.state() | json }}</code></pre>
    `,
    styles: `
        :host {
            display: flex;
            padding: var(--kbq-size-m);
            max-height: 100%;
            gap: var(--kbq-size-xl);
        }

        ag-grid-angular {
            flex-grow: 1;
            height: 70vh;
        }

        pre {
            max-width: 30vw;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevInfiniteSelection {
    protected readonly datasource = devInjectDatasource(300);
    protected readonly columnDefs = COLUMN_DEFS;
    protected readonly getRowId: GetRowIdFunc<DevRowData> = ({ data }) => data.id;
    protected readonly defaultColDef: ColDef = {
        cellRendererSelector: (params: ICellRendererParams) =>
            params.data === undefined ? { component: KbqAgGridSkeletonCellRenderer } : undefined
    };

    protected onSelectAllChange(state: KbqAgGridInfiniteSelectionState): void {
        console.debug('onSelectAllChange: ', state);
    }
}
