import { DOWN_ARROW, UP_ARROW } from '@angular/cdk/keycodes';
import { Component, Directive, forwardRef, viewChild } from '@angular/core';
import { render } from '@testing-library/angular';
import { AgGridAngular } from 'ag-grid-angular';
import { CellKeyDownEvent, GridApi } from 'ag-grid-community';
import { Subject } from 'rxjs';
import { KbqAgGridSelectRowsByShiftArrow } from '../src/select-rows-by-shift-arrow.ng';

@Directive({
    selector: 'ag-grid-angular',
    standalone: true,
    providers: [{ provide: AgGridAngular, useExisting: forwardRef(() => AgGridStub) }]
})
class AgGridStub {
    readonly cellKeyDown = new Subject<Partial<CellKeyDownEvent>>();
}

@Component({
    standalone: true,
    template: `
        <ag-grid-angular kbqAgGridSelectRowsByShiftArrow />
    `,
    imports: [AgGridStub, KbqAgGridSelectRowsByShiftArrow]
})
class TestComponent {
    readonly grid = viewChild.required(AgGridStub);
}

const createKeyEvent = (keyCode: number, modifiers: { shiftKey?: boolean } = {}): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { cancelable: true, ...modifiers });
    Object.defineProperty(event, 'keyCode', { value: keyCode });
    return event;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createRowNode = (rowIndex: number) => ({ rowIndex, setSelected: jest.fn() });

describe(KbqAgGridSelectRowsByShiftArrow.name, () => {
    it('should select the next row on shift+down', async () => {
        const { fixture } = await render(TestComponent);

        const row0 = createRowNode(0);
        const row1 = createRowNode(1);
        const rows = new Map([
            [0, row0],
            [1, row1]
        ]);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        const api = {
            getSelectedNodes: jest.fn(() => []),
            getDisplayedRowCount: jest.fn(() => 5),
            getDisplayedRowAtIndex: jest.fn((i: number) => rows.get(i) ?? null),
            getFocusedCell: jest.fn(() => null),
            setFocusedCell: jest.fn()
        } as unknown as GridApi;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        fixture.componentInstance.grid().cellKeyDown.next({
            event: createKeyEvent(DOWN_ARROW, { shiftKey: true }),
            node: row0,
            api
        } as unknown as CellKeyDownEvent);

        expect(row1.setSelected).toHaveBeenCalledWith(true);
    });

    it('should select the previous row on shift+up', async () => {
        const { fixture } = await render(TestComponent);

        const row0 = createRowNode(0);
        const row1 = createRowNode(1);
        const rows = new Map([
            [0, row0],
            [1, row1]
        ]);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        const api = {
            getSelectedNodes: jest.fn(() => []),
            getDisplayedRowCount: jest.fn(() => 5),
            getDisplayedRowAtIndex: jest.fn((i: number) => rows.get(i) ?? null),
            getFocusedCell: jest.fn(() => null),
            setFocusedCell: jest.fn()
        } as unknown as GridApi;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        fixture.componentInstance.grid().cellKeyDown.next({
            event: createKeyEvent(UP_ARROW, { shiftKey: true }),
            node: row1,
            api
        } as unknown as CellKeyDownEvent);

        expect(row0.setSelected).toHaveBeenCalledWith(true);
    });

    it('should not react when shift key is not pressed', async () => {
        const { fixture } = await render(TestComponent);
        const setSelected = jest.fn();

        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        const api = {
            getSelectedNodes: jest.fn(() => []),
            getDisplayedRowCount: jest.fn(() => 5),
            getDisplayedRowAtIndex: jest.fn(() => ({ setSelected })),
            getFocusedCell: jest.fn(() => null)
        } as unknown as GridApi;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        fixture.componentInstance.grid().cellKeyDown.next({
            event: createKeyEvent(DOWN_ARROW),
            node: { rowIndex: 0 },
            api
        } as unknown as CellKeyDownEvent);

        expect(setSelected).not.toHaveBeenCalled();
    });

    it('should not go out of bounds at the last row', async () => {
        const { fixture } = await render(TestComponent);
        const row4 = createRowNode(4);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        const api = {
            getSelectedNodes: jest.fn(() => []),
            getDisplayedRowCount: jest.fn(() => 5),
            getDisplayedRowAtIndex: jest.fn(() => null),
            getFocusedCell: jest.fn(() => null)
        } as unknown as GridApi;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        fixture.componentInstance.grid().cellKeyDown.next({
            event: createKeyEvent(DOWN_ARROW, { shiftKey: true }),
            node: row4,
            api
        } as unknown as CellKeyDownEvent);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(api.getDisplayedRowAtIndex).not.toHaveBeenCalled();
    });
});
