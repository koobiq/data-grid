import { ColDef } from '@ag-grid-community/core';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TableGridUtils<T = any> {
    colDef<V>(data: ColDef<T, V> & Required<Pick<ColDef, 'colId' | 'headerValueGetter'>>): ColDef {
        data.cellStyle = { display: 'flex', alignItems: 'center' };
        return data;
    }
}
