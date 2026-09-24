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
};

const createApiMock = (initialOptions: Record<string, unknown> = {}): ApiMock => {
    const options = new Map<string, unknown>(Object.entries(initialOptions));

    const api = {
        setRowCount: jest.fn(),
        redrawRows: jest.fn(),
        refreshInfiniteCache: jest.fn(),
        getGridOption: jest.fn((key: string) => options.get(key)),
        setGridOption: jest.fn((key: string, value: unknown) => options.set(key, value))
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return { api: api as unknown as GridApi, options };
};

type IsFullWidthRowFn = (params: IsFullWidthRowParams) => boolean;
type IsRowSelectableFn = (node: IRowNode) => boolean;
type LabelledParams = { labels: () => KbqAgGridLoadErrorLabels };

/** Grid options are stored untyped in the mock, so each read narrows once, right here. */
const isFullWidthRowOf = (options: Map<string, unknown>): IsFullWidthRowFn =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    options.get('isFullWidthRow') as IsFullWidthRowFn;

const isRowSelectableOf = (options: Map<string, unknown>): IsRowSelectableFn =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    options.get('isRowSelectable') as IsRowSelectableFn;

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
): Promise<{ component: TestLoadErrorGrid; directive: KbqAgGridLoadError } & ApiMock> => {
    const apiMock = createApiMock(initialOptions);
    const { fixture } = await render(TestLoadErrorGrid);
    const component = fixture.componentInstance;

    component.grid().emitGridReady(apiMock.api);
    fixture.detectChanges();

    return { ...apiMock, component, directive: component.directive() };
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

    it('keeps the error row unselectable and composes with an existing isRowSelectable', async () => {
        const existing = jest.fn((node: IRowNode) => node.rowIndex !== 3);
        const { options, directive } = await renderGrid({ isRowSelectable: existing });
        const isRowSelectable = isRowSelectableOf(options);

        directive.fail(150);

        expect(isRowSelectable(rowNodeAt(150))).toBe(false);
        expect(isRowSelectable(rowNodeAt(3))).toBe(false);
        expect(isRowSelectable(rowNodeAt(4))).toBe(true);
    });

    it('registers the error row renderer with Russian labels by default', async () => {
        const { options } = await renderGrid();
        const params = rendererParamsOf(options);

        expect(options.get('fullWidthCellRenderer')).toBe(KbqAgGridLoadErrorRowComponent);
        expect(params.labels()).toEqual(KBQ_AG_GRID_LOAD_ERROR_LABELS_RU);
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
