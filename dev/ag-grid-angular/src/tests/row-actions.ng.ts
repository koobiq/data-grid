import { ChangeDetectionStrategy, Component, computed, inject, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KBQ_AG_GRID_ROW_ACTIONS_PARAMS, KbqAgGridThemeModule } from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, ModuleRegistry } from 'ag-grid-community';
import { devInjectRowData } from '../row-data';

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
    standalone: true,
    selector: 'dev-row-actions-cell',
    template: `
        <button type="button" (click)="onDelete()">Delete</button>
    `,
    styles: `
        :host {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            height: 100%;
            width: 100px;
            padding: 0 var(--kbq-size-s);
        }

        button {
            cursor: pointer;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevRowActionsCellComponent {
    private readonly params = inject(KBQ_AG_GRID_ROW_ACTIONS_PARAMS);

    onDelete(): void {
        this.params.api.applyTransaction({ remove: [this.params.data] });
    }
}

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule, FormsModule],
    selector: 'dev-row-actions',
    template: `
        <div>
            <label data-testid="e2ePinFirstColumnToggle">
                <input type="checkbox" [(ngModel)]="pinFirstColumn" />
                Pin First Column
            </label>
            <label data-testid="e2ePinLastColumnToggle">
                <input type="checkbox" [(ngModel)]="pinLastColumn" />
                Pin Last Column
            </label>
        </div>
        <ag-grid-angular
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            animateRows="false"
            [kbqAgGridRowActions]="rowActionsComponent"
            [rowData]="rowData()"
            [columnDefs]="columnDefs()"
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
export class DevRowActions {
    readonly rowData = devInjectRowData();
    readonly rowActionsComponent = DevRowActionsCellComponent;
    readonly pinFirstColumn = model(false);
    readonly pinLastColumn = model(false);
    readonly columnDefs = computed<ColDef[]>(() => [
        { field: 'athlete', headerName: 'Athlete', pinned: this.pinFirstColumn() ? 'left' : false },
        { field: 'age', headerName: 'Age' },
        { field: 'country', headerName: 'Country' },
        { field: 'year', headerName: 'Year' },
        { field: 'date', headerName: 'Date' },
        { field: 'sport', headerName: 'Sport' },
        { field: 'gold', headerName: 'Gold' },
        { field: 'silver', headerName: 'Silver' },
        { field: 'bronze', headerName: 'Bronze' },
        { field: 'total', headerName: 'Total', pinned: this.pinLastColumn() ? 'right' : false }
    ]);
}
