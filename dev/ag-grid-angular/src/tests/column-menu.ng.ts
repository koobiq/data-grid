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
        { field: 'title', headerName: 'Title', filter: true, lockVisible: true },
        { field: 'riskScore', headerName: 'Risk score', filter: true, lockVisible: true },
        { field: 'severity', headerName: 'Severity (header name with text overflow and ellipsis)', filter: true },
        { field: 'status', headerName: 'Status', filter: true },
        { field: 'detectedOn', headerName: 'Detected on', filter: true, pinned: 'right' },
        { field: 'attackType', headerName: 'Attack type', filter: true },
        { field: 'alerts', headerName: 'Alerts', filter: true },
        { field: 'reviewBy', headerName: 'Review by', filter: true },
        { field: 'comment', headerName: 'Comment (header name with text overflow and ellipsis)', filter: true },
        { field: 'affectedHosts', headerName: 'Affected hosts', filter: true }
    ];
}
