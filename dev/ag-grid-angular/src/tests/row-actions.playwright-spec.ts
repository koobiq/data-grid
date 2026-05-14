import { expect, Locator, Page, test } from '@playwright/test';
import { getAgGridApi } from './utils/api';
import { getRow } from './utils/helpers';

const getScreenshotTarget = (page: Page): Locator => page.getByTestId('e2eScreenshotTarget');
const getPinFirstColumnToggle = (page: Page): Locator => page.getByTestId('e2ePinFirstColumnToggle');
const getPinLastColumnToggle = (page: Page): Locator => page.getByTestId('e2ePinLastColumnToggle');

test.describe('KbqAgGridRowActions', () => {
    // Screenshot tests are only valid on CI. Do not update snapshots locally.
    test('shows actions overlay on hover with horizontal scroll', async ({ page }) => {
        await page.setViewportSize({ width: 650, height: 500 });
        await page.goto('/e2e/row-actions');
        await getPinFirstColumnToggle(page).evaluate((label: HTMLLabelElement) => label.click());
        await getPinLastColumnToggle(page).evaluate((label: HTMLLabelElement) => label.click());
        await getRow(page, 1).first().hover();
        await expect(getScreenshotTarget(page)).toHaveScreenshot('row-actions-hover-light.png');
    });

    test('removes row when Delete button is clicked', async ({ page }) => {
        await page.goto('/e2e/row-actions');
        const gridApi = await getAgGridApi(page);
        const rowsBefore = await gridApi.evaluate((api) => api.getDisplayedRowCount());
        await getRow(page, 0).hover();
        await page.getByTestId('e2eDeleteRowButton').click();
        await expect.poll(async () => gridApi.evaluate((api) => api.getDisplayedRowCount())).toBe(rowsBefore - 1);
    });
});
