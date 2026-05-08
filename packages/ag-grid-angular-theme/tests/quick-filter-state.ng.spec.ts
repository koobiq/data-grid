import { Component, Directive, forwardRef, viewChild } from '@angular/core';
import { render, waitFor } from '@testing-library/angular';
import { AgGridAngular } from 'ag-grid-angular';
import { AgEventType, GridApi } from 'ag-grid-community';
import { Subject } from 'rxjs';
import { KbqAgGridQuickFilterState, KbqAgGridQuickFilterStateStore } from '../src/quick-filter-state.ng';

type FilterChangedHandler = (event: { source?: string }) => void;

const createApiMock = (): { api: GridApi; dispatchFilterChanged: (source?: string) => void } => {
    const listeners = new Map<AgEventType, FilterChangedHandler[]>();
    let quickFilterText = '';

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
        getQuickFilter: jest.fn((): string | undefined => quickFilterText || undefined),
        setGridOption: jest.fn((option: string, value: unknown) => {
            if (option === 'quickFilterText') {
                quickFilterText = typeof value === 'string' ? value : '';
            }
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
    selector: 'test-quick-filter-state-grid',
    standalone: true,
    template: `
        <ag-grid-angular [kbqAgGridQuickFilterState]="key" [kbqAgGridQuickFilterStateStore]="store" />
    `,
    imports: [TestAgGridAngularStub, KbqAgGridQuickFilterState]
})
class TestQuickFilterStateGrid {
    key = 'quick-filter';
    store: KbqAgGridQuickFilterStateStore = {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined
    };

    readonly grid = viewChild.required(TestAgGridAngularStub);
    readonly directive = viewChild.required(KbqAgGridQuickFilterState);
}

describe(KbqAgGridQuickFilterState.name, () => {
    it('restores saved text from store on init', async () => {
        const store: KbqAgGridQuickFilterStateStore = {
            getItem: jest.fn(() => 'Michael'),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        const { fixture } = await render(TestQuickFilterStateGrid, {
            componentProperties: { key: 'qf-1', store }
        });

        const grid = fixture.componentInstance.grid();
        grid.emitGridReady();

        await waitFor(() => {
            expect(store.getItem).toHaveBeenCalledWith('qf-1');
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(grid.api.setGridOption).toHaveBeenCalledWith('quickFilterText', 'Michael');
            expect(fixture.componentInstance.directive().value()).toBe('Michael');
        });
    });

    it('does not apply text when store returns null', async () => {
        const store: KbqAgGridQuickFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        const { fixture } = await render(TestQuickFilterStateGrid, {
            componentProperties: { key: 'qf-2', store }
        });

        const grid = fixture.componentInstance.grid();
        grid.emitGridReady();

        await waitFor(() => {
            expect(store.getItem).toHaveBeenCalledWith('qf-2');
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(grid.api.setGridOption).not.toHaveBeenCalled();
        });
    });

    it('saves text on non-api filterChanged events', async () => {
        const store: KbqAgGridQuickFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        jest.spyOn(apiMock.api, 'getQuickFilter').mockReturnValue('test query');

        const { fixture } = await render(TestQuickFilterStateGrid, {
            componentProperties: { key: 'qf-3', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.addEventListener).toHaveBeenCalledWith('filterChanged', expect.any(Function));
        });

        apiMock.dispatchFilterChanged('columnFilter');

        await waitFor(() => {
            expect(store.setItem).toHaveBeenCalledWith('qf-3', 'test query');
            expect(store.removeItem).not.toHaveBeenCalled();
        });
    });

    it('removes item when filterChanged produces empty text', async () => {
        const store: KbqAgGridQuickFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        jest.spyOn(apiMock.api, 'getQuickFilter').mockReturnValue(undefined);

        const { fixture } = await render(TestQuickFilterStateGrid, {
            componentProperties: { key: 'qf-4', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.addEventListener).toHaveBeenCalledWith('filterChanged', expect.any(Function));
        });

        apiMock.dispatchFilterChanged('columnFilter');

        await waitFor(() => {
            expect(store.removeItem).toHaveBeenCalledWith('qf-4');
            expect(store.setItem).not.toHaveBeenCalled();
        });
    });

    it('ignores filterChanged events triggered by api source', async () => {
        const store: KbqAgGridQuickFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        const { fixture } = await render(TestQuickFilterStateGrid, {
            componentProperties: { key: 'qf-5', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);
        apiMock.dispatchFilterChanged('api');

        await waitFor(() => {
            expect(store.setItem).not.toHaveBeenCalled();
            expect(store.removeItem).not.toHaveBeenCalled();
        });
    });

    it('updates value signal on filterChanged', async () => {
        const store: KbqAgGridQuickFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        jest.spyOn(apiMock.api, 'getQuickFilter').mockReturnValue('hello');

        const { fixture } = await render(TestQuickFilterStateGrid, {
            componentProperties: { key: 'qf-6', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.addEventListener).toHaveBeenCalledWith('filterChanged', expect.any(Function));
        });

        apiMock.dispatchFilterChanged('columnFilter');

        await waitFor(() => {
            expect(fixture.componentInstance.directive().value()).toBe('hello');
        });
    });

    it('reset removes stored state, clears grid filter, and resets value signal', async () => {
        const store: KbqAgGridQuickFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        const { fixture } = await render(TestQuickFilterStateGrid, {
            componentProperties: { key: 'qf-7', store }
        });

        fixture.componentInstance.directive().reset();

        expect(store.removeItem).toHaveBeenCalledWith('qf-7');
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(fixture.componentInstance.grid().api.setGridOption).toHaveBeenCalledWith('quickFilterText', '');
        expect(fixture.componentInstance.directive().value()).toBe('');
    });

    it('supports async store methods', async () => {
        const store: KbqAgGridQuickFilterStateStore = {
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            getItem: jest.fn(() => Promise.resolve('Phelps')),
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            setItem: jest.fn(() => Promise.resolve(undefined)),
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            removeItem: jest.fn(() => Promise.resolve(undefined))
        };
        const apiMock = createApiMock();

        jest.spyOn(apiMock.api, 'getQuickFilter').mockReturnValue('Phelps updated');

        const { fixture } = await render(TestQuickFilterStateGrid, {
            componentProperties: { key: 'qf-8', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.setGridOption).toHaveBeenCalledWith('quickFilterText', 'Phelps');
        });

        apiMock.dispatchFilterChanged('columnFilter');

        await waitFor(() => {
            expect(store.setItem).toHaveBeenCalledWith('qf-8', 'Phelps updated');
        });
    });

    it('removes filterChanged listener on destroy', async () => {
        const store: KbqAgGridQuickFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        const { fixture } = await render(TestQuickFilterStateGrid, {
            componentProperties: { key: 'qf-9', store }
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
