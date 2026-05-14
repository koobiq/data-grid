import { expect, Locator, Page, test } from '@playwright/test';
import { enableDarkTheme } from './utils/theme';

const getPaginationToggle = (page: Page): Locator => page.getByTestId('e2ePaginationToggle');
const getScreenshotTarget = (page: Page): Locator => page.getByTestId('e2eScreenshotTarget');
const getPinFirstColumnToggle = (page: Page): Locator => page.getByTestId('e2ePinFirstColumnToggle');
const getPinLastColumnToggle = (page: Page): Locator => page.getByTestId('e2ePinLastColumnToggle');

// Screenshot tests are only valid on CI. Do not update snapshots locally.
test.describe('KbqAgGridAngularTheme', () => {
    test('default state', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 500 });
        await page.goto('/e2e/theme');
        await getPaginationToggle(page).evaluate((label: HTMLLabelElement) => label.click());
        await expect(getScreenshotTarget(page)).toHaveScreenshot('theme-default-light.png');
        await enableDarkTheme(page);
        await expect(getScreenshotTarget(page)).toHaveScreenshot('theme-default-dark.png');
    });

    test('with pinned columns', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 500 });
        await page.goto('/e2e/theme');
        await getPinFirstColumnToggle(page).evaluate((label: HTMLLabelElement) => label.click());
        await getPinLastColumnToggle(page).evaluate((label: HTMLLabelElement) => label.click());
        await page
            .locator('.ag-center-cols-viewport')
            .evaluate((element: HTMLElement) => element.scrollTo({ left: 10 }));
        await expect(getScreenshotTarget(page)).toHaveScreenshot('theme-pinned-columns-light.png');
    });

    test('with opened filter popup', async ({ page }) => {
        await page.setViewportSize({ width: 500, height: 500 });
        await page.goto('/e2e/theme');
        await page.hover('.ag-header-cell[col-id="athlete"]');
        await page.click('.ag-header-cell[col-id="athlete"] .ag-header-cell-filter-button');
        await page.click('.ag-menu .ag-filter-select');
        await expect(getScreenshotTarget(page)).toHaveScreenshot('theme-filter-popup-light.png');
        await enableDarkTheme(page);
        await expect(getScreenshotTarget(page)).toHaveScreenshot('theme-filter-popup-dark.png');
    });
});
