import { Component, Directive, forwardRef, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { render, waitFor } from '@testing-library/angular';
import { AgGridAngular } from 'ag-grid-angular';
import { GridApi, IRowNode } from 'ag-grid-community';
import { Subject } from 'rxjs';
import { KbqAgGridExternalFilterState, KbqAgGridExternalFilterStateStore } from '../src/external-filter-state.ng';

const createApiMock = (): { api: GridApi } => {
    const api = {
        onFilterChanged: jest.fn(),
        setGridOption: jest.fn()
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return { api: api as unknown as GridApi };
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
    selector: 'test-external-filter-state-grid',
    standalone: true,
    template: `
        <ag-grid-angular
            [kbqAgGridExternalFilterState]="key"
            [kbqAgGridExternalFilterStateStore]="store"
            [kbqAgGridExternalFilterStatePass]="filterPass"
        />
    `,
    imports: [TestAgGridAngularStub, KbqAgGridExternalFilterState]
})
class TestExternalFilterStateGrid {
    key = 'external-filter';
    store: KbqAgGridExternalFilterStateStore = {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined
    };
    filterPass = (_node: IRowNode): boolean => true;

    readonly grid = viewChild.required(TestAgGridAngularStub);
    readonly directive = viewChild.required(KbqAgGridExternalFilterState);
}

@Component({
    selector: 'test-external-filter-state-grid-restored',
    standalone: true,
    template: `
        <ag-grid-angular
            [kbqAgGridExternalFilterState]="key"
            [kbqAgGridExternalFilterStateStore]="store"
            [kbqAgGridExternalFilterStatePass]="filterPass"
            (kbqAgGridExternalFilterStateRestored)="onRestored($event)"
        />
    `,
    imports: [TestAgGridAngularStub, KbqAgGridExternalFilterState]
})
class TestExternalFilterStateGridWithRestoredOutput {
    key = 'external-filter';
    store: KbqAgGridExternalFilterStateStore = {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined
    };
    filterPass = (_node: IRowNode): boolean => true;
    onRestored = jest.fn();

    readonly grid = viewChild.required(TestAgGridAngularStub);
}

@Component({
    selector: 'test-external-filter-state-grid-model-binding',
    standalone: true,
    template: `
        <ag-grid-angular
            [kbqAgGridExternalFilterState]="key"
            [kbqAgGridExternalFilterStateStore]="store"
            [kbqAgGridExternalFilterStatePass]="filterPass"
            [(kbqAgGridExternalFilterStateValue)]="filterValue"
        />
    `,
    imports: [TestAgGridAngularStub, KbqAgGridExternalFilterState]
})
class TestExternalFilterStateGridModelBinding {
    key = 'external-filter';
    store: KbqAgGridExternalFilterStateStore = {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined
    };
    filterPass = (_node: IRowNode): boolean => true;
    filterValue = signal<string | null>(null);

    readonly grid = viewChild.required(TestAgGridAngularStub);
    readonly directive = viewChild.required(KbqAgGridExternalFilterState);
}

@Component({
    selector: 'test-external-filter-state-grid-reactive-forms',
    standalone: true,
    template: `
        <ag-grid-angular
            [kbqAgGridExternalFilterState]="key"
            [kbqAgGridExternalFilterStateStore]="store"
            [kbqAgGridExternalFilterStatePass]="filterPass"
            [kbqAgGridExternalFilterStateValue]="filterValue()"
            (kbqAgGridExternalFilterStateRestored)="onRestored($event)"
        />
    `,
    imports: [TestAgGridAngularStub, KbqAgGridExternalFilterState]
})
class TestExternalFilterStateGridReactiveForms {
    key = 'external-filter';
    store: KbqAgGridExternalFilterStateStore = {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined
    };
    filterPass = (_node: IRowNode): boolean => true;
    readonly control = new FormControl<string | null>(null);
    readonly filterValue = toSignal(this.control.valueChanges, { initialValue: null });

    readonly grid = viewChild.required(TestAgGridAngularStub);
    readonly directive = viewChild.required(KbqAgGridExternalFilterState);

    onRestored(value: unknown): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        this.control.setValue(value as string | null);
    }
}

describe(KbqAgGridExternalFilterState.name, () => {
    it('restores saved value from store on init', async () => {
        const store: KbqAgGridExternalFilterStateStore = {
            getItem: jest.fn(() => 'Swimming'),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        const { fixture } = await render(TestExternalFilterStateGrid, {
            componentProperties: { key: 'ef-1', store }
        });

        const grid = fixture.componentInstance.grid();
        grid.emitGridReady();

        await waitFor(() => {
            expect(store.getItem).toHaveBeenCalledWith('ef-1');
            expect(fixture.componentInstance.directive().value()).toBe('Swimming');
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(grid.api.onFilterChanged).toHaveBeenCalled();
        });
    });

    it('does not apply value when store returns null', async () => {
        const store: KbqAgGridExternalFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        const { fixture } = await render(TestExternalFilterStateGrid, {
            componentProperties: { key: 'ef-2', store }
        });

        const grid = fixture.componentInstance.grid();
        grid.emitGridReady();

        await waitFor(() => {
            expect(store.getItem).toHaveBeenCalledWith('ef-2');
            expect(fixture.componentInstance.directive().value()).toBeNull();
        });

        expect(store.setItem).not.toHaveBeenCalled();
    });

    it('emits restored output with the stored value on init', async () => {
        const store: KbqAgGridExternalFilterStateStore = {
            getItem: jest.fn(() => 'Swimming'),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        const { fixture } = await render(TestExternalFilterStateGridWithRestoredOutput, {
            componentProperties: { key: 'ef-3', store }
        });

        fixture.componentInstance.grid().emitGridReady();

        await waitFor(() => {
            expect(fixture.componentInstance.onRestored).toHaveBeenCalledWith('Swimming');
        });
    });

    it('does not emit restored output when store returns null', async () => {
        const store: KbqAgGridExternalFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        const { fixture } = await render(TestExternalFilterStateGridWithRestoredOutput, {
            componentProperties: { key: 'ef-4', store }
        });

        fixture.componentInstance.grid().emitGridReady();

        await waitFor(() => expect(store.getItem).toHaveBeenCalled());

        expect(fixture.componentInstance.onRestored).not.toHaveBeenCalled();
    });

    it('wires isExternalFilterPresent and doesExternalFilterPass into the grid', async () => {
        const store: KbqAgGridExternalFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        const { fixture } = await render(TestExternalFilterStateGrid, {
            componentProperties: { key: 'ef-5', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.setGridOption).toHaveBeenCalledWith('isExternalFilterPresent', expect.any(Function));
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.setGridOption).toHaveBeenCalledWith('doesExternalFilterPass', expect.any(Function));
        });
    });

    it('value.set() persists value to store and calls onFilterChanged', async () => {
        const store: KbqAgGridExternalFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        const { fixture } = await render(TestExternalFilterStateGrid, {
            componentProperties: { key: 'ef-6', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => expect(store.getItem).toHaveBeenCalled());

        jest.clearAllMocks();

        fixture.componentInstance.directive().value.set('Gymnastics');

        await waitFor(() => {
            expect(store.setItem).toHaveBeenCalledWith('ef-6', 'Gymnastics');
            expect(fixture.componentInstance.directive().value()).toBe('Gymnastics');
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.onFilterChanged).toHaveBeenCalled();
        });
    });

    it('value.set(null) removes value from store and calls onFilterChanged', async () => {
        const store: KbqAgGridExternalFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        const { fixture } = await render(TestExternalFilterStateGrid, {
            componentProperties: { key: 'ef-7', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => expect(store.getItem).toHaveBeenCalled());

        fixture.componentInstance.directive().value.set('Swimming');
        await waitFor(() => expect(store.setItem).toHaveBeenCalled());

        jest.clearAllMocks();

        fixture.componentInstance.directive().value.set(null);

        await waitFor(() => {
            expect(store.removeItem).toHaveBeenCalledWith('ef-7');
            expect(store.setItem).not.toHaveBeenCalled();
            expect(fixture.componentInstance.directive().value()).toBeNull();
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.onFilterChanged).toHaveBeenCalled();
        });
    });

    it('value.set() before gridReady does not call onFilterChanged or persist to store', async () => {
        const store: KbqAgGridExternalFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        const { fixture } = await render(TestExternalFilterStateGrid, {
            componentProperties: { key: 'ef-8', store }
        });

        fixture.componentInstance.directive().value.set('Swimming');

        expect(fixture.componentInstance.directive().value()).toBe('Swimming');
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(fixture.componentInstance.grid().api.onFilterChanged).not.toHaveBeenCalled();
        expect(store.setItem).not.toHaveBeenCalled();
    });

    it('reset() clears value, removes stored state, and calls onFilterChanged', async () => {
        const store: KbqAgGridExternalFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        const { fixture } = await render(TestExternalFilterStateGrid, {
            componentProperties: { key: 'ef-9', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => expect(store.getItem).toHaveBeenCalled());

        fixture.componentInstance.directive().value.set('Gymnastics');
        await waitFor(() => expect(store.setItem).toHaveBeenCalled());

        jest.clearAllMocks();

        fixture.componentInstance.directive().reset();

        await waitFor(() => {
            expect(store.removeItem).toHaveBeenCalledWith('ef-9');
            expect(fixture.componentInstance.directive().value()).toBeNull();
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.onFilterChanged).toHaveBeenCalled();
        });
    });

    it('supports async store methods', async () => {
        const store: KbqAgGridExternalFilterStateStore = {
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            getItem: jest.fn(() => Promise.resolve('Speed Skating')),
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            setItem: jest.fn(() => Promise.resolve(undefined)),
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            removeItem: jest.fn(() => Promise.resolve(undefined))
        };
        const apiMock = createApiMock();

        const { fixture } = await render(TestExternalFilterStateGrid, {
            componentProperties: { key: 'ef-10', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            expect(fixture.componentInstance.directive().value()).toBe('Speed Skating');
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.onFilterChanged).toHaveBeenCalled();
        });

        fixture.componentInstance.directive().value.set('Gymnastics');

        await waitFor(() => {
            expect(store.setItem).toHaveBeenCalledWith('ef-10', 'Gymnastics');
        });
    });

    describe('two-way model binding', () => {
        it('external signal change updates filter and calls onFilterChanged', async () => {
            const store: KbqAgGridExternalFilterStateStore = {
                getItem: jest.fn(() => null),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };
            const apiMock = createApiMock();

            const { fixture } = await render(TestExternalFilterStateGridModelBinding, {
                componentProperties: { key: 'ef-model-1', store }
            });

            fixture.componentInstance.grid().emitGridReady(apiMock.api);

            await waitFor(() => expect(store.getItem).toHaveBeenCalled());

            jest.clearAllMocks();

            fixture.componentInstance.filterValue.set('Swimming');

            await waitFor(() => {
                expect(fixture.componentInstance.directive().value()).toBe('Swimming');
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(apiMock.api.onFilterChanged).toHaveBeenCalled();
                expect(store.setItem).toHaveBeenCalledWith('ef-model-1', 'Swimming');
            });
        });

        it('reset propagates null back to external signal', async () => {
            const store: KbqAgGridExternalFilterStateStore = {
                getItem: jest.fn(() => null),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };
            const apiMock = createApiMock();

            const { fixture } = await render(TestExternalFilterStateGridModelBinding, {
                componentProperties: { key: 'ef-model-2', store }
            });

            fixture.componentInstance.grid().emitGridReady(apiMock.api);

            await waitFor(() => expect(store.getItem).toHaveBeenCalled());

            fixture.componentInstance.filterValue.set('Swimming');
            await waitFor(() => expect(store.setItem).toHaveBeenCalled());

            fixture.componentInstance.directive().reset();

            await waitFor(() => {
                expect(fixture.componentInstance.filterValue()).toBeNull();
            });
        });
    });

    describe('reactive forms', () => {
        it('FormControl value change updates filter and calls onFilterChanged', async () => {
            const store: KbqAgGridExternalFilterStateStore = {
                getItem: jest.fn(() => null),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };
            const apiMock = createApiMock();

            const { fixture } = await render(TestExternalFilterStateGridReactiveForms, {
                componentProperties: { key: 'ef-rf-1', store }
            });

            fixture.componentInstance.grid().emitGridReady(apiMock.api);

            await waitFor(() => expect(store.getItem).toHaveBeenCalled());

            jest.clearAllMocks();

            fixture.componentInstance.control.setValue('Swimming');

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(apiMock.api.onFilterChanged).toHaveBeenCalled();
                expect(store.setItem).toHaveBeenCalledWith('ef-rf-1', 'Swimming');
            });
        });

        it('restored output syncs FormControl on init', async () => {
            const store: KbqAgGridExternalFilterStateStore = {
                getItem: jest.fn(() => 'Swimming'),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };

            const { fixture } = await render(TestExternalFilterStateGridReactiveForms, {
                componentProperties: { key: 'ef-rf-2', store }
            });

            fixture.componentInstance.grid().emitGridReady();

            await waitFor(() => {
                expect(fixture.componentInstance.control.value).toBe('Swimming');
            });
        });
    });
});
