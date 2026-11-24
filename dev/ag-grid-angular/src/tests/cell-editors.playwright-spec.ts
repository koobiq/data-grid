import { expect, Locator, Page, test } from '@playwright/test';
import { getAgGridApi } from './utils/api';
import { getCell } from './utils/helpers';
import { enableDarkTheme } from './utils/theme';

/** The row the editors open in: the rows around it show the same values as plain cell text to compare against. */
const EDITED_ROW_INDEX = 1;

const getScreenshotTarget = (page: Page): Locator => page.getByTestId('e2eScreenshotTarget');

/** The control an editor puts the value in: an input in the cell, a textarea in a popup, or the select display. */
const getEditorControl = (page: Page): Locator =>
    page.locator(
        '.ag-cell-inline-editing input, .ag-cell-inline-editing .ag-picker-field-display, .ag-popup-editor textarea'
    );

const startEditing = async (page: Page, colKey: string): Promise<void> => {
    await (
        await getAgGridApi(page)
    ).evaluate(
        (api, { rowIndex, key }) => {
            // A user starts editing from a focused cell, and the row shows that focus while the editor is open.
            api.setFocusedCell(rowIndex, key);
            api.startEditingCell({ rowIndex, colKey: key });
        },
        { rowIndex: EDITED_ROW_INDEX, key: colKey }
    );
    // The editor takes the focus once it is attached, and a screenshot taken before that shows it unfocused.
    await expect(page.locator(':is(.ag-cell-inline-editing, .ag-popup-editor) :focus')).toHaveCount(1);
};

const readTypography = (element: Element): Record<string, string> => {
    const { color, fontFamily, fontFeatureSettings, fontSize, fontWeight, letterSpacing, textTransform } =
        getComputedStyle(element);

    return { color, fontFamily, fontFeatureSettings, fontSize, fontWeight, letterSpacing, textTransform };
};

/** Where the text starts: at the content box of an input, at the first character of the text anywhere else. */
const readTextStart = (element: Element): number => {
    if (element instanceof HTMLInputElement) {
        const { borderLeftWidth, paddingLeft } = getComputedStyle(element);

        return element.getBoundingClientRect().left + parseFloat(borderLeftWidth) + parseFloat(paddingLeft);
    }

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => (node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP)
    });
    const range = document.createRange();

    range.selectNodeContents(walker.nextNode()!);

    return range.getBoundingClientRect().left;
};

// Screenshots differ across OS — always update snapshots via Docker: `yarn run e2e:docker:update-snapshots`
const expectScreenshots = async (page: Page, name: string): Promise<void> => {
    await expect(getScreenshotTarget(page)).toHaveScreenshot(`cell-editors-${name}-light.png`);
    await enableDarkTheme(page);
    await expect(getScreenshotTarget(page)).toHaveScreenshot(`cell-editors-${name}-dark.png`);
};

test.describe('KbqAgGridTheme cell editors', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1000, height: 360 });
        await page.goto('/e2e/cell-editors');
        // Wait for row data to load via HTTP before starting an editor.
        await page.locator('.ag-row[row-index]').first().waitFor();
    });

    // The browser resets the letter spacing and the font features of a form control instead of letting it inherit
    // them, so a value read wider while it was edited than the same value in a cell.
    test('sets the value in an editor in the typography of the cell text', async ({ page }) => {
        const cellTypography = await getCell(page, EDITED_ROW_INDEX, 'title').evaluate(readTypography);

        for (const colKey of ['title', 'riskScore', 'reviewBy', 'detectedOn', 'comment', 'severity']) {
            await startEditing(page, colKey);

            expect(await getEditorControl(page).evaluate(readTypography), colKey).toEqual(cellTypography);

            await page.keyboard.press('Escape');
            await expect(getEditorControl(page)).toHaveCount(0);
        }
    });

    test('starts the value in an inline editor where the cell showed it', async ({ page }) => {
        for (const colKey of ['title', 'riskScore', 'reviewBy', 'detectedOn', 'severity']) {
            const cellTextStart = await getCell(page, EDITED_ROW_INDEX, colKey).evaluate(readTextStart);

            await startEditing(page, colKey);

            expect(await getEditorControl(page).evaluate(readTextStart), colKey).toBeCloseTo(cellTextStart, 1);

            await page.keyboard.press('Escape');
            await expect(getEditorControl(page)).toHaveCount(0);
        }
    });

    test('text editor', async ({ page }) => {
        await startEditing(page, 'title');
        await page.keyboard.press('End');
        await expectScreenshots(page, 'text');
    });

    test('text editor with an invalid value', async ({ page }) => {
        await startEditing(page, 'title');
        await page.keyboard.press('End');
        await getEditorControl(page).fill('');
        await expect(getEditorControl(page)).toHaveAttribute('aria-invalid', 'true');
        await expectScreenshots(page, 'text-invalid');
    });

    test('number editor', async ({ page }) => {
        await startEditing(page, 'riskScore');
        await page.keyboard.press('End');
        await expectScreenshots(page, 'number');
    });

    test('number editor with an invalid value', async ({ page }) => {
        await startEditing(page, 'riskScore');
        await getEditorControl(page).fill('150');
        await expect(getEditorControl(page)).toHaveAttribute('aria-invalid', 'true');
        await expectScreenshots(page, 'number-invalid');
    });

    test('date editor', async ({ page }) => {
        await startEditing(page, 'reviewBy');
        await expectScreenshots(page, 'date');
    });

    test('date editor with an invalid value', async ({ page }) => {
        await startEditing(page, 'reviewBy');
        await getEditorControl(page).fill('2027-01-01');
        await expect(getEditorControl(page)).toHaveAttribute('aria-invalid', 'true');
        await expectScreenshots(page, 'date-invalid');
    });

    test('date string editor', async ({ page }) => {
        await startEditing(page, 'detectedOn');
        await expectScreenshots(page, 'date-string');
    });

    // The date filter renders a date field of its own, a text field of the date type, styled the way the editors are.
    test('date filter', async ({ page }) => {
        // Turned on here only: the filter buttons of a filterable grid would show in the header of every other shot.
        await (
            await getAgGridApi(page)
        ).evaluate((api) => api.setGridOption('defaultColDef', { editable: true, filter: true }));
        await page.locator('.ag-header-cell[col-id="reviewBy"] .ag-header-cell-filter-button').click();
        // The second field, the end of a range, stays hidden until the range condition is chosen.
        await expect(page.locator('.ag-filter .ag-date-filter input[type="date"]').first()).toBeVisible();
        // Takes the pointer off the header, which the click left hovered.
        await page.mouse.move(0, 0);
        await expectScreenshots(page, 'date-filter');
    });

    test('large text editor', async ({ page }) => {
        await startEditing(page, 'comment');
        await page.keyboard.press('End');
        await expectScreenshots(page, 'large-text');
    });

    test('large text editor with an invalid value', async ({ page }) => {
        await startEditing(page, 'comment');
        await page.keyboard.press('End');
        await getEditorControl(page).fill('   ');
        await expect(getEditorControl(page)).toHaveAttribute('aria-invalid', 'true');
        await expectScreenshots(page, 'large-text-invalid');
    });

    test('select editor', async ({ page }) => {
        await startEditing(page, 'severity');
        await page.locator('.ag-cell-inline-editing .ag-picker-field-wrapper').click();
        await expect(page.getByRole('option', { name: 'Critical', exact: true })).toHaveClass(/ag-active-item/);
        // Takes the pointer off the row, which the click left hovered.
        await page.mouse.move(0, 0);
        await expectScreenshots(page, 'select');
    });

    test('checkbox editor', async ({ page }) => {
        await startEditing(page, 'escalated');
        await expectScreenshots(page, 'checkbox');
    });
});
