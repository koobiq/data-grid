import { GridOptions } from '@ag-grid-community/core';
import { InjectionToken, inject } from '@angular/core';
import { TableGridUtils } from '@koobiq/ag-grid';
import { Observable } from 'rxjs';

export const DATA_VIEW_ADAPTER_OPTIONS = new InjectionToken<DataViewAdapterOptions<any>>('DATA_VIEW_ADAPTER_OPTIONS');

/**
 * Interface for overriding the default behavior of the data view adapter
 *
 * @remarks
 * This interface is primarily used for customizing the data source and column definitions,
 * especially in picker dialogs where a reduced set of columns and data is required.
 */
export interface DataViewAdapterOptions<T> {
    /**
     * Optional data source from which entities should be fetched
     *
     * @remarks
     * If not provided, the host adapter will use a default data source.
     */
    source?: Observable<T[]>;

    /**
     * Optional filter function to apply to the data source
     *
     * @param item - A single entity of type T
     * @returns A boolean indicating whether the item should be included in the data view
     */
    filter?: (item: T) => boolean;

    /**
     * Optional sorting comparator function
     *
     * @param a - The first entity of type T
     * @param b - The second entity of type T
     * @returns A number indicating the sort order: negative if a < b, positive if a > b, 0 if equal
     */
    sort?: (a: T, b: T) => number;

    /**
     * Function to configure grid options for the ag-grid table
     *
     * @param util - Utility object for configuring grid options
     * @returns A GridOptions object with the necessary configuration
     */
    gridOptions?: (util: TableGridUtils) => GridOptions<T>;

    /**
     * Function to retrieve the ID of a given entity
     *
     * @param item - A single entity of type T
     * @returns The unique ID of the entity, either as a string or number
     */
    entityIdD?: (item: T) => string | number;
}

/**
 * Abstract class defining the structure of a DataViewAdapter
 *
 * @typeparam T - The type of entities managed by the adapter
 */
export abstract class DataViewAdapter<T> {
    abstract entityID(item: T): string | number;
    abstract connect(): Observable<T[]>;
    abstract gridOptions(): GridOptions<T>;
}

/**
 * Default implementation of the DataViewAdapter interface
 *
 * @typeparam T - The type of entities managed by the adapter
 */
export class DataViewDefaultAdapter<T> implements DataViewAdapter<T> {
    private config = inject(DATA_VIEW_ADAPTER_OPTIONS);
    private utils = inject(TableGridUtils);

    /**
     * Retrieves the ID of a given entity using the entityIdD function provided in the config
     *
     * @param item - A single entity of type T
     * @returns The unique ID of the entity, either as a string or number
     */
    entityID(item: T): string | number {
        return this.config.entityIdD(item);
    }

    /**
     * Connects to the data source and retrieves the data as an Observable
     *
     * @returns An Observable of an array of entities of type T
     */
    connect(): Observable<T[]> {
        return this.config.source;
    }

    /**
     * Retrieves the grid options for configuring the ag-grid table
     *
     * @returns A GridOptions object for ag-grid configuration
     */
    gridOptions(): GridOptions<T> {
        return this.config.gridOptions?.(this.utils);
    }
}
