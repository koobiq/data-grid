import { expect, Locator, Page, test } from '@playwright/test';
import { getRow, isRowSelected, toggleRowSelection } from './utils/helpers';

const getSelectRowsByShiftClickToggle = (page: Page): Locator => page.getByTestId('e2eSelectRowsByShiftClickToggle');

const shiftClickCheckbox = async (page: Page, rowIndex: number): Promise<void> =>
    getRow(page, rowIndex)
        .locator('.ag-checkbox-input')
        .click({ modifiers: ['Shift'] });

test.describe('KbqAgGridSelectRowsByShiftClick', () => {
    test('Shift+Click selects a range between anchor and clicked row', async ({ page }) => {
        await page.goto('/e2e/select-rows-by-shift-click');
        await toggleRowSelection(page, 1);
        await shiftClickCheckbox(page, 3);
        expect(await isRowSelected(page, 0)).toBe(false);
        expect(await isRowSelected(page, 1)).toBe(true);
        expect(await isRowSelected(page, 2)).toBe(true);
        expect(await isRowSelected(page, 3)).toBe(true);
        expect(await isRowSelected(page, 4)).toBe(false);
    });

    test('plain checkbox click resets the anchor', async ({ page }) => {
        await page.goto('/e2e/select-rows-by-shift-click');
        await toggleRowSelection(page, 0);
        await shiftClickCheckbox(page, 2);
        expect(await isRowSelected(page, 0)).toBe(true);
        expect(await isRowSelected(page, 1)).toBe(true);
        expect(await isRowSelected(page, 2)).toBe(true);
        await toggleRowSelection(page, 4);
        await shiftClickCheckbox(page, 6);
        expect(await isRowSelected(page, 0)).toBe(true);
        expect(await isRowSelected(page, 1)).toBe(true);
        expect(await isRowSelected(page, 2)).toBe(true);
        expect(await isRowSelected(page, 3)).toBe(false);
        expect(await isRowSelected(page, 4)).toBe(true);
        expect(await isRowSelected(page, 5)).toBe(true);
        expect(await isRowSelected(page, 6)).toBe(true);
        expect(await isRowSelected(page, 7)).toBe(false);
    });

    test('should unselect selected rows', async ({ page }) => {
        await page.goto('/e2e/select-rows-by-shift-click');
        await toggleRowSelection(page, 0);
        await shiftClickCheckbox(page, 3);
        expect(await isRowSelected(page, 0)).toBe(true);
        expect(await isRowSelected(page, 1)).toBe(true);
        expect(await isRowSelected(page, 2)).toBe(true);
        expect(await isRowSelected(page, 3)).toBe(true);
        await shiftClickCheckbox(page, 0);
        expect(await isRowSelected(page, 0)).toBe(false);
        expect(await isRowSelected(page, 1)).toBe(false);
        expect(await isRowSelected(page, 2)).toBe(false);
        expect(await isRowSelected(page, 3)).toBe(false);
    });

    test('should unselect rows in the middle of range with shift click', async ({ page }) => {
        await page.goto('/e2e/select-rows-by-shift-click');
        await toggleRowSelection(page, 0);
        await shiftClickCheckbox(page, 4);
        expect(await isRowSelected(page, 0)).toBe(true);
        expect(await isRowSelected(page, 1)).toBe(true);
        expect(await isRowSelected(page, 2)).toBe(true);
        expect(await isRowSelected(page, 3)).toBe(true);
        expect(await isRowSelected(page, 4)).toBe(true);
        await toggleRowSelection(page, 3);
        await shiftClickCheckbox(page, 1);
        expect(await isRowSelected(page, 0)).toBe(true);
        expect(await isRowSelected(page, 1)).toBe(false);
        expect(await isRowSelected(page, 2)).toBe(false);
        expect(await isRowSelected(page, 3)).toBe(false);
        expect(await isRowSelected(page, 4)).toBe(true);
    });

    test('should handle complex shift click scenarios', async ({ page }) => {
        await page.goto('/e2e/select-rows-by-shift-click');
        await toggleRowSelection(page, 0);
        await shiftClickCheckbox(page, 4);
        expect(await isRowSelected(page, 0)).toBe(true);
        expect(await isRowSelected(page, 1)).toBe(true);
        expect(await isRowSelected(page, 2)).toBe(true);
        expect(await isRowSelected(page, 3)).toBe(true);
        expect(await isRowSelected(page, 4)).toBe(true);
        await toggleRowSelection(page, 3);
        await shiftClickCheckbox(page, 1);
        expect(await isRowSelected(page, 0)).toBe(true);
        expect(await isRowSelected(page, 1)).toBe(false);
        expect(await isRowSelected(page, 2)).toBe(false);
        expect(await isRowSelected(page, 3)).toBe(false);
        expect(await isRowSelected(page, 4)).toBe(true);
        await shiftClickCheckbox(page, 6);
        expect(await isRowSelected(page, 0)).toBe(true);
        expect(await isRowSelected(page, 1)).toBe(true);
        expect(await isRowSelected(page, 2)).toBe(true);
        expect(await isRowSelected(page, 3)).toBe(true);
        expect(await isRowSelected(page, 4)).toBe(true);
        expect(await isRowSelected(page, 5)).toBe(true);
        expect(await isRowSelected(page, 6)).toBe(true);
    });

    test('should preserve default AG Grid Shift+Click behavior when disabled', async ({ page }) => {
        await page.goto('/e2e/select-rows-by-shift-click');
        await getSelectRowsByShiftClickToggle(page).evaluate((label: HTMLLabelElement) => label.click());
        await toggleRowSelection(page, 0);
        await shiftClickCheckbox(page, 3);
        expect(await isRowSelected(page, 0)).toBe(true);
        expect(await isRowSelected(page, 1)).toBe(true);
        expect(await isRowSelected(page, 2)).toBe(true);
        expect(await isRowSelected(page, 3)).toBe(true);
        await shiftClickCheckbox(page, 0);
        expect(await isRowSelected(page, 0)).toBe(true);
        expect(await isRowSelected(page, 1)).toBe(false);
        expect(await isRowSelected(page, 2)).toBe(false);
        expect(await isRowSelected(page, 3)).toBe(false);
    });
});
