import { Component, Directive, forwardRef, viewChild } from '@angular/core';
import { render } from '@testing-library/angular';
import { AgGridAngular } from 'ag-grid-angular';
import { GridApi, IRowNode, IsFullWidthRowParams } from 'ag-grid-community';
import { Subject } from 'rxjs';
import {
    KBQ_AG_GRID_LOAD_ERROR_LABELS_EN,
    KBQ_AG_GRID_LOAD_ERROR_LABELS_RU,
    KbqAgGridLoadError,
    KbqAgGridLoadErrorLabels,
    KbqAgGridLoadErrorRowComponent,
    kbqAgGridLoadErrorLabelsProvider
} from '../src/load-error.ng';

type ApiMock = {
    api: GridApi;
    options: Map<string, unknown>;
    /** Stands in for the cell AG Grid has focused; `clearFocusedCell()` sets it back to `null`. */
    focusRow: (rowIndex: number | null) => void;
    focusedRow: () => number | null;
};

const createApiMock = (initialOptions: Record<string, unknown> = {}): ApiMock => {
    const options = new Map<string, unknown>(Object.entries(initialOptions));
    let focusedRow: number | null = null;

    const api = {
        setRowCount: jest.fn(),
        redrawRows: jest.fn(),
        refreshInfiniteCache: jest.fn(),
        getGridOption: jest.fn((key: string) => options.get(key)),
        setGridOption: jest.fn((key: string, value: unknown) => options.set(key, value)),
        getFocusedCell: jest.fn(() => (focusedRow === null ? null : { rowIndex: focusedRow })),
        clearFocusedCell: jest.fn(() => {
            focusedRow = null;
        })
    };

    return {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        api: api as unknown as GridApi,
        options,
        focusRow: (rowIndex: number | null): void => {
            focusedRow = rowIndex;
        },
        focusedRow: () => focusedRow
    };
};

type IsFullWidthRowFn = (params: IsFullWidthRowParams) => boolean;
type IsRowSelectableFn = (node: IRowNode) => boolean;
type LabelledParams = {
    labels: () => KbqAgGridLoadErrorLabels;
    isErrorRow: IsRowSelectableFn;
    fallbackRenderer?: unknown;
    fallbackParams?: unknown;
};

/** Grid options are stored untyped in the mock, so each read narrows once, right here. */
const isFullWidthRowOf = (options: Map<string, unknown>): IsFullWidthRowFn =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    options.get('isFullWidthRow') as IsFullWidthRowFn;

const isRowSelectableOf = (options: Map<string, unknown>): IsRowSelectableFn | undefined =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    options.get('isRowSelectable') as IsRowSelectableFn | undefined;

/** Where AG Grid actually reads the callback from once `rowSelection` is given as an object. */
const rowSelectionSelectableOf = (options: Map<string, unknown>): IsRowSelectableFn | undefined =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    (options.get('rowSelection') as { isRowSelectable?: IsRowSelectableFn }).isRowSelectable;

const rendererParamsOf = (options: Map<string, unknown>): LabelledParams =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    options.get('fullWidthCellRendererParams') as LabelledParams;

const rowNodeAt = (rowIndex: number | null): IRowNode =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    ({ rowIndex }) as IRowNode;

const fullWidthParamsAt = (rowIndex: number | null): IsFullWidthRowParams =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    ({ rowNode: rowNodeAt(rowIndex) }) as IsFullWidthRowParams;

@Directive({
    selector: 'ag-grid-angular',
    standalone: true,
    providers: [{ provide: AgGridAngular, useExisting: forwardRef(() => TestAgGridAngularStub) }]
})
class TestAgGridAngularStub {
    readonly gridReady = new Subject<{ api: GridApi }>();
    readonly sortChanged = new Subject<void>();
    readonly filterChanged = new Subject<void>();

    api?: GridApi;

    emitGridReady(api: GridApi): void {
        this.api = api;
        this.gridReady.next({ api });
    }
}

@Component({
    selector: 'test-load-error-grid',
    standalone: true,
    template: `
        <ag-grid-angular kbqAgGridLoadError (kbqAgGridLoadErrorRetry)="retries = retries + 1" />
    `,
    imports: [TestAgGridAngularStub, KbqAgGridLoadError]
})
class TestLoadErrorGrid {
    readonly grid = viewChild.required(TestAgGridAngularStub);
    readonly directive = viewChild.required(KbqAgGridLoadError);

    retries = 0;
}

@Component({
    selector: 'test-load-error-grid-en',
    standalone: true,
    template: `
        <ag-grid-angular kbqAgGridLoadError />
    `,
    imports: [TestAgGridAngularStub, KbqAgGridLoadError],
    providers: [kbqAgGridLoadErrorLabelsProvider(KBQ_AG_GRID_LOAD_ERROR_LABELS_EN)]
})
class TestLoadErrorGridEn {
    readonly grid = viewChild.required(TestAgGridAngularStub);
}

const renderGrid = async (
    initialOptions: Record<string, unknown> = {}
): Promise<{ component: TestLoadErrorGrid; directive: KbqAgGridLoadError; grid: TestAgGridAngularStub } & ApiMock> => {
    const apiMock = createApiMock(initialOptions);
    const { fixture } = await render(TestLoadErrorGrid);
    const component = fixture.componentInstance;

    component.grid().emitGridReady(apiMock.api);
    fixture.detectChanges();

    return { ...apiMock, component, directive: component.directive(), grid: component.grid() };
};

describe('KbqAgGridLoadError', () => {
    it('does not touch the grid before a failure is reported', async () => {
        const { api } = await renderGrid();

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(api.setRowCount).not.toHaveBeenCalled();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(api.redrawRows).not.toHaveBeenCalled();
    });

    it('makes the failed page the last row and redraws on fail()', async () => {
        const { api, directive } = await renderGrid();

        directive.fail(150);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(api.setRowCount).toHaveBeenCalledWith(151, true);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(api.redrawRows).toHaveBeenCalled();
        expect(directive.failedAtRow()).toBe(150);
    });

    it('restores the unknown last row and refreshes the cache on retry()', async () => {
        const { api, directive, component } = await renderGrid();

        directive.fail(150);
        directive.retry();

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(api.setRowCount).toHaveBeenLastCalledWith(150, false);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(api.refreshInfiniteCache).toHaveBeenCalledTimes(1);
        expect(component.retries).toBe(1);
        expect(directive.failedAtRow()).toBeNull();
    });

    it('drops the error row without requesting anything on clear()', async () => {
        const { api, directive, component } = await renderGrid();

        directive.fail(150);
        directive.clear();

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(api.setRowCount).toHaveBeenLastCalledWith(150, false);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(api.refreshInfiniteCache).not.toHaveBeenCalled();
        expect(directive.failedAtRow()).toBeNull();
        expect(component.retries).toBe(0);
    });

    it('releases the focus the retry link left on the error row', async () => {
        const { directive, focusRow, focusedRow } = await renderGrid();

        directive.fail(150);
        focusRow(150);
        directive.retry();

        expect(focusedRow()).toBeNull();
    });

    it('leaves focus alone when it sits on a row other than the error row', async () => {
        const { directive, focusRow, focusedRow } = await renderGrid();

        directive.fail(150);
        focusRow(12);
        directive.clear();

        expect(focusedRow()).toBe(12);
    });

    it.each([['sortChanged'], ['filterChanged']] as const)('drops the error row on %s', async (event) => {
        const { api, directive, grid } = await renderGrid();

        directive.fail(150);
        grid[event].next();

        expect(directive.failedAtRow()).toBeNull();
        // Only the call `fail()` made. The row model resets the count itself, and writing the old
        // one back afterwards would claim rows the freshly emptied grid does not have.
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(api.setRowCount).toHaveBeenCalledTimes(1);
    });

    it('stops treating the remembered index as the error row after a sort', async () => {
        const { options, directive, grid } = await renderGrid();
        const isFullWidthRow = isFullWidthRowOf(options);

        directive.fail(150);
        grid.sortChanged.next();

        // Otherwise a row of the new query landing on that index would be drawn as the banner.
        expect(isFullWidthRow(fullWidthParamsAt(150))).toBe(false);
    });

    it('ignores clear() when there is no error row', async () => {
        const { api, directive } = await renderGrid();

        directive.clear();

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(api.setRowCount).not.toHaveBeenCalled();
    });

    it('ignores retry() when there is no error row', async () => {
        const { api, directive, component } = await renderGrid();

        directive.retry();

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(api.refreshInfiniteCache).not.toHaveBeenCalled();
        expect(component.retries).toBe(0);
    });

    it('treats only the failed row as full width', async () => {
        const { options, directive } = await renderGrid();
        const isFullWidthRow = isFullWidthRowOf(options);

        expect(isFullWidthRow(fullWidthParamsAt(150))).toBe(false);

        directive.fail(150);

        expect(isFullWidthRow(fullWidthParamsAt(150))).toBe(true);
        expect(isFullWidthRow(fullWidthParamsAt(149))).toBe(false);
        expect(isFullWidthRow(fullWidthParamsAt(null))).toBe(false);
    });

    it('composes isFullWidthRow with a callback already set on the grid', async () => {
        const existing = jest.fn((params: IsFullWidthRowParams) => params.rowNode.rowIndex === 7);
        const { options, directive } = await renderGrid({ isFullWidthRow: existing });
        const isFullWidthRow = isFullWidthRowOf(options);

        directive.fail(150);

        expect(isFullWidthRow(fullWidthParamsAt(7))).toBe(true);
        expect(isFullWidthRow(fullWidthParamsAt(150))).toBe(true);
        expect(isFullWidthRow(fullWidthParamsAt(8))).toBe(false);
    });

    it('keeps the error row unselectable through rowSelection, composing with the callback found there', async () => {
        const existing = jest.fn((node: IRowNode) => node.rowIndex !== 3);
        const { options, directive } = await renderGrid({
            rowSelection: { mode: 'multiRow', isRowSelectable: existing }
        });
        const isRowSelectable = rowSelectionSelectableOf(options);

        directive.fail(150);

        expect(isRowSelectable?.(rowNodeAt(150))).toBe(false);
        expect(isRowSelectable?.(rowNodeAt(3))).toBe(false);
        expect(isRowSelectable?.(rowNodeAt(4))).toBe(true);
    });

    it('keeps the rest of rowSelection when writing the callback into it', async () => {
        const { options } = await renderGrid({ rowSelection: { mode: 'multiRow', checkboxes: true } });

        expect(options.get('rowSelection')).toEqual(expect.objectContaining({ mode: 'multiRow', checkboxes: true }));
    });

    it('leaves the deprecated top level option alone on the current rowSelection API', async () => {
        const { options } = await renderGrid({ rowSelection: { mode: 'multiRow' } });

        // AG Grid only reads the top level option for the legacy string form, and warns about it.
        expect(isRowSelectableOf(options)).toBeUndefined();
    });

    it('falls back to the top level option for the legacy string rowSelection', async () => {
        const existing = jest.fn((node: IRowNode) => node.rowIndex !== 3);
        const { options, directive } = await renderGrid({ rowSelection: 'multiple', isRowSelectable: existing });
        const isRowSelectable = isRowSelectableOf(options);

        directive.fail(150);

        expect(isRowSelectable?.(rowNodeAt(150))).toBe(false);
        expect(isRowSelectable?.(rowNodeAt(3))).toBe(false);
        expect(isRowSelectable?.(rowNodeAt(4))).toBe(true);
    });

    it('writes no selection callback at all when the grid has no rowSelection', async () => {
        const { options } = await renderGrid();

        expect(isRowSelectableOf(options)).toBeUndefined();
        expect(options.get('rowSelection')).toBeUndefined();
    });

    it('registers the error row renderer with Russian labels by default', async () => {
        const { options } = await renderGrid();
        const params = rendererParamsOf(options);

        expect(options.get('fullWidthCellRenderer')).toBe(KbqAgGridLoadErrorRowComponent);
        expect(params.labels()).toEqual(KBQ_AG_GRID_LOAD_ERROR_LABELS_RU);
    });

    it('carries a full width renderer the grid already had into the params', async () => {
        const ownRenderer = class {};
        const ownParams = { mine: true };
        const { options } = await renderGrid({
            fullWidthCellRenderer: ownRenderer,
            fullWidthCellRendererParams: ownParams
        });
        const params = rendererParamsOf(options);

        expect(options.get('fullWidthCellRenderer')).toBe(KbqAgGridLoadErrorRowComponent);
        expect(params.fallbackRenderer).toBe(ownRenderer);
        expect(params.fallbackParams).toBe(ownParams);
    });

    it('passes a row test that answers only for the failed row', async () => {
        const { options, directive } = await renderGrid();
        const params = rendererParamsOf(options);

        directive.fail(150);

        expect(params.isErrorRow(rowNodeAt(150))).toBe(true);
        expect(params.isErrorRow(rowNodeAt(151))).toBe(false);
    });

    it('uses labels supplied through the provider', async () => {
        const apiMock = createApiMock();
        const { fixture } = await render(TestLoadErrorGridEn);

        fixture.componentInstance.grid().emitGridReady(apiMock.api);
        fixture.detectChanges();

        const params = rendererParamsOf(apiMock.options);

        expect(params.labels()).toEqual(KBQ_AG_GRID_LOAD_ERROR_LABELS_EN);
    });
});
