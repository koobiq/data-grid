import { A } from '@angular/cdk/keycodes';
import { Component, Directive, forwardRef, viewChild } from '@angular/core';
import { render } from '@testing-library/angular';
import { AgGridAngular } from 'ag-grid-angular';
import { CellKeyDownEvent, GridApi } from 'ag-grid-community';
import { Subject } from 'rxjs';
import { KbqAgGridSelectAllRowsByCtrlA } from '../src/select-all-rows-by-ctrl-a.ng';

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
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    imports: [AgGridStub, KbqAgGridSelectAllRowsByCtrlA],
    template: `
        <ag-grid-angular kbqAgGridSelectAllRowsByCtrlA />
    `
})
class TestComponent {
    readonly grid = viewChild.required(AgGridStub);
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
const createGridApi = (): GridApi => ({ selectAll: jest.fn() }) as unknown as GridApi;

const createKeyEvent = (keyCode: number, modifiers: { ctrlKey?: boolean; metaKey?: boolean } = {}): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { cancelable: true, ...modifiers });
    Object.defineProperty(event, 'keyCode', { value: keyCode });
    return event;
};

// eslint-disable-next-line @typescript-eslint/no-deprecated
describe(KbqAgGridSelectAllRowsByCtrlA.name, () => {
    it('should call api.selectAll() on ctrl+A', async () => {
        const { fixture } = await render(TestComponent);
        const api = createGridApi();

        fixture.componentInstance.grid().cellKeyDown.next({
            event: createKeyEvent(A, { ctrlKey: true }),
            api
        });

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(api.selectAll).toHaveBeenCalled();
    });

    it('should call api.selectAll() on meta+A (Mac)', async () => {
        const { fixture } = await render(TestComponent);
        const api = createGridApi();

        fixture.componentInstance.grid().cellKeyDown.next({
            event: createKeyEvent(A, { metaKey: true }),
            api
        });

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(api.selectAll).toHaveBeenCalled();
    });

    it('should not call api.selectAll() when ctrl is not pressed', async () => {
        const { fixture } = await render(TestComponent);
        const api = createGridApi();

        fixture.componentInstance.grid().cellKeyDown.next({
            event: createKeyEvent(A),
            api
        });

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(api.selectAll).not.toHaveBeenCalled();
    });
});
