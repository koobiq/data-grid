import { Clipboard } from '@angular/cdk/clipboard';
import { C } from '@angular/cdk/keycodes';
import { Component, Directive, forwardRef, viewChild } from '@angular/core';
import { render, waitFor } from '@testing-library/angular';
import { AgGridAngular } from 'ag-grid-angular';
import { CellKeyDownEvent, GridApi } from 'ag-grid-community';
import { Subject } from 'rxjs';
import { KbqAgGridCopyByCtrlC, KbqAgGridCopyEvent } from '../src/copy-by-ctrl-c.ng';

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
        <ag-grid-angular kbqAgGridCopyByCtrlC (kbqAgGridCopyDone)="onCopy($event)" />
    `,
    imports: [AgGridStub, KbqAgGridCopyByCtrlC]
})
class TestComponent {
    readonly grid = viewChild.required(AgGridStub);
    copyResult: KbqAgGridCopyEvent | null = null;

    onCopy(result: KbqAgGridCopyEvent): void {
        this.copyResult = result;
    }
}

const createKeyEvent = (keyCode: number, modifiers: { ctrlKey?: boolean; metaKey?: boolean } = {}): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { cancelable: true, ...modifiers });
    Object.defineProperty(event, 'keyCode', { value: keyCode });
    return event;
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
const createApi = (nodes: object[] = []): GridApi => ({ getSelectedNodes: jest.fn(() => nodes) }) as unknown as GridApi;

describe(KbqAgGridCopyByCtrlC.name, () => {
    beforeEach(() => {
        jest.spyOn(document, 'getSelection').mockReturnValue(null);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should copy selected rows to clipboard on ctrl+C', async () => {
        const clipboardMock = { copy: jest.fn(() => true) };
        const { fixture } = await render(TestComponent, {
            providers: [{ provide: Clipboard, useValue: clipboardMock }]
        });

        const api = createApi([{ rowIndex: 0, data: { name: 'Alice' } }]);
        fixture.componentInstance.grid().cellKeyDown.next({
            event: createKeyEvent(C, { ctrlKey: true }),
            api
        });

        await waitFor(() => expect(clipboardMock.copy).toHaveBeenCalled());
    });

    it('should emit kbqAgGridCopyDone with result after copying', async () => {
        const clipboardMock = { copy: jest.fn(() => true) };
        const { fixture } = await render(TestComponent, {
            providers: [{ provide: Clipboard, useValue: clipboardMock }]
        });

        const api = createApi([{ rowIndex: 0, data: { name: 'Alice' } }]);
        fixture.componentInstance.grid().cellKeyDown.next({
            event: createKeyEvent(C, { ctrlKey: true }),
            api
        });

        await waitFor(() =>
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            expect(fixture.componentInstance.copyResult).toEqual({ success: true, text: expect.any(String) })
        );
    });

    it('should not copy when no rows are selected', async () => {
        const clipboardMock = { copy: jest.fn(() => true) };
        const { fixture } = await render(TestComponent, {
            providers: [{ provide: Clipboard, useValue: clipboardMock }]
        });

        fixture.componentInstance.grid().cellKeyDown.next({
            event: createKeyEvent(C, { ctrlKey: true }),
            api: createApi([])
        });

        await fixture.whenStable();

        expect(clipboardMock.copy).not.toHaveBeenCalled();
    });

    it('should not copy when text is selected in the browser', async () => {
        const clipboardMock = { copy: jest.fn(() => true) };
        const { fixture } = await render(TestComponent, {
            providers: [{ provide: Clipboard, useValue: clipboardMock }]
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        jest.spyOn(document, 'getSelection').mockReturnValue({
            toString: () => 'selected text'
        } as unknown as Selection);

        fixture.componentInstance.grid().cellKeyDown.next({
            event: createKeyEvent(C, { ctrlKey: true }),
            api: createApi([{ rowIndex: 0, data: { name: 'Alice' } }])
        });

        await fixture.whenStable();

        expect(clipboardMock.copy).not.toHaveBeenCalled();
    });
});
