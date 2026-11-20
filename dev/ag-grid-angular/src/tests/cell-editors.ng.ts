import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { KbqAgGridThemeModule } from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, IErrorValidationParams, ModuleRegistry } from 'ag-grid-community';
import { DevRowData, devInjectRowData } from '../row-data';

ModuleRegistry.registerModules([AllCommunityModule]);

type DevCellEditorsRow = DevRowData & {
    dateObject: Date;
    isoDate: string;
    medalist: boolean;
};

/** Turns the `dd/mm/yyyy` date of the row data into the `yyyy-mm-dd` string AG Grid reads dates from. */
const devToIsoDate = (date: string): string => date.split('/').reverse().join('-');

/** Reads a `dd/mm/yyyy` date as local midnight: `new Date('yyyy-mm-dd')` is UTC midnight, a day off west of UTC. */
const devToDate = (date: string): Date => {
    const [day, month, year] = date.split('/').map(Number);

    return new Date(year, month - 1, day);
};

/** Rejects a value with a digit in it, which gives the text editors an invalid state to show. */
const devValidateNoDigits = ({ value }: IErrorValidationParams<DevCellEditorsRow, string>): string[] | null =>
    value && /\d/.test(value) ? ['The value must not contain digits'] : null;

const DEFAULT_COL_DEF: ColDef<DevCellEditorsRow> = {
    editable: true
};

// One column per editor provided by AG Grid Community, with the constraints its invalid state is reached through.
const COLUMN_DEFS: ColDef<DevCellEditorsRow>[] = [
    {
        field: 'athlete',
        headerName: 'Text',
        width: 170,
        cellEditor: 'agTextCellEditor',
        cellEditorParams: { getValidationErrors: devValidateNoDigits }
    },
    {
        field: 'age',
        headerName: 'Number',
        width: 100,
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: { min: 0, max: 100 }
    },
    {
        field: 'dateObject',
        headerName: 'Date',
        width: 150,
        cellDataType: 'date',
        cellEditor: 'agDateCellEditor',
        cellEditorParams: { max: new Date(2012, 11, 31) }
    },
    {
        field: 'isoDate',
        headerName: 'Date string',
        width: 150,
        cellDataType: 'dateString',
        cellEditor: 'agDateStringCellEditor'
    },
    {
        field: 'sport',
        headerName: 'Large text',
        width: 130,
        cellEditor: 'agLargeTextCellEditor',
        cellEditorPopup: true,
        cellEditorParams: { getValidationErrors: devValidateNoDigits }
    },
    {
        field: 'country',
        headerName: 'Select',
        width: 160,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ['Australia', 'Russia', 'United States'] }
    },
    {
        field: 'medalist',
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
    private readonly olympicWinners = devInjectRowData();

    protected readonly rowData = computed((): DevCellEditorsRow[] =>
        this.olympicWinners().map((row) => ({
            ...row,
            dateObject: devToDate(row.date),
            isoDate: devToIsoDate(row.date),
            medalist: row.gold > 0
        }))
    );
    protected readonly columnDefs = COLUMN_DEFS;
    protected readonly defaultColDef = DEFAULT_COL_DEF;
}
