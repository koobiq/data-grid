import { expect, Locator, Page, test } from '@playwright/test';

test.describe('KbqAgGridThemeModule', () => {
    const getScreenshotTarget = (page: Page): Locator => page.getByTestId('e2eScreenshotTarget');
    const getRow = (page: Page, rowIndex: number): Locator => page.locator(`.ag-row[row-index="${rowIndex}"]`);
    const getCell = (page: Page, rowIndex: number, colField: string): Locator =>
        getRow(page, rowIndex).locator(`.ag-cell[col-id="${colField}"]`);
    const displayOptions = async (page: Page): Promise<void> =>
        page.getByTestId('e2eOptionsAccordion').evaluate((element: HTMLDetailsElement) => {
            element.open = true;
        });
    const isRowSelected = async (page: Page, rowIndex: number): Promise<boolean> =>
        getRow(page, rowIndex).evaluate((el: Element) => el.classList.contains('ag-row-selected'));
    const isCellFocused = async (page: Page, rowIndex: number, colField: string): Promise<boolean> =>
        getCell(page, rowIndex, colField).evaluate((el: Element) => el.classList.contains('ag-cell-focus'));
    const unselectAllRows = async (page: Page): Promise<void> => {
        const headerCheckbox = page.locator('.ag-header-cell[col-id="ag-Grid-SelectionColumn"] .ag-checkbox-input');
        await headerCheckbox.click();
        await headerCheckbox.click();
        await Promise.all(
            // Selected rows by default
            [4, 5].map(async (rowIndex) => expect(await isRowSelected(page, rowIndex)).toBe(false))
        );
    };
    const toggleRowSelection = async (page: Page, rowIndex: number): Promise<void> =>
        getRow(page, rowIndex).locator('.ag-checkbox-input').click();

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
        const pressCtrlC = async (page: Page): Promise<void> => page.keyboard.press('ControlOrMeta+c');

        test('does not copy when no rows are selected', async ({ page }) => {
            await page.goto('/');
            await unselectAllRows(page);
            await clearClipboard(page);
            await setClipboardText(page, 'test');
            await getCell(page, 0, 'athlete').focus();
            await pressCtrlC(page);
            expect(await getClipboardText(page)).toBe('test');
        });

        test('copies selected rows in TSV format by default', async ({ page }) => {
            await page.goto('/');
            await unselectAllRows(page);
            await clearClipboard(page);
            await toggleRowSelection(page, 2);
            await toggleRowSelection(page, 4);
            await toggleRowSelection(page, 5);
            await toggleRowSelection(page, 7);
            await getCell(page, 4, 'athlete').focus();
            await pressCtrlC(page);
            expect(await getClipboardText(page)).toMatchSnapshot('01.txt');
        });

        test('copies selected rows in CSV', async ({ page }) => {
            await page.goto('/');
            await unselectAllRows(page);
            await clearClipboard(page);
            await displayOptions(page);
            await getCopyFormatSelect(page).selectOption('csv');
            await toggleRowSelection(page, 2);
            await toggleRowSelection(page, 4);
            await toggleRowSelection(page, 5);
            await toggleRowSelection(page, 7);
            await getCell(page, 4, 'athlete').focus();
            await pressCtrlC(page);
            expect(await getClipboardText(page)).toMatchSnapshot('02.txt');
        });

        test('copies selected rows in JSON', async ({ page }) => {
            await page.goto('/');
            await unselectAllRows(page);
            await clearClipboard(page);
            await displayOptions(page);
            await getCopyFormatSelect(page).selectOption('json');
            await toggleRowSelection(page, 2);
            await toggleRowSelection(page, 4);
            await toggleRowSelection(page, 5);
            await toggleRowSelection(page, 7);
            await getCell(page, 4, 'athlete').focus();
            await pressCtrlC(page);
            expect(await getClipboardText(page)).toMatchSnapshot('03.txt');
        });

        test('copies selected rows in custom format', async ({ page }) => {
            await page.goto('/');
            await unselectAllRows(page);
            await clearClipboard(page);
            await displayOptions(page);
            await getCopyFormatSelect(page).selectOption('custom');
            await toggleRowSelection(page, 8);
            await toggleRowSelection(page, 9);
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
            expect(await isCellFocused(page, 1, 'athlete')).toBe(true);
        });

        test('Shift+Tab moves focus to the previous row', async ({ page }) => {
            await page.goto('/');
            await getCell(page, 2, 'athlete').focus();
            await page.keyboard.press('Shift+Tab');
            expect(await isCellFocused(page, 1, 'athlete')).toBe(true);
        });

        test('does not navigate to next row when disabled', async ({ page }) => {
            await page.goto('/');
            await displayOptions(page);
            await getToNextRowByTabToggle(page).evaluate((label: HTMLLabelElement) => label.click());
            await getCell(page, 0, 'athlete').focus();
            await page.keyboard.press('Tab');
            expect(await isCellFocused(page, 0, 'age')).toBe(true);
        });
    });

    test.describe('KbqAgGridSelectRowsByShiftArrow', () => {
        const getSelectRowsByShiftArrowToggle = (page: Page): Locator =>
            page.getByTestId('e2eSelectRowsByShiftArrowToggle');

        test('Shift+Down selects the focused row and the next row', async ({ page }) => {
            await page.goto('/');
            await unselectAllRows(page);
            await getCell(page, 0, 'athlete').focus();
            await page.keyboard.press('Shift+ArrowDown');
            expect(await isRowSelected(page, 0)).toBe(true);
            expect(await isRowSelected(page, 1)).toBe(true);
        });

        test('Shift+Up selects the focused row and the previous row', async ({ page }) => {
            await page.goto('/');
            await unselectAllRows(page);
            await getCell(page, 2, 'athlete').focus();
            await page.keyboard.press('Shift+ArrowUp');
            expect(await isRowSelected(page, 0)).toBe(false);
            expect(await isRowSelected(page, 1)).toBe(true);
            expect(await isRowSelected(page, 2)).toBe(true);
            expect(await isRowSelected(page, 3)).toBe(false);
        });

        test('repeated Shift+Down extends the selection', async ({ page }) => {
            await page.goto('/');
            await unselectAllRows(page);
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
            await page.goto('/');
            await displayOptions(page);
            await getSelectRowsByShiftArrowToggle(page).evaluate((label: HTMLLabelElement) => label.click());
            await getCell(page, 0, 'athlete').focus();
            await page.keyboard.press('Shift+ArrowDown');
            expect(await isRowSelected(page, 0)).toBe(false);
            expect(await isRowSelected(page, 1)).toBe(false);
        });
    });

    test.describe('KbqAgGridSelectRowsByCtrlClick', () => {
        const getSelectRowsByCtrlClickToggle = (page: Page): Locator =>
            page.getByTestId('e2eSelectRowsByCtrlClickToggle');

        test('Ctrl+Click selects an unselected row', async ({ page }) => {
            await page.goto('/');
            await unselectAllRows(page);
            expect(await isRowSelected(page, 0)).toBe(false);
            await getCell(page, 0, 'athlete').click({ modifiers: ['ControlOrMeta'] });
            expect(await isRowSelected(page, 0)).toBe(true);
        });

        test('Ctrl+Click deselects an already selected row', async ({ page }) => {
            await page.goto('/');
            await unselectAllRows(page);
            await toggleRowSelection(page, 4);
            expect(await isRowSelected(page, 4)).toBe(true);
            await getCell(page, 4, 'athlete').click({ modifiers: ['ControlOrMeta'] });
            expect(await isRowSelected(page, 4)).toBe(false);
        });

        test('does not toggle selection when disabled', async ({ page }) => {
            await page.goto('/');
            await displayOptions(page);
            await getSelectRowsByCtrlClickToggle(page).evaluate((label: HTMLLabelElement) => label.click());
            await getCell(page, 0, 'athlete').click({ modifiers: ['ControlOrMeta'] });
            expect(await isRowSelected(page, 0)).toBe(false);
        });
    });

    test.describe('KbqAgGridRowActions', () => {
        test('shows actions overlay on hover with horizontal scroll', async ({ page }) => {
            await page.setViewportSize({ width: 650, height: 500 });
            await page.goto('/');

            const row = getRow(page, 1).first();

            await row.hover();

            await expect(getScreenshotTarget(page)).toHaveScreenshot('03-light.png');
        });
    });

    test.describe('KbqAgGridSelectRowsByShiftClick', () => {
        const getSelectRowsByShiftClickToggle = (page: Page): Locator =>
            page.getByTestId('e2eSelectRowsByShiftClickToggle');
        const shiftClickCheckbox = async (page: Page, rowIndex: number): Promise<void> => {
            return getRow(page, rowIndex)
                .locator('.ag-checkbox-input')
                .click({ modifiers: ['Shift'] });
        };

        test('Shift+Click selects a range between anchor and clicked row', async ({ page }) => {
            await page.goto('/');
            await unselectAllRows(page);
            await toggleRowSelection(page, 1);
            await shiftClickCheckbox(page, 3);
            expect(await isRowSelected(page, 0)).toBe(false);
            expect(await isRowSelected(page, 1)).toBe(true);
            expect(await isRowSelected(page, 2)).toBe(true);
            expect(await isRowSelected(page, 3)).toBe(true);
            expect(await isRowSelected(page, 4)).toBe(false);
        });

        test('plain checkbox click resets the anchor', async ({ page }) => {
            await page.goto('/');
            await unselectAllRows(page);
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
            await page.goto('/');
            await unselectAllRows(page);
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
            await page.goto('/');
            await unselectAllRows(page);
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
            await page.goto('/');
            await unselectAllRows(page);
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

        test.skip('does not clear other selected rows when disabled', async ({ page }) => {
            await page.goto('/');
            await unselectAllRows(page);
            await displayOptions(page);
            await getSelectRowsByShiftClickToggle(page).evaluate((label: HTMLLabelElement) => label.click());
            await toggleRowSelection(page, 6);
            await toggleRowSelection(page, 7);
            await toggleRowSelection(page, 0);
            await shiftClickCheckbox(page, 2);
            expect(await isRowSelected(page, 6)).toBe(true);
            expect(await isRowSelected(page, 7)).toBe(true);
        });
    });
});
