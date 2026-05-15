import { Component, Directive, forwardRef, viewChild } from '@angular/core';
import { render } from '@testing-library/angular';
import { AgGridAngular } from 'ag-grid-angular';
import { CellClickedEvent } from 'ag-grid-community';
import { Subject } from 'rxjs';
import { KbqAgGridSelectRowsByCtrlClick } from '../src/select-rows-by-ctrl-click.ng';

@Directive({
    selector: 'ag-grid-angular',
    standalone: true,
    providers: [{ provide: AgGridAngular, useExisting: forwardRef(() => AgGridStub) }]
})
class AgGridStub {
    readonly cellClicked = new Subject<Partial<CellClickedEvent>>();
}

@Component({
    standalone: true,
    template: `
        <ag-grid-angular kbqAgGridSelectRowsByCtrlClick />
    `,
    imports: [AgGridStub, KbqAgGridSelectRowsByCtrlClick]
})
class TestComponent {
    readonly grid = viewChild.required(AgGridStub);
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createNode = (selected = false) => ({
    selectable: true,
    isSelected: jest.fn(() => selected),
    setSelected: jest.fn()
});

describe(KbqAgGridSelectRowsByCtrlClick.name, () => {
    it('should select the row on ctrl+click when not selected', async () => {
        const { fixture } = await render(TestComponent);
        const node = createNode(false);
        const event = new MouseEvent('click', { ctrlKey: true, cancelable: true });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        fixture.componentInstance.grid().cellClicked.next({ event, node } as unknown as CellClickedEvent);

        expect(node.setSelected).toHaveBeenCalledWith(true);
    });

    it('should deselect the row on ctrl+click when already selected', async () => {
        const { fixture } = await render(TestComponent);
        const node = createNode(true);
        const event = new MouseEvent('click', { ctrlKey: true, cancelable: true });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        fixture.componentInstance.grid().cellClicked.next({ event, node } as unknown as CellClickedEvent);

        expect(node.setSelected).toHaveBeenCalledWith(false);
    });

    it('should not change selection on regular click without modifier keys', async () => {
        const { fixture } = await render(TestComponent);
        const node = createNode();
        const event = new MouseEvent('click', { cancelable: true });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        fixture.componentInstance.grid().cellClicked.next({ event, node } as unknown as CellClickedEvent);

        expect(node.setSelected).not.toHaveBeenCalled();
    });

    it('should not change selection for non-selectable nodes', async () => {
        const { fixture } = await render(TestComponent);
        const node = { ...createNode(), selectable: false };
        const event = new MouseEvent('click', { ctrlKey: true, cancelable: true });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        fixture.componentInstance.grid().cellClicked.next({ event, node } as unknown as CellClickedEvent);

        expect(node.setSelected).not.toHaveBeenCalled();
    });
});
