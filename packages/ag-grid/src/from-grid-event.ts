import { AgGridEvent } from '@ag-grid-community/core';
import { NEVER, Observable, isObservable, of, switchMap } from 'rxjs';
import { AgGrid } from './types';

export function fromGridEvent<T extends AgGridEvent = AgGridEvent>(grid$: AgGrid | Observable<AgGrid>, event: any) {
    const ready$ = isObservable(grid$) ? grid$ : of(grid$);

    return ready$.pipe(
        switchMap((grid) => {
            if (!grid?.api) {
                return NEVER;
            }

            const api = grid.api;

            return new Observable<T>((subscriber) => {
                const handler = (res: T) => subscriber.next(res);

                api.addEventListener(event, handler);

                return () => {
                    try {
                        if (!api.isDestroyed()) {
                            api.removeEventListener(event, handler);
                        }
                    } catch (error) {
                        // TODO: use destroy event to unsubscribe before grid is destroyed
                        console.error('Error removing event listener from grid API:', error);
                    }
                };
            });
        })
    );
}
