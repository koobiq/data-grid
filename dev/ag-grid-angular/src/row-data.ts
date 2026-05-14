import { HttpClient } from '@angular/common/http';
import { inject, Injectable, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, shareReplay } from 'rxjs';

export type DevRowData = {
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
