import { inject, Injectable } from '@angular/core';
import { AgGrid } from '@koobiq/ag-grid';
import { ComponentStore } from '@ngrx/component-store';
import { catchError, map, Observable, of } from 'rxjs';
import { DataViewAdapter } from './data-view.adapter';

/**
 * Interface representing the state of the DataViewService.
 *
 * @typeparam T - The type of items managed by the service.
 */
export interface DataViewServiceState<T> {
    agGrid?: AgGrid<T> | null;

    /**
     * Array of items to be displayed or managed by the service.
     */
    items: T[];
}

@Injectable()
/**
 * Service class for managing data view state and interaction with the DataViewAdapter.
 *
 * @typeparam T - The type of items managed by the service.
 */
export class DataViewService<T> extends ComponentStore<DataViewServiceState<T>> {
    private readonly adapter = inject(DataViewAdapter<T>);

    readonly agGrid$ = this.select(({ agGrid }) => agGrid);
    readonly items$ = this.select(({ items }) => items);

    readonly tableGridOptions = this.adapter.gridOptions();

    readonly onTableReady = (item: AgGrid<T>) => {
        return this.patchState({ agGrid: item });
    };

    readonly entityIdGetter = (item: T) => {
        return this.adapter.entityID(item);
    };

    constructor() {
        super({
            items: null
        });

        this.loadItems(this.adapter.connect());
    }

    /**
     * Effect for loading items into the service state.
     *
     * @param items - An observable of the items to be loaded.
     * @returns Observable that patches the state with the loaded items.
     */
    readonly loadItems = this.effect((items$: Observable<T[]>) => {
        return items$.pipe(
            map((items) => {
                this.patchState({
                    items: items
                });
            }),
            catchError((error) => {
                this.handleError(error);
                return of([]);
            })
        );
    });

    /**
     * Handles errors during item loading.
     *
     * @param error - The error that occurred during loading.
     */
    private handleError(error: any): void {
        console.error('Error loading items:', error);
    }
}
