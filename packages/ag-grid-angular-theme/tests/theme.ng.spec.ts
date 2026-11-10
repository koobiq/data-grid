import { ChangeDetectionStrategy, Component, input, viewChild } from '@angular/core';
import { render, waitFor } from '@testing-library/angular';
import { AgGridAngular, AgGridModule } from 'ag-grid-angular';
import {
    AllCommunityModule,
    ColDef,
    GridApi,
    GridOptions,
    ModuleRegistry,
    RowSelectionOptions,
    SelectionColumnDef
} from 'ag-grid-community';
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
    selector: 'test-grid-selection-column-options',
    standalone: true,
    template: `
        <ag-grid-angular kbqAgGridTheme [gridOptions]="gridOptions()" [selectionColumnDef]="selectionColumnDef()" />
    `,
    imports: [AgGridModule, KbqAgGridTheme],
    changeDetection: ChangeDetectionStrategy.OnPush
})
class TestGridSelectionColumnOptions {
    /** Passed to the grid as is. */
    readonly gridOptions = input<GridOptions>();
    /** Passed to the grid as is. */
    readonly selectionColumnDef = input<SelectionColumnDef>();
    /** The grid under test. */
    readonly grid = viewChild.required(AgGridAngular);
}

@Component({
    selector: 'test-grid-selection-column-resize',
    standalone: true,
    template: `
        <ag-grid-angular
            kbqAgGridTheme
            [columnDefs]="columnDefs"
            [rowData]="rowData"
            [rowSelection]="rowSelection"
            (columnResized)="resized = resized + 1"
            (firstDataRendered)="rendered = true"
        />
    `,
    imports: [AgGridModule, KbqAgGridTheme],
    changeDetection: ChangeDetectionStrategy.OnPush
})
class TestGridSelectionColumnResize {
    /** The grid under test. */
    readonly grid = viewChild.required(AgGridAngular);
    /** How many times the grid has resized a column. */
    resized = 0;
    /** Whether the grid has rendered its first rows. */
    rendered = false;
    protected readonly columnDefs: ColDef[] = [{ field: 'athlete' }];
    protected readonly rowData = [{ athlete: 'Michael Phelps' }];
    protected readonly rowSelection: RowSelectionOptions = { mode: 'multiRow' };
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

    describe('selection column width before the grid is created', () => {
        const renderOptions = async (componentInputs: {
            gridOptions?: GridOptions;
            selectionColumnDef?: SelectionColumnDef;
        }): Promise<SelectionColumnDef | undefined> => {
            const { fixture } = await render(TestGridSelectionColumnOptions, { componentInputs });

            await waitFor(() => {
                expect(fixture.componentInstance.grid().api).toBeDefined();
            });

            return fixture.componentInstance.grid().api.getGridOption('selectionColumnDef');
        };

        it('does not resize the selection column once the grid is ready', async () => {
            const { fixture } = await render(TestGridSelectionColumnResize);

            await waitFor(() => {
                expect(fixture.componentInstance.rendered).toBe(true);
            });

            const { api } = fixture.componentInstance.grid();

            expect(api.getColumn('ag-Grid-SelectionColumn')?.getActualWidth()).toBe(36);
            expect(fixture.componentInstance.resized).toBe(0);
        });

        it('keeps the other fields of the selectionColumnDef input', async () => {
            await expect(renderOptions({ selectionColumnDef: { headerName: 'Selected' } })).resolves.toEqual({
                width: 36,
                headerName: 'Selected'
            });
        });

        it('takes the selectionColumnDef from gridOptions when there is no input', async () => {
            await expect(
                renderOptions({ gridOptions: { selectionColumnDef: { headerName: 'Selected', width: 80 } } })
            ).resolves.toEqual({ headerName: 'Selected', width: 80 });
        });

        it('applies the default width to a selectionColumnDef from gridOptions', async () => {
            await expect(
                renderOptions({ gridOptions: { selectionColumnDef: { headerName: 'Selected' } } })
            ).resolves.toEqual({ width: 36, headerName: 'Selected' });
        });

        it('lets the input replace the selectionColumnDef from gridOptions as a whole, as the grid does', async () => {
            await expect(
                renderOptions({
                    gridOptions: { selectionColumnDef: { headerName: 'From options', width: 80 } },
                    selectionColumnDef: { suppressMovable: true }
                })
            ).resolves.toEqual({ width: 36, suppressMovable: true });
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
