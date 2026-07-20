import { Component, Directive, forwardRef, viewChild } from '@angular/core';
import { render, waitFor } from '@testing-library/angular';
import { AgGridAngular } from 'ag-grid-angular';
import { AgEventType, GridApi, IRowNode } from 'ag-grid-community';
import { Subject } from 'rxjs';
import {
    KbqAgGridRowFocusState,
    KbqAgGridRowFocusStateStore,
    KbqAgGridRowFocusStateValue
} from '../src/row-focus-state.ng';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEventHandler = (event?: any) => void;

const makeNode = (id: string, rowIndex: number | null): IRowNode => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return { id, rowIndex } as unknown as IRowNode;
};

const createApiMock = (
    nodesById: Record<string, IRowNode> = {},
    nodesByIndex: Record<number, IRowNode> = {}
): {
    api: GridApi;
    dispatch: (eventName: AgEventType, event?: object) => void;
} => {
    const listeners = new Map<AgEventType, AnyEventHandler[]>();

    const api = {
        addEventListener: jest.fn((eventName: AgEventType, handler: AnyEventHandler) => {
            const eventListeners = listeners.get(eventName) ?? [];
            eventListeners.push(handler);
            listeners.set(eventName, eventListeners);
        }),
        removeEventListener: jest.fn((eventName: AgEventType, handler: AnyEventHandler) => {
            const eventListeners = listeners.get(eventName) ?? [];
            listeners.set(
                eventName,
                eventListeners.filter((listener) => listener !== handler)
            );
        }),
        getRowNode: jest.fn((id: string) => nodesById[id]),
        getDisplayedRowAtIndex: jest.fn((index: number) => nodesByIndex[index]),
        setFocusedCell: jest.fn(),
        clearFocusedCell: jest.fn()
    };

    const dispatch = (eventName: AgEventType, event?: object): void => {
        const eventListeners = listeners.get(eventName) ?? [];
        eventListeners.forEach((listener) => listener(event));
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return { api: api as unknown as GridApi, dispatch };
};

@Directive({
    selector: 'ag-grid-angular',
    standalone: true,
    providers: [{ provide: AgGridAngular, useExisting: forwardRef(() => TestAgGridAngularStub) }]
})
class TestAgGridAngularStub {
    readonly gridReady = new Subject<{ api: GridApi }>();
    readonly api = createApiMock().api;

    emitGridReady(api: GridApi = this.api): void {
        this.gridReady.next({ api });
    }
}

@Component({
    selector: 'test-row-focus-state-grid',
    standalone: true,
    template: `
        <ag-grid-angular [kbqAgGridRowFocusState]="key" [kbqAgGridRowFocusStateStore]="store" />
    `,
    imports: [TestAgGridAngularStub, KbqAgGridRowFocusState]
})
class TestRowFocusStateGrid {
    key = 'row-focus';
    store: KbqAgGridRowFocusStateStore = {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined
    };

    readonly grid = viewChild.required(TestAgGridAngularStub);
    readonly directive = viewChild.required(KbqAgGridRowFocusState);
}

describe('KbqAgGridRowFocusState', () => {
    it('restores saved active cell from store on firstDataRendered', async () => {
        const savedValue: KbqAgGridRowFocusStateValue = { rowId: 'b', colId: 'athlete' };
        const nodeB = makeNode('b', 1);
        const store: KbqAgGridRowFocusStateStore = {
            getItem: jest.fn(() => savedValue),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock({ b: nodeB });

        const { fixture } = await render(TestRowFocusStateGrid, {
            componentProperties: { key: 'grid-row-focus-1', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);
        apiMock.dispatch('firstDataRendered');

        await waitFor(() => {
            expect(store.getItem).toHaveBeenCalledWith('grid-row-focus-1');
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.setFocusedCell).toHaveBeenCalledWith(1, 'athlete');
        });
    });

    it('does not focus anything when store returns null', async () => {
        const store: KbqAgGridRowFocusStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        const { fixture } = await render(TestRowFocusStateGrid, {
            componentProperties: { key: 'grid-row-focus-2', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);
        apiMock.dispatch('firstDataRendered');

        await waitFor(() => {
            expect(store.getItem).toHaveBeenCalledWith('grid-row-focus-2');
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.setFocusedCell).not.toHaveBeenCalled();
        });
    });

    it('does not restore when the saved row id no longer resolves to a row index', async () => {
        const savedValue: KbqAgGridRowFocusStateValue = { rowId: 'missing', colId: 'athlete' };
        const store: KbqAgGridRowFocusStateStore = {
            getItem: jest.fn(() => savedValue),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        const { fixture } = await render(TestRowFocusStateGrid, {
            componentProperties: { key: 'grid-row-focus-3', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);
        apiMock.dispatch('firstDataRendered');

        await waitFor(() => {
            expect(store.getItem).toHaveBeenCalledWith('grid-row-focus-3');
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.setFocusedCell).not.toHaveBeenCalled();
        });
    });

    it('saves the active cell on cellFocused', async () => {
        const nodeA = makeNode('a', 0);
        const store: KbqAgGridRowFocusStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock({}, { 0: nodeA });

        const { fixture } = await render(TestRowFocusStateGrid, {
            componentProperties: { key: 'grid-row-focus-4', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.addEventListener).toHaveBeenCalledWith('cellFocused', expect.any(Function));
        });

        apiMock.dispatch('cellFocused', {
            rowIndex: 0,
            rowPinned: null,
            column: { getColId: () => 'athlete' }
        });

        await waitFor(() => {
            expect(store.setItem).toHaveBeenCalledWith('grid-row-focus-4', { rowId: 'a', colId: 'athlete' });
        });
    });

    it('removes stored state when focus moves to a pinned row', async () => {
        const store: KbqAgGridRowFocusStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        const { fixture } = await render(TestRowFocusStateGrid, {
            componentProperties: { key: 'grid-row-focus-5', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.addEventListener).toHaveBeenCalledWith('cellFocused', expect.any(Function));
        });

        apiMock.dispatch('cellFocused', {
            rowIndex: 0,
            rowPinned: 'top',
            column: { getColId: () => 'athlete' }
        });

        await waitFor(() => {
            expect(store.removeItem).toHaveBeenCalledWith('grid-row-focus-5');
            expect(store.setItem).not.toHaveBeenCalled();
        });
    });

    it('does not resave the cell focused as a result of its own restore call', async () => {
        const savedValue: KbqAgGridRowFocusStateValue = { rowId: 'b', colId: 'athlete' };
        const nodeB = makeNode('b', 1);
        const store: KbqAgGridRowFocusStateStore = {
            getItem: jest.fn(() => savedValue),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock({ b: nodeB }, { 1: nodeB });

        // setFocusedCell dispatches `cellFocused` synchronously, mirroring real ag-grid behavior.
        jest.spyOn(apiMock.api, 'setFocusedCell').mockImplementation((rowIndex, colKey) => {
            apiMock.dispatch('cellFocused', { rowIndex, rowPinned: null, column: { getColId: () => colKey } });
        });

        const { fixture } = await render(TestRowFocusStateGrid, {
            componentProperties: { key: 'grid-row-focus-6', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);
        apiMock.dispatch('firstDataRendered');

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.setFocusedCell).toHaveBeenCalledWith(1, 'athlete');
        });

        expect(store.setItem).not.toHaveBeenCalled();
    });

    it('reset removes stored state and clears grid focus', async () => {
        const store: KbqAgGridRowFocusStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        const { fixture } = await render(TestRowFocusStateGrid, {
            componentProperties: { key: 'grid-row-focus-7', store }
        });

        fixture.componentInstance.directive().reset();

        expect(store.removeItem).toHaveBeenCalledWith('grid-row-focus-7');
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(fixture.componentInstance.grid().api.clearFocusedCell).toHaveBeenCalled();
    });

    it('removes all event listeners on destroy', async () => {
        const store: KbqAgGridRowFocusStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        const { fixture } = await render(TestRowFocusStateGrid, {
            componentProperties: { key: 'grid-row-focus-8', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.addEventListener).toHaveBeenCalledWith('cellFocused', expect.any(Function));
        });

        // eslint-disable-next-line @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-type-assertion
        const addEventListenerMock = apiMock.api.addEventListener as unknown as jest.MockedFunction<
            typeof apiMock.api.addEventListener
        >;

        const getHandler = (eventName: AgEventType): AnyEventHandler | undefined =>
            addEventListenerMock.mock.calls.find(([name]) => name === eventName)?.[1];

        fixture.destroy();

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(apiMock.api.removeEventListener).toHaveBeenCalledWith(
            'firstDataRendered',
            getHandler('firstDataRendered')
        );
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(apiMock.api.removeEventListener).toHaveBeenCalledWith('cellFocused', getHandler('cellFocused'));
    });
});
