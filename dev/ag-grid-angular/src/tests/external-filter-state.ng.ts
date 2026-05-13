import { ChangeDetectionStrategy, Component, computed, inject, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
    KbqAgGridExternalFilterStateLocalStorageStore,
    KbqAgGridExternalFilterStateQueryParamsStore,
    KbqAgGridThemeModule
} from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, IRowNode, ModuleRegistry } from 'ag-grid-community';
import { devInjectRowData, DevRowData } from '../data';

ModuleRegistry.registerModules([AllCommunityModule]);

const COLUMN_DEFS: ColDef[] = [
    { field: 'athlete', headerName: 'Athlete' },
    { field: 'sport', headerName: 'Sport' },
    { field: 'age', headerName: 'Age' },
    { field: 'country', headerName: 'Country' },
    { field: 'year', headerName: 'Year' }
];

const STATE_KEY = 'dev-ag-grid-external-filter-state';

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule, FormsModule],
    selector: 'dev-external-filter-state',
    template: `
        <select data-testid="e2eSportSelect" [(ngModel)]="filterValue">
            <option value="" [selected]="!filterValue()">All Sports</option>
            @for (sport of sports(); track sport) {
                <option [value]="sport" [selected]="filterValue() === sport">{{ sport }}</option>
            }
        </select>
        <button type="button" data-testid="e2eResetExternalFilterState" (click)="filterState.reset()">
            Reset state
        </button>
        <ag-grid-angular
            #filterState="kbqAgGridExternalFilterState"
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            animateRows="false"
            [kbqAgGridExternalFilterState]="stateKey"
            [kbqAgGridExternalFilterStateStore]="store"
            [kbqAgGridExternalFilterStatePass]="filterPass"
            [rowData]="rowData()"
            [columnDefs]="columnDefs"
            [(kbqAgGridExternalFilterStateValue)]="filterValue"
        />
    `,
    styles: `
        ag-grid-angular {
            height: 100%;
            max-width: 2036px;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevExternalFilterState {
    readonly rowData = devInjectRowData();
    readonly store = inject(KbqAgGridExternalFilterStateLocalStorageStore);
    readonly stateKey = STATE_KEY;
    readonly sports = computed(() => [...new Set(this.rowData().map((row) => row.sport))].sort());
    readonly filterValue = model<string | null>(null);
    readonly filterPass = (node: IRowNode<DevRowData>): boolean => node.data?.sport === this.filterValue();
    readonly columnDefs = COLUMN_DEFS;
}

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule, FormsModule],
    selector: 'dev-external-filter-state-query-params',
    template: `
        <select data-testid="e2eSportSelect" [(ngModel)]="filterValue">
            <option value="" [selected]="!filterValue()">All Sports</option>
            @for (sport of sports(); track sport) {
                <option [value]="sport" [selected]="filterValue() === sport">{{ sport }}</option>
            }
        </select>
        <button type="button" data-testid="e2eResetExternalFilterState" (click)="filterState.reset()">
            Reset state
        </button>
        <ag-grid-angular
            #filterState="kbqAgGridExternalFilterState"
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            animateRows="false"
            [kbqAgGridExternalFilterState]="stateKey"
            [kbqAgGridExternalFilterStateStore]="store"
            [kbqAgGridExternalFilterStatePass]="filterPass"
            [rowData]="rowData()"
            [columnDefs]="columnDefs"
            [(kbqAgGridExternalFilterStateValue)]="filterValue"
        />
    `,
    styles: `
        ag-grid-angular {
            height: 100%;
            max-width: 2036px;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevExternalFilterStateQueryParams {
    readonly rowData = devInjectRowData();
    readonly store = inject(KbqAgGridExternalFilterStateQueryParamsStore);
    readonly stateKey = STATE_KEY;
    readonly sports = computed(() => [...new Set(this.rowData().map((row) => row.sport))].sort());
    readonly filterValue = model<string | null>(null);
    readonly filterPass = (node: IRowNode<DevRowData>): boolean => node.data?.sport === this.filterValue();
    readonly columnDefs = COLUMN_DEFS;
}
