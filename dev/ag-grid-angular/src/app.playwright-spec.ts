import { expect, Locator, Page, test } from '@playwright/test';
import { ColumnState } from 'ag-grid-community';

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
    const getPinFirstColumnToggle = (page: Page): Locator => page.getByTestId('e2ePinFirstColumnToggle');
    const getPinLastColumnToggle = (page: Page): Locator => page.getByTestId('e2ePinLastColumnToggle');

    // Screenshot tests are only valid on CI. Do not update snapshots locally.
    test.describe('KbqAgGridAngularTheme', () => {
        const getShowIndexColumnToggle = (page: Page): Locator => page.getByTestId('e2eShowIndexColumnToggle');
        const getLightThemeToggle = (page: Page): Locator => page.getByTestId('e2eLightThemeToggle');
        const getPaginationToggle = (page: Page): Locator => page.getByTestId('e2ePaginationToggle');

        test('default state', async ({ page }) => {
            await page.addInitScript((key: string) => localStorage.removeItem(key), 'dev-ag-grid-column-state');
            await page.setViewportSize({ width: 768, height: 500 });
            await page.goto('/');
            await getShowIndexColumnToggle(page).evaluate((label: HTMLLabelElement) => label.click());
            await getPaginationToggle(page).evaluate((label: HTMLLabelElement) => label.click());
            await expect(getScreenshotTarget(page)).toHaveScreenshot('01-light.png');
            await getLightThemeToggle(page).evaluate((label: HTMLLabelElement) => label.click());
            await expect(getScreenshotTarget(page)).toHaveScreenshot('01-dark.png');
        });

        test('with pinned columns', async ({ page }) => {
            await page.addInitScript((key: string) => localStorage.removeItem(key), 'dev-ag-grid-column-state');
            await page.setViewportSize({ width: 768, height: 500 });
            await page.goto('/');
            await getShowIndexColumnToggle(page).evaluate((label: HTMLLabelElement) => label.click());
            await getPinFirstColumnToggle(page).evaluate((label: HTMLLabelElement) => label.click());
            await getPinLastColumnToggle(page).evaluate((label: HTMLLabelElement) => label.click());
            await page.locator('.ag-center-cols-viewport').evaluate((element: HTMLElement) => {
                element.scrollTo({ left: 10 });
            });
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
            await page.addInitScript((key: string) => localStorage.removeItem(key), 'dev-ag-grid-column-state');
            await page.setViewportSize({ width: 650, height: 500 });
            await page.goto('/');
            await getPinFirstColumnToggle(page).evaluate((label: HTMLLabelElement) => label.click());
            await getPinLastColumnToggle(page).evaluate((label: HTMLLabelElement) => label.click());
            await getRow(page, 1).first().hover();
            await expect(getScreenshotTarget(page)).toHaveScreenshot('03-light.png');
        });
    });

    test.describe('KbqAgGridColumnState', () => {
        const storageKey = 'dev-ag-grid-column-state';

        const getColumnState = async (page: Page): Promise<ColumnState[] | null> => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return page.evaluate((key) => {
                const stored = localStorage.getItem(key);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return stored ? JSON.parse(stored) : null;
            }, storageKey);
        };

        const clearColumnState = async (page: Page): Promise<void> => {
            await page.evaluate((key: string) => localStorage.removeItem(key), storageKey);
        };

        test('saves sort state to localStorage when column header is clicked', async ({ page }) => {
            await page.goto('/');
            await clearColumnState(page);
            await page.locator('.ag-header-cell[col-id="athlete"] .ag-header-cell-label').click();

            const state = await getColumnState(page);
            const athleteState = state?.find((s) => s.colId === 'athlete');

            expect(athleteState?.sort).toBe('asc');
            expect(athleteState?.sortIndex).toBe(0);
        });

        test('restores sort state from localStorage on page reload', async ({ page }) => {
            await page.goto('/');
            await clearColumnState(page);
            await page.locator('.ag-header-cell[col-id="athlete"] .ag-header-cell-label').click();
            await page.reload();

            await expect(page.locator('.ag-header-cell[col-id="athlete"][aria-sort="ascending"]')).toBeVisible();
        });

        test('saves column width to localStorage when column is resized', async ({ page }) => {
            await page.goto('/');
            await clearColumnState(page);

            const resizer = page.locator('.ag-header-cell[col-id="athlete"] .ag-header-cell-resize');
            const bounds = await resizer.boundingBox();

            if (!bounds) throw new Error('resizer not found');

            await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            await page.mouse.down();
            await page.mouse.move(bounds.x + bounds.width / 2 + 60, bounds.y);
            await page.mouse.up();

            await expect
                .poll(async () => {
                    const state = await getColumnState(page);
                    return state?.find((s) => s.colId === 'athlete')?.width;
                })
                .toBeGreaterThan(200);
        });

        test('restores column width from localStorage on page reload', async ({ page }) => {
            await page.goto('/');
            await clearColumnState(page);

            const resizer = page.locator('.ag-header-cell[col-id="athlete"] .ag-header-cell-resize');
            const bounds = await resizer.boundingBox();

            if (!bounds) throw new Error('resizer not found');

            await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            await page.mouse.down();
            await page.mouse.move(bounds.x + bounds.width / 2 + 60, bounds.y);
            await page.mouse.up();

            const widthBeforeReload = await page
                .locator('.ag-header-cell[col-id="athlete"]')
                .evaluate((el: Element) => Math.round(el.getBoundingClientRect().width));

            await page.reload();

            await expect
                .poll(async () =>
                    page
                        .locator('.ag-header-cell[col-id="athlete"]')
                        .evaluate((el: Element) => Math.round(el.getBoundingClientRect().width))
                )
                .toBe(widthBeforeReload);
        });

        test('applies pre-existing sort state from localStorage on page load', async ({ page }) => {
            await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
                key: storageKey,
                value: JSON.stringify([
                    { colId: 'ag-Grid-SelectionColumn', hide: false, width: 36, sort: null, sortIndex: null },
                    { colId: '0', hide: false, width: 70, sort: null, sortIndex: null },
                    { colId: 'athlete', hide: false, width: 200, sort: 'desc', sortIndex: 0 },
                    { colId: 'age', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'country', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'year', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'date', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'sport', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'gold', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'silver', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'bronze', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'total', hide: false, width: 200, sort: null, sortIndex: null }
                ])
            });
            await page.goto('/');

            await expect(page.locator('.ag-header-cell[col-id="athlete"][aria-sort="descending"]')).toBeVisible();
        });

        test('applies pre-existing column order from localStorage on page load', async ({ page }) => {
            await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
                key: storageKey,
                value: JSON.stringify([
                    { colId: 'ag-Grid-SelectionColumn', hide: false, width: 36, sort: null, sortIndex: null },
                    { colId: '0', hide: false, width: 70, sort: null, sortIndex: null },
                    { colId: 'country', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'athlete', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'age', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'year', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'date', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'sport', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'gold', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'silver', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'bronze', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'total', hide: false, width: 200, sort: null, sortIndex: null }
                ])
            });
            await page.goto('/');

            // AG Grid uses absolute positioning, so visual order is determined by CSS left, not DOM order.
            // Country should appear to the left of Athlete after the saved order is restored.
            await expect
                .poll(async () => {
                    const [countryLeft, athleteLeft] = await Promise.all([
                        page
                            .locator('.ag-header-cell[col-id="country"]')
                            .evaluate((el: Element) => el.getBoundingClientRect().left),
                        page
                            .locator('.ag-header-cell[col-id="athlete"]')
                            .evaluate((el: Element) => el.getBoundingClientRect().left)
                    ]);

                    return countryLeft < athleteLeft;
                })
                .toBe(true);
        });

        test('saves column visibility to localStorage when column is hidden', async ({ page }) => {
            await page.goto('/');
            await clearColumnState(page);

            await page.evaluate(() => {
                const el = document.querySelector('ag-grid-angular')!;
                // AG Grid v34 has no column menu button in Community edition, so there's no UI to hide a column.
                // `window.ng` is Angular's global debug API (available in dev mode) that exposes the component
                // instance for a given DOM element. This is the only way to call the GridApi from Playwright.
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
                (window as any).ng.getComponent(el).api.setColumnsVisible(['athlete'], false);
            });

            await expect
                .poll(async () => {
                    const state = await getColumnState(page);
                    return state?.find((s) => s.colId === 'athlete')?.hide;
                })
                .toBe(true);
        });

        test('restores column visibility from localStorage on page reload', async ({ page }) => {
            await page.addInitScript(
                ({ key, value }: { key: string; value: string }) => localStorage.setItem(key, value),
                {
                    key: storageKey,
                    value: JSON.stringify([
                        { colId: 'ag-Grid-SelectionColumn', hide: false, width: 36, sort: null, sortIndex: null },
                        { colId: '0', hide: false, width: 70, sort: null, sortIndex: null },
                        { colId: 'athlete', hide: true, width: 200, sort: null, sortIndex: null },
                        { colId: 'age', hide: false, width: 200, sort: null, sortIndex: null },
                        { colId: 'country', hide: false, width: 200, sort: null, sortIndex: null },
                        { colId: 'year', hide: false, width: 200, sort: null, sortIndex: null },
                        { colId: 'date', hide: false, width: 200, sort: null, sortIndex: null },
                        { colId: 'sport', hide: false, width: 200, sort: null, sortIndex: null },
                        { colId: 'gold', hide: false, width: 200, sort: null, sortIndex: null },
                        { colId: 'silver', hide: false, width: 200, sort: null, sortIndex: null },
                        { colId: 'bronze', hide: false, width: 200, sort: null, sortIndex: null },
                        { colId: 'total', hide: false, width: 200, sort: null, sortIndex: null }
                    ])
                }
            );
            await page.goto('/');

            await expect(page.locator('.ag-header-cell[col-id="athlete"]')).not.toBeVisible();
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

        test('should preserve default AG Grid Shift+Click behavior when disabled', async ({ page }) => {
            await page.goto('/');
            await unselectAllRows(page);
            await displayOptions(page);
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
});
