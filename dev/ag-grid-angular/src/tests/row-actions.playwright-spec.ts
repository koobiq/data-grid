import { expect, Locator, Page, test } from '@playwright/test';
import { getRow } from './utils/helpers';

const getScreenshotTarget = (page: Page): Locator => page.getByTestId('e2eScreenshotTarget');
const getPinFirstColumnToggle = (page: Page): Locator => page.getByTestId('e2ePinFirstColumnToggle');
const getPinLastColumnToggle = (page: Page): Locator => page.getByTestId('e2ePinLastColumnToggle');

// Screenshot tests are only valid on CI. Do not update snapshots locally.
test.describe('KbqAgGridRowActions', () => {
    test('shows actions overlay on hover with horizontal scroll', async ({ page }) => {
        await page.setViewportSize({ width: 650, height: 500 });
        await page.goto('/e2e/row-actions');
        await getPinFirstColumnToggle(page).evaluate((label: HTMLLabelElement) => label.click());
        await getPinLastColumnToggle(page).evaluate((label: HTMLLabelElement) => label.click());
        await getRow(page, 1).first().hover();
        await expect(getScreenshotTarget(page)).toHaveScreenshot('03-light.png');
    });
});
