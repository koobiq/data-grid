import { Component, Directive, forwardRef, viewChild } from '@angular/core';
import { render, waitFor } from '@testing-library/angular';
import { AgGridAngular } from 'ag-grid-angular';
import { GridApi } from 'ag-grid-community';
import { Subject } from 'rxjs';
import { KbqAgGridExternalFilterState, KbqAgGridExternalFilterStateStore } from '../src/external-filter-state.ng';

const createApiMock = (): { api: GridApi } => {
    const api = {
        onFilterChanged: jest.fn()
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
        <ag-grid-angular [kbqAgGridExternalFilterState]="key" [kbqAgGridExternalFilterStateStore]="store" />
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

    readonly grid = viewChild.required(TestAgGridAngularStub);
    readonly directive = viewChild.required(KbqAgGridExternalFilterState);
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
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(grid.api.onFilterChanged).not.toHaveBeenCalled();
        });
    });

    it('set() persists value to store, updates signal, and calls onFilterChanged', async () => {
        const store: KbqAgGridExternalFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        const { fixture } = await render(TestExternalFilterStateGrid, {
            componentProperties: { key: 'ef-3', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => expect(store.getItem).toHaveBeenCalled());

        fixture.componentInstance.directive().set('Gymnastics');

        expect(store.setItem).toHaveBeenCalledWith('ef-3', 'Gymnastics');
        expect(fixture.componentInstance.directive().value()).toBe('Gymnastics');
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(apiMock.api.onFilterChanged).toHaveBeenCalled();
    });

    it('set(null) removes value from store, clears signal, and calls onFilterChanged', async () => {
        const store: KbqAgGridExternalFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const apiMock = createApiMock();

        const { fixture } = await render(TestExternalFilterStateGrid, {
            componentProperties: { key: 'ef-4', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => expect(store.getItem).toHaveBeenCalled());

        fixture.componentInstance.directive().set(null);

        expect(store.removeItem).toHaveBeenCalledWith('ef-4');
        expect(store.setItem).not.toHaveBeenCalled();
        expect(fixture.componentInstance.directive().value()).toBeNull();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(apiMock.api.onFilterChanged).toHaveBeenCalled();
    });

    it('set() before gridReady persists to store but does not call onFilterChanged', async () => {
        const store: KbqAgGridExternalFilterStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        const { fixture } = await render(TestExternalFilterStateGrid, {
            componentProperties: { key: 'ef-5', store }
        });

        fixture.componentInstance.directive().set('Swimming');

        expect(store.setItem).toHaveBeenCalledWith('ef-5', 'Swimming');
        expect(fixture.componentInstance.directive().value()).toBe('Swimming');
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(fixture.componentInstance.grid().api.onFilterChanged).not.toHaveBeenCalled();
    });

    it('reset() removes stored value, clears signal, and calls onFilterChanged', async () => {
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

        fixture.componentInstance.directive().set('Gymnastics');
        fixture.componentInstance.directive().reset();

        expect(store.removeItem).toHaveBeenCalledWith('ef-6');
        expect(fixture.componentInstance.directive().value()).toBeNull();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(apiMock.api.onFilterChanged).toHaveBeenCalledTimes(2);
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
            componentProperties: { key: 'ef-7', store }
        });

        fixture.componentInstance.grid().emitGridReady(apiMock.api);

        await waitFor(() => {
            expect(fixture.componentInstance.directive().value()).toBe('Speed Skating');
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(apiMock.api.onFilterChanged).toHaveBeenCalled();
        });

        fixture.componentInstance.directive().set('Gymnastics');

        await waitFor(() => {
            expect(store.setItem).toHaveBeenCalledWith('ef-7', 'Gymnastics');
        });
    });
});
