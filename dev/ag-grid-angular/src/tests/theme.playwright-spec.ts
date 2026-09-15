import { expect, Locator, Page, test } from '@playwright/test';
import { getAgGridApi } from './utils/api';
import { getCell, getRow, toggleRowSelection } from './utils/helpers';
import { enableDarkTheme } from './utils/theme';

const getScreenshotTarget = (page: Page): Locator => page.getByTestId('e2eScreenshotTarget');

// Pinned columns split a row into one `.ag-row` element per container, so every part is returned.
const getRowBackgrounds = async (page: Page, rowIndex: number): Promise<string[]> =>
    getRow(page, rowIndex).evaluateAll((rows) => rows.map((row) => getComputedStyle(row).backgroundColor));

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
        // Wait for async row data and the generated selection column before capturing the grid.
        await page.locator('.ag-row[row-index]').first().waitFor();
        await page.locator('.ag-header-cell input[type="checkbox"]').first().waitFor();
        await page.locator('.ag-header-cell[col-id="athlete"]').hover();
        await page.locator('.ag-header-cell[col-id="athlete"] .ag-header-cell-filter-button').click();
        await page.locator('.ag-menu .ag-filter-select').click();
        await page.getByRole('option', { name: 'Contains', exact: true }).waitFor();
        // Navigate to "Equals" by keyboard (rather than hover) to deterministically capture
        // the select item's highlighted state regardless of pointer/layout timing.
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await expect(page.getByRole('option', { name: 'Equals', exact: true })).toHaveClass(/ag-active-item/);
        // The selection checkbox column can still be settling at this point; re-check right before
        // capturing to avoid a race where it briefly disappears and shifts every column.
        await expect(page.locator('.ag-header-cell input[type="checkbox"]').first()).toBeVisible();
        await expect(getScreenshotTarget(page)).toHaveScreenshot('theme-filter-popup-light.png');
        await enableDarkTheme(page);
        await expect(getScreenshotTarget(page)).toHaveScreenshot('theme-filter-popup-dark.png');
    });

    test('highlights the focused row only while focus is inside it', async ({ page }) => {
        await page.goto('/e2e/theme');
        // Wait for row data to load via HTTP before manipulating grid state.
        await page.locator('.ag-row[row-index]').first().waitFor();
        await (
            await getAgGridApi(page)
        ).evaluate((api) => {
            api.applyColumnState({ state: [{ colId: 'athlete', pinned: 'left' }] });
            api.setFocusedCell(1, 'country');
        });
        await expect(getRow(page, 1)).toHaveCount(2);
        const [unfocusedBackground] = await getRowBackgrounds(page, 2);
        const focusedBackgrounds = await getRowBackgrounds(page, 1);

        expect(focusedBackgrounds).toEqual([focusedBackgrounds[0], focusedBackgrounds[0]]);
        expect(focusedBackgrounds[0]).not.toBe(unfocusedBackground);

        await getCell(page, 1, 'country').blur();

        expect(await getRowBackgrounds(page, 1)).toEqual([unfocusedBackground, unfocusedBackground]);
    });

    test('keeps the selection background after focus leaves a selected row', async ({ page }) => {
        await page.goto('/e2e/theme');
        // Wait for row data to load via HTTP before manipulating grid state.
        await page.locator('.ag-row[row-index]').first().waitFor();
        await (
            await getAgGridApi(page)
        ).evaluate((api) => {
            api.getDisplayedRowAtIndex(1)?.setSelected(true);
            api.getDisplayedRowAtIndex(3)?.setSelected(true);
            api.setFocusedCell(1, 'athlete');
        });
        const selectedBackgrounds = await getRowBackgrounds(page, 3);

        expect(await getRowBackgrounds(page, 1)).not.toEqual(selectedBackgrounds);

        await getCell(page, 1, 'athlete').blur();

        expect(await getRowBackgrounds(page, 1)).toEqual(selectedBackgrounds);
    });
});
