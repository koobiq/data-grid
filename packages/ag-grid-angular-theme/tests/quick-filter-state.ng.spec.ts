import { Component, Directive, forwardRef, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
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

@Component({
    selector: 'test-quick-filter-state-grid-restored',
    standalone: true,
    template: `
        <ag-grid-angular
            [kbqAgGridQuickFilterState]="key"
            [kbqAgGridQuickFilterStateStore]="store"
            (kbqAgGridQuickFilterStateRestored)="onRestored($event)"
        />
    `,
    imports: [TestAgGridAngularStub, KbqAgGridQuickFilterState]
})
class TestQuickFilterStateGridWithRestoredOutput {
    key = 'quick-filter';
    store: KbqAgGridQuickFilterStateStore = {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined
    };
    onRestored = jest.fn();
    readonly grid = viewChild.required(TestAgGridAngularStub);
}

@Component({
    selector: 'test-quick-filter-state-grid-model-binding',
    standalone: true,
    template: `
        <ag-grid-angular
            [kbqAgGridQuickFilterState]="key"
            [kbqAgGridQuickFilterStateStore]="store"
            [(kbqAgGridQuickFilterStateValue)]="filterText"
        />
    `,
    imports: [TestAgGridAngularStub, KbqAgGridQuickFilterState]
})
class TestQuickFilterStateGridModelBinding {
    key = 'quick-filter';
    store: KbqAgGridQuickFilterStateStore = {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined
    };
    filterText = signal('');

    readonly grid = viewChild.required(TestAgGridAngularStub);
    readonly directive = viewChild.required(KbqAgGridQuickFilterState);
}

@Component({
    selector: 'test-quick-filter-state-grid-reactive-forms',
    standalone: true,
    template: `
        <ag-grid-angular
            [kbqAgGridQuickFilterState]="key"
            [kbqAgGridQuickFilterStateStore]="store"
            [kbqAgGridQuickFilterStateValue]="filterValue()"
            (kbqAgGridQuickFilterStateValueChange)="control.setValue($event)"
            (kbqAgGridQuickFilterStateRestored)="control.setValue($event)"
        />
    `,
    imports: [TestAgGridAngularStub, KbqAgGridQuickFilterState]
})
class TestQuickFilterStateGridReactiveForms {
    key = 'quick-filter';
    store: KbqAgGridQuickFilterStateStore = {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined
    };
    readonly control = new FormControl('', { nonNullable: true });
    readonly filterValue = toSignal(this.control.valueChanges, { initialValue: '' });

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

        fixture.componentInstance.grid().emitGridReady();

        await waitFor(() => {
            expect(store.getItem).toHaveBeenCalledWith('qf-1');
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(fixture.componentInstance.grid().api.setGridOption).toHaveBeenCalledWith(
                'quickFilterText',
                'Michael'
            );
            expect(fixture.componentInstance.directive().value()).toBe('Michael');
        });
    });

    it('does not apply non-empty text to grid when store returns null', async () => {
        const store: KbqAgGridQuickFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        const { fixture } = await render(TestQuickFilterStateGrid, {
            componentProperties: { key: 'qf-2', store }
        });

        fixture.componentInstance.grid().emitGridReady();

        await waitFor(() => expect(store.getItem).toHaveBeenCalledWith('qf-2'));

        // The effect fires with value='' on api init, but must never set a non-empty value
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(fixture.componentInstance.grid().api.setGridOption).not.toHaveBeenCalledWith(
            'quickFilterText',
            expect.stringMatching(/.+/)
        );
        expect(fixture.componentInstance.directive().value()).toBe('');
    });

    it('emits restored output with the stored value on init', async () => {
        const store: KbqAgGridQuickFilterStateStore = {
            getItem: jest.fn(() => 'Michael'),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        const { fixture } = await render(TestQuickFilterStateGridWithRestoredOutput, {
            componentProperties: { key: 'qf-3', store }
        });

        fixture.componentInstance.grid().emitGridReady();

        await waitFor(() => {
            expect(fixture.componentInstance.onRestored).toHaveBeenCalledWith('Michael');
        });
    });

    it('does not emit restored output when store returns null', async () => {
        const store: KbqAgGridQuickFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        const { fixture } = await render(TestQuickFilterStateGridWithRestoredOutput, {
            componentProperties: { key: 'qf-4', store }
        });

        fixture.componentInstance.grid().emitGridReady();

        await waitFor(() => expect(store.getItem).toHaveBeenCalled());

        expect(fixture.componentInstance.onRestored).not.toHaveBeenCalled();
    });

    it('saves text to store when value changes', async () => {
        const store: KbqAgGridQuickFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        const { fixture } = await render(TestQuickFilterStateGrid, {
            componentProperties: { key: 'qf-5', store }
        });

        const grid = fixture.componentInstance.grid();
        grid.emitGridReady();

        await waitFor(() => expect(store.getItem).toHaveBeenCalled());

        fixture.componentInstance.directive().value.set('test query');

        await waitFor(() => {
            expect(store.setItem).toHaveBeenCalledWith('qf-5', 'test query');
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(grid.api.setGridOption).toHaveBeenCalledWith('quickFilterText', 'test query');
        });
    });

    it('removes item from store when value is cleared', async () => {
        const store: KbqAgGridQuickFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        const { fixture } = await render(TestQuickFilterStateGrid, {
            componentProperties: { key: 'qf-6', store }
        });

        const grid = fixture.componentInstance.grid();
        grid.emitGridReady();

        await waitFor(() => expect(store.getItem).toHaveBeenCalled());

        fixture.componentInstance.directive().value.set('test');
        await waitFor(() => expect(store.setItem).toHaveBeenCalled());

        jest.clearAllMocks();

        fixture.componentInstance.directive().value.set('');

        await waitFor(() => {
            expect(store.removeItem).toHaveBeenCalledWith('qf-6');
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(grid.api.setGridOption).toHaveBeenCalledWith('quickFilterText', '');
        });
    });

    it('updates value when filterChanged fires with quickFilter source', async () => {
        const store: KbqAgGridQuickFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        jest.spyOn(apiMock.api, 'getQuickFilter').mockReturnValue('hello');

        const { fixture } = await render(TestQuickFilterStateGrid, {
            componentProperties: { key: 'qf-7', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.addEventListener).toHaveBeenCalledWith('filterChanged', expect.any(Function));
        });

        apiMock.dispatchFilterChanged('quickFilter');

        await waitFor(() => {
            expect(fixture.componentInstance.directive().value()).toBe('hello');
        });
    });

    it('does not update value when filterChanged fires with non-quickFilter source', async () => {
        const store: KbqAgGridQuickFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        const { fixture } = await render(TestQuickFilterStateGrid, {
            componentProperties: { key: 'qf-8', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.addEventListener).toHaveBeenCalledWith('filterChanged', expect.any(Function));
        });

        apiMock.dispatchFilterChanged('api');
        apiMock.dispatchFilterChanged('columnFilter');

        expect(fixture.componentInstance.directive().value()).toBe('');
    });

    it('reset clears grid filter and removes stored state', async () => {
        const store: KbqAgGridQuickFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        const { fixture } = await render(TestQuickFilterStateGrid, {
            componentProperties: { key: 'qf-9', store }
        });

        const grid = fixture.componentInstance.grid();
        grid.emitGridReady();

        await waitFor(() => expect(store.getItem).toHaveBeenCalled());

        fixture.componentInstance.directive().value.set('some text');
        await waitFor(() => expect(store.setItem).toHaveBeenCalled());

        jest.clearAllMocks();

        fixture.componentInstance.directive().reset();

        await waitFor(() => {
            expect(store.removeItem).toHaveBeenCalledWith('qf-9');
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(grid.api.setGridOption).toHaveBeenCalledWith('quickFilterText', '');
            expect(fixture.componentInstance.directive().value()).toBe('');
        });
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

        const { fixture } = await render(TestQuickFilterStateGrid, {
            componentProperties: { key: 'qf-10', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.setGridOption).toHaveBeenCalledWith('quickFilterText', 'Phelps');
        });

        fixture.componentInstance.directive().value.set('Phelps updated');

        await waitFor(() => {
            expect(store.setItem).toHaveBeenCalledWith('qf-10', 'Phelps updated');
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
            componentProperties: { key: 'qf-11', store }
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

    describe('two-way model binding', () => {
        it('external signal change updates grid filter', async () => {
            const store: KbqAgGridQuickFilterStateStore = {
                getItem: jest.fn(() => null),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };
            const apiMock = createApiMock();

            const { fixture } = await render(TestQuickFilterStateGridModelBinding, {
                componentProperties: { key: 'qf-model-1', store }
            });

            fixture.componentInstance.grid().emitGridReady(apiMock.api);

            await waitFor(() => expect(store.getItem).toHaveBeenCalled());

            jest.clearAllMocks();

            fixture.componentInstance.filterText.set('Phelps');

            await waitFor(() => {
                expect(fixture.componentInstance.directive().value()).toBe('Phelps');
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(apiMock.api.setGridOption).toHaveBeenCalledWith('quickFilterText', 'Phelps');
            });
        });

        it('filterChanged with quickFilter source updates external signal', async () => {
            const store: KbqAgGridQuickFilterStateStore = {
                getItem: jest.fn(() => null),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };
            const apiMock = createApiMock();

            jest.spyOn(apiMock.api, 'getQuickFilter').mockReturnValue('Bolt');

            const { fixture } = await render(TestQuickFilterStateGridModelBinding, {
                componentProperties: { key: 'qf-model-2', store }
            });

            fixture.componentInstance.grid().emitGridReady(apiMock.api);

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(apiMock.api.addEventListener).toHaveBeenCalledWith('filterChanged', expect.any(Function));
            });

            apiMock.dispatchFilterChanged('quickFilter');

            await waitFor(() => {
                expect(fixture.componentInstance.filterText()).toBe('Bolt');
            });
        });
    });

    describe('reactive forms', () => {
        it('FormControl value change updates grid filter', async () => {
            const store: KbqAgGridQuickFilterStateStore = {
                getItem: jest.fn(() => null),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };
            const apiMock = createApiMock();

            const { fixture } = await render(TestQuickFilterStateGridReactiveForms, {
                componentProperties: { key: 'qf-rf-1', store }
            });

            fixture.componentInstance.grid().emitGridReady(apiMock.api);

            await waitFor(() => expect(store.getItem).toHaveBeenCalled());

            jest.clearAllMocks();

            fixture.componentInstance.control.setValue('Phelps');

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(apiMock.api.setGridOption).toHaveBeenCalledWith('quickFilterText', 'Phelps');
            });
        });

        it('restored output syncs FormControl on init', async () => {
            const store: KbqAgGridQuickFilterStateStore = {
                getItem: jest.fn(() => 'Michael'),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };

            const { fixture } = await render(TestQuickFilterStateGridReactiveForms, {
                componentProperties: { key: 'qf-rf-2', store }
            });

            fixture.componentInstance.grid().emitGridReady();

            await waitFor(() => {
                expect(fixture.componentInstance.control.value).toBe('Michael');
            });
        });

        it('kbqAgGridQuickFilterStateValueChange syncs FormControl when directive value changes', async () => {
            const store: KbqAgGridQuickFilterStateStore = {
                getItem: jest.fn(() => null),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };
            const apiMock = createApiMock();

            jest.spyOn(apiMock.api, 'getQuickFilter').mockReturnValue('Bolt');

            const { fixture } = await render(TestQuickFilterStateGridReactiveForms, {
                componentProperties: { key: 'qf-rf-3', store }
            });

            fixture.componentInstance.grid().emitGridReady(apiMock.api);

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(apiMock.api.addEventListener).toHaveBeenCalledWith('filterChanged', expect.any(Function));
            });

            apiMock.dispatchFilterChanged('quickFilter');

            await waitFor(() => {
                expect(fixture.componentInstance.control.value).toBe('Bolt');
            });
        });
    });
});
