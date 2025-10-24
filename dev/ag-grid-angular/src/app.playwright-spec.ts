import { expect, Locator, Page, test } from '@playwright/test';

test.describe('AgGridAngular', () => {
    const getShowIndexColumnToggle = (page: Page): Locator => page.getByTestId('e2eShowIndexColumnToggle');
    const getLightThemeToggle = (page: Page): Locator => page.getByTestId('e2eLightThemeToggle');
    const getPaginationToggle = (page: Page): Locator => page.getByTestId('e2ePaginationToggle');
    const getScreenshotTarget = (page: Page): Locator => page.getByTestId('e2eScreenshotTarget');
    const getPinFirstColumnToggle = (page: Page): Locator => page.getByTestId('e2ePinFirstColumnToggle');
    const getPinLastColumnToggle = (page: Page): Locator => page.getByTestId('e2ePinLastColumnToggle');

    test('default state', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 500 });
        await page.goto('/');

        await getShowIndexColumnToggle(page).evaluate((label: HTMLLabelElement) => label.click());
        await getPaginationToggle(page).evaluate((label: HTMLLabelElement) => label.click());

        await expect(getScreenshotTarget(page)).toHaveScreenshot();
    });

    test('default state (dark theme)', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 500 });
        await page.goto('/');

        await getShowIndexColumnToggle(page).evaluate((label: HTMLLabelElement) => label.click());
        await getLightThemeToggle(page).evaluate((label: HTMLLabelElement) => label.click());
        await getPaginationToggle(page).evaluate((label: HTMLLabelElement) => label.click());

        await expect(getScreenshotTarget(page)).toHaveScreenshot();
    });

    test('with pinned columns', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 500 });
        await page.goto('/');

        await getShowIndexColumnToggle(page).evaluate((label: HTMLLabelElement) => label.click());
        await getPinFirstColumnToggle(page).evaluate((label: HTMLLabelElement) => label.click());
        await getPinLastColumnToggle(page).evaluate((label: HTMLLabelElement) => label.click());

        await expect(getScreenshotTarget(page)).toHaveScreenshot();
    });
});
