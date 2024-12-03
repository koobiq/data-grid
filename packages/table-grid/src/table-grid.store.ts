import { GridOptions } from '@ag-grid-community/core';
import { Injectable } from '@angular/core';
import { AgGrid } from '@koobiq/ag-grid';
import { ComponentStore } from '@ngrx/component-store';
import { RowSelectionOptions } from 'ag-grid-community';
import { isEqual } from 'lodash';

/**
 * Interface representing the state of the TableGrid.
 *
 * @typeparam T - The type of items managed by the grid.
 */
export interface TableGridState<T> {
    /** The AgGrid instance for the table grid. */
    grid?: AgGrid<T>;

    /** Function to identify a unique key for an item in the grid. */
    identifyBy?: (item: T) => string | number;

    /** The data to be displayed in the grid. */
    gridData?: T[];

    /** The grid options for configuring AgGrid behavior. */
    gridOptions?: GridOptions<T>;

    /** The selected rows in the grid, represented by their unique identifiers. */
    selection?: Array<string | number>;

    /** Pinned rows in the grid, represented by their unique identifiers. */
    pinned?: Array<string | number>;

    /** Raw selection options, determining single or multiple selection behavior. */
    rawSelection?: RowSelectionOptions | 'single' | 'multiple';

    /** Flag to indicate whether multiple selection is allowed. */
    multiSelect?: boolean;

    /** The current filter model applied to the grid. */
    filterModel?: any;

    /** Flag to indicate whether the grid has finished loading. */
    hasLoaded?: boolean;
}

@Injectable()
export class TableGridStore<T = unknown> extends ComponentStore<TableGridState<T>> {
    /** Observable of the current grid instance. */
    readonly grid$ = this.select(({ grid }) => grid);

    /** Observable of the current grid data. */
    readonly gridData$ = this.select(({ gridData }) => gridData);
    readonly gridOptions$ = this.select(({ gridOptions }) => gridOptions);
    readonly selection$ = this.select(({ selection }) => selection, { equal: isEqual });

    /** Observable of the pinned rows in the grid. Uses deep comparison to detect changes. */
    readonly pinned$ = this.select(({ pinned }) => pinned, { equal: isEqual });

    /** Signal for retrieving the `identifyBy` function used to uniquely identify rows. */

    readonly identifyBy$ = this.selectSignal(({ identifyBy }) => identifyBy);

    /** Observable of the flag indicating whether the grid has finished loading. */
    readonly hasLoaded$ = this.select(({ hasLoaded }) => hasLoaded);
    readonly rawSelection$ = this.select(({ rawSelection }) => rawSelection);

    /**
     * Constructor for the TableGridStore.
     * Initializes the store with an empty state.
     */
    constructor() {
        super({});
    }
}
