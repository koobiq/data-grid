import { expect, Locator, Page, test } from '@playwright/test';
import { getAgGridApi } from './utils/api';
import { getCell, getRow, isCellFocused } from './utils/helpers';

const getToNextRowByTabToggle = (page: Page): Locator => page.getByTestId('e2eToNextRowByTabToggle');

// Rows are virtualized, so the last rows are not rendered until the grid is scrolled to them.
const scrollToLastRow = async (page: Page): Promise<number> => {
    // Wait for row data to load via HTTP before reading the row count.
    await getRow(page, 0).waitFor();
    return (await getAgGridApi(page)).evaluate((api) => {
        const lastRowIndex = api.getDisplayedRowCount() - 1;
        api.ensureIndexVisible(lastRowIndex);
        return lastRowIndex;
    });
};

test.describe('KbqAgGridToNextRowByTab', () => {
    test('Tab moves focus to the next row', async ({ page }) => {
        await page.goto('/e2e/to-next-row-by-tab');
        await getCell(page, 0, 'athlete').focus();
        await page.keyboard.press('Tab');
        expect(await isCellFocused(page, 1, 'athlete')).toBe(true);
    });

    test('Shift+Tab moves focus to the previous row', async ({ page }) => {
        await page.goto('/e2e/to-next-row-by-tab');
        await getCell(page, 2, 'athlete').focus();
        await page.keyboard.press('Shift+Tab');
        expect(await isCellFocused(page, 1, 'athlete')).toBe(true);
    });

    test('Tab moves focus from the penultimate row to the last row', async ({ page }) => {
        await page.goto('/e2e/to-next-row-by-tab');
        const lastRowIndex = await scrollToLastRow(page);
        await getCell(page, lastRowIndex - 1, 'athlete').focus();
        await page.keyboard.press('Tab');
        expect(await isCellFocused(page, lastRowIndex, 'athlete')).toBe(true);
    });

    test('Tab on the last row moves focus away from the cells', async ({ page }) => {
        const pageErrors: Error[] = [];
        page.on('pageerror', (error) => {
            pageErrors.push(error);
        });
        await page.goto('/e2e/to-next-row-by-tab');
        const lastRowIndex = await scrollToLastRow(page);
        const lastRowCell = getCell(page, lastRowIndex, 'athlete');
        await lastRowCell.focus();
        await expect(lastRowCell).toBeFocused();
        await page.keyboard.press('Tab');
        // The browser handles this Tab; Chromium may stop on AG Grid's scroll containers, so only cells are checked.
        await expect(
            page.getByTestId('e2eScreenshotTarget').locator('.ag-cell:focus, .ag-header-cell:focus')
        ).toHaveCount(0);
        expect(pageErrors).toEqual([]);
    });

    test('Shift+Tab on the first row moves focus to the header', async ({ page }) => {
        await page.goto('/e2e/to-next-row-by-tab');
        await getCell(page, 0, 'athlete').focus();
        await page.keyboard.press('Shift+Tab');
        await expect(
            page.getByTestId('e2eScreenshotTarget').locator('.ag-header-cell[col-id="athlete"]')
        ).toBeFocused();
    });

    test('does not navigate to next row when disabled', async ({ page }) => {
        await page.goto('/e2e/to-next-row-by-tab');
        await getToNextRowByTabToggle(page).evaluate((label: HTMLLabelElement) => label.click());
        await getCell(page, 0, 'athlete').focus();
        await page.keyboard.press('Tab');
        expect(await isCellFocused(page, 0, 'age')).toBe(true);
    });
});
