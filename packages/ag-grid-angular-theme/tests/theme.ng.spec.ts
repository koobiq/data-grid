import { Component, viewChild } from '@angular/core';
import { render, waitFor } from '@testing-library/angular';
import { AgGridAngular, AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ModuleRegistry, SelectionColumnDef } from 'ag-grid-community';
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
});
