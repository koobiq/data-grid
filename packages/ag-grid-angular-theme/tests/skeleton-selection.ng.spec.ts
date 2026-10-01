import { Component } from '@angular/core';
import { render } from '@testing-library/angular';
import { KbqAgGridSkeletonSelectionCellComponent } from '../src/skeleton-selection.ng';

@Component({
    selector: 'test-skeleton-selection-cell',
    standalone: true,
    imports: [KbqAgGridSkeletonSelectionCellComponent],
    template: `
        <kbq-ag-grid-skeleton-selection-cell />
    `
})
class TestSkeletonSelectionCell {}

describe('KbqAgGridSkeletonSelectionCellComponent', () => {
    /**
     * All this component contributes is an element of its own, so that the theme can size the bar
     * down to a square without touching the bars in the data columns. Losing the bar inside it is
     * the one way it can break in TypeScript.
     */
    it('draws the same bar the data columns use', async () => {
        const { container } = await render(TestSkeletonSelectionCell);

        expect(container.querySelector('kbq-ag-grid-skeleton-cell-renderer')).not.toBeNull();
    });
});
