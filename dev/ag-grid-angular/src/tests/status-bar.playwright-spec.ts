import { expect, Locator, Page, test } from '@playwright/test';
import { toggleRowSelection } from './utils/helpers';

const getScreenshotTarget = (page: Page): Locator => page.getByTestId('e2eScreenshotTarget');
const getStatusBarSelected = (page: Page): Locator => page.getByTestId('e2eStatusBarSelected');

test.describe('KbqAgGridStatusBar', () => {
    // Screenshots differ across OS — always update snapshots via Docker: `yarn run e2e:docker:update-snapshots`
    test('renders status bar', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 500 });
        await page.goto('/e2e/status-bar');
        await expect(getScreenshotTarget(page)).toHaveScreenshot('status-bar-light.png');
    });

    test('updates Selected count when rows are selected', async ({ page }) => {
        await page.goto('/e2e/status-bar');
        await expect(getStatusBarSelected(page)).toHaveText('Selected: 0');
        await toggleRowSelection(page, 0);
        await expect(getStatusBarSelected(page)).toHaveText('Selected: 1');
        await toggleRowSelection(page, 1);
        await expect(getStatusBarSelected(page)).toHaveText('Selected: 2');
    });
});
