import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import {
    KbqAgGridRowGroup,
    kbqAgGridRowGroupColOptionsProvider,
    KbqAgGridRowGroupRowId,
    KbqAgGridThemeModule
} from '@koobiq/ag-grid-angular-theme';
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
            Group by:
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

        <div>
            Selected rows:
            <span data-testid="selectedCount">{{ selectedRows().length }}</span>
        </div>

        <div>
            <button type="button" data-testid="expandAllBtn" (click)="expandAll()">Expand all</button>
            <button type="button" data-testid="collapseAllBtn" (click)="collapseAll()">Collapse all</button>
            <button type="button" data-testid="expandRussiaDivingBtn" (click)="expandRussiaDiving()">
                Expand Russia &gt; Diving
            </button>
            <button type="button" data-testid="collapseRussiaDivingBtn" (click)="collapseRussiaDiving()">
                Collapse Russia &gt; Diving
            </button>
            <button type="button" data-testid="selectIlyaZakharovBtn" (click)="setIlyaZakharovSelected(true)">
                Select Ilya Zakharov
            </button>
            <button type="button" data-testid="deselectIlyaZakharovBtn" (click)="setIlyaZakharovSelected(false)">
                Deselect Ilya Zakharov
            </button>
        </div>

        <ag-grid-angular
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            kbqAgGridThemeDisableCellFocusStyles
            kbqAgGridRowGroup
            [kbqAgGridRowGroupRowData]="rowData()"
            [kbqAgGridRowGroupRowId]="rowId"
            [columnDefs]="columnDefs"
            [(kbqAgGridRowGroupCols)]="groupCols"
            [defaultColDef]="defaultColDef"
            [rowSelection]="rowSelection"
            [animateRows]="false"
            (selectionChanged)="onSelectionChanged($event)"
            (kbqAgGridRowGroupSelectionChanged)="onRowSelectionChanged($event)"
        />
    `,
    providers: [kbqAgGridRowGroupColOptionsProvider({ headerName: 'Group' })],
    styles: `
        ag-grid-angular {
            height: 500px;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevRowGroup {
    readonly rowData = devInjectRowData();
    readonly columnDefs = COLUMN_DEFS;
    readonly defaultColDef = DEFAULT_COL_DEF;
    protected readonly rowId: KbqAgGridRowGroupRowId = (row) => String(row.id);
    protected readonly groupCols = signal<string[]>(['country', 'sport']);
    protected readonly rowSelection = { mode: 'multiRow', checkboxes: true } as const;
    protected readonly selectedRows = signal<Record<string, unknown>[]>([]);
    private readonly group = viewChild.required(KbqAgGridRowGroup);

    protected expandAll(): void {
        this.group().expandAll();
    }

    protected collapseAll(): void {
        this.group().collapseAll();
    }

    protected expandRussiaDiving(): void {
        this.group().setExpanded(['Russia', 'Diving'], true);
    }

    protected collapseRussiaDiving(): void {
        this.group().setExpanded(['Russia', 'Diving'], false);
    }

    protected setIlyaZakharovSelected(selected: boolean): void {
        const row = this.rowData().find((r) => r.athlete === 'Ilya Zakharov');
        if (row) this.group().setRowSelected(row.id, selected);
    }

    protected onToggle(field: string, event: Event): void {
        const { target } = event;
        if (!(target instanceof HTMLInputElement)) return;
        const { checked } = target;
        this.groupCols.update((cols) => (checked ? [...cols, field] : cols.filter((f) => f !== field)));
    }

    protected onSelectionChanged(event: SelectionChangedEvent): void {
        console.debug('SelectionChangedEvent: ', event);
    }

    protected onRowSelectionChanged(rows: Record<string, unknown>[]): void {
        this.selectedRows.set(rows);
    }
}
