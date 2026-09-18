import { Component, Directive, forwardRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { render, waitFor } from '@testing-library/angular';
import { AgGridAngular } from 'ag-grid-angular';
import { AgEventType, GridApi, IRowNode } from 'ag-grid-community';
import { Subject } from 'rxjs';
import {
    KBQ_AG_GRID_ROW_SELECTION_STATE_STORE,
    KbqAgGridRowSelectionState,
    KbqAgGridRowSelectionStateLocalStorageStore,
    KbqAgGridRowSelectionStateQueryParamsStore,
    KbqAgGridRowSelectionStateStore,
    kbqAgGridRowSelectionStateStoreProvider
} from '../src/row-selection-state.ng';

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
    readonly firstDataRendered = new Subject<{ api: GridApi }>();
    // Mirrors real ag-grid-angular, which assigns its `api` property synchronously before either
    // output fires, so directives reading `this.grid.api` see the right instance.
    api = createApiMock().api;

    emitGridReady(api: GridApi = this.api): void {
        this.api = api;
        this.gridReady.next({ api });
    }

    emitFirstDataRendered(api: GridApi = this.api): void {
        this.api = api;
        this.firstDataRendered.next({ api });
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
        fixture.componentInstance.grid().emitFirstDataRendered(apiMock.api);

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
        fixture.componentInstance.grid().emitFirstDataRendered(apiMock.api);

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
        fixture.componentInstance.grid().emitFirstDataRendered(apiMock.api);

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
        fixture.componentInstance.grid().emitFirstDataRendered(apiMock.api);

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

    it('removes the selectionChanged listener on destroy', async () => {
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
            'selectionChanged',
            getHandler('selectionChanged')
        );
    });

    it('stops restoring from firstDataRendered on destroy', async () => {
        const nodeB = makeNode('b');
        const store: KbqAgGridRowSelectionStateStore = {
            getItem: jest.fn(() => ['b']),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock([nodeB]);

        const { fixture } = await render(TestRowSelectionStateGrid, {
            componentProperties: { key: 'grid-row-selection-8', store }
        });

        const grid = fixture.componentInstance.grid();

        grid.emitGridReady(apiMock.api);
        fixture.destroy();
        grid.emitFirstDataRendered(apiMock.api);

        expect(store.getItem).not.toHaveBeenCalled();
    });

    it('does not touch grid selection when destroyed while store.getItem is still pending', async () => {
        const nodeB = makeNode('b');
        let resolveGetItem: (value: string[] | null) => void = () => undefined;
        const pendingItem = new Promise<string[] | null>((resolve) => {
            resolveGetItem = resolve;
        });
        const store: KbqAgGridRowSelectionStateStore = {
            getItem: jest.fn(async () => pendingItem),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock([nodeB]);

        const { fixture } = await render(TestRowSelectionStateGrid, {
            componentProperties: { key: 'grid-row-selection-9', store }
        });

        const grid = fixture.componentInstance.grid();

        grid.emitGridReady(apiMock.api);
        grid.emitFirstDataRendered(apiMock.api);

        await waitFor(() => expect(store.getItem).toHaveBeenCalledWith('grid-row-selection-9'));

        // Destroy while the store's Promise is still pending — mirrors a slow, consumer-provided
        // async store (e.g. a network round trip) resolving after the directive has torn down.
        fixture.destroy();
        resolveGetItem(['b']);
        await Promise.resolve();

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(apiMock.api.setNodesSelected).not.toHaveBeenCalled();
    });

    describe('built-in stores', () => {
        const STATE_KEY = 'row-selection-state-key';
        const navigate = jest.fn();

        beforeEach(() => {
            navigate.mockClear();
            localStorage.clear();
            window.history.replaceState({}, '', '/');
        });

        afterEach(() => {
            localStorage.clear();
            window.history.replaceState({}, '', '/');
        });

        describe('KbqAgGridRowSelectionStateLocalStorageStore', () => {
            const makeStore = (): KbqAgGridRowSelectionStateLocalStorageStore =>
                TestBed.inject(KbqAgGridRowSelectionStateLocalStorageStore);

            it('writes the selected row ids as json', () => {
                makeStore().setItem(STATE_KEY, ['a', 'b']);

                expect(localStorage.getItem(STATE_KEY)).toBe('["a","b"]');
            });

            it('reads the selected row ids back', () => {
                localStorage.setItem(STATE_KEY, '["a","b"]');

                expect(makeStore().getItem(STATE_KEY)).toEqual(['a', 'b']);
            });

            it('returns null when nothing is stored', () => {
                expect(makeStore().getItem(STATE_KEY)).toBeNull();
            });

            it('returns null for a malformed stored value', () => {
                localStorage.setItem(STATE_KEY, 'not json');

                expect(makeStore().getItem(STATE_KEY)).toBeNull();
            });

            it('removes the stored value', () => {
                localStorage.setItem(STATE_KEY, '["a"]');
                makeStore().removeItem(STATE_KEY);

                expect(localStorage.getItem(STATE_KEY)).toBeNull();
            });
        });

        describe('KbqAgGridRowSelectionStateQueryParamsStore', () => {
            const makeStore = (): KbqAgGridRowSelectionStateQueryParamsStore => {
                TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: { navigate } }] });

                return TestBed.inject(KbqAgGridRowSelectionStateQueryParamsStore);
            };

            it('reads the selected row ids from the query string', () => {
                window.history.replaceState({}, '', `/?${STATE_KEY}=${encodeURIComponent('["a","b"]')}`);

                expect(makeStore().getItem(STATE_KEY)).toEqual(['a', 'b']);
            });

            it('returns null when the query param is absent', () => {
                expect(makeStore().getItem(STATE_KEY)).toBeNull();
            });

            it('returns null for a malformed query param', () => {
                window.history.replaceState({}, '', `/?${STATE_KEY}=not-json`);

                expect(makeStore().getItem(STATE_KEY)).toBeNull();
            });

            it('writes the selected row ids into the query string', async () => {
                await makeStore().setItem(STATE_KEY, ['a']);

                expect(navigate).toHaveBeenCalledWith([], {
                    queryParams: { [STATE_KEY]: '["a"]' },
                    queryParamsHandling: 'merge',
                    replaceUrl: true
                });
            });

            it('drops the query param on remove', async () => {
                await makeStore().removeItem(STATE_KEY);

                expect(navigate).toHaveBeenCalledWith([], {
                    queryParams: { [STATE_KEY]: null },
                    queryParamsHandling: 'merge',
                    replaceUrl: true
                });
            });
        });

        describe('store injection', () => {
            it('defaults to the localStorage store', () => {
                expect(TestBed.inject(KBQ_AG_GRID_ROW_SELECTION_STATE_STORE)).toBeInstanceOf(
                    KbqAgGridRowSelectionStateLocalStorageStore
                );
            });

            it('binds the store class passed to kbqAgGridRowSelectionStateStoreProvider', () => {
                TestBed.configureTestingModule({
                    providers: [
                        { provide: Router, useValue: { navigate } },
                        kbqAgGridRowSelectionStateStoreProvider(KbqAgGridRowSelectionStateQueryParamsStore)
                    ]
                });

                expect(TestBed.inject(KBQ_AG_GRID_ROW_SELECTION_STATE_STORE)).toBeInstanceOf(
                    KbqAgGridRowSelectionStateQueryParamsStore
                );
            });

            it('binds the store instance passed to kbqAgGridRowSelectionStateStoreProvider', () => {
                const store: KbqAgGridRowSelectionStateStore = {
                    getItem: () => null,
                    setItem: () => undefined,
                    removeItem: () => undefined
                };

                TestBed.configureTestingModule({ providers: [kbqAgGridRowSelectionStateStoreProvider(store)] });

                expect(TestBed.inject(KBQ_AG_GRID_ROW_SELECTION_STATE_STORE)).toBe(store);
            });
        });
    });
});
