import { ChangeDetectionStrategy, Component } from '@angular/core';
import { KbqAgGridThemeModule } from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, IErrorValidationParams, ModuleRegistry } from 'ag-grid-community';
import { DEV_REVIEW_DATE_COLUMN, DEV_SEVERITIES, DevRowData, devInjectEditableIncidents } from '../row-data';

ModuleRegistry.registerModules([AllCommunityModule]);

const devRequireText = ({ value }: IErrorValidationParams<DevRowData, string>): string[] | null =>
    value?.trim() ? null : ['Enter a value'];

const DEFAULT_COL_DEF: ColDef<DevRowData> = {
    editable: true
};

// One column per editor provided by AG Grid Community, with the constraints its invalid state is reached through.
const COLUMN_DEFS: ColDef<DevRowData>[] = [
    {
        field: 'title',
        headerName: 'Text',
        width: 170,
        cellEditor: 'agTextCellEditor',
        cellEditorParams: { getValidationErrors: devRequireText }
    },
    {
        field: 'riskScore',
        headerName: 'Number',
        width: 100,
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: { min: 0, max: 100 }
    },
    {
        ...DEV_REVIEW_DATE_COLUMN,
        headerName: 'Date',
        width: 150,
        cellEditor: 'agDateCellEditor',
        cellEditorParams: { max: new Date(2026, 11, 31) }
    },
    {
        field: 'detectedOn',
        headerName: 'Date string',
        width: 150,
        cellDataType: 'dateString',
        cellEditor: 'agDateStringCellEditor'
    },
    {
        field: 'comment',
        headerName: 'Large text',
        width: 130,
        cellEditor: 'agLargeTextCellEditor',
        cellEditorPopup: true,
        cellEditorParams: {
            getValidationErrors: ({ value }: IErrorValidationParams<DevRowData, string>): string[] | null =>
                value && !value.trim() ? ['Enter a comment or clear the field'] : null
        }
    },
    {
        field: 'severity',
        headerName: 'Select',
        width: 160,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: DEV_SEVERITIES }
    },
    {
        field: 'escalated',
        headerName: 'Checkbox',
        width: 110,
        cellDataType: 'boolean',
        cellEditor: 'agCheckboxCellEditor'
    }
];

/** Grid with a column for every cell editor of AG Grid Community, covering how the theme styles them. */
@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-cell-editors',
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
    styles: `
        :host {
            display: flex;
            flex-direction: column;
            padding: var(--kbq-size-m);
        }

        ag-grid-angular {
            height: 100%;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevCellEditors {
    protected readonly rowData = devInjectEditableIncidents();
    protected readonly columnDefs = COLUMN_DEFS;
    protected readonly defaultColDef = DEFAULT_COL_DEF;
}
