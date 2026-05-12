import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import {
    KbqAgGridExternalFilterState,
    KbqAgGridExternalFilterStateLocalStorageStore,
    KbqAgGridExternalFilterStateQueryParamsStore,
    KbqAgGridThemeModule
} from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, IRowNode, ModuleRegistry } from 'ag-grid-community';
import { devInjectRowData, DevRowData } from '../data';

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-external-filter-state',
    template: `
        <select data-testid="e2eSportSelect" (change)="onSportChange($event)">
            <option value="" [selected]="!externalFilter.value()">All Sports</option>
            @for (sport of sports(); track sport) {
                <option [value]="sport" [selected]="externalFilter.value() === sport">{{ sport }}</option>
            }
        </select>
        <button type="button" data-testid="e2eResetExternalFilterState" (click)="externalFilter.reset()">
            Reset state
        </button>
        <ag-grid-angular
            #externalFilter="kbqAgGridExternalFilterState"
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            animateRows="false"
            [kbqAgGridExternalFilterState]="stateKey"
            [kbqAgGridExternalFilterStateStore]="store"
            [rowData]="rowData()"
            [columnDefs]="columnDefs()"
            [isExternalFilterPresent]="isExternalFilterPresent"
            [doesExternalFilterPass]="doesExternalFilterPass"
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
    readonly stateKey = 'dev-ag-grid-external-filter-state';
    readonly sports = computed(() => [...new Set(this.rowData().map((row) => row.sport))].sort());
    readonly state = viewChild.required(KbqAgGridExternalFilterState);
    readonly isExternalFilterPresent = (): boolean => !!this.state().value();
    readonly doesExternalFilterPass = (node: IRowNode<DevRowData>): boolean =>
        node.data?.sport === this.state().value();
    readonly columnDefs = computed<ColDef[]>(() => [
        { field: 'athlete', headerName: 'Athlete' },
        { field: 'sport', headerName: 'Sport' },
        { field: 'age', headerName: 'Age' },
        { field: 'country', headerName: 'Country' },
        { field: 'year', headerName: 'Year' }
    ]);

    onSportChange(event: Event): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        const { value } = event.target as HTMLSelectElement;
        this.state().set(value || null);
    }
}

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-external-filter-state-query-params',
    template: `
        <select data-testid="e2eSportSelect" (change)="onSportChange($event)">
            <option value="" [selected]="!externalFilter.value()">All Sports</option>
            @for (sport of sports(); track sport) {
                <option [value]="sport" [selected]="externalFilter.value() === sport">{{ sport }}</option>
            }
        </select>
        <button type="button" data-testid="e2eResetExternalFilterState" (click)="externalFilter.reset()">
            Reset state
        </button>
        <ag-grid-angular
            #externalFilter="kbqAgGridExternalFilterState"
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            animateRows="false"
            [kbqAgGridExternalFilterState]="stateKey"
            [kbqAgGridExternalFilterStateStore]="store"
            [rowData]="rowData()"
            [columnDefs]="columnDefs()"
            [isExternalFilterPresent]="isExternalFilterPresent"
            [doesExternalFilterPass]="doesExternalFilterPass"
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
    readonly stateKey = 'dev-ag-grid-external-filter-state';
    readonly sports = computed(() => [...new Set(this.rowData().map((row) => row.sport))].sort());
    readonly state = viewChild.required(KbqAgGridExternalFilterState);
    readonly isExternalFilterPresent = (): boolean => !!this.state().value();
    readonly doesExternalFilterPass = (node: IRowNode<DevRowData>): boolean =>
        node.data?.sport === this.state().value();
    readonly columnDefs = computed<ColDef[]>(() => [
        { field: 'athlete', headerName: 'Athlete' },
        { field: 'age', headerName: 'Age' },
        { field: 'country', headerName: 'Country' },
        { field: 'year', headerName: 'Year' },
        { field: 'sport', headerName: 'Sport' }
    ]);

    onSportChange(event: Event): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        const { value } = event.target as HTMLSelectElement;
        this.state().set(value || null);
    }
}
