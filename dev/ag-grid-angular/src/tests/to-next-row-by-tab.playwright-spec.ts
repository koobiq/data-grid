import { expect, Locator, Page, test } from '@playwright/test';
import { getCell, isCellFocused } from './utils/helpers';

const getToNextRowByTabToggle = (page: Page): Locator => page.getByTestId('e2eToNextRowByTabToggle');

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

    test('does not navigate to next row when disabled', async ({ page }) => {
        await page.goto('/e2e/to-next-row-by-tab');
        await getToNextRowByTabToggle(page).evaluate((label: HTMLLabelElement) => label.click());
        await getCell(page, 0, 'athlete').focus();
        await page.keyboard.press('Tab');
        expect(await isCellFocused(page, 0, 'age')).toBe(true);
    });
});
