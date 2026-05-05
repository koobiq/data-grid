import { Component, viewChild } from '@angular/core';
import { render } from '@testing-library/angular';
import { AgGridAngular, AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
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
        <ag-grid-angular kbqAgGridTheme [disableCellFocusStyles]="true" />
    `,
    imports: [AgGridModule, KbqAgGridTheme]
})
class TestGridFocusDisabled {}

describe(KbqAgGridTheme.name, () => {
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
});
