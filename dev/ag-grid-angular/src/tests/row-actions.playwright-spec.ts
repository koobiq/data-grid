import { expect, Locator, Page, test } from '@playwright/test';
import { getAgGridApi } from './utils/api';
import { getRow } from './utils/helpers';

const getScreenshotTarget = (page: Page): Locator => page.getByTestId('e2eScreenshotTarget');

test.describe('KbqAgGridRowActions', () => {
    // Screenshots differ across OS — always update snapshots via Docker: `yarn run e2e:docker:update-snapshots`
    test('shows actions overlay on hover with horizontal scroll', async ({ page }) => {
        await page.setViewportSize({ width: 650, height: 500 });
        await page.goto('/e2e/row-actions');
        await (
            await getAgGridApi(page)
        ).evaluate((api) => {
            api.applyColumnState({
                state: [
                    { colId: 'athlete', pinned: 'left' },
                    { colId: 'total', pinned: 'right' }
                ]
            });
        });
        await getRow(page, 1).first().hover({ timeout: 1000 });
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
