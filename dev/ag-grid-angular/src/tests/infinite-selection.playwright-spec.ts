import { expect, Locator, Page, test } from '@playwright/test';
import { getCell, getRow, isRowSelected, toggleRowSelection, waitForRowSelected } from './utils/helpers';
import { enableDarkTheme } from './utils/theme';

const getHeaderCheckbox = (page: Page): Locator => page.locator('.ag-header-cell input[type="checkbox"]');

const getState = async (page: Page): Promise<{ selectAll: boolean; excludedIds: string[] }> => {
    const text = await page.getByTestId('e2eInfiniteSelectionState').textContent();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return JSON.parse(text ?? '{}') as { selectAll: boolean; excludedIds: string[] };
};

// Wait until row data is actually loaded (skeleton cells in row 0 are gone).
// In InfiniteRowModel, row elements appear in the DOM before data arrives (skeleton state).
const waitForDataLoaded = async (page: Page): Promise<void> => {
    await expect(getRow(page, 0)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.ag-row[row-index="0"] .kbq-ag-grid-skeleton-cell')).toHaveCount(0, { timeout: 10_000 });
};

const getScreenshotTarget = (page: Page): Locator => page.getByTestId('e2eScreenshotTarget');

test.describe('KbqAgGridInfiniteSelection', () => {
    // Screenshots differ across OS — always update snapshots via Docker: `yarn run e2e:docker:update-snapshots`
    test('initial state', async ({ page }) => {
        await page.goto('/e2e/infinite-selection');
        await waitForDataLoaded(page);
        await getHeaderCheckbox(page).click();
        await toggleRowSelection(page, 3);
        await toggleRowSelection(page, 4);
        await expect(getScreenshotTarget(page)).toHaveScreenshot('infinite-selection-light.png');
        await enableDarkTheme(page);
        await expect(getScreenshotTarget(page)).toHaveScreenshot('infinite-selection-dark.png');
    });

    test('initial state is selectAll=false with empty excludedIds', async ({ page }) => {
        await page.goto('/e2e/infinite-selection');
        await waitForDataLoaded(page);

        const state = await getState(page);
        expect(state.selectAll).toBe(false);
        expect(state.excludedIds).toHaveLength(0);
    });

    test('no rows are selected initially', async ({ page }) => {
        await page.goto('/e2e/infinite-selection');
        await waitForDataLoaded(page);

        expect(await isRowSelected(page, 0)).toBe(false);
        expect(await isRowSelected(page, 1)).toBe(false);
    });

    test('clicking header checkbox selects all visible rows', async ({ page }) => {
        await page.goto('/e2e/infinite-selection');
        await waitForDataLoaded(page);

        await getHeaderCheckbox(page).click();

        // Rows are selected asynchronously via wrapDatasource successCallback — use retry assertion.
        await waitForRowSelected(page, 0);
        await waitForRowSelected(page, 1);

        const state = await getState(page);
        expect(state.selectAll).toBe(true);
        expect(state.excludedIds).toHaveLength(0);
    });

    test('clicking header checkbox again deselects all', async ({ page }) => {
        await page.goto('/e2e/infinite-selection');
        await waitForDataLoaded(page);

        await getHeaderCheckbox(page).click();
        await waitForRowSelected(page, 0); // ensure first click took effect before second

        await getHeaderCheckbox(page).click();

        // Wait for the state signal to reflect deselection — more reliable than the DOM class,
        // which can clear before the Angular signal flushes in slower CI environments.
        await expect(page.getByTestId('e2eInfiniteSelectionState')).toContainText('"selectAll": false');

        const state = await getState(page);
        expect(state.selectAll).toBe(false);
        expect(state.excludedIds).toHaveLength(0);
        expect(await isRowSelected(page, 0)).toBe(false);
    });

    test('unchecking a row after select-all adds it to excludedIds', async ({ page }) => {
        await page.goto('/e2e/infinite-selection');
        await waitForDataLoaded(page);

        await getHeaderCheckbox(page).click();
        await waitForRowSelected(page, 0);
        await toggleRowSelection(page, 0);

        // Wait for the state signal to reflect the exclusion before reading it.
        await expect(page.getByTestId('e2eInfiniteSelectionState')).not.toContainText('"excludedIds": []');

        const state = await getState(page);
        expect(state.selectAll).toBe(true);
        expect(state.excludedIds).toHaveLength(1);
        expect(await isRowSelected(page, 0)).toBe(false);
        expect(await isRowSelected(page, 1)).toBe(true);
    });

    test('header checkbox becomes indeterminate after partial exclusion', async ({ page }) => {
        await page.goto('/e2e/infinite-selection');
        await waitForDataLoaded(page);

        await getHeaderCheckbox(page).click();
        await waitForRowSelected(page, 0);
        await toggleRowSelection(page, 0);

        const isIndeterminate = await getHeaderCheckbox(page).evaluate((el: HTMLInputElement) => el.indeterminate);
        expect(isIndeterminate).toBe(true);
    });

    test('clicking indeterminate header checkbox deselects all', async ({ page }) => {
        await page.goto('/e2e/infinite-selection');
        await waitForDataLoaded(page);

        await getHeaderCheckbox(page).click(); // select all → checked
        await waitForRowSelected(page, 0);
        await toggleRowSelection(page, 0); // uncheck row 0 → indeterminate

        const isIndeterminateBefore = await getHeaderCheckbox(page).evaluate(
            (el: HTMLInputElement) => el.indeterminate
        );
        expect(isIndeterminateBefore).toBe(true);

        await getHeaderCheckbox(page).click(); // click indeterminate → should deselect all

        // Wait for the state signal to reflect deselection — more reliable than the DOM class,
        // which can clear before the Angular signal flushes in slower CI environments.
        await expect(page.getByTestId('e2eInfiniteSelectionState')).toContainText('"selectAll": false');

        const state = await getState(page);
        expect(state.selectAll).toBe(false);
        expect(state.excludedIds).toHaveLength(0);
        expect(await isRowSelected(page, 0)).toBe(false);
        expect(await isRowSelected(page, 1)).toBe(false);

        const isCheckedAfter = await getHeaderCheckbox(page).evaluate((el: HTMLInputElement) => el.checked);
        const isIndeterminateAfter = await getHeaderCheckbox(page).evaluate((el: HTMLInputElement) => el.indeterminate);
        expect(isCheckedAfter).toBe(false);
        expect(isIndeterminateAfter).toBe(false);
    });

    test('newly loaded block is auto-selected when selectAll=true', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 600 });
        await page.goto('/e2e/infinite-selection');
        await waitForDataLoaded(page);

        await getHeaderCheckbox(page).click();
        await waitForRowSelected(page, 0);

        await page.locator('.ag-body-viewport').evaluate((el: Element) => {
            el.scrollTop = 10000;
        });

        await waitForRowSelected(page, 10);
    });

    test('auto-selects a block that loads only after select-all (not in initial viewport)', async ({ page }) => {
        // Small viewport: ~4 rows visible → only block 0 (rows 0-9) loads initially.
        await page.setViewportSize({ width: 1280, height: 200 });
        await page.goto('/e2e/infinite-selection');
        await waitForDataLoaded(page);

        await getHeaderCheckbox(page).click();
        await waitForRowSelected(page, 0);

        // Scroll far past the initial viewport to trigger loading of blocks 2+ (rows 20+).
        await page.locator('.ag-body-viewport').evaluate((el: Element) => {
            el.scrollTop = 10000;
        });

        // Rows in a block that didn't exist at select-all time must be auto-selected.
        // Datasource has a 300 ms delay, so allow generous timeout.
        await waitForRowSelected(page, 20);
        await waitForRowSelected(page, 21);
    });

    test('Ctrl+A selects all visible rows', async ({ page }) => {
        await page.goto('/e2e/infinite-selection');
        await waitForDataLoaded(page);

        await getCell(page, 0, 'athlete').click();
        await page.keyboard.press('Control+a');

        await waitForRowSelected(page, 0);
        await waitForRowSelected(page, 1);

        const state = await getState(page);
        expect(state.selectAll).toBe(true);
        expect(state.excludedIds).toHaveLength(0);
    });

    test('Ctrl+A does nothing when already fully selected', async ({ page }) => {
        await page.goto('/e2e/infinite-selection');
        await waitForDataLoaded(page);

        await getCell(page, 0, 'athlete').click();
        await page.keyboard.press('Control+a');
        await waitForRowSelected(page, 0);

        await page.keyboard.press('Control+a'); // already all selected — should stay selected
        await page.waitForTimeout(200); // give time for any (unexpected) state change

        const state = await getState(page);
        expect(state.selectAll).toBe(true);
        expect(state.excludedIds).toHaveLength(0);
        expect(await isRowSelected(page, 0)).toBe(true);
    });

    test('Ctrl+A from indeterminate state selects all', async ({ page }) => {
        await page.goto('/e2e/infinite-selection');
        await waitForDataLoaded(page);

        await getCell(page, 0, 'athlete').click();
        await page.keyboard.press('Control+a'); // select all → checked
        await waitForRowSelected(page, 0);
        await toggleRowSelection(page, 0); // uncheck row 0 → indeterminate

        await page.keyboard.press('Control+a');
        await waitForRowSelected(page, 0); // row 0 should become selected again

        const state = await getState(page);
        expect(state.selectAll).toBe(true);
        expect(state.excludedIds).toHaveLength(0);
        expect(await isRowSelected(page, 0)).toBe(true);
        expect(await isRowSelected(page, 1)).toBe(true);
    });
});
