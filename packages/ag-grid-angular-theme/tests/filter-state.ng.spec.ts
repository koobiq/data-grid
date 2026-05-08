import { Component, Directive, forwardRef, viewChild } from '@angular/core';
import { render, waitFor } from '@testing-library/angular';
import { AgGridAngular } from 'ag-grid-angular';
import { AgEventType, FilterModel, GridApi } from 'ag-grid-community';
import { Subject } from 'rxjs';
import { KbqAgGridFilterState, KbqAgGridFilterStateStore } from '../src/filter-state.ng';

type FilterChangedHandler = (event: { source?: string }) => void;

const createApiMock = (): { api: GridApi; dispatchFilterChanged: (source?: string) => void } => {
    const listeners = new Map<AgEventType, FilterChangedHandler[]>();
    let model: FilterModel = {};

    const api = {
        addEventListener: jest.fn((eventName: AgEventType, handler: FilterChangedHandler) => {
            const eventListeners = listeners.get(eventName) ?? [];
            eventListeners.push(handler);
            listeners.set(eventName, eventListeners);
        }),
        removeEventListener: jest.fn((eventName: AgEventType, handler: FilterChangedHandler) => {
            const eventListeners = listeners.get(eventName) ?? [];
            listeners.set(
                eventName,
                eventListeners.filter((listener) => listener !== handler)
            );
        }),
        getFilterModel: jest.fn(() => model),
        setFilterModel: jest.fn((nextModel: FilterModel | null) => {
            model = nextModel ?? {};
        })
    };

    const dispatchFilterChanged = (source?: string): void => {
        const eventListeners = listeners.get('filterChanged') ?? [];

        eventListeners.forEach((listener) => listener({ source }));
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return { api: api as unknown as GridApi, dispatchFilterChanged };
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
    selector: 'test-filter-state-grid',
    standalone: true,
    template: `
        <ag-grid-angular [kbqAgGridFilterState]="key" [kbqAgGridFilterStateStore]="store" />
    `,
    imports: [TestAgGridAngularStub, KbqAgGridFilterState]
})
class TestFilterStateGrid {
    key = 'filters';
    store: KbqAgGridFilterStateStore = {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined
    };

    readonly grid = viewChild.required(TestAgGridAngularStub);
    readonly directive = viewChild.required(KbqAgGridFilterState);
}

describe(KbqAgGridFilterState.name, () => {
    it('restores saved model from store on init', async () => {
        const savedModel: FilterModel = {
            athlete: { filterType: 'text', type: 'contains', filter: 'Michael' }
        };
        const store: KbqAgGridFilterStateStore = {
            getItem: jest.fn(() => savedModel),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        const { fixture } = await render(TestFilterStateGrid, {
            componentProperties: { key: 'grid-filters-1', store }
        });

        const grid = fixture.componentInstance.grid();
        grid.emitGridReady();

        await waitFor(() => {
            expect(store.getItem).toHaveBeenCalledWith('grid-filters-1');
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(grid.api.setFilterModel).toHaveBeenCalledWith(savedModel);
        });
    });

    it('does not apply model when store returns null', async () => {
        const store: KbqAgGridFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        const { fixture } = await render(TestFilterStateGrid, {
            componentProperties: { key: 'grid-filters-2', store }
        });

        const grid = fixture.componentInstance.grid();
        grid.emitGridReady();

        await waitFor(() => {
            expect(store.getItem).toHaveBeenCalledWith('grid-filters-2');
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(grid.api.setFilterModel).not.toHaveBeenCalled();
        });
    });

    it('saves model on non-api filterChanged events', async () => {
        const model: FilterModel = {
            athlete: { filterType: 'text', type: 'startsWith', filter: 'Mi' }
        };
        const store: KbqAgGridFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        jest.spyOn(apiMock.api, 'getFilterModel').mockReturnValue(model);

        const { fixture } = await render(TestFilterStateGrid, {
            componentProperties: { key: 'grid-filters-3', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.addEventListener).toHaveBeenCalledWith('filterChanged', expect.any(Function));
        });

        apiMock.dispatchFilterChanged('columnFilter');

        await waitFor(() => {
            expect(store.setItem).toHaveBeenCalledWith('grid-filters-3', model);
            expect(store.removeItem).not.toHaveBeenCalled();
        });
    });

    it('removes model when filterChanged produces an empty model', async () => {
        const store: KbqAgGridFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        jest.spyOn(apiMock.api, 'getFilterModel').mockReturnValue({});

        const { fixture } = await render(TestFilterStateGrid, {
            componentProperties: { key: 'grid-filters-4', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.addEventListener).toHaveBeenCalledWith('filterChanged', expect.any(Function));
        });

        apiMock.dispatchFilterChanged('columnFilter');

        await waitFor(() => {
            expect(store.removeItem).toHaveBeenCalledWith('grid-filters-4');
            expect(store.setItem).not.toHaveBeenCalled();
        });
    });

    it('ignores filterChanged events triggered by api source', async () => {
        const store: KbqAgGridFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        const { fixture } = await render(TestFilterStateGrid, {
            componentProperties: { key: 'grid-filters-5', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);
        apiMock.dispatchFilterChanged('api');

        await waitFor(() => {
            expect(store.setItem).not.toHaveBeenCalled();
            expect(store.removeItem).not.toHaveBeenCalled();
        });
    });

    it('reset removes saved model and clears grid filter model', async () => {
        const store: KbqAgGridFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        const { fixture } = await render(TestFilterStateGrid, {
            componentProperties: { key: 'grid-filters-6', store }
        });

        fixture.componentInstance.directive().reset();

        expect(store.removeItem).toHaveBeenCalledWith('grid-filters-6');
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(fixture.componentInstance.grid().api.setFilterModel).toHaveBeenCalledWith(null);
    });

    it('supports async store methods', async () => {
        const restoredModel: FilterModel = {
            athlete: { filterType: 'text', type: 'contains', filter: 'Phelps' }
        };
        const changedModel: FilterModel = {
            athlete: { filterType: 'text', type: 'equals', filter: 'Phelps' }
        };
        const store: KbqAgGridFilterStateStore = {
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            getItem: jest.fn(() => Promise.resolve(restoredModel)),
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            setItem: jest.fn(() => Promise.resolve(undefined)),
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            removeItem: jest.fn(() => Promise.resolve(undefined))
        };
        const apiMock = createApiMock();

        jest.spyOn(apiMock.api, 'getFilterModel').mockReturnValue(changedModel);

        const { fixture } = await render(TestFilterStateGrid, {
            componentProperties: { key: 'grid-filters-7', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.setFilterModel).toHaveBeenCalledWith(restoredModel);
        });

        apiMock.dispatchFilterChanged('columnFilter');

        await waitFor(() => {
            expect(store.setItem).toHaveBeenCalledWith('grid-filters-7', changedModel);
        });
    });

    it('removes filterChanged listener on destroy', async () => {
        const store: KbqAgGridFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        const { fixture } = await render(TestFilterStateGrid, {
            componentProperties: { key: 'grid-filters-8', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.addEventListener).toHaveBeenCalledWith('filterChanged', expect.any(Function));
        });

        // eslint-disable-next-line @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-type-assertion
        const addEventListenerMock = apiMock.api.addEventListener as unknown as jest.MockedFunction<
            typeof apiMock.api.addEventListener
        >;
        const handler = addEventListenerMock.mock.calls.find(([eventName]) => eventName === 'filterChanged')?.[1];

        fixture.destroy();

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(apiMock.api.removeEventListener).toHaveBeenCalledWith('filterChanged', handler);
    });
});
