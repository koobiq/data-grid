import { Component, Directive, forwardRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { render, waitFor } from '@testing-library/angular';
import { AgGridAngular } from 'ag-grid-angular';
import { AgEventType, GridApi, IRowNode } from 'ag-grid-community';
import { Subject } from 'rxjs';
import {
    KBQ_AG_GRID_ROW_FOCUS_STATE_STORE,
    KbqAgGridRowFocusState,
    KbqAgGridRowFocusStateLocalStorageStore,
    KbqAgGridRowFocusStateQueryParamsStore,
    KbqAgGridRowFocusStateStore,
    KbqAgGridRowFocusStateValue,
    kbqAgGridRowFocusStateStoreProvider
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

describe(KbqAgGridRowFocusState.name, () => {
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

    describe('cellFocused edge cases', () => {
        it('removes stored state when rowIndex is null', async () => {
            const store: KbqAgGridRowFocusStateStore = {
                getItem: jest.fn(() => null),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };
            const apiMock = createApiMock();

            const { fixture } = await render(TestRowFocusStateGrid, {
                componentProperties: { key: 'grid-row-focus-9', store }
            });
            fixture.componentInstance.grid().emitGridReady(apiMock.api);

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(apiMock.api.addEventListener).toHaveBeenCalledWith('cellFocused', expect.any(Function));
            });

            apiMock.dispatch('cellFocused', {
                rowIndex: null,
                rowPinned: null,
                column: { getColId: () => 'athlete' }
            });

            await waitFor(() => {
                expect(store.removeItem).toHaveBeenCalledWith('grid-row-focus-9');
                expect(store.setItem).not.toHaveBeenCalled();
            });
        });

        it('removes stored state when column is null', async () => {
            const store: KbqAgGridRowFocusStateStore = {
                getItem: jest.fn(() => null),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };
            const apiMock = createApiMock({}, { 0: makeNode('a', 0) });

            const { fixture } = await render(TestRowFocusStateGrid, {
                componentProperties: { key: 'grid-row-focus-10', store }
            });
            fixture.componentInstance.grid().emitGridReady(apiMock.api);

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(apiMock.api.addEventListener).toHaveBeenCalledWith('cellFocused', expect.any(Function));
            });

            apiMock.dispatch('cellFocused', { rowIndex: 0, rowPinned: null, column: null });

            await waitFor(() => {
                expect(store.removeItem).toHaveBeenCalledWith('grid-row-focus-10');
                expect(store.setItem).not.toHaveBeenCalled();
            });
        });

        it('removes stored state when the focused row cannot be resolved to an id', async () => {
            const store: KbqAgGridRowFocusStateStore = {
                getItem: jest.fn(() => null),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };
            // No node registered at index 0 — getDisplayedRowAtIndex resolves to undefined.
            const apiMock = createApiMock();

            const { fixture } = await render(TestRowFocusStateGrid, {
                componentProperties: { key: 'grid-row-focus-11', store }
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
                expect(store.removeItem).toHaveBeenCalledWith('grid-row-focus-11');
                expect(store.setItem).not.toHaveBeenCalled();
            });
        });

        it('accepts a string column key directly, without calling getColId', async () => {
            const nodeA = makeNode('a', 0);
            const store: KbqAgGridRowFocusStateStore = {
                getItem: jest.fn(() => null),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };
            const apiMock = createApiMock({}, { 0: nodeA });

            const { fixture } = await render(TestRowFocusStateGrid, {
                componentProperties: { key: 'grid-row-focus-12', store }
            });
            fixture.componentInstance.grid().emitGridReady(apiMock.api);

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(apiMock.api.addEventListener).toHaveBeenCalledWith('cellFocused', expect.any(Function));
            });

            apiMock.dispatch('cellFocused', { rowIndex: 0, rowPinned: null, column: 'athlete' });

            await waitFor(() => {
                expect(store.setItem).toHaveBeenCalledWith('grid-row-focus-12', { rowId: 'a', colId: 'athlete' });
            });
        });
    });
});

describe(KbqAgGridRowFocusStateLocalStorageStore.name, () => {
    const key = 'row-focus-local-storage-test-key';

    afterEach(() => {
        window.localStorage.removeItem(key);
    });

    it('getItem returns null when nothing is stored', () => {
        const store = new KbqAgGridRowFocusStateLocalStorageStore();
        expect(store.getItem(key)).toBeNull();
    });

    it('setItem stores the value as JSON, and getItem parses it back', () => {
        const store = new KbqAgGridRowFocusStateLocalStorageStore();
        const value: KbqAgGridRowFocusStateValue = { rowId: 'row-1', colId: 'athlete' };

        store.setItem(key, value);

        expect(window.localStorage.getItem(key)).toBe(JSON.stringify(value));
        expect(store.getItem(key)).toEqual(value);
    });

    it('removeItem deletes the stored value', () => {
        const store = new KbqAgGridRowFocusStateLocalStorageStore();
        store.setItem(key, { rowId: 'row-1', colId: 'athlete' });

        store.removeItem(key);

        expect(window.localStorage.getItem(key)).toBeNull();
        expect(store.getItem(key)).toBeNull();
    });

    it('getItem returns null when the stored value is not valid JSON', () => {
        const store = new KbqAgGridRowFocusStateLocalStorageStore();
        window.localStorage.setItem(key, 'not-json{{{');

        expect(store.getItem(key)).toBeNull();
    });
});

describe(KbqAgGridRowFocusStateQueryParamsStore.name, () => {
    const key = 'row-focus-query-params-test-key';
    let navigate: jest.Mock;
    let store: KbqAgGridRowFocusStateQueryParamsStore;

    beforeEach(() => {
        navigate = jest.fn(() => Promise.resolve(true));
        TestBed.configureTestingModule({
            providers: [{ provide: Router, useValue: { navigate } }]
        });
        store = TestBed.inject(KbqAgGridRowFocusStateQueryParamsStore);
    });

    afterEach(() => {
        window.history.pushState({}, '', '/');
    });

    it('getItem returns null when the query param is absent', () => {
        window.history.pushState({}, '', '/?other=1');
        expect(store.getItem(key)).toBeNull();
    });

    it('getItem parses the value from the URL query string', () => {
        const value: KbqAgGridRowFocusStateValue = { rowId: 'row-1', colId: 'athlete' };
        window.history.pushState({}, '', `/?${key}=${encodeURIComponent(JSON.stringify(value))}`);

        expect(store.getItem(key)).toEqual(value);
    });

    it('getItem returns null when the query param is not valid JSON', () => {
        window.history.pushState({}, '', `/?${key}=not-json{{{`);

        expect(store.getItem(key)).toBeNull();
    });

    it('setItem navigates with the JSON-stringified value merged into query params', async () => {
        const value: KbqAgGridRowFocusStateValue = { rowId: 'row-1', colId: 'athlete' };

        await store.setItem(key, value);

        expect(navigate).toHaveBeenCalledWith([], {
            queryParams: { [key]: JSON.stringify(value) },
            queryParamsHandling: 'merge',
            replaceUrl: true
        });
    });

    it('removeItem navigates with the query param set to null', async () => {
        await store.removeItem(key);

        expect(navigate).toHaveBeenCalledWith([], {
            queryParams: { [key]: null },
            queryParamsHandling: 'merge',
            replaceUrl: true
        });
    });
});

describe(kbqAgGridRowFocusStateStoreProvider.name, () => {
    it('binds the token to useClass when given a class', () => {
        const provider = kbqAgGridRowFocusStateStoreProvider(KbqAgGridRowFocusStateQueryParamsStore);

        expect(provider).toEqual({
            provide: KBQ_AG_GRID_ROW_FOCUS_STATE_STORE,
            useClass: KbqAgGridRowFocusStateQueryParamsStore
        });
    });

    it('binds the token to useValue when given an instance', () => {
        const instance: KbqAgGridRowFocusStateStore = {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined
        };

        const provider = kbqAgGridRowFocusStateStoreProvider(instance);

        expect(provider).toEqual({ provide: KBQ_AG_GRID_ROW_FOCUS_STATE_STORE, useValue: instance });
    });

    it('resolves to the provided store instance through Angular DI', () => {
        const instance: KbqAgGridRowFocusStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        TestBed.configureTestingModule({ providers: [kbqAgGridRowFocusStateStoreProvider(instance)] });

        expect(TestBed.inject(KBQ_AG_GRID_ROW_FOCUS_STATE_STORE)).toBe(instance);
    });
});
