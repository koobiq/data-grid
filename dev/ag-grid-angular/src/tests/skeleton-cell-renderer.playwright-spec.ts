import { expect, Locator, Page, test } from '@playwright/test';

const getScreenshotTarget = (page: Page): Locator => page.getByTestId('e2eScreenshotTarget');
const getSkeletonCells = (page: Page): Locator => page.locator('.kbq-ag-grid-skeleton-cell');
const getDataRows = (page: Page): Locator => page.locator('.ag-row[row-index]');

test.describe('DevSkeletonCellRenderer', () => {
    // Screenshots differ across OS — always update snapshots via Docker: `yarn run e2e:docker:update-snapshots`
    test('renders skeleton cells on initial load', async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 600 });
        await page.goto('/e2e/skeleton-cell-renderer');
        await expect(getScreenshotTarget(page)).toHaveScreenshot('skeleton-cell-renderer-light.png');
    });

    test('skeleton cells are visible before data loads', async ({ page }) => {
        await page.goto('/e2e/skeleton-cell-renderer');
        await expect(getSkeletonCells(page).first()).toBeVisible();
    });

    test('data rows appear after block loads', async ({ page }) => {
        await page.goto('/e2e/skeleton-cell-renderer');
        await expect(getDataRows(page).first()).toBeVisible();
        // The grid's viewport + row buffer renders more rows than a single cache block (9 rows),
        // so later blocks' stub rows also carry `row-index` before their data arrives.
        // Scope the check to block 0's rows (row-index 0-8), which are guaranteed loaded by now.
        const firstBlockSkeletons = Array.from(
            { length: 9 },
            (_, rowIndex) => `.ag-row[row-index="${rowIndex}"] .kbq-ag-grid-skeleton-cell`
        ).join(', ');
        await expect(page.locator(firstBlockSkeletons)).toHaveCount(0, { timeout: 5_000 });
    });

    test('subsequent blocks show skeletons while scrolling', async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 400 });
        await page.goto('/e2e/skeleton-cell-renderer');

        // Wait for the first block to load
        await expect(getDataRows(page).first()).toBeVisible();

        // Scroll to the bottom to trigger the next block
        await getScreenshotTarget(page).evaluate((el) => el.querySelector('.ag-body-viewport')?.scrollTo(0, 10000));

        // Skeleton cells for the new block should appear
        await expect(getSkeletonCells(page).first()).toBeVisible();
    });

    test('rows without data ignore the pointer from the moment they are inserted', async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 400 });
        await page.goto('/e2e/skeleton-cell-renderer');
        await expect(page.locator('.ag-row[row-id]').first()).toBeVisible({ timeout: 5_000 });

        // Read from a mutation callback, which runs ahead of the animation frame AG Grid renders cells in:
        // waiting for the skeleton to show up would miss the moment this test is about.
        const pointerEvents = await getScreenshotTarget(page).evaluate(
            async (grid) =>
                new Promise<string[]>((resolve) => {
                    const observer = new MutationObserver((records) => {
                        const rows = records
                            .flatMap(({ addedNodes }) => Array.from(addedNodes))
                            .filter((node): node is Element => node instanceof Element)
                            .filter((element) => element.matches('.ag-row:not([row-id])'));

                        if (rows.length > 0) {
                            observer.disconnect();
                            resolve(rows.map((row) => getComputedStyle(row).pointerEvents));
                        }
                    });

                    observer.observe(grid.querySelector('.ag-center-cols-container')!, { childList: true });
                    grid.querySelector('.ag-body-viewport')?.scrollTo(0, 10000);
                })
        );

        expect(new Set(pointerEvents)).toEqual(new Set(['none']));
    });

    test('back-dates the wave, so that rebuilding a row does not restart it', async ({ page }) => {
        await page.goto('/e2e/skeleton-cell-renderer');

        // The bar is found and read in one call: AG Grid rebuilds these rows, so a locator could hand over
        // a bar that has just left the document, and a detached element has no computed style.
        await expect
            .poll(
                async () =>
                    page.evaluate(() => {
                        const bar = document.querySelector('.kbq-ag-grid-skeleton-cell');

                        return bar === null ? 0 : Number.parseFloat(getComputedStyle(bar, '::after').animationDelay);
                    }),
                { timeout: 5_000 }
            )
            .toBeLessThan(0);
    });
});
