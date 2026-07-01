import { expect, Locator, Page, test } from '@playwright/test';
import { getAgGridApi } from './utils/api';
import { getCell, toggleRowSelection } from './utils/helpers';
import { enableDarkTheme } from './utils/theme';

const getScreenshotTarget = (page: Page): Locator => page.getByTestId('e2eScreenshotTarget');

test.describe('KbqAgGridAngularTheme', () => {
    // Screenshots differ across OS — always update snapshots via Docker: `yarn run e2e:docker:update-snapshots`
    test('default state', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 500 });
        await page.goto('/e2e/theme');
        // Wait for row data to load via HTTP before manipulating grid state.
        await page.locator('.ag-row[row-index]').first().waitFor();
        await (
            await getAgGridApi(page)
        ).evaluate((api) => {
            api.setGridOption('pagination', true);
            api.applyColumnState({
                state: [
                    { colId: 'year', sort: 'asc', sortIndex: 1 },
                    { colId: 'date', sort: 'asc', sortIndex: 2 }
                ]
            });
        });
        await toggleRowSelection(page, 4);
        await toggleRowSelection(page, 5);
        await getCell(page, 0, 'athlete').click();
        await expect(page.locator('.ag-paging-panel')).toBeVisible();
        await expect(getScreenshotTarget(page)).toHaveScreenshot('theme-default-light.png');
        await enableDarkTheme(page);
        await expect(getScreenshotTarget(page)).toHaveScreenshot('theme-default-dark.png');
    });

    // Screenshots differ across OS — always update snapshots via Docker: `yarn run e2e:docker:update-snapshots`
    test('with pinned columns', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 500 });
        await page.goto('/e2e/theme');
        // Wait for row data to load via HTTP before manipulating grid state.
        await page.locator('.ag-row[row-index]').first().waitFor();
        await (
            await getAgGridApi(page)
        ).evaluate((api) => {
            api.setFocusedCell(0, 'athlete');
            api.applyColumnState({
                state: [
                    { colId: 'athlete', pinned: 'left' },
                    { colId: 'total', pinned: 'right' }
                ]
            });
        });
        await toggleRowSelection(page, 3);
        await toggleRowSelection(page, 5);
        await toggleRowSelection(page, 6);
        await page
            .locator('.ag-center-cols-viewport')
            .evaluate((element: HTMLElement) => element.scrollTo({ left: 10 }));
        await expect(getScreenshotTarget(page)).toHaveScreenshot('theme-pinned-columns-light.png');
    });

    // Screenshots differ across OS — always update snapshots via Docker: `yarn run e2e:docker:update-snapshots`
    test('with opened filter popup', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 500 });
        await page.goto('/e2e/theme');
        await page.hover('.ag-header-cell[col-id="athlete"]');
        await page.click('.ag-header-cell[col-id="athlete"] .ag-header-cell-filter-button');
        await page.click('.ag-menu .ag-filter-select');
        await expect(getScreenshotTarget(page)).toHaveScreenshot('theme-filter-popup-light.png');
        await enableDarkTheme(page);
        await expect(getScreenshotTarget(page)).toHaveScreenshot('theme-filter-popup-dark.png');
    });
});
