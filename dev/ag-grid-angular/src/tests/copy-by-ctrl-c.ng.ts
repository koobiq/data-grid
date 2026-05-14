import { ChangeDetectionStrategy, Component, computed, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
    KbqAgGridCopyFormatter,
    kbqAgGridCopyFormatterCsv,
    kbqAgGridCopyFormatterJson,
    kbqAgGridCopyFormatterTsv,
    KbqAgGridThemeModule
} from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, GridApi, ModuleRegistry, RowSelectionOptions } from 'ag-grid-community';
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

const ROW_SELECTION: RowSelectionOptions = {
    mode: 'multiRow',
    checkboxes: true,
    headerCheckbox: true
};

const COPY_FORMAT_OPTIONS = ['tsv', 'csv', 'json', 'custom'] as const;

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule, FormsModule],
    selector: 'dev-copy-by-ctrl-c',
    template: `
        <div>
            <label data-testid="e2eCopyByCtrlCToggle">
                <input type="checkbox" [(ngModel)]="copyByCtrlC" />
                Copy by Ctrl+C
            </label>
            <label>
                Copy Format:
                <select data-testid="e2eCopyFormatSelect" [disabled]="!copyByCtrlC()" [(ngModel)]="copyFormat">
                    @for (option of copyFormatOptions; track option) {
                        <option [value]="option">{{ option }}</option>
                    }
                </select>
            </label>
        </div>
        <ag-grid-angular
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            animateRows="false"
            [kbqAgGridCopyByCtrlC]="copyByCtrlC()"
            [kbqAgGridCopyFormatter]="copyFormatter()"
            [kbqAgGridSelectRowsByShiftClick]="true"
            [enableCellTextSelection]="true"
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
export class DevCopyByCtrlC {
    readonly rowData = devInjectRowData();
    readonly columnDefs = COLUMN_DEFS;
    readonly rowSelection = ROW_SELECTION;
    readonly copyFormatOptions = COPY_FORMAT_OPTIONS;
    readonly copyByCtrlC = model(true);
    readonly copyFormat = model<(typeof COPY_FORMAT_OPTIONS)[number]>('tsv');
    readonly copyFormatter = computed<KbqAgGridCopyFormatter | undefined>(() => {
        switch (this.copyFormat()) {
            case 'custom':
                return (api: GridApi): string =>
                    `Custom Copy Formatter Output. Selected Nodes: ${api.getSelectedNodes().length}.`;
            case 'csv':
                return kbqAgGridCopyFormatterCsv;
            case 'json':
                return kbqAgGridCopyFormatterJson;
            case 'tsv':
                return kbqAgGridCopyFormatterTsv;
            default:
                return undefined;
        }
    });
}
