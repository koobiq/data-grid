import { Component, Directive, forwardRef, viewChild } from '@angular/core';
import { render, waitFor } from '@testing-library/angular';
import { AgGridAngular } from 'ag-grid-angular';
import { AgEventType, ColumnState, GridApi } from 'ag-grid-community';
import { Subject } from 'rxjs';
import { KbqAgGridColumnState, KbqAgGridColumnStateStore } from '../src/column-state.ng';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEventHandler = (event?: any) => void;

const createApiMock = (): { api: GridApi; dispatch: (eventName: AgEventType, event?: object) => void } => {
    const listeners = new Map<AgEventType, AnyEventHandler[]>();
    let state: ColumnState[] = [];

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
        getColumnState: jest.fn(() => state),
        applyColumnState: jest.fn(({ state: nextState }: { state: ColumnState[]; applyOrder: boolean }) => {
            state = nextState;
        })
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
    selector: 'test-column-state-grid',
    standalone: true,
    template: `
        <ag-grid-angular [kbqAgGridColumnState]="key" [kbqAgGridColumnStateStore]="store" />
    `,
    imports: [TestAgGridAngularStub, KbqAgGridColumnState]
})
class TestColumnStateGrid {
    key = 'columns';
    store: KbqAgGridColumnStateStore = {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined
    };

    readonly grid = viewChild.required(TestAgGridAngularStub);
    readonly directive = viewChild.required(KbqAgGridColumnState);
}

describe(KbqAgGridColumnState.name, () => {
    it('restores saved state from store on init', async () => {
        const savedState: ColumnState[] = [{ colId: 'name', sort: 'asc' }];
        const store: KbqAgGridColumnStateStore = {
            getItem: jest.fn(() => savedState),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        const { fixture } = await render(TestColumnStateGrid, {
            componentProperties: { key: 'grid-columns-1', store }
        });

        const grid = fixture.componentInstance.grid();
        grid.emitGridReady();

        await waitFor(() => {
            expect(store.getItem).toHaveBeenCalledWith('grid-columns-1');
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(grid.api.applyColumnState).toHaveBeenCalledWith({ state: savedState, applyOrder: true });
        });
    });

    it('does not apply state when store returns null', async () => {
        const store: KbqAgGridColumnStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        const { fixture } = await render(TestColumnStateGrid, {
            componentProperties: { key: 'grid-columns-2', store }
        });

        const grid = fixture.componentInstance.grid();
        grid.emitGridReady();

        await waitFor(() => {
            expect(store.getItem).toHaveBeenCalledWith('grid-columns-2');
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(grid.api.applyColumnState).not.toHaveBeenCalled();
        });
    });

    it('saves state on sortChanged', async () => {
        const columnState: ColumnState[] = [{ colId: 'name', sort: 'desc' }];
        const store: KbqAgGridColumnStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        jest.spyOn(apiMock.api, 'getColumnState').mockReturnValue(columnState);

        const { fixture } = await render(TestColumnStateGrid, {
            componentProperties: { key: 'grid-columns-3', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.addEventListener).toHaveBeenCalledWith('sortChanged', expect.any(Function));
        });

        apiMock.dispatch('sortChanged');

        await waitFor(() => {
            expect(store.setItem).toHaveBeenCalledWith('grid-columns-3', columnState);
        });
    });

    it('saves state on columnMoved', async () => {
        const columnState: ColumnState[] = [{ colId: 'name' }, { colId: 'age' }];
        const store: KbqAgGridColumnStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        jest.spyOn(apiMock.api, 'getColumnState').mockReturnValue(columnState);

        const { fixture } = await render(TestColumnStateGrid, {
            componentProperties: { key: 'grid-columns-4', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.addEventListener).toHaveBeenCalledWith('columnMoved', expect.any(Function));
        });

        apiMock.dispatch('columnMoved');

        await waitFor(() => {
            expect(store.setItem).toHaveBeenCalledWith('grid-columns-4', columnState);
        });
    });

    it('saves state on columnVisible', async () => {
        const columnState: ColumnState[] = [{ colId: 'name', hide: true }];
        const store: KbqAgGridColumnStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        jest.spyOn(apiMock.api, 'getColumnState').mockReturnValue(columnState);

        const { fixture } = await render(TestColumnStateGrid, {
            componentProperties: { key: 'grid-columns-5', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.addEventListener).toHaveBeenCalledWith('columnVisible', expect.any(Function));
        });

        apiMock.dispatch('columnVisible');

        await waitFor(() => {
            expect(store.setItem).toHaveBeenCalledWith('grid-columns-5', columnState);
        });
    });

    it('saves state on columnResized when finished', async () => {
        const columnState: ColumnState[] = [{ colId: 'name', width: 200 }];
        const store: KbqAgGridColumnStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        jest.spyOn(apiMock.api, 'getColumnState').mockReturnValue(columnState);

        const { fixture } = await render(TestColumnStateGrid, {
            componentProperties: { key: 'grid-columns-6', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.addEventListener).toHaveBeenCalledWith('columnResized', expect.any(Function));
        });

        apiMock.dispatch('columnResized', { finished: true });

        await waitFor(() => {
            expect(store.setItem).toHaveBeenCalledWith('grid-columns-6', columnState);
        });
    });

    it('does not save state on columnResized when not finished', async () => {
        const store: KbqAgGridColumnStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        const { fixture } = await render(TestColumnStateGrid, {
            componentProperties: { key: 'grid-columns-7', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.addEventListener).toHaveBeenCalledWith('columnResized', expect.any(Function));
        });

        apiMock.dispatch('columnResized', { finished: false });

        await waitFor(() => {
            expect(store.setItem).not.toHaveBeenCalled();
        });
    });

    it('supports async store methods', async () => {
        const restoredState: ColumnState[] = [{ colId: 'name', sort: 'asc' }];
        const currentState: ColumnState[] = [{ colId: 'name', sort: 'desc' }];
        const store: KbqAgGridColumnStateStore = {
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            getItem: jest.fn(() => Promise.resolve(restoredState)),
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            setItem: jest.fn(() => Promise.resolve(undefined)),
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            removeItem: jest.fn(() => Promise.resolve(undefined))
        };
        const apiMock = createApiMock();

        jest.spyOn(apiMock.api, 'getColumnState').mockReturnValue(currentState);

        const { fixture } = await render(TestColumnStateGrid, {
            componentProperties: { key: 'grid-columns-8', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.applyColumnState).toHaveBeenCalledWith({ state: restoredState, applyOrder: true });
        });

        apiMock.dispatch('sortChanged');

        await waitFor(() => {
            expect(store.setItem).toHaveBeenCalledWith('grid-columns-8', currentState);
        });
    });

    it('reset removes stored state and resets grid column state', async () => {
        const store: KbqAgGridColumnStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        const { fixture } = await render(TestColumnStateGrid, {
            componentProperties: { key: 'grid-columns-9', store }
        });

        fixture.componentInstance.directive().reset();

        expect(store.removeItem).toHaveBeenCalledWith('grid-columns-9');
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(fixture.componentInstance.grid().api.applyColumnState).toHaveBeenCalledWith({
            state: [],
            applyOrder: true
        });
    });

    it('removes all event listeners on destroy', async () => {
        const store: KbqAgGridColumnStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        const { fixture } = await render(TestColumnStateGrid, {
            componentProperties: { key: 'grid-columns-10', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.addEventListener).toHaveBeenCalledWith('sortChanged', expect.any(Function));
        });

        // eslint-disable-next-line @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-type-assertion
        const addEventListenerMock = apiMock.api.addEventListener as unknown as jest.MockedFunction<
            typeof apiMock.api.addEventListener
        >;

        const getHandler = (eventName: AgEventType): AnyEventHandler | undefined =>
            addEventListenerMock.mock.calls.find(([name]) => name === eventName)?.[1];

        fixture.destroy();

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(apiMock.api.removeEventListener).toHaveBeenCalledWith('sortChanged', getHandler('sortChanged'));
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(apiMock.api.removeEventListener).toHaveBeenCalledWith('columnMoved', getHandler('columnMoved'));
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(apiMock.api.removeEventListener).toHaveBeenCalledWith('columnVisible', getHandler('columnVisible'));
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(apiMock.api.removeEventListener).toHaveBeenCalledWith('columnResized', getHandler('columnResized'));
    });
});
