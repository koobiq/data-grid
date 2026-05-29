import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    KBQ_AG_GRID_COLUMN_MENU_LABELS_EN,
    kbqAgGridColumnMenuLabelsProvider,
    KbqAgGridThemeModule
} from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, ModuleRegistry, RowSelectionOptions } from 'ag-grid-community';
import { devInjectRowData } from '../row-data';

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
    selector: 'dev-column-menu',
    imports: [AgGridModule, KbqAgGridThemeModule],
    standalone: true,
    providers: [kbqAgGridColumnMenuLabelsProvider(KBQ_AG_GRID_COLUMN_MENU_LABELS_EN)],
    template: `
        <ag-grid-angular
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            kbqAgGridColumnMenu
            animateRows="false"
            [rowData]="rowData()"
            [rowSelection]="rowSelection"
            [columnDefs]="columnDefs"
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
export class DevColumnMenu {
    readonly rowData = devInjectRowData();
    readonly rowSelection: RowSelectionOptions = {
        mode: 'multiRow',
        enableClickSelection: true,
        hideDisabledCheckboxes: false,
        checkboxes: true,
        headerCheckbox: true
    };
    readonly columnDefs: ColDef[] = [
        { field: 'athlete', headerName: 'Athlete', filter: true },
        { field: 'age', headerName: 'Age', filter: true },
        { field: 'country', headerName: 'Country', filter: true },
        { field: 'year', headerName: 'Year', filter: true },
        { field: 'date', headerName: 'Date', filter: true, pinned: 'right' },
        { field: 'sport', headerName: 'Sport', filter: true },
        { field: 'gold', headerName: 'Gold', filter: true },
        { field: 'silver', headerName: 'Silver', filter: true },
        { field: 'bronze', headerName: 'Bronze', filter: true },
        { field: 'total', headerName: 'Total', filter: true }
    ];
}
