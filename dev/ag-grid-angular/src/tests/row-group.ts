import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
    KbqAgGridRowGroup,
    KbqAgGridRowGroupCellContent,
    KbqAgGridRowGroupCollapsedStateLocalStorageStore,
    kbqAgGridRowGroupColOptionsProvider,
    KbqAgGridRowGroupInfo,
    KbqAgGridRowGroupRowId,
    KbqAgGridRowGroupSelectionStateLocalStorageStore,
    KbqAgGridThemeModule
} from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, ModuleRegistry, SelectionChangedEvent } from 'ag-grid-community';
import { DEV_UNASSIGNED_OPERATOR, devIncidentColumns, devInjectRowData } from '../row-data';

ModuleRegistry.registerModules([AllCommunityModule]);

const COLUMN_DEFS: ColDef[] = devIncidentColumns(
    'incidentNumber',
    'severity',
    'attackType',
    'status',
    'alerts',
    'reviewBy',
    'comment',
    'affectedHosts',
    'title',
    'source',
    'operator'
);

const DEFAULT_COL_DEF: ColDef = {
    resizable: true,
    minWidth: 80
};

// Custom `kbqAgGridRowGroupCellContent` demo — replaces the default key markup with a
// differently-styled label; the toggle button/icon/click handling stays whatever the directive renders.
@Component({
    standalone: true,
    selector: 'dev-row-group-custom-cell-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <strong>{{ group().key }}</strong>
        <span class="dev-row-group-custom-cell-content__count">{{ group().count }}</span>
    `,
    styles: `
        :host {
            display: flex;
            gap: var(--kbq-size-xxs);
        }

        .dev-row-group-custom-cell-content__count {
            color: var(--kbq-foreground-contrast-secondary);
        }
    `
})
class DevRowGroupCustomCellContent implements KbqAgGridRowGroupCellContent {
    readonly group = input.required<KbqAgGridRowGroupInfo>();
}

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule, FormsModule],
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
            <button type="button" data-testid="expandHighMalwareBtn" (click)="expandHighMalware()">
                Expand High &gt; Malware
            </button>
            <button type="button" data-testid="collapseHighMalwareBtn" (click)="collapseHighMalware()">
                Collapse High &gt; Malware
            </button>
            <button type="button" data-testid="selectMalwareIncidentBtn" (click)="setMalwareIncidentSelected(true)">
                Select INC-20261116-0013
            </button>
            <button type="button" data-testid="deselectMalwareIncidentBtn" (click)="setMalwareIncidentSelected(false)">
                Deselect INC-20261116-0013
            </button>
            <button type="button" data-testid="sortGroupColAscBtn" (click)="sortGroupColAsc()">
                Sort group column asc
            </button>
            <button type="button" data-testid="clearGroupColSortBtn" (click)="clearGroupColSort()">
                Clear group column sort
            </button>
            <button type="button" data-testid="resetRowGroupStateBtn" (click)="resetGroupState()">
                Reset group state
            </button>
            <label>
                <input type="checkbox" data-testid="useCustomCellContentCheckbox" [(ngModel)]="useCustomCellContent" />
                Use custom group cell content
            </label>
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
            [kbqAgGridRowGroupCellContent]="cellContent()"
            [kbqAgGridRowGroupCollapsedState]="collapsedStateKey"
            [kbqAgGridRowGroupCollapsedStateStore]="collapsedStateStore"
            [kbqAgGridRowGroupSelectionState]="selectionStateKey"
            [kbqAgGridRowGroupSelectionStateStore]="selectionStateStore"
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
    private readonly incidents = devInjectRowData();
    // The grouping directive uses raw field values as group labels.
    readonly rowData = computed(() =>
        this.incidents().map((row) => ({ ...row, operator: row.operator ?? DEV_UNASSIGNED_OPERATOR }))
    );
    readonly columnDefs = COLUMN_DEFS;
    readonly defaultColDef = DEFAULT_COL_DEF;
    protected readonly useCustomCellContent = model(false);
    protected readonly cellContent = computed(() =>
        this.useCustomCellContent() ? DevRowGroupCustomCellContent : undefined
    );
    protected readonly rowId: KbqAgGridRowGroupRowId = (row) => String(row.id);
    protected readonly groupCols = signal<string[]>(['severity', 'attackType']);
    protected readonly rowSelection = { mode: 'multiRow', checkboxes: true } as const;
    protected readonly selectedRows = signal<Record<string, unknown>[]>([]);
    protected readonly collapsedStateKey = 'dev-ag-grid-row-group-collapsed-state';
    protected readonly collapsedStateStore = inject(KbqAgGridRowGroupCollapsedStateLocalStorageStore);
    protected readonly selectionStateKey = 'dev-ag-grid-row-group-selection-state';
    protected readonly selectionStateStore = inject(KbqAgGridRowGroupSelectionStateLocalStorageStore);
    private readonly group = viewChild.required(KbqAgGridRowGroup);

    protected resetGroupState(): void {
        this.group().clearGroupColumns();
    }

    protected expandAll(): void {
        this.group().expandAll();
    }

    protected collapseAll(): void {
        this.group().collapseAll();
    }

    protected expandHighMalware(): void {
        this.group().setExpanded(['High', 'Malware'], true);
    }

    protected collapseHighMalware(): void {
        this.group().setExpanded(['High', 'Malware'], false);
    }

    protected setMalwareIncidentSelected(selected: boolean): void {
        const row = this.rowData().find((r) => r.incidentNumber === 'INC-20261116-0013');
        if (row) this.group().setRowSelected(row.id, selected);
    }

    protected sortGroupColAsc(): void {
        this.group().setGroupColSort('asc');
    }

    protected clearGroupColSort(): void {
        this.group().setGroupColSort(null);
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
