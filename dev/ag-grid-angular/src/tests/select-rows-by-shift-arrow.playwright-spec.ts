import { expect, Locator, Page, test } from '@playwright/test';
import { getCell, isRowSelected } from './utils/helpers';

const getSelectRowsByShiftArrowToggle = (page: Page): Locator => page.getByTestId('e2eSelectRowsByShiftArrowToggle');

test.describe('KbqAgGridSelectRowsByShiftArrow', () => {
    test('Shift+Down selects the focused row and the next row', async ({ page }) => {
        await page.goto('/e2e/select-rows-by-shift-arrow');
        await getCell(page, 0, 'athlete').focus();
        await page.keyboard.press('Shift+ArrowDown');
        expect(await isRowSelected(page, 0)).toBe(true);
        expect(await isRowSelected(page, 1)).toBe(true);
    });

    test('Shift+Up selects the focused row and the previous row', async ({ page }) => {
        await page.goto('/e2e/select-rows-by-shift-arrow');
        await getCell(page, 2, 'athlete').focus();
        await page.keyboard.press('Shift+ArrowUp');
        expect(await isRowSelected(page, 0)).toBe(false);
        expect(await isRowSelected(page, 1)).toBe(true);
        expect(await isRowSelected(page, 2)).toBe(true);
        expect(await isRowSelected(page, 3)).toBe(false);
    });

    test('repeated Shift+Down extends the selection', async ({ page }) => {
        await page.goto('/e2e/select-rows-by-shift-arrow');
        await getCell(page, 1, 'athlete').focus();
        await page.keyboard.press('Shift+ArrowDown');
        await page.keyboard.press('Shift+ArrowDown');
        expect(await isRowSelected(page, 0)).toBe(false);
        expect(await isRowSelected(page, 1)).toBe(true);
        expect(await isRowSelected(page, 2)).toBe(true);
        expect(await isRowSelected(page, 3)).toBe(true);
        expect(await isRowSelected(page, 4)).toBe(false);
    });

    test('does not select rows when disabled', async ({ page }) => {
        await page.goto('/e2e/select-rows-by-shift-arrow');
        await getSelectRowsByShiftArrowToggle(page).evaluate((label: HTMLLabelElement) => label.click());
        await getCell(page, 0, 'athlete').focus();
        await page.keyboard.press('Shift+ArrowDown');
        expect(await isRowSelected(page, 0)).toBe(false);
        expect(await isRowSelected(page, 1)).toBe(false);
    });
});
