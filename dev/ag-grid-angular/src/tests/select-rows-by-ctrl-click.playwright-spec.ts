import { expect, Locator, Page, test } from '@playwright/test';
import { getCell, isRowSelected, toggleRowSelection } from './utils/helpers';

const getSelectRowsByCtrlClickToggle = (page: Page): Locator => page.getByTestId('e2eSelectRowsByCtrlClickToggle');

test.describe('KbqAgGridSelectRowsByCtrlClick', () => {
    test('Ctrl+Click selects an unselected row', async ({ page }) => {
        await page.goto('/e2e/select-rows-by-ctrl-click');
        expect(await isRowSelected(page, 0)).toBe(false);
        await getCell(page, 0, 'athlete').click({ modifiers: ['ControlOrMeta'] });
        expect(await isRowSelected(page, 0)).toBe(true);
    });

    test('Ctrl+Click deselects an already selected row', async ({ page }) => {
        await page.goto('/e2e/select-rows-by-ctrl-click');
        await toggleRowSelection(page, 4);
        expect(await isRowSelected(page, 4)).toBe(true);
        await getCell(page, 4, 'athlete').click({ modifiers: ['ControlOrMeta'] });
        expect(await isRowSelected(page, 4)).toBe(false);
    });

    test('does not toggle selection when disabled', async ({ page }) => {
        await page.goto('/e2e/select-rows-by-ctrl-click');
        await getSelectRowsByCtrlClickToggle(page).evaluate((label: HTMLLabelElement) => label.click());
        await getCell(page, 0, 'athlete').click({ modifiers: ['ControlOrMeta'] });
        expect(await isRowSelected(page, 0)).toBe(false);
    });
});
