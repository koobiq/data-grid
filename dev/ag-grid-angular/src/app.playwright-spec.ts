import { expect, Locator, Page, test } from '@playwright/test';

test.describe('KbqAgGridThemeModule', () => {
    const getScreenshotTarget = (page: Page): Locator => page.getByTestId('e2eScreenshotTarget');
    const getCell = (page: Page, rowIndex: number, colField: string): Locator =>
        page.locator(`[row-index="${rowIndex}"] [col-id="${colField}"]`);
    const getRow = (page: Page, rowIndex: number): Locator => page.locator(`.ag-row[row-index="${rowIndex}"]`);
    const displayOptions = async (page: Page): Promise<void> => {
        return page.getByTestId('e2eOptionsAccordion').evaluate((element: HTMLDetailsElement) => {
            element.open = true;
        });
    };

    test.describe('KbqAgGridAngularTheme', () => {
        const getShowIndexColumnToggle = (page: Page): Locator => page.getByTestId('e2eShowIndexColumnToggle');
        const getLightThemeToggle = (page: Page): Locator => page.getByTestId('e2eLightThemeToggle');
        const getPaginationToggle = (page: Page): Locator => page.getByTestId('e2ePaginationToggle');
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
        const toggleRowSelection = async (page: Page, rowIndex: number): Promise<void> => {
            return page.locator(`[row-index="${rowIndex}"] .ag-selection-checkbox`).click();
        };
        const pressCtrlC = async (page: Page): Promise<void> => page.keyboard.press('ControlOrMeta+c');

        test('does not copy when no rows are selected', async ({ page }) => {
            await page.goto('/');
            await clearClipboard(page);
            await setClipboardText(page, 'test');
            await toggleRowSelection(page, 4);
            await toggleRowSelection(page, 5);
            await getCell(page, 0, 'athlete').focus();
            await pressCtrlC(page);

            expect(await getClipboardText(page)).toBe('test');
        });

        test('copies selected rows in TSV format by default', async ({ page }) => {
            await page.goto('/');
            await clearClipboard(page);
            await toggleRowSelection(page, 2);
            await toggleRowSelection(page, 7);
            await getCell(page, 4, 'athlete').focus();
            await pressCtrlC(page);

            expect(await getClipboardText(page)).toMatchSnapshot('01.txt');
        });

        test('copies selected rows in CSV', async ({ page }) => {
            await page.goto('/');
            await clearClipboard(page);
            await displayOptions(page);
            await getCopyFormatSelect(page).selectOption('csv');
            await toggleRowSelection(page, 2);
            await toggleRowSelection(page, 7);
            await getCell(page, 4, 'athlete').focus();
            await pressCtrlC(page);

            expect(await getClipboardText(page)).toMatchSnapshot('02.txt');
        });

        test('copies selected rows in JSON', async ({ page }) => {
            await page.goto('/');
            await clearClipboard(page);
            await displayOptions(page);
            await getCopyFormatSelect(page).selectOption('json');
            await toggleRowSelection(page, 2);
            await toggleRowSelection(page, 7);
            await getCell(page, 4, 'athlete').focus();
            await pressCtrlC(page);

            expect(await getClipboardText(page)).toMatchSnapshot('03.txt');
        });

        test('copies selected rows in custom format', async ({ page }) => {
            await page.goto('/');
            await clearClipboard(page);
            await displayOptions(page);
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

    test.describe('KbqAgGridToNextRowByTab', () => {
        const getToNextRowByTabToggle = (page: Page): Locator => page.getByTestId('e2eToNextRowByTabToggle');

        test('Tab moves focus to the next row', async ({ page }) => {
            await page.goto('/');
            await getCell(page, 0, 'athlete').focus();
            await page.keyboard.press('Tab');
            await expect(getCell(page, 1, 'athlete')).toHaveClass(/ag-cell-focus/);
        });

        test('Shift+Tab moves focus to the previous row', async ({ page }) => {
            await page.goto('/');
            await getCell(page, 2, 'athlete').focus();
            await page.keyboard.press('Shift+Tab');
            await expect(getCell(page, 1, 'athlete')).toHaveClass(/ag-cell-focus/);
        });

        test('does not navigate to next row when disabled', async ({ page }) => {
            await page.goto('/');
            await displayOptions(page);
            await getToNextRowByTabToggle(page).evaluate((label: HTMLLabelElement) => label.click());
            await getCell(page, 0, 'athlete').focus();
            await page.keyboard.press('Tab');
            await expect(getCell(page, 0, 'age')).toHaveClass(/ag-cell-focus/);
        });
    });

    test.describe('KbqAgGridSelectRowsByShiftArrow', () => {
        const getSelectRowsByShiftArrowToggle = (page: Page): Locator =>
            page.getByTestId('e2eSelectRowsByShiftArrowToggle');

        test('Shift+Down selects the focused row and the next row', async ({ page }) => {
            await page.goto('/');
            await getCell(page, 0, 'athlete').focus();
            await page.keyboard.press('Shift+ArrowDown');
            await expect(getRow(page, 0)).toHaveClass(/ag-row-selected/);
            await expect(getRow(page, 1)).toHaveClass(/ag-row-selected/);
        });

        test('Shift+Up selects the focused row and the previous row', async ({ page }) => {
            await page.goto('/');
            await getCell(page, 2, 'athlete').focus();
            await page.keyboard.press('Shift+ArrowUp');
            await expect(getRow(page, 1)).toHaveClass(/ag-row-selected/);
            await expect(getRow(page, 2)).toHaveClass(/ag-row-selected/);
        });

        test('repeated Shift+Down extends the selection', async ({ page }) => {
            await page.goto('/');
            await getCell(page, 0, 'athlete').focus();
            await page.keyboard.press('Shift+ArrowDown');
            await page.keyboard.press('Shift+ArrowDown');
            await expect(getRow(page, 0)).toHaveClass(/ag-row-selected/);
            await expect(getRow(page, 1)).toHaveClass(/ag-row-selected/);
            await expect(getRow(page, 2)).toHaveClass(/ag-row-selected/);
        });

        test('does not select rows when disabled', async ({ page }) => {
            await page.goto('/');
            await displayOptions(page);
            await getSelectRowsByShiftArrowToggle(page).evaluate((label: HTMLLabelElement) => label.click());
            await getCell(page, 0, 'athlete').focus();
            await page.keyboard.press('Shift+ArrowDown');
            await expect(getRow(page, 0)).not.toHaveClass(/ag-row-selected/);
            await expect(getRow(page, 1)).not.toHaveClass(/ag-row-selected/);
        });
    });

    test.describe('KbqAgGridSelectRowsByCtrlClick', () => {
        const getSelectRowsByCtrlClickToggle = (page: Page): Locator =>
            page.getByTestId('e2eSelectRowsByCtrlClickToggle');

        test('Ctrl+Click selects an unselected row', async ({ page }) => {
            await page.goto('/');
            await getCell(page, 0, 'athlete').click({ modifiers: ['ControlOrMeta'] });
            await expect(getRow(page, 0)).toHaveClass(/ag-row-selected/);
        });

        test('Ctrl+Click deselects an already selected row', async ({ page }) => {
            await page.goto('/');
            await getCell(page, 4, 'athlete').click({ modifiers: ['ControlOrMeta'] });
            await expect(getRow(page, 4)).not.toHaveClass(/ag-row-selected/);
        });

        test('Ctrl+Click preserves existing selection', async ({ page }) => {
            await page.goto('/');
            await getCell(page, 0, 'athlete').click({ modifiers: ['ControlOrMeta'] });
            await expect(getRow(page, 0)).toHaveClass(/ag-row-selected/);
            await expect(getRow(page, 4)).toHaveClass(/ag-row-selected/);
            await expect(getRow(page, 5)).toHaveClass(/ag-row-selected/);
        });

        test('does not toggle selection when disabled', async ({ page }) => {
            await page.goto('/');
            await displayOptions(page);
            await getSelectRowsByCtrlClickToggle(page).evaluate((label: HTMLLabelElement) => label.click());
            await getCell(page, 0, 'athlete').click({ modifiers: ['ControlOrMeta'] });
            await expect(getRow(page, 0)).not.toHaveClass(/ag-row-selected/);
        });
    });

    test.describe('KbqAgGridRowActions', () => {
        test('shows actions overlay on hover with horizontal scroll', async ({ page }) => {
            await page.setViewportSize({ width: 650, height: 500 });
            await page.goto('/');

            const row = page.locator('[row-index="1"]').first();

            await row.hover();

            await expect(getScreenshotTarget(page)).toHaveScreenshot('03-light.png');
        });
    });
});
