import { expect, Locator, Page, test } from '@playwright/test';

const getScreenshotTarget = (page: Page): Locator => page.getByTestId('e2eScreenshotTarget');
const getSkeletonCells = (page: Page): Locator => page.locator('.kbq-ag-grid-skeleton-cell');
const getDataRows = (page: Page): Locator => page.locator('.ag-row[row-index]');

test.describe('DevLazyLoading', () => {
    // Screenshots differ across OS — always update snapshots via Docker: `yarn run e2e:docker:update-snapshots`
    test('renders skeleton cells on initial load', async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 600 });
        await page.goto('/e2e/lazy-loading');
        await expect(getScreenshotTarget(page)).toHaveScreenshot('lazy-loading-light.png');
    });

    test('skeleton cells are visible before data loads', async ({ page }) => {
        await page.goto('/e2e/lazy-loading');
        await expect(getSkeletonCells(page).first()).toBeVisible();
    });

    test('data rows appear after block loads', async ({ page }) => {
        await page.goto('/e2e/lazy-loading');
        await expect(getDataRows(page).first()).toBeVisible({ timeout: 5000 });
        await expect(getSkeletonCells(page)).toHaveCount(0);
    });

    test('subsequent blocks show skeletons while scrolling', async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 400 });
        await page.goto('/e2e/lazy-loading');

        // Wait for the first block to load
        await expect(getDataRows(page).first()).toBeVisible({ timeout: 5000 });

        // Scroll to the bottom to trigger the next block
        await getScreenshotTarget(page).evaluate((el) => el.querySelector('.ag-body-viewport')?.scrollTo(0, 10000));

        // Skeleton cells for the new block should appear
        await expect(getSkeletonCells(page).first()).toBeVisible({ timeout: 2000 });
    });
});
