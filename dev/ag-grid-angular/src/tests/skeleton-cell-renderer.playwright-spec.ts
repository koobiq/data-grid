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
});
