import { expect, Locator, Page, test } from '@playwright/test';

test.describe('AgGridAngular', () => {
    const getShowIndexColumnToggle = (page: Page): Locator => page.getByTestId('e2eShowIndexColumnToggle');
    const getLightThemeToggle = (page: Page): Locator => page.getByTestId('e2eLightThemeToggle');
    const getPaginationToggle = (page: Page): Locator => page.getByTestId('e2ePaginationToggle');
    const getScreenshotTarget = (page: Page): Locator => page.getByTestId('e2eScreenshotTarget');
    const getPinFirstColumnToggle = (page: Page): Locator => page.getByTestId('e2ePinFirstColumnToggle');
    const getPinLastColumnToggle = (page: Page): Locator => page.getByTestId('e2ePinLastColumnToggle');

    test('default state', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 500 });
        await page.goto('/');
        await getShowIndexColumnToggle(page).evaluate((label: HTMLLabelElement) => label.click());
        await getPaginationToggle(page).evaluate((label: HTMLLabelElement) => label.click());
        await expect(getScreenshotTarget(page)).toHaveScreenshot('01-light.png');
        await getLightThemeToggle(page).evaluate((label: HTMLLabelElement) => label.click());
        await expect(getScreenshotTarget(page)).toHaveScreenshot('01-dark.png');
    });

    test('with pinned columns', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 500 });
        await page.goto('/');
        await getShowIndexColumnToggle(page).evaluate((label: HTMLLabelElement) => label.click());
        await getPinFirstColumnToggle(page).evaluate((label: HTMLLabelElement) => label.click());
        await getPinLastColumnToggle(page).evaluate((label: HTMLLabelElement) => label.click());
        await expect(getScreenshotTarget(page)).toHaveScreenshot('02-light.png');
    });
});

test.describe('KbqAgGridCopyByCtrlC', () => {
    test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

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
    const getCell = (page: Page, rowIndex: number, colField: string): Locator => {
        return page.locator(`[row-index="${rowIndex}"] [col-id="${colField}"]`);
    };
    const deselectRow = async (page: Page, rowIndex: number): Promise<void> => {
        return page.locator(`[row-index="${rowIndex}"] .ag-selection-checkbox`).click();
    };
    const displayDetails = async (page: Page): Promise<void> => {
        return page.getByTestId('e2eOptionsAccordion').evaluate((element: HTMLDetailsElement) => {
            element.open = true;
        });
    };
    const pressCtrlC = async (page: Page): Promise<void> => page.keyboard.press('ControlOrMeta+c');

    test('does not copy when no rows are selected', async ({ page }) => {
        await page.goto('/');
        await clearClipboard(page);
        await setClipboardText(page, 'test');
        await deselectRow(page, 4);
        await deselectRow(page, 5);
        await getCell(page, 0, 'athlete').focus();
        await pressCtrlC(page);

        expect(await getClipboardText(page)).toBe('test');
    });

    test('copies selected rows in TSV format by default', async ({ page }) => {
        await page.goto('/');
        await clearClipboard(page);
        await getCell(page, 4, 'athlete').focus();
        await pressCtrlC(page);

        expect(await getClipboardText(page)).toMatchSnapshot('01.txt');
    });

    test('copies selected rows in CSV', async ({ page }) => {
        await page.goto('/');
        await clearClipboard(page);
        await displayDetails(page);
        await getCopyFormatSelect(page).selectOption('csv');
        await getCell(page, 4, 'athlete').focus();
        await pressCtrlC(page);

        expect(await getClipboardText(page)).toMatchSnapshot('02.txt');
    });

    test('copies selected rows in JSON', async ({ page }) => {
        await page.goto('/');
        await clearClipboard(page);
        await displayDetails(page);
        await getCopyFormatSelect(page).selectOption('json');
        await getCell(page, 4, 'athlete').focus();
        await pressCtrlC(page);

        expect(await getClipboardText(page)).toMatchSnapshot('03.txt');
    });

    test('copies selected rows in custom format', async ({ page }) => {
        await page.goto('/');
        await clearClipboard(page);
        await displayDetails(page);
        await getCopyFormatSelect(page).selectOption('custom');
        await getCell(page, 4, 'athlete').focus();
        await pressCtrlC(page);

        expect(await getClipboardText(page)).toBe('Custom Copy Formatter Output. Selected Nodes: 2.');
    });

    test('does not copy when text is selected on the page', async ({ page }) => {
        await page.goto('/');
        await clearClipboard(page);
        await getCell(page, 4, 'athlete').click({ clickCount: 3 }); // Selects the cell text
        await pressCtrlC(page);

        expect(await getClipboardText(page)).toMatch('Aleksey Nemov');
    });

    test('does not copy when directive is disabled', async ({ page }) => {
        await page.goto('/');
        await clearClipboard(page);
        await getCopyByCtrlCToggle(page).evaluate((label: HTMLLabelElement) => label.click());
        await getCell(page, 4, 'athlete').focus();
        await pressCtrlC(page);

        expect(await getClipboardText(page)).toBe('');
    });
});
