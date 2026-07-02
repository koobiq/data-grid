import { expect, Locator, Page, test } from '@playwright/test';
import { getCell, toggleRowSelection, waitForRowSelected } from './utils/helpers';

const getCopyByCtrlCToggle = (page: Page): Locator => page.getByTestId('e2eCopyByCtrlCToggle');
const getCopyFormatSelect = (page: Page): Locator => page.getByTestId('e2eCopyFormatSelect');
const setClipboardText = async (page: Page, text: string): Promise<void> => {
    await page.evaluate(async (t) => navigator.clipboard.writeText(t), text);
};
const getClipboardText = async (page: Page): Promise<string> => {
    return page.evaluate(async () => navigator.clipboard.readText());
};
const clearClipboard = async (page: Page): Promise<void> => {
    await setClipboardText(page, '');
};
const pressCtrlC = async (page: Page): Promise<void> => page.keyboard.press('ControlOrMeta+c');

test.describe('KbqAgGridCopyByCtrlC', () => {
    test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

    test('does not copy when no rows are selected', async ({ page }) => {
        await page.goto('/e2e/copy-by-ctrl-c');
        await clearClipboard(page);
        await setClipboardText(page, 'test');
        await getCell(page, 0, 'athlete').focus();
        await pressCtrlC(page);
        expect(await getClipboardText(page)).toBe('test');
    });

    test('copies selected rows in TSV format by default', async ({ page }) => {
        await page.goto('/e2e/copy-by-ctrl-c');
        await clearClipboard(page);
        await toggleRowSelection(page, 2);
        await toggleRowSelection(page, 4);
        await toggleRowSelection(page, 5);
        await toggleRowSelection(page, 7);
        // Wait for AG Grid to apply selection state before reading it in the copy handler.
        await waitForRowSelected(page, 7);
        await getCell(page, 4, 'athlete').focus();
        await pressCtrlC(page);
        await expect.poll(async () => getClipboardText(page)).not.toBe('');
        expect(await getClipboardText(page)).toMatchSnapshot('selected-rows-tsv.txt');
    });

    test('copies selected rows in CSV', async ({ page }) => {
        await page.goto('/e2e/copy-by-ctrl-c');
        await clearClipboard(page);
        await getCopyFormatSelect(page).selectOption('csv');
        await toggleRowSelection(page, 2);
        await toggleRowSelection(page, 4);
        await toggleRowSelection(page, 5);
        await toggleRowSelection(page, 7);
        // Wait for AG Grid to apply selection state before reading it in the copy handler.
        await waitForRowSelected(page, 7);
        await getCell(page, 4, 'athlete').focus();
        await pressCtrlC(page);
        await expect.poll(async () => getClipboardText(page)).not.toBe('');
        expect(await getClipboardText(page)).toMatchSnapshot('selected-rows-csv.txt');
    });

    test('copies selected rows in JSON', async ({ page }) => {
        await page.goto('/e2e/copy-by-ctrl-c');
        await clearClipboard(page);
        await getCopyFormatSelect(page).selectOption('json');
        await toggleRowSelection(page, 2);
        await toggleRowSelection(page, 4);
        await toggleRowSelection(page, 5);
        await toggleRowSelection(page, 7);
        // Wait for AG Grid to apply selection state before reading it in the copy handler.
        await waitForRowSelected(page, 7);
        await getCell(page, 4, 'athlete').focus();
        await pressCtrlC(page);
        await expect.poll(async () => getClipboardText(page)).not.toBe('');
        expect(await getClipboardText(page)).toMatchSnapshot('selected-rows-json.txt');
    });

    test('copies selected rows in custom format', async ({ page }) => {
        await page.goto('/e2e/copy-by-ctrl-c');
        await clearClipboard(page);
        await getCopyFormatSelect(page).selectOption('custom');
        await toggleRowSelection(page, 8);
        await toggleRowSelection(page, 9);
        // Wait for AG Grid to apply selection state before reading it in the copy handler.
        await waitForRowSelected(page, 8);
        await waitForRowSelected(page, 9);
        await getCell(page, 4, 'athlete').focus();
        await pressCtrlC(page);
        await expect.poll(async () => getClipboardText(page)).not.toBe('');
        expect(await getClipboardText(page)).toBe('Custom Copy Formatter Output. Selected Nodes: 2.');
    });

    test('does not copy when text is selected on the page', async ({ page }) => {
        await page.goto('/e2e/copy-by-ctrl-c');
        await clearClipboard(page);
        await getCell(page, 4, 'athlete').click({ clickCount: 3 }); // Selects the cell text
        await pressCtrlC(page);
        expect(await getClipboardText(page)).toMatch('Aleksey Nemov');
    });

    test('does not copy when directive is disabled', async ({ page }) => {
        await page.goto('/e2e/copy-by-ctrl-c');
        await clearClipboard(page);
        await getCopyByCtrlCToggle(page).evaluate((label: HTMLLabelElement) => label.click());
        await getCell(page, 4, 'athlete').focus();
        await pressCtrlC(page);
        expect(await getClipboardText(page)).toBe('');
    });
});
