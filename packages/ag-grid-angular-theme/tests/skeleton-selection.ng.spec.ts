import { Component, Directive, forwardRef, viewChild } from '@angular/core';
import { render } from '@testing-library/angular';
import { AgGridAngular } from 'ag-grid-angular';
import { CellRendererSelectorResult, GridApi, ICellRendererParams, SelectionColumnDef } from 'ag-grid-community';
import { Subject } from 'rxjs';
import { KbqAgGridSkeletonSelection, KbqAgGridSkeletonSelectionCellComponent } from '../src/skeleton-selection.ng';

type SelectionColumnSelector = (params: ICellRendererParams) => CellRendererSelectorResult | undefined;

const createApiMock = (
    initialSelectionColumnDef?: SelectionColumnDef
): { api: GridApi; read: () => SelectionColumnDef } => {
    let selectionColumnDef = initialSelectionColumnDef;

    const api = {
        getGridOption: jest.fn(() => selectionColumnDef),
        setGridOption: jest.fn((_key: string, value: SelectionColumnDef) => {
            selectionColumnDef = value;
        })
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return { api: api as unknown as GridApi, read: () => selectionColumnDef ?? {} };
};

/** The directive only reads `data`, so a bare object stands in for the full params. */
const paramsWithData = (data: unknown): ICellRendererParams =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    ({ data }) as ICellRendererParams;

@Directive({
    selector: 'ag-grid-angular',
    standalone: true,
    providers: [{ provide: AgGridAngular, useExisting: forwardRef(() => TestAgGridAngularStub) }]
})
class TestAgGridAngularStub {
    readonly gridReady = new Subject<{ api: GridApi }>();

    emitGridReady(api: GridApi): void {
        this.gridReady.next({ api });
    }
}

@Component({
    selector: 'test-skeleton-selection-grid',
    standalone: true,
    template: `
        <ag-grid-angular kbqAgGridSkeletonSelection />
    `,
    imports: [TestAgGridAngularStub, KbqAgGridSkeletonSelection]
})
class TestSkeletonSelectionGrid {
    readonly grid = viewChild.required(TestAgGridAngularStub);
}

const renderGrid = async (
    initialSelectionColumnDef?: SelectionColumnDef
): Promise<{ selector: SelectionColumnSelector; read: () => SelectionColumnDef }> => {
    const { api, read } = createApiMock(initialSelectionColumnDef);
    const { fixture } = await render(TestSkeletonSelectionGrid);

    fixture.componentInstance.grid().emitGridReady(api);
    fixture.detectChanges();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return { selector: read().cellRendererSelector as SelectionColumnSelector, read };
};

describe('KbqAgGridSkeletonSelection', () => {
    it('renders the skeleton for a row that has not loaded', async () => {
        const { selector } = await renderGrid();

        expect(selector(paramsWithData(undefined))).toEqual({ component: KbqAgGridSkeletonSelectionCellComponent });
    });

    it('leaves a loaded row to the default renderer', async () => {
        const { selector } = await renderGrid();

        expect(selector(paramsWithData({ id: '1' }))).toBeUndefined();
    });

    it('keeps other selectionColumnDef options set by another directive', async () => {
        const { read } = await renderGrid({ width: 36, pinned: 'left' });

        expect(read()).toEqual(expect.objectContaining({ width: 36, pinned: 'left' }));
    });

    it('defers to an existing cellRendererSelector for loaded rows', async () => {
        const existing = jest.fn(() => ({ component: KbqAgGridSkeletonSelectionCellComponent, params: { own: true } }));
        const { selector } = await renderGrid({ cellRendererSelector: existing });

        expect(selector(paramsWithData({ id: '1' }))).toEqual(expect.objectContaining({ params: { own: true } }));

        expect(existing).toHaveBeenCalledTimes(1);
    });

    it('takes precedence over an existing selector for unloaded rows', async () => {
        const existing = jest.fn(() => undefined);
        const { selector } = await renderGrid({ cellRendererSelector: existing });

        expect(selector(paramsWithData(undefined))).toEqual({
            component: KbqAgGridSkeletonSelectionCellComponent
        });

        expect(existing).not.toHaveBeenCalled();
    });
});
