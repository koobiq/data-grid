import { expect, Locator, Page, test } from '@playwright/test';
import { isRowSelected, waitForRowSelected } from './utils/helpers';

// const getScreenshotTarget = (page: Page): Locator => page.getByTestId('e2eScreenshotTarget');

const getGroupCheckbox = (page: Page, headerName: string): Locator =>
    page.locator('label').filter({ hasText: headerName }).locator('input[type="checkbox"]');

const getGroupCellInner = (page: Page, rowIndex: number): Locator =>
    page.locator(`.ag-row[row-index="${rowIndex}"] .kbq-ag-grid-group-cell-renderer__inner`);

const getRowCheckbox = (page: Page, rowIndex: number): Locator =>
    page.locator(`.ag-row[row-index="${rowIndex}"] .ag-checkbox-input`);

const waitForDataLoaded = async (page: Page): Promise<void> => {
    await expect(page.locator('.ag-row[row-index="0"]')).toBeVisible({ timeout: 10_000 });
};

const waitForGroupsVisible = async (page: Page): Promise<void> => {
    await expect(getGroupCellInner(page, 0)).toBeVisible({ timeout: 5_000 });
};

test.describe('KbqAgGridRowGroup', () => {
    // Screenshots differ across OS — always update snapshots via Docker: `yarn run e2e:docker:update-snapshots`
    // test('screenshot — grouped, expanded, and with selection', async ({ page }) => {
    //     await page.goto('/e2e/row-group');
    //     await waitForDataLoaded(page);

    //     await getGroupCheckbox(page, 'Country').click();
    //     await waitForGroupsVisible(page);

    //     // Expand the first group
    //     await getGroupCellInner(page, 0).click();
    //     await expect(page.locator('.ag-row[row-index="1"]')).toBeVisible();

    //     // Select the first group header
    //     await getRowCheckbox(page, 0).click();

    //     await expect(getScreenshotTarget(page)).toHaveScreenshot('row-group-light.png');
    //     await enableDarkTheme(page);
    //     await expect(getScreenshotTarget(page)).toHaveScreenshot('row-group-dark.png');
    // });

    test('initial state shows flat data without group headers', async ({ page }) => {
        await page.goto('/e2e/row-group');
        await waitForDataLoaded(page);

        await expect(getGroupCellInner(page, 0)).toHaveCount(0);
    });

    test('checking a column checkbox groups rows by that column', async ({ page }) => {
        await page.goto('/e2e/row-group');
        await waitForDataLoaded(page);

        await getGroupCheckbox(page, 'Country').click();
        await waitForGroupsVisible(page);

        // The first row should be a group header
        await expect(getGroupCellInner(page, 0)).toBeVisible();
    });

    test('clicking a group header expands it to show child rows', async ({ page }) => {
        await page.goto('/e2e/row-group');
        await waitForDataLoaded(page);

        await getGroupCheckbox(page, 'Country').click();
        await waitForGroupsVisible(page);

        // All groups are collapsed initially — no data rows visible beyond headers
        await expect(page.locator('.kbq-ag-grid-group-cell-renderer__inner')).toHaveCount(
            await page.locator('.ag-row').count()
        );

        // Click first group to expand
        await getGroupCellInner(page, 0).click();

        // Row at index 1 should now be a data row (no group cell renderer inner)
        await expect(page.locator('.ag-row[row-index="1"]')).toBeVisible();
        await expect(getGroupCellInner(page, 1)).toHaveCount(0);
    });

    test('clicking an expanded group header collapses it', async ({ page }) => {
        await page.goto('/e2e/row-group');
        await waitForDataLoaded(page);

        await getGroupCheckbox(page, 'Country').click();
        await waitForGroupsVisible(page);

        // Expand first group
        await getGroupCellInner(page, 0).click();
        await expect(page.locator('.ag-row[row-index="1"]')).toBeVisible();
        await expect(getGroupCellInner(page, 1)).toHaveCount(0);

        // Collapse the same group
        await getGroupCellInner(page, 0).click();

        // Row 1 should now be the next group header (not a data row)
        await expect(getGroupCellInner(page, 1)).toBeVisible();
    });

    test('two group columns produce a nested group structure', async ({ page }) => {
        await page.goto('/e2e/row-group');
        await waitForDataLoaded(page);

        await getGroupCheckbox(page, 'Country').click();
        await waitForGroupsVisible(page);

        await getGroupCheckbox(page, 'Sport').click();

        // Expand the first top-level group
        await getGroupCellInner(page, 0).click();

        // Row 1 should be a nested group header (level 1)
        await expect(getGroupCellInner(page, 1)).toBeVisible();

        // Expand the nested group
        await getGroupCellInner(page, 1).click();

        // Row 2 should be a data row
        await expect(page.locator('.ag-row[row-index="2"]')).toBeVisible();
        await expect(getGroupCellInner(page, 2)).toHaveCount(0);
    });

    test('selecting a group row selects all its expanded children', async ({ page }) => {
        await page.goto('/e2e/row-group');
        await waitForDataLoaded(page);

        await getGroupCheckbox(page, 'Country').click();
        await waitForGroupsVisible(page);

        // Expand the first group so children are visible
        await getGroupCellInner(page, 0).click();
        await expect(page.locator('.ag-row[row-index="1"]')).toBeVisible();

        // Select the group header via checkbox
        await getRowCheckbox(page, 0).click();

        // All visible children should be selected
        await waitForRowSelected(page, 1);
        await waitForRowSelected(page, 2);
        expect(await isRowSelected(page, 0)).toBe(true);
    });

    test('deselecting a group row deselects all its children', async ({ page }) => {
        await page.goto('/e2e/row-group');
        await waitForDataLoaded(page);

        await getGroupCheckbox(page, 'Country').click();
        await waitForGroupsVisible(page);

        await getGroupCellInner(page, 0).click();
        await expect(page.locator('.ag-row[row-index="1"]')).toBeVisible();

        // Select
        await getRowCheckbox(page, 0).click();
        await waitForRowSelected(page, 1);

        // Deselect
        await getRowCheckbox(page, 0).click();

        await expect(page.locator('.ag-row[row-index="0"]')).not.toHaveClass(/ag-row-selected/);
        await expect(page.locator('.ag-row[row-index="1"]')).not.toHaveClass(/ag-row-selected/);
    });

    test('selection is preserved when a collapsed group is expanded', async ({ page }) => {
        await page.goto('/e2e/row-group');
        await waitForDataLoaded(page);

        await getGroupCheckbox(page, 'Country').click();
        await waitForGroupsVisible(page);

        // Select the first group header while it is still collapsed
        await getRowCheckbox(page, 0).click();
        await waitForRowSelected(page, 0);

        // Expand the selected group
        await getGroupCellInner(page, 0).click();
        await expect(page.locator('.ag-row[row-index="1"]')).toBeVisible();

        // The group header must still be selected, and children must be auto-selected
        await waitForRowSelected(page, 0);
        await waitForRowSelected(page, 1);
    });

    test('unchecking a column checkbox removes grouping', async ({ page }) => {
        await page.goto('/e2e/row-group');
        await waitForDataLoaded(page);

        await getGroupCheckbox(page, 'Country').click();
        await waitForGroupsVisible(page);

        await getGroupCheckbox(page, 'Country').click();

        // Group cell renderers should no longer be present
        await expect(page.locator('.kbq-ag-grid-group-cell-renderer__inner')).toHaveCount(0, { timeout: 5_000 });
    });
});
