import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { KbqAgGridRowGroup, KbqAgGridThemeModule } from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, ModuleRegistry } from 'ag-grid-community';
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
                        [checked]="selectedFields().includes(col.field!)"
                        (change)="onToggle(col.field!, $event)"
                    />
                    @let index = selectedFields().indexOf(col.field!);
                    {{ col.headerName }} {{ index >= 0 ? index : '' }}
                </label>
            }
        </div>

        <ag-grid-angular
            #group="kbqAgGridRowGroup"
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            kbqAgGridRowGroup
            [kbqAgGridRowGroupRowData]="rowData()"
            [columnDefs]="columnDefs"
            [defaultColDef]="defaultColDef"
            [rowSelection]="rowSelection"
            [animateRows]="false"
        />
    `,
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
    private readonly group = viewChild.required(KbqAgGridRowGroup);
    readonly rowData = devInjectRowData();
    readonly columnDefs = COLUMN_DEFS;
    readonly defaultColDef = DEFAULT_COL_DEF;
    protected readonly selectedFields = signal<string[]>([]);
    protected readonly rowSelection = { mode: 'multiRow', checkboxes: true } as const;

    protected onToggle(field: string, event: Event): void {
        const { target } = event;
        if (!(target instanceof HTMLInputElement)) return;
        const { checked } = target;
        this.selectedFields.update((fields) => (checked ? [...fields, field] : fields.filter((f) => f !== field)));
        if (checked) {
            this.group().addGroupColumn(field);
        } else {
            this.group().removeGroupColumn(field);
        }
    }
}
