import { Component, signal } from '@angular/core';
import { render, RenderResult } from '@testing-library/angular';
import { KbqAgGridSkeletonCellRenderer } from '../src/skeleton-cell-renderer.ng';

@Component({
    selector: 'test-skeleton-cell',
    standalone: true,
    imports: [KbqAgGridSkeletonCellRenderer],
    template: `
        <kbq-ag-grid-skeleton-cell-renderer [seed]="seed()" />
    `
})
class TestSkeletonCell {
    readonly seed = signal<number | null>(null);
}

/** The width the renderer publishes for the stylesheet to read. */
const barWidthOf = (container: Element): string => {
    const bar = container.querySelector<HTMLElement>('kbq-ag-grid-skeleton-cell-renderer');

    return bar!.style.getPropertyValue('--kbq-ag-grid-skeleton-bar-width');
};

const widthForSeed = (rendered: RenderResult<TestSkeletonCell>, seed: number): number => {
    rendered.fixture.componentInstance.seed.set(seed);
    rendered.detectChanges();

    return Number.parseInt(barWidthOf(rendered.container), 10);
};

describe('KbqAgGridSkeletonCellRenderer', () => {
    it('fills the cell when no seed is given', async () => {
        const { container } = await render(TestSkeletonCell);

        expect(barWidthOf(container)).toBe('100%');
    });

    it('varies the width by seed, and keeps every bar wide enough to read as one', async () => {
        const rendered = await render(TestSkeletonCell);
        const widths: number[] = [];

        for (const seed of [0, 1, 2, 3, 4, 5]) {
            widths.push(widthForSeed(rendered, seed));
        }

        expect(new Set(widths).size).toBeGreaterThan(1);
        widths.forEach((width) => {
            expect(width).toBeGreaterThanOrEqual(45);
            expect(width).toBeLessThanOrEqual(100);
        });
    });

    /** Screenshot tests would go flaky the moment a width stopped being a pure function of its seed. */
    it('gives the same seed the same width every time', async () => {
        const rendered = await render(TestSkeletonCell);

        expect(widthForSeed(rendered, 7)).toBe(widthForSeed(rendered, 7));
    });
});
