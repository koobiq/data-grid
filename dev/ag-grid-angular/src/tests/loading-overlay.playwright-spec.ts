import { expect, Locator, Page, test } from '@playwright/test';
import { enableDarkTheme } from './utils/theme';

const getScreenshotTarget = (page: Page): Locator => page.getByTestId('e2eScreenshotTarget');
const getToggleButton = (page: Page): Locator => page.getByRole('button', { name: /hide loading|show loading/i });
const getOverlay = (page: Page): Locator => page.locator('.kbq-ag-grid-loading-overlay');
const getSkeletonRows = (page: Page): Locator => page.locator('.kbq-ag-grid-skeleton-row');
const getSkeletonHeaderCells = (page: Page): Locator =>
    page.locator('.kbq-ag-grid-skeleton-row_header .kbq-ag-grid-skeleton-cell');

test.describe('KbqAgGridLoadingOverlay', () => {
    // Screenshot tests are only valid on CI. Do not update snapshots locally.
    test('renders skeleton overlay', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 400 });
        await page.goto('/e2e/loading-overlay');
        await expect(getScreenshotTarget(page)).toHaveScreenshot('loading-overlay-light.png');
        await enableDarkTheme(page);
        await expect(getScreenshotTarget(page)).toHaveScreenshot('loading-overlay-dark.png');
    });

    test('overlay is visible on initial load', async ({ page }) => {
        await page.goto('/e2e/loading-overlay');
        await expect(getOverlay(page)).toBeVisible();
    });

    test('hides overlay when toggle button is clicked', async ({ page }) => {
        await page.goto('/e2e/loading-overlay');
        await getToggleButton(page).click();
        await expect(getOverlay(page)).not.toBeVisible();
    });

    test('shows overlay again after second toggle', async ({ page }) => {
        await page.goto('/e2e/loading-overlay');
        await getToggleButton(page).click();
        await getToggleButton(page).click();
        await expect(getOverlay(page)).toBeVisible();
    });

    test('renders correct number of rows from config (5 data + 1 header)', async ({ page }) => {
        await page.goto('/e2e/loading-overlay');
        await expect(getSkeletonRows(page)).toHaveCount(6);
    });

    test('renders correct number of columns from config (6 cols)', async ({ page }) => {
        await page.goto('/e2e/loading-overlay');
        await expect(getSkeletonHeaderCells(page)).toHaveCount(6);
    });
});
