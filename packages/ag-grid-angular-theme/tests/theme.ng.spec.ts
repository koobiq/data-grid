import { Component, viewChild } from '@angular/core';
import { render, waitFor } from '@testing-library/angular';
import { AgGridAngular, AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, GridApi, ModuleRegistry, SelectionColumnDef } from 'ag-grid-community';
import { KbqAgGridTheme } from '../src/theme.ng';

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
    selector: 'test-grid',
    standalone: true,
    template: `
        <ag-grid-angular kbqAgGridTheme />
    `,
    imports: [AgGridModule, KbqAgGridTheme]
})
class TestGrid {
    readonly grid = viewChild.required(AgGridAngular);
}

@Component({
    selector: 'test-grid-focus-disabled',
    standalone: true,
    template: `
        <ag-grid-angular kbqAgGridTheme kbqAgGridThemeDisableCellFocusStyles />
    `,
    imports: [AgGridModule, KbqAgGridTheme]
})
class TestGridFocusDisabled {}

@Component({
    selector: 'test-grid-custom-selection-width',
    standalone: true,
    template: `
        <ag-grid-angular kbqAgGridTheme [selectionColumnDef]="selectionColumnDef" />
    `,
    imports: [AgGridModule, KbqAgGridTheme]
})
class TestGridCustomSelectionWidth {
    readonly grid = viewChild.required(AgGridAngular);
    protected readonly selectionColumnDef: SelectionColumnDef = { width: 80 };
}

@Component({
    selector: 'test-grid-pinned-columns',
    standalone: true,
    template: `
        <ag-grid-angular kbqAgGridTheme [columnDefs]="columnDefs" />
    `,
    imports: [AgGridModule, KbqAgGridTheme]
})
class TestGridPinnedColumns {
    readonly grid = viewChild.required(AgGridAngular);
    // Every column is 200px wide by default, so the scrollable columns are 400px in total.
    protected readonly columnDefs: ColDef[] = [
        { field: 'athlete', pinned: 'left' },
        { field: 'year' },
        { field: 'date' },
        { field: 'total', pinned: 'right' }
    ];
}

/**
 * Renders a grid with pinned columns and reports the scrolled range of the scrollable ones, which
 * jsdom cannot lay out on its own.
 */
const renderPinnedGrid = async (range: { left: number; right: number }): Promise<{ grid: Element; api: GridApi }> => {
    const { fixture, container } = await render(TestGridPinnedColumns);
    const grid = container.querySelector('ag-grid-angular')!;

    await waitFor(() => {
        expect(fixture.componentInstance.grid().api).toBeDefined();
    });

    const { api } = fixture.componentInstance.grid();

    jest.spyOn(api, 'getHorizontalPixelRange').mockReturnValue(range);

    return { grid, api };
};

describe('KbqAgGridTheme', () => {
    it('should apply ag-theme-koobiq host class', async () => {
        const { container } = await render(TestGrid);

        expect(container.querySelector('ag-grid-angular')).toHaveClass('ag-theme-koobiq');
    });

    it('should set grid.theme to "legacy"', async () => {
        const { fixture } = await render(TestGrid);

        expect(fixture.componentInstance.grid().theme).toBe('legacy');
    });

    it('should not add ag-theme-koobiq_disable-cell-focus-styles by default', async () => {
        const { container } = await render(TestGrid);

        expect(container.querySelector('ag-grid-angular')).not.toHaveClass('ag-theme-koobiq_disable-cell-focus-styles');
    });

    it('should add ag-theme-koobiq_disable-cell-focus-styles when input is true', async () => {
        const { container } = await render(TestGridFocusDisabled);

        expect(container.querySelector('ag-grid-angular')).toHaveClass('ag-theme-koobiq_disable-cell-focus-styles');
    });

    it('defaults the selection checkbox column width to 36px', async () => {
        const { fixture } = await render(TestGrid);

        await waitFor(() => {
            expect(fixture.componentInstance.grid().api.getGridOption('selectionColumnDef')).toEqual(
                expect.objectContaining({ width: 36 })
            );
        });
    });

    it("does not override a consumer's own selectionColumnDef width", async () => {
        const { fixture } = await render(TestGridCustomSelectionWidth);

        await waitFor(() => {
            expect(fixture.componentInstance.grid().api.getGridOption('selectionColumnDef')).toEqual(
                expect.objectContaining({ width: 80 })
            );
        });
    });

    describe('pinned column shadows', () => {
        it('marks the right side while columns are hidden behind the right pinned column', async () => {
            const { grid, api } = await renderPinnedGrid({ left: 0, right: 300 });

            api.setColumnsPinned(['total'], 'right');

            await waitFor(() => {
                expect(grid).toHaveClass('ag-theme-koobiq_pinned-right-cols-overflow');
            });
            expect(grid).not.toHaveClass('ag-theme-koobiq_pinned-left-cols-overflow');
        });

        it('marks the left side only once the columns are scrolled to the end', async () => {
            const { grid, api } = await renderPinnedGrid({ left: 100, right: 400 });

            api.setColumnsPinned(['total'], 'right');

            await waitFor(() => {
                expect(grid).toHaveClass('ag-theme-koobiq_pinned-left-cols-overflow');
            });
            expect(grid).not.toHaveClass('ag-theme-koobiq_pinned-right-cols-overflow');
        });

        it('drops both sides when no column is pinned', async () => {
            const { grid, api } = await renderPinnedGrid({ left: 100, right: 300 });

            api.setColumnsPinned(['total'], 'right');

            await waitFor(() => {
                expect(grid).toHaveClass('ag-theme-koobiq_pinned-right-cols-overflow');
            });

            api.setColumnsPinned(['athlete', 'total'], null);

            await waitFor(() => {
                expect(grid).not.toHaveClass('ag-theme-koobiq_pinned-right-cols-overflow');
            });
            expect(grid).not.toHaveClass('ag-theme-koobiq_pinned-left-cols-overflow');
        });
    });
});
