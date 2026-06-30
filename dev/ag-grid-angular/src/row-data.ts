import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IDatasource, IGetRowsParams } from 'ag-grid-community';
import { catchError, of, shareReplay } from 'rxjs';

export type DevRowData = {
    id: string;
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

@Injectable({ providedIn: 'root' })
export class DevRowDataService {
    private readonly data$ = inject(HttpClient)
        .get<DevRowData[]>('/olympic-winners.json')
        .pipe(
            catchError(() => of([])),
            shareReplay({ bufferSize: 1, refCount: false })
        );

    readonly data: Signal<DevRowData[]> = toSignal(this.data$, { initialValue: [] });
}

export function devInjectRowData(): Signal<DevRowData[]> {
    return inject(DevRowDataService).data;
}

export function devInjectDatasource(delay = 1300): Signal<IDatasource> {
    let timeout: ReturnType<typeof setTimeout> | undefined = undefined;
    const rowData = devInjectRowData();

    return computed((): IDatasource => {
        const data = rowData();
        return {
            rowCount: data.length,
            getRows(params: IGetRowsParams): void {
                timeout = setTimeout(() => {
                    const rows = data.slice(params.startRow, params.endRow);
                    const lastRow = params.endRow >= data.length ? data.length : -1;
                    params.successCallback(rows, lastRow);
                }, delay);
            },
            destroy(): void {
                clearTimeout(timeout);
            }
        };
    });
}
