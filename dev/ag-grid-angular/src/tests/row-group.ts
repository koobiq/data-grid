import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { kbqAgGridRowGroupColOptionsProvider, KbqAgGridThemeModule } from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, ModuleRegistry, SelectionChangedEvent } from 'ag-grid-community';
import { devInjectRowData } from '../row-data';

ModuleRegistry.registerModules([AllCommunityModule]);

const COLUMN_DEFS: ColDef[] = [
    { field: 'athlete', headerName: 'Athlete' },
    { field: 'country', headerName: 'Country' },
    { field: 'sport', headerName: 'Sport' },
    { field: 'year', headerName: 'Year' },
    { field: 'gold', headerName: 'Gold' },
    { field: 'silver', headerName: 'Silver' },
    { field: 'bronze', headerName: 'Bronze' },
    { field: 'total', headerName: 'Total' }
];

const DEFAULT_COL_DEF: ColDef = {
    resizable: true,
    minWidth: 80
};

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-row-group',
    template: `
        <div>
            @for (col of columnDefs; track col.field) {
                <label>
                    <input
                        type="checkbox"
                        [checked]="groupCols().includes(col.field!)"
                        (change)="onToggle(col.field!, $event)"
                    />
                    @let index = groupCols().indexOf(col.field!);
                    {{ col.headerName }} {{ index >= 0 ? index : '' }}
                </label>
            }
        </div>

        <ag-grid-angular
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            kbqAgGridRowGroup
            [kbqAgGridRowGroupRowData]="rowData()"
            [columnDefs]="columnDefs"
            [(kbqAgGridRowGroupCols)]="groupCols"
            [defaultColDef]="defaultColDef"
            [rowSelection]="rowSelection"
            [animateRows]="false"
            (selectionChanged)="onSelectionChanged($event)"
        />
    `,
    providers: [kbqAgGridRowGroupColOptionsProvider({ headerName: 'Group' })],
    styles: `
        :host {
            display: flex;
            flex-direction: column;
            height: 100%;
        }

        ag-grid-angular {
            flex: 1;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevRowGroup {
    readonly rowData = devInjectRowData();
    readonly columnDefs = COLUMN_DEFS;
    readonly defaultColDef = DEFAULT_COL_DEF;
    protected readonly groupCols = signal<string[]>(['country', 'sport']);
    protected readonly rowSelection = { mode: 'multiRow', checkboxes: true } as const;

    protected onToggle(field: string, event: Event): void {
        const { target } = event;
        if (!(target instanceof HTMLInputElement)) return;
        const { checked } = target;
        this.groupCols.update((cols) => (checked ? [...cols, field] : cols.filter((f) => f !== field)));
    }

    protected onSelectionChanged(event: SelectionChangedEvent): void {
        console.debug('SelectionChangedEvent: ', event);
    }
}
