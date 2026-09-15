import { DestroyRef, inject } from '@angular/core';
import { Column, GridApi } from 'ag-grid-community';

/** Grid events after which the columns, their visibility, pinning, order or sorting may have changed. */
const COLUMN_STATE_EVENTS = [
    'newColumnsLoaded',
    'gridColumnsChanged',
    'columnVisible',
    'columnPinned',
    'columnMoved',
    'sortChanged'
] as const;

const compareSortIndexes = (a: number | null | undefined, b: number | null | undefined): number => {
    const hasA = a !== null && a !== undefined;
    const hasB = b !== null && b !== undefined;

    if (hasA && hasB) return a - b;
    if (!hasA && !hasB) return 0;

    return hasA ? -1 : 1;
};

/** Whether the column is created by the grid itself (e.g. the selection column) rather than defined by the consumer. */
export const kbqIsGridOwnColumn = (col: Column): boolean => col.getColId().startsWith('ag-Grid-');

/** Columns defined by the consumer, in column definition order. */
export const kbqUserColumns = (api: GridApi): Column[] =>
    (api.getColumns() ?? []).filter((col) => !kbqIsGridOwnColumn(col));

/** Columns the user can sort, in column definition order. */
export const kbqSortableColumns = (api: GridApi): Column[] => kbqUserColumns(api).filter((col) => col.isSortable());

/**
 * Sortable columns with sorting applied, in the priority the grid sorts rows by. Mirrors AG Grid's sort
 * service: columns with a `sortIndex` come first in index order, then the ones without an index, and ties
 * keep column definition order (not the display order the user may have changed by moving columns).
 */
export const kbqSortedColumns = (api: GridApi): Column[] =>
    kbqSortableColumns(api)
        .filter((col) => !!col.getSort())
        .map((col, position) => ({ col, position }))
        .sort((a, b) => compareSortIndexes(a.col.getSortIndex(), b.col.getSortIndex()) || a.position - b.position)
        .map(({ col }) => col);

/**
 * Title of the column as the grid header renders it (`headerValueGetter`, `headerName` or the humanized
 * `field`). Columns rendering an icon-only header fall back to `headerTooltip`.
 */
export const kbqResolveColumnName = (api: GridApi, col: Column): string =>
    [api.getDisplayNameForColumn(col, 'header'), col.getColDef().headerTooltip]
        .map((name) => name?.trim())
        .find((name) => !!name) ?? col.getColId();

/**
 * Calls `callback` after every grid event that changes the columns or their state, until the calling
 * component is destroyed. Must be called in an injection context.
 */
export const kbqListenColumnStateChanges = (api: GridApi, callback: () => void): void => {
    COLUMN_STATE_EVENTS.forEach((event) => api.addEventListener(event, callback));

    inject(DestroyRef).onDestroy(() => {
        // Menus are torn down after the grid they belong to, whose api no longer accepts listener removal.
        if (api.isDestroyed()) return;

        COLUMN_STATE_EVENTS.forEach((event) => api.removeEventListener(event, callback));
    });
};
