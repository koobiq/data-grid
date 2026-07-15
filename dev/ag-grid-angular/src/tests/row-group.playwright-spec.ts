import { expect, Locator, Page, test } from '@playwright/test';
import { isRowSelected, waitForRowSelected } from './utils/helpers';
import { enableDarkTheme } from './utils/theme';

const getScreenshotTarget = (page: Page): Locator => page.getByTestId('e2eScreenshotTarget');

const getGroupCheckbox = (page: Page, headerName: string): Locator =>
    page.locator('label').filter({ hasText: headerName }).locator('input[type="checkbox"]');

const getGroupCellInner = (page: Page, rowIndex: number): Locator =>
    page.locator(`.ag-row[row-index="${rowIndex}"] .kbq-ag-grid-group-cell-renderer__inner`);

// Group rows render a custom checkbox (not AG's `.ag-checkbox-input`) in the selection column;
// AG Grid still emits its own native checkbox markup there too, permanently hidden via CSS.
// Matching on visibility picks whichever one is actually shown for the row.
const getRowCheckbox = (page: Page, rowIndex: number): Locator =>
    page.locator(`.ag-row[row-index="${rowIndex}"] input[type="checkbox"]:visible`);

const waitForDataLoaded = async (page: Page): Promise<void> => {
    await expect(page.locator('.ag-row[row-index="0"]')).toBeVisible({ timeout: 10_000 });
};

const waitForGroupsVisible = async (page: Page): Promise<void> => {
    await expect(getGroupCellInner(page, 0)).toBeVisible({ timeout: 5_000 });
};

// Locates a group header row by its rendered key (e.g. "Russia" for a "Russia (706)" label).
const getGroupRowByKey = (page: Page, key: string): Locator =>
    page.locator('.ag-row').filter({ has: page.locator('.kbq-ag-grid-group-cell-renderer__key', { hasText: key }) });

// Locates a data (non-group) row containing the given text.
const getDataRowByText = (page: Page, text: string): Locator =>
    page
        .locator('.ag-row')
        .filter({ hasText: text })
        .filter({ hasNot: page.locator('.kbq-ag-grid-group-cell-renderer__inner') });

const getGroupHeaderCell = (page: Page): Locator => page.locator('.ag-header-cell[col-id="KbqAgGridRowGroup"]');

const getDataHeaderCell = (page: Page, colId: string): Locator => page.locator(`.ag-header-cell[col-id="${colId}"]`);

// Every row (group or leaf) renders a cell for every column, but a group row's data-field cells
// are empty (group rows carry none of the raw data fields) — filtering those out leaves exactly
// the currently-visible leaf rows' Gold values, in DOM order.
const getLeafGoldValues = async (page: Page): Promise<number[]> => {
    const cells = await page.locator('.ag-row [col-id="gold"]').allTextContents();
    return cells.filter((text) => text !== '').map(Number);
};

const naturalCompare = (a: string, b: string): number => a.localeCompare(b, undefined, { numeric: true });

test.describe('KbqAgGridRowGroup', () => {
    // Screenshots differ across OS — always update snapshots via Docker: `yarn run e2e:docker:update-snapshots`
    test('screenshot — grouped, expanded, and with selection', async ({ page }) => {
        // Both Country and Sport are grouped by default (see DevRowGroup.groupCols).
        await page.goto('/e2e/row-group');
        await waitForGroupsVisible(page);

        // Expand Russia, then its Diving sub-group.
        await getGroupRowByKey(page, 'Russia').locator('.kbq-ag-grid-group-cell-renderer__inner').click();
        const divingGroup = getGroupRowByKey(page, 'Diving');
        await expect(divingGroup).toBeVisible();
        await divingGroup.locator('.kbq-ag-grid-group-cell-renderer__inner').click();

        // Select Ilya Zakharov's row.
        const athleteRow = getDataRowByText(page, 'Ilya Zakharov');
        await expect(athleteRow).toBeVisible();
        await athleteRow.locator('input[type="checkbox"]:visible').click();
        await expect(athleteRow).toHaveClass(/ag-row-selected/);

        await expect(getScreenshotTarget(page)).toHaveScreenshot('row-group-light.png');
        await enableDarkTheme(page);
        await expect(getScreenshotTarget(page)).toHaveScreenshot('row-group-dark.png');
    });

    test('initial state shows grouped and collapsed rows from kbqAgGridRowGroupCols', async ({ page }) => {
        await page.goto('/e2e/row-group');
        await waitForGroupsVisible(page);

        // All visible rows must be group headers — groups are collapsed by default
        const totalRows = await page.locator('.ag-row').count();
        const groupRows = page.locator('.kbq-ag-grid-group-cell-renderer__inner');
        await expect(groupRows).toHaveCount(totalRows);
    });

    test('checking a column checkbox groups rows by that column', async ({ page }) => {
        await page.goto('/e2e/row-group');
        await waitForDataLoaded(page);

        // Both columns are grouped by default (see DevRowGroup.groupCols) — start ungrouped so
        // this test actually exercises "checking adds grouping", not just "grouping remains".
        await getGroupCheckbox(page, 'Country').click();
        await getGroupCheckbox(page, 'Sport').click();
        await expect(page.locator('.kbq-ag-grid-group-cell-renderer__inner')).toHaveCount(0, { timeout: 5_000 });

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

    test('group header toggle is keyboard-operable via Enter and Space', async ({ page }) => {
        await page.goto('/e2e/row-group');
        await waitForGroupsVisible(page);

        const firstGroup = getGroupCellInner(page, 0);
        await expect(firstGroup).toHaveAttribute('aria-expanded', 'false');

        // Enter expands, same as a click.
        await firstGroup.focus();
        await firstGroup.press('Enter');
        await expect(page.locator('.ag-row[row-index="1"]')).toBeVisible();
        await expect(firstGroup).toHaveAttribute('aria-expanded', 'true');

        // Space collapses it again.
        await firstGroup.press(' ');
        await expect(firstGroup).toHaveAttribute('aria-expanded', 'false');
        await expect(getGroupCellInner(page, 1)).toBeVisible();
    });

    test('two group columns produce a nested group structure', async ({ page }) => {
        // Both Country and Sport are grouped by default (see DevRowGroup.groupCols).
        await page.goto('/e2e/row-group');
        await waitForGroupsVisible(page);

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

    test('deselecting one child unchecks the parent group but keeps all siblings selected', async ({ page }) => {
        await page.goto('/e2e/row-group');
        await waitForDataLoaded(page);

        await getGroupCheckbox(page, 'Country').click();
        await waitForGroupsVisible(page);

        // Expand the first group so children are visible
        await getGroupCellInner(page, 0).click();
        await expect(page.locator('.ag-row[row-index="1"]')).toBeVisible();

        // Select the group header — all children become selected
        await getRowCheckbox(page, 0).click();
        await waitForRowSelected(page, 1);
        await waitForRowSelected(page, 2);

        // Deselect only the first child
        await getRowCheckbox(page, 1).click();

        // Parent must become unchecked, first child must be unchecked
        await expect(page.locator('.ag-row[row-index="0"]')).not.toHaveClass(/ag-row-selected/);
        await expect(page.locator('.ag-row[row-index="1"]')).not.toHaveClass(/ag-row-selected/);

        // Remaining siblings must still be selected
        await waitForRowSelected(page, 2);
        await waitForRowSelected(page, 3);
    });

    test('all visible children are selected after expanding a previously selected collapsed group', async ({
        page
    }) => {
        await page.goto('/e2e/row-group');
        await waitForDataLoaded(page);

        await getGroupCheckbox(page, 'Country').click();
        await waitForGroupsVisible(page);

        // Select the first group while it is still collapsed
        await getRowCheckbox(page, 0).click();
        await waitForRowSelected(page, 0);

        // Expand the selected group
        await getGroupCellInner(page, 0).click();
        await expect(page.locator('.ag-row[row-index="1"]')).toBeVisible();

        // Every visible row must be selected — not just the first two
        await waitForRowSelected(page, 0);
        await waitForRowSelected(page, 1);
        await waitForRowSelected(page, 2);
        await waitForRowSelected(page, 3);

        const totalRows = await page.locator('.ag-row').count();
        const selectedRows = page.locator('.ag-row-selected');
        await expect(selectedRows).toHaveCount(totalRows);
    });

    test('preserves a partial selection when the group is collapsed and re-expanded', async ({ page }) => {
        await page.goto('/e2e/row-group');
        await waitForDataLoaded(page);

        await getGroupCheckbox(page, 'Country').click();
        await waitForGroupsVisible(page);

        // Expand the first group so children are visible
        await getGroupCellInner(page, 0).click();
        await expect(page.locator('.ag-row[row-index="1"]')).toBeVisible();

        // Select only the first child — group ends up indeterminate, not itself selected
        await getRowCheckbox(page, 1).click();
        await waitForRowSelected(page, 1);
        await expect(page.locator('.ag-row[row-index="0"]')).not.toHaveClass(/ag-row-selected/);

        // Collapse the group — row 1 becomes the next group header again
        await getGroupCellInner(page, 0).click();
        await expect(getGroupCellInner(page, 1)).toBeVisible();

        // Re-expand — the same single child must still be selected, group still not fully checked
        await getGroupCellInner(page, 0).click();
        await expect(page.locator('.ag-row[row-index="1"]')).toBeVisible();
        await waitForRowSelected(page, 1);
        await expect(page.locator('.ag-row[row-index="0"]')).not.toHaveClass(/ag-row-selected/);
    });

    test('two group levels: deselecting one sub-group unchecks parent but keeps siblings selected', async ({
        page
    }) => {
        // Both Country and Sport are grouped by default (see DevRowGroup.groupCols).
        await page.goto('/e2e/row-group');
        await waitForGroupsVisible(page);

        // Expand the first top-level group
        await getGroupCellInner(page, 0).click();
        await expect(getGroupCellInner(page, 1)).toBeVisible();

        // Select the country group — all sport sub-groups become selected
        await getRowCheckbox(page, 0).click();
        await waitForRowSelected(page, 1);
        await waitForRowSelected(page, 2);

        // Deselect the first sport sub-group
        await getRowCheckbox(page, 1).click();

        // Country group must become unchecked, first sport must be unchecked
        await expect(page.locator('.ag-row[row-index="0"]')).not.toHaveClass(/ag-row-selected/);
        await expect(page.locator('.ag-row[row-index="1"]')).not.toHaveClass(/ag-row-selected/);

        // Remaining sport siblings must still be selected
        await waitForRowSelected(page, 2);
        await waitForRowSelected(page, 3);
    });

    test('kbqAgGridRowGroupSelectionChanged reports the full selection across collapsed groups, not just visible rows', async ({
        page
    }) => {
        // Both Country and Sport are grouped by default (see DevRowGroup.groupCols).
        await page.goto('/e2e/row-group');
        await waitForGroupsVisible(page);

        // Read the first top-level group's total descendant count from its own label.
        const countText = await page.locator('.kbq-ag-grid-group-cell-renderer__count').first().textContent();
        const total = Number(countText!.replace(/[()]/g, ''));

        // Select the whole top-level group while it — and all its nested sub-groups — are
        // still collapsed, i.e. none of its descendant rows are loaded into AG's row model.
        await getRowCheckbox(page, 0).click();
        await expect(page.getByTestId('selectedCount')).toHaveText(String(total));

        // Expand the top-level group, then its first nested sub-group.
        await getGroupCellInner(page, 0).click();
        await expect(page.locator('.ag-row[row-index="1"]')).toBeVisible();
        await getGroupCellInner(page, 1).click();
        await expect(page.locator('.ag-row[row-index="2"]')).toBeVisible();

        // Deselect a single visible child row inside the now-expanded sub-group.
        await getRowCheckbox(page, 2).click();

        // The reported selection must drop by exactly one across the whole dataset — not
        // collapse down to only the small sub-group's own visible count.
        await expect(page.getByTestId('selectedCount')).toHaveText(String(total - 1));
    });

    test('expandAll expands every group at every level', async ({ page }) => {
        // Both Country and Sport are grouped by default (see DevRowGroup.groupCols).
        await page.goto('/e2e/row-group');
        await waitForGroupsVisible(page);

        await page.getByTestId('expandAllBtn').click();

        // Row 0: top-level group header. Row 1: nested group header — both levels are
        // expanded by a single call, without expanding each chevron by hand.
        await expect(getGroupCellInner(page, 0)).toBeVisible();
        await expect(getGroupCellInner(page, 1)).toBeVisible();
        // Row 2: a plain data row — the deepest level has no further grouping.
        await expect(page.locator('.ag-row[row-index="2"]')).toBeVisible();
        await expect(getGroupCellInner(page, 2)).toHaveCount(0);
    });

    test('collapseAll collapses every group back down to the top level', async ({ page }) => {
        await page.goto('/e2e/row-group');
        await waitForGroupsVisible(page);

        await page.getByTestId('expandAllBtn').click();
        await expect(page.locator('.ag-row[row-index="2"]')).toBeVisible();

        await page.getByTestId('collapseAllBtn').click();

        // Back to the initial state: every currently visible row is a collapsed group header.
        const totalRows = await page.locator('.ag-row').count();
        await expect(page.locator('.kbq-ag-grid-group-cell-renderer__inner')).toHaveCount(totalRows);
    });

    test('setExpanded(groupPath, true) auto-expands every ancestor of a nested group', async ({ page }) => {
        await page.goto('/e2e/row-group');
        await waitForGroupsVisible(page);

        await page.getByTestId('expandRussiaDivingBtn').click();

        // Russia and its Diving sub-group are both expanded by one call — an athlete two
        // levels deep becomes visible with no manual chevron clicks at all.
        await expect(getDataRowByText(page, 'Ilya Zakharov')).toBeVisible();

        // A sibling sport under Russia must stay collapsed — only the addressed path expands.
        const gymnasticsGroup = getGroupRowByKey(page, 'Gymnastics');
        await expect(gymnasticsGroup).toBeVisible();
        await expect(gymnasticsGroup.locator('.kbq-chevron-right_16')).toBeVisible();
    });

    test('setExpanded(groupPath, false) collapses only the target group, ancestors stay expanded', async ({ page }) => {
        await page.goto('/e2e/row-group');
        await waitForGroupsVisible(page);

        await page.getByTestId('expandRussiaDivingBtn').click();
        await expect(getDataRowByText(page, 'Ilya Zakharov')).toBeVisible();

        await page.getByTestId('collapseRussiaDivingBtn').click();

        // Diving's own children are hidden again...
        await expect(getDataRowByText(page, 'Ilya Zakharov')).toHaveCount(0);
        // ...but Russia itself is still expanded, and the Diving group header is still shown.
        await expect(getGroupRowByKey(page, 'Diving')).toBeVisible();
    });

    test('setRowSelected selects a row hidden inside a collapsed group, and it shows selected once expanded', async ({
        page
    }) => {
        await page.goto('/e2e/row-group');
        await waitForGroupsVisible(page);

        // Russia > Diving is still fully collapsed — no AG row node exists yet for this row.
        await page.getByTestId('selectIlyaZakharovBtn').click();

        // The selection is already reflected in the full-dataset count even though the row
        // itself isn't loaded into AG's row model.
        await expect(page.getByTestId('selectedCount')).toHaveText('1');

        // Expand down to the row — it comes back selected.
        await page.getByTestId('expandRussiaDivingBtn').click();
        const athleteRow = getDataRowByText(page, 'Ilya Zakharov');
        await expect(athleteRow).toBeVisible();
        await expect(athleteRow).toHaveClass(/ag-row-selected/);
    });

    test('setRowSelected(id, false) deselects a row', async ({ page }) => {
        await page.goto('/e2e/row-group');
        await waitForGroupsVisible(page);

        await page.getByTestId('selectIlyaZakharovBtn').click();
        await expect(page.getByTestId('selectedCount')).toHaveText('1');

        await page.getByTestId('deselectIlyaZakharovBtn').click();
        await expect(page.getByTestId('selectedCount')).toHaveText('0');

        await page.getByTestId('expandRussiaDivingBtn').click();
        const athleteRow = getDataRowByText(page, 'Ilya Zakharov');
        await expect(athleteRow).toBeVisible();
        await expect(athleteRow).not.toHaveClass(/ag-row-selected/);
    });

    test('clicking the group column header cycles asc/desc/none, reordering top-level groups', async ({ page }) => {
        await page.goto('/e2e/row-group');
        await waitForGroupsVisible(page);

        const headerCell = getGroupHeaderCell(page);
        const headerLabel = headerCell.locator('.ag-header-cell-label');
        const firstGroupKey = page.locator('.kbq-ag-grid-group-cell-renderer__key').first();

        const initialFirstKey = (await firstGroupKey.textContent()) ?? '';

        // Ascending. AG's own header state (aria-sort) updates synchronously on click, but the
        // actual row reorder happens asynchronously (via the directive's `sortChanged`
        // subscription → signal write → effect) — wait for the row content itself to change
        // before reading it, not just the header attribute, to avoid a race between the two.
        await headerLabel.click();
        await expect(headerCell).toHaveAttribute('aria-sort', 'ascending');
        await expect(firstGroupKey).not.toHaveText(initialFirstKey);
        const ascFirstKey = (await firstGroupKey.textContent()) ?? '';

        // Descending — the previous (ascending) first key must now sort strictly before the new
        // first key, proving the whole order actually reversed rather than staying put.
        await headerLabel.click();
        await expect(headerCell).toHaveAttribute('aria-sort', 'descending');
        await expect(firstGroupKey).not.toHaveText(ascFirstKey);
        const descFirstKey = (await firstGroupKey.textContent()) ?? '';
        expect(naturalCompare(ascFirstKey, descFirstKey)).toBeLessThan(0);

        // Back to unsorted — original insertion order is restored.
        await headerLabel.click();
        await expect(headerCell).toHaveAttribute('aria-sort', 'none');
        await expect(firstGroupKey).toHaveText(initialFirstKey);
    });

    test('setGroupColSort applies sort through AG Grid, keeping the header arrow in sync', async ({ page }) => {
        await page.goto('/e2e/row-group');
        await waitForGroupsVisible(page);

        const headerCell = getGroupHeaderCell(page);
        const firstGroupKey = page.locator('.kbq-ag-grid-group-cell-renderer__key').first();
        const initialFirstKey = (await firstGroupKey.textContent()) ?? '';

        await page.getByTestId('sortGroupColAscBtn').click();

        // The header's own sort arrow reflects the programmatic change exactly as it would a
        // real click, and the rows are reordered ascending.
        await expect(headerCell).toHaveAttribute('aria-sort', 'ascending');
        await expect(firstGroupKey).not.toHaveText(initialFirstKey);

        await page.getByTestId('clearGroupColSortBtn').click();

        await expect(headerCell).toHaveAttribute('aria-sort', 'none');
        await expect(firstGroupKey).toHaveText(initialFirstKey);
    });

    test('unchecking all column checkboxes removes grouping', async ({ page }) => {
        await page.goto('/e2e/row-group');
        await waitForGroupsVisible(page);

        // Both columns are grouped by default (see DevRowGroup.groupCols) — uncheck each
        await getGroupCheckbox(page, 'Country').click();
        await getGroupCheckbox(page, 'Sport').click();

        // Group cell renderers should no longer be present
        await expect(page.locator('.kbq-ag-grid-group-cell-renderer__inner')).toHaveCount(0, { timeout: 5_000 });
    });

    test('sorting a data column reorders leaf rows within a group without scattering group headers', async ({
        page
    }) => {
        // Both Country and Sport are grouped by default (see DevRowGroup.groupCols).
        await page.goto('/e2e/row-group');
        await waitForGroupsVisible(page);

        await page.getByTestId('expandRussiaDivingBtn').click();
        await expect(getDataRowByText(page, 'Ilya Zakharov')).toBeVisible();

        const groupCountBefore = await page.locator('.kbq-ag-grid-group-cell-renderer__inner').count();
        const goldBefore = await getLeafGoldValues(page);

        const goldHeader = getDataHeaderCell(page, 'gold');
        await goldHeader.locator('.ag-header-cell-label').click();
        await expect(goldHeader).toHaveAttribute('aria-sort', 'ascending');

        // Group headers/nesting stay identical to before the sort — this is the actual bug: a
        // native AG sort over rowData used to scatter/duplicate/lose these synthetic rows.
        await expect(page.locator('.kbq-ag-grid-group-cell-renderer__inner')).toHaveCount(groupCountBefore);
        await expect(getGroupRowByKey(page, 'Diving')).toBeVisible();

        // The leaf rows within Diving are now actually reordered ascending by Gold.
        await expect.poll(async () => getLeafGoldValues(page)).not.toEqual(goldBefore);
        const goldAfter = await getLeafGoldValues(page);
        expect(goldAfter).toEqual([...goldAfter].sort((a, b) => a - b));
    });

    test('sorting a data column and the group column are mutually exclusive', async ({ page }) => {
        await page.goto('/e2e/row-group');
        await waitForGroupsVisible(page);

        const groupHeader = getGroupHeaderCell(page);
        const goldHeader = getDataHeaderCell(page, 'gold');

        await groupHeader.locator('.ag-header-cell-label').click();
        await expect(groupHeader).toHaveAttribute('aria-sort', 'ascending');

        // Sorting Gold takes over as the single active sort — AG itself clears the group
        // column's sort state, same as a real header click would for any two native columns.
        await goldHeader.locator('.ag-header-cell-label').click();
        await expect(goldHeader).toHaveAttribute('aria-sort', 'ascending');
        await expect(groupHeader).toHaveAttribute('aria-sort', 'none');
    });

    test('data column sorting behaves as a plain native AG sort once grouping is removed', async ({ page }) => {
        await page.goto('/e2e/row-group');
        await waitForDataLoaded(page);

        // Both columns are grouped by default (see DevRowGroup.groupCols) — uncheck each so the
        // no-op comparator (grouped-only) is out of the picture entirely.
        await getGroupCheckbox(page, 'Country').click();
        await getGroupCheckbox(page, 'Sport').click();
        await expect(page.locator('.kbq-ag-grid-group-cell-renderer__inner')).toHaveCount(0, { timeout: 5_000 });

        const goldHeader = getDataHeaderCell(page, 'gold');
        const firstGoldCell = page.locator('.ag-row[row-index="0"] [col-id="gold"]');
        const initialGold = (await firstGoldCell.textContent()) ?? '';

        await goldHeader.locator('.ag-header-cell-label').click();
        await expect(goldHeader).toHaveAttribute('aria-sort', 'ascending');
        await expect(firstGoldCell).not.toHaveText(initialGold);
        const ascGold = (await firstGoldCell.textContent()) ?? '';

        await goldHeader.locator('.ag-header-cell-label').click();
        await expect(goldHeader).toHaveAttribute('aria-sort', 'descending');
        await expect(firstGoldCell).not.toHaveText(ascGold);
    });
});
