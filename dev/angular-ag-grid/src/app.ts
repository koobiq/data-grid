import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, FirstDataRenderedEvent, ModuleRegistry } from 'ag-grid-community';
import { catchError } from 'rxjs';

ModuleRegistry.registerModules([]);

type DevOlympicData = {
    athlete: string;
    age: number;
    country: string;
    year: number;
    date: string;
    sport: string;
    gold: number;
    silver: number;
    bronze: number;
    total: number;
};

@Component({
    standalone: true,
    imports: [AgGridModule],
    selector: 'dev-root',
    template: `
        <ag-grid-angular
            class="ag-theme-alpine"
            [columnDefs]="columnDefs"
            [rowSelection]="'multiple'"
            [defaultColDef]="defaultColDef"
            [rowData]="rowData()"
            (firstDataRendered)="onFirstDataRendered($event)"
        />
    `,
    styles: `
        :host {
            display: flex;
            padding: 20px;
            height: calc(100vh - 40px);
        }

        ag-grid-angular {
            width: 100%;
            height: 100%;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevApp {
    readonly columnDefs: ColDef[] = [
        {
            headerCheckboxSelection: true,
            checkboxSelection: true,
            width: 40,
            headerName: '',
            sortable: false,
            filter: false,
            resizable: false
        },
        { field: 'athlete', minWidth: 170 },
        { field: 'age' },
        { field: 'country' },
        { field: 'year' },
        { field: 'date' },
        { field: 'sport' },
        { field: 'gold' },
        { field: 'silver' },
        { field: 'bronze' },
        { field: 'total' }
    ];

    readonly defaultColDef: ColDef = {
        editable: true,
        filter: true,
        sortable: true,
        resizable: true
    };

    readonly rowData: Signal<DevOlympicData[]>;

    constructor() {
        this.rowData = toSignal(
            inject(HttpClient)
                .get<DevOlympicData[]>('https://www.ag-grid.com/example-assets/olympic-winners.json')
                .pipe(catchError(() => [])),
            { initialValue: [] }
        );
    }

    onFirstDataRendered(params: FirstDataRenderedEvent<DevOlympicData>): void {
        console.log('onFirstDataRendered params', params);
        params.api.forEachNode((node) => {
            if (node.rowIndex === 2 || node.rowIndex === 3) {
                node.setSelected(true);
            }
        });
    }
}
