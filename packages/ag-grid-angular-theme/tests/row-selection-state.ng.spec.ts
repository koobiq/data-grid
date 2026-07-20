import { Component, Directive, forwardRef, viewChild } from '@angular/core';
import { render, waitFor } from '@testing-library/angular';
import { AgGridAngular } from 'ag-grid-angular';
import { AgEventType, GridApi, IRowNode } from 'ag-grid-community';
import { Subject } from 'rxjs';
import { KbqAgGridRowSelectionState, KbqAgGridRowSelectionStateStore } from '../src/row-selection-state.ng';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEventHandler = (event?: any) => void;

const makeNode = (id: string, selected = false): IRowNode => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return {
        id,
        isSelected: () => selected,
        setSelected: (value: boolean) => (selected = value)
    } as unknown as IRowNode;
};

const createApiMock = (
    nodes: IRowNode[] = []
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
        forEachNode: jest.fn((callback: (node: IRowNode, index: number) => void) => {
            nodes.forEach((node, index) => callback(node, index));
        }),
        setNodesSelected: jest.fn(({ nodes: selectedNodes, newValue }: { nodes: IRowNode[]; newValue: boolean }) => {
            selectedNodes.forEach((node) => node.setSelected(newValue));
        }),
        getSelectedNodes: jest.fn(() => nodes.filter((node) => node.isSelected())),
        deselectAll: jest.fn(() => nodes.forEach((node) => node.setSelected(false)))
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
    selector: 'test-row-selection-state-grid',
    standalone: true,
    template: `
        <ag-grid-angular [kbqAgGridRowSelectionState]="key" [kbqAgGridRowSelectionStateStore]="store" />
    `,
    imports: [TestAgGridAngularStub, KbqAgGridRowSelectionState]
})
class TestRowSelectionStateGrid {
    key = 'row-selection';
    store: KbqAgGridRowSelectionStateStore = {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined
    };

    readonly grid = viewChild.required(TestAgGridAngularStub);
    readonly directive = viewChild.required(KbqAgGridRowSelectionState);
}

describe('KbqAgGridRowSelectionState', () => {
    it('restores saved selection from store on firstDataRendered', async () => {
        const nodeA = makeNode('a');
        const nodeB = makeNode('b');
        const store: KbqAgGridRowSelectionStateStore = {
            getItem: jest.fn(() => ['b']),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock([nodeA, nodeB]);

        const { fixture } = await render(TestRowSelectionStateGrid, {
            componentProperties: { key: 'grid-row-selection-1', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);
        apiMock.dispatch('firstDataRendered');

        await waitFor(() => {
            expect(store.getItem).toHaveBeenCalledWith('grid-row-selection-1');
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.setNodesSelected).toHaveBeenCalledWith({
                nodes: [nodeB],
                newValue: true,
                source: 'api'
            });
        });
    });

    it('deselects a node that is selected but not in the persisted set', async () => {
        // Simulates a default rowSelection config, or a click that raced ahead of
        // firstDataRendered — either way, a node selected before restore runs that isn't part
        // of the persisted set must not survive the restore.
        const nodeA = makeNode('a', true);
        const nodeB = makeNode('b');
        const store: KbqAgGridRowSelectionStateStore = {
            getItem: jest.fn(() => ['b']),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock([nodeA, nodeB]);

        const { fixture } = await render(TestRowSelectionStateGrid, {
            componentProperties: { key: 'grid-row-selection-stale', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);
        apiMock.dispatch('firstDataRendered');

        await waitFor(() => {
            expect(nodeA.isSelected()).toBe(false);
            expect(nodeB.isSelected()).toBe(true);
        });
    });

    it('clears a pre-existing selection when nothing is persisted', async () => {
        const nodeA = makeNode('a', true);
        const store: KbqAgGridRowSelectionStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock([nodeA]);

        const { fixture } = await render(TestRowSelectionStateGrid, {
            componentProperties: { key: 'grid-row-selection-clear', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);
        apiMock.dispatch('firstDataRendered');

        await waitFor(() => {
            expect(nodeA.isSelected()).toBe(false);
        });
    });

    it('does not select anything when store returns null', async () => {
        const nodeA = makeNode('a');
        const store: KbqAgGridRowSelectionStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock([nodeA]);

        const { fixture } = await render(TestRowSelectionStateGrid, {
            componentProperties: { key: 'grid-row-selection-2', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);
        apiMock.dispatch('firstDataRendered');

        await waitFor(() => {
            expect(store.getItem).toHaveBeenCalledWith('grid-row-selection-2');
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.setNodesSelected).not.toHaveBeenCalled();
        });
    });

    it('saves selected row ids on non-api selectionChanged events', async () => {
        const nodeA = makeNode('a', true);
        const nodeB = makeNode('b');
        const store: KbqAgGridRowSelectionStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock([nodeA, nodeB]);

        const { fixture } = await render(TestRowSelectionStateGrid, {
            componentProperties: { key: 'grid-row-selection-3', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.addEventListener).toHaveBeenCalledWith('selectionChanged', expect.any(Function));
        });

        apiMock.dispatch('selectionChanged', { source: 'rowClicked' });

        await waitFor(() => {
            expect(store.setItem).toHaveBeenCalledWith('grid-row-selection-3', ['a']);
        });
    });

    it('removes stored selection when selectionChanged produces no selected rows', async () => {
        const nodeA = makeNode('a');
        const store: KbqAgGridRowSelectionStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock([nodeA]);

        const { fixture } = await render(TestRowSelectionStateGrid, {
            componentProperties: { key: 'grid-row-selection-4', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.addEventListener).toHaveBeenCalledWith('selectionChanged', expect.any(Function));
        });

        apiMock.dispatch('selectionChanged', { source: 'rowClicked' });

        await waitFor(() => {
            expect(store.removeItem).toHaveBeenCalledWith('grid-row-selection-4');
            expect(store.setItem).not.toHaveBeenCalled();
        });
    });

    it('ignores selectionChanged events triggered by api source', async () => {
        const store: KbqAgGridRowSelectionStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        const { fixture } = await render(TestRowSelectionStateGrid, {
            componentProperties: { key: 'grid-row-selection-5', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.addEventListener).toHaveBeenCalledWith('selectionChanged', expect.any(Function));
        });

        apiMock.dispatch('selectionChanged', { source: 'api' });

        await waitFor(() => {
            expect(store.setItem).not.toHaveBeenCalled();
            expect(store.removeItem).not.toHaveBeenCalled();
        });
    });

    it('reset removes stored state and clears grid selection', async () => {
        const store: KbqAgGridRowSelectionStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        const { fixture } = await render(TestRowSelectionStateGrid, {
            componentProperties: { key: 'grid-row-selection-6', store }
        });

        fixture.componentInstance.directive().reset();

        expect(store.removeItem).toHaveBeenCalledWith('grid-row-selection-6');
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(fixture.componentInstance.grid().api.deselectAll).toHaveBeenCalled();
    });

    it('removes all event listeners on destroy', async () => {
        const store: KbqAgGridRowSelectionStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        const { fixture } = await render(TestRowSelectionStateGrid, {
            componentProperties: { key: 'grid-row-selection-7', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.addEventListener).toHaveBeenCalledWith('selectionChanged', expect.any(Function));
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
        expect(apiMock.api.removeEventListener).toHaveBeenCalledWith(
            'selectionChanged',
            getHandler('selectionChanged')
        );
    });
});
