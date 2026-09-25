import { Component, Directive, forwardRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { render, waitFor } from '@testing-library/angular';
import { AgGridAngular } from 'ag-grid-angular';
import { AgEventType, ColumnState, GridApi } from 'ag-grid-community';
import { Subject } from 'rxjs';
import {
    KBQ_AG_GRID_COLUMN_STATE_STORE,
    KbqAgGridColumnState,
    KbqAgGridColumnStateLocalStorageStore,
    KbqAgGridColumnStateQueryParamsStore,
    KbqAgGridColumnStateStore,
    kbqAgGridColumnStateStoreProvider
} from '../src/column-state.ng';

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

describe('KbqAgGridColumnState', () => {
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

    describe('built-in stores', () => {
        const navigate = jest.fn();
        const STATE_KEY = 'built-in-columns-state-key';
        const STATE: ColumnState[] = [{ colId: 'name', width: 200 }];
        const STATE_JSON = '[{"colId":"name","width":200}]';

        beforeEach(() => {
            navigate.mockClear();
            localStorage.clear();
            window.history.replaceState({}, '', '/');
        });

        afterEach(() => {
            localStorage.clear();
            window.history.replaceState({}, '', '/');
        });

        describe('KbqAgGridColumnStateLocalStorageStore', () => {
            const makeStore = (): KbqAgGridColumnStateLocalStorageStore =>
                TestBed.inject(KbqAgGridColumnStateLocalStorageStore);

            it('writes the column state as json', () => {
                makeStore().setItem(STATE_KEY, STATE);

                expect(localStorage.getItem(STATE_KEY)).toBe(STATE_JSON);
            });

            it('reads the column state back', () => {
                localStorage.setItem(STATE_KEY, STATE_JSON);

                expect(makeStore().getItem(STATE_KEY)).toEqual(STATE);
            });

            it('returns null when nothing is stored', () => {
                expect(makeStore().getItem(STATE_KEY)).toBeNull();
            });

            it('returns null for a malformed stored value', () => {
                localStorage.setItem(STATE_KEY, 'not json');

                expect(makeStore().getItem(STATE_KEY)).toBeNull();
            });

            it('removes the stored value', () => {
                localStorage.setItem(STATE_KEY, STATE_JSON);
                makeStore().removeItem(STATE_KEY);

                expect(localStorage.getItem(STATE_KEY)).toBeNull();
            });
        });

        describe('KbqAgGridColumnStateQueryParamsStore', () => {
            const makeStore = (): KbqAgGridColumnStateQueryParamsStore => {
                TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: { navigate } }] });

                return TestBed.inject(KbqAgGridColumnStateQueryParamsStore);
            };

            it('reads the column state from the query string', () => {
                window.history.replaceState({}, '', `/?${STATE_KEY}=${encodeURIComponent(STATE_JSON)}`);

                expect(makeStore().getItem(STATE_KEY)).toEqual(STATE);
            });

            it('returns null when the query param is absent', () => {
                expect(makeStore().getItem(STATE_KEY)).toBeNull();
            });

            it('returns null for a malformed query param', () => {
                window.history.replaceState({}, '', `/?${STATE_KEY}=not-json`);

                expect(makeStore().getItem(STATE_KEY)).toBeNull();
            });

            it('writes the column state into the query string', async () => {
                await makeStore().setItem(STATE_KEY, STATE);

                expect(navigate).toHaveBeenCalledWith([], {
                    queryParams: { [STATE_KEY]: STATE_JSON },
                    queryParamsHandling: 'merge',
                    replaceUrl: true
                });
            });

            it('omits null and false column state values to keep the query string short', async () => {
                await makeStore().setItem(STATE_KEY, [
                    { colId: 'name', width: 200, sort: null, hide: false, pinned: 'left' }
                ]);

                expect(navigate).toHaveBeenCalledWith([], {
                    queryParams: { [STATE_KEY]: '[{"colId":"name","width":200,"pinned":"left"}]' },
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
                expect(TestBed.inject(KBQ_AG_GRID_COLUMN_STATE_STORE)).toBeInstanceOf(
                    KbqAgGridColumnStateLocalStorageStore
                );
            });

            it('binds the store class passed to kbqAgGridColumnStateStoreProvider', () => {
                TestBed.configureTestingModule({
                    providers: [
                        { provide: Router, useValue: { navigate } },
                        kbqAgGridColumnStateStoreProvider(KbqAgGridColumnStateQueryParamsStore)
                    ]
                });

                expect(TestBed.inject(KBQ_AG_GRID_COLUMN_STATE_STORE)).toBeInstanceOf(
                    KbqAgGridColumnStateQueryParamsStore
                );
            });

            it('binds the store instance passed to kbqAgGridColumnStateStoreProvider', () => {
                const store: KbqAgGridColumnStateStore = {
                    getItem: () => null,
                    setItem: () => undefined,
                    removeItem: () => undefined
                };

                TestBed.configureTestingModule({ providers: [kbqAgGridColumnStateStoreProvider(store)] });

                expect(TestBed.inject(KBQ_AG_GRID_COLUMN_STATE_STORE)).toBe(store);
            });
        });
    });
});
