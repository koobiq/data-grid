import { Component, Directive, forwardRef, signal } from '@angular/core';
import { render } from '@testing-library/angular';
import { AgGridAngular } from 'ag-grid-angular';
import { GridApi } from 'ag-grid-community';
import {
    KbqAgGridLoadingOverlay,
    KbqAgGridLoadingOverlayComponent,
    kbqAgGridLoadingOverlayConfigProvider
} from '../src/loading-overlay.ng';

@Directive({
    selector: 'ag-grid-angular',
    standalone: true,
    providers: [{ provide: AgGridAngular, useExisting: forwardRef(() => TestAgGridAngularStub) }]
})
class TestAgGridAngularStub {
    loadingOverlayComponent: unknown = undefined;
    loading: boolean | undefined = undefined;
    api: GridApi | null = null;
}

@Component({
    selector: 'test-grid',
    standalone: true,
    template: `
        <ag-grid-angular [kbqAgGridLoadingOverlay]="loading()" />
    `,
    imports: [TestAgGridAngularStub, KbqAgGridLoadingOverlay]
})
class TestGridComponent {
    readonly loading = signal(true);
}

@Component({
    selector: 'test-grid-with-api',
    standalone: true,
    template: `
        <ag-grid-angular [kbqAgGridLoadingOverlay]="loading()" />
    `,
    imports: [TestAgGridAngularStub, KbqAgGridLoadingOverlay]
})
class TestGridWithApiComponent {
    readonly loading = signal(false);
}

describe(KbqAgGridLoadingOverlay.name, () => {
    it('should set loadingOverlayComponent to KbqAgGridLoadingOverlayComponent', async () => {
        const { fixture } = await render(TestGridComponent);
        const stub = fixture.debugElement.children[0].injector.get(AgGridAngular) as TestAgGridAngularStub;

        expect(stub.loadingOverlayComponent).toBe(KbqAgGridLoadingOverlayComponent);
    });

    it('should set grid.loading=true on the grid input before api is ready', async () => {
        const { fixture } = await render(TestGridComponent);
        const stub = fixture.debugElement.children[0].injector.get(AgGridAngular) as TestAgGridAngularStub;

        expect(stub.loading).toBe(true);
    });

    it('should set grid.loading=false when input is false', async () => {
        const { fixture } = await render(TestGridWithApiComponent);
        const stub = fixture.debugElement.children[0].injector.get(AgGridAngular) as TestAgGridAngularStub;

        expect(stub.loading).toBe(false);
    });

    it('should call api.setGridOption when api is available', async () => {
        const { fixture } = await render(TestGridComponent);
        const stub = fixture.debugElement.children[0].injector.get(AgGridAngular) as TestAgGridAngularStub;

        const setGridOption = jest.fn();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        stub.api = { setGridOption } as unknown as GridApi;

        fixture.componentInstance.loading.set(false);
        fixture.detectChanges();

        expect(setGridOption).toHaveBeenCalledWith('loading', false);
    });

    it('should react to loading input changes', async () => {
        const { fixture } = await render(TestGridComponent);
        const stub = fixture.debugElement.children[0].injector.get(AgGridAngular) as TestAgGridAngularStub;

        expect(stub.loading).toBe(true);

        fixture.componentInstance.loading.set(false);
        fixture.detectChanges();

        expect(stub.loading).toBe(false);
    });

    describe(KbqAgGridLoadingOverlayComponent.name, () => {
        it('should render 1 header row and 3 data rows by default', async () => {
            const { container } = await render(KbqAgGridLoadingOverlayComponent);
            const rows = container.querySelectorAll('.kbq-ag-grid-skeleton-row');

            expect(rows).toHaveLength(4); // 1 header + 3 data
            expect(rows[0]).toHaveClass('kbq-ag-grid-skeleton-row_header');
        });

        it('should render 3 cells per row by default', async () => {
            const { container } = await render(KbqAgGridLoadingOverlayComponent);
            const headerCells = container.querySelectorAll(
                '.kbq-ag-grid-skeleton-row_header .kbq-ag-grid-skeleton-cell'
            );

            expect(headerCells).toHaveLength(3);
        });

        it('should render custom rows count from config', async () => {
            const { container } = await render(KbqAgGridLoadingOverlayComponent, {
                providers: [kbqAgGridLoadingOverlayConfigProvider({ rows: 5 })]
            });
            const rows = container.querySelectorAll('.kbq-ag-grid-skeleton-row');

            expect(rows).toHaveLength(6); // 1 header + 5 data
        });

        it('should render custom cols count from config', async () => {
            const { container } = await render(KbqAgGridLoadingOverlayComponent, {
                providers: [kbqAgGridLoadingOverlayConfigProvider({ cols: 6 })]
            });
            const headerCells = container.querySelectorAll(
                '.kbq-ag-grid-skeleton-row_header .kbq-ag-grid-skeleton-cell'
            );

            expect(headerCells).toHaveLength(6);
        });

        it('should render custom rows and cols from config', async () => {
            const { container } = await render(KbqAgGridLoadingOverlayComponent, {
                providers: [kbqAgGridLoadingOverlayConfigProvider({ rows: 2, cols: 4 })]
            });
            const rows = container.querySelectorAll('.kbq-ag-grid-skeleton-row');
            const headerCells = container.querySelectorAll(
                '.kbq-ag-grid-skeleton-row_header .kbq-ag-grid-skeleton-cell'
            );

            expect(rows).toHaveLength(3); // 1 header + 2 data
            expect(headerCells).toHaveLength(4);
        });
    });
});
