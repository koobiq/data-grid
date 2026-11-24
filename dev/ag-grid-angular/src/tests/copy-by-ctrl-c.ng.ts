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
import { AllCommunityModule, GridApi, ModuleRegistry, RowSelectionOptions } from 'ag-grid-community';
import { DEV_INCIDENT_COLUMNS, devInjectRowData } from '../row-data';

ModuleRegistry.registerModules([AllCommunityModule]);

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
    readonly columnDefs = DEV_INCIDENT_COLUMNS;
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
