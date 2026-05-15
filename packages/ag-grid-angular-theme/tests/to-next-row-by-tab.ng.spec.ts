import { Component, Directive, forwardRef, viewChild } from '@angular/core';
import { render } from '@testing-library/angular';
import { AgGridAngular } from 'ag-grid-angular';
import { CellPosition, GridApi, TabToNextCellParams } from 'ag-grid-community';
import { KbqAgGridToNextRowByTab } from '../src/to-next-row-by-tab.ng';

@Directive({
    selector: 'ag-grid-angular',
    standalone: true,
    providers: [{ provide: AgGridAngular, useExisting: forwardRef(() => AgGridStub) }]
})
class AgGridStub {
    tabToNextCell?: (params: TabToNextCellParams) => CellPosition | boolean;
}

@Component({
    standalone: true,
    template: `
        <ag-grid-angular kbqAgGridToNextRowByTab />
    `,
    imports: [AgGridStub, KbqAgGridToNextRowByTab]
})
class TestComponent {
    readonly grid = viewChild.required(AgGridStub);
}

const createApi = (rowCount: number): GridApi =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    ({ getDisplayedRowCount: jest.fn(() => rowCount) }) as unknown as GridApi;

const makeParams = (rowIndex: number, rowCount: number, backwards = false): TabToNextCellParams =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    ({
        previousCellPosition: { rowIndex, column: {}, rowPinned: null },
        api: createApi(rowCount),
        backwards,
        nextCellPosition: null
    }) as unknown as TabToNextCellParams;

describe(KbqAgGridToNextRowByTab.name, () => {
    it('should set tabToNextCell on the grid', async () => {
        const { fixture } = await render(TestComponent);

        expect(fixture.componentInstance.grid().tabToNextCell).toBeDefined();
    });

    it('should return the next row position when moving forward', async () => {
        const { fixture } = await render(TestComponent);
        const column = {};
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        const params = {
            previousCellPosition: { rowIndex: 2, column, rowPinned: null },
            api: createApi(10),
            backwards: false,
            nextCellPosition: null
        } as unknown as TabToNextCellParams;

        const result = fixture.componentInstance.grid().tabToNextCell!(params);

        expect(result).toEqual({ rowIndex: 3, column, rowPinned: null });
    });

    it('should return the previous row position when moving backwards', async () => {
        const { fixture } = await render(TestComponent);
        const column = {};
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        const params = {
            previousCellPosition: { rowIndex: 3, column, rowPinned: null },
            api: createApi(10),
            backwards: true,
            nextCellPosition: null
        } as unknown as TabToNextCellParams;

        const result = fixture.componentInstance.grid().tabToNextCell!(params);

        expect(result).toEqual({ rowIndex: 2, column, rowPinned: null });
    });

    it('should return false when reaching the last row', async () => {
        const { fixture } = await render(TestComponent);

        const result = fixture.componentInstance.grid().tabToNextCell!(makeParams(3, 5));

        expect(result).toBe(false);
    });
});
