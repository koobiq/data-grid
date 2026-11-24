import { expect, Locator, Page, test } from '@playwright/test';
import { getAgGridApi } from './utils/api';
import { enableDarkTheme } from './utils/theme';

// DevSettingsMenu uses KBQ_AG_GRID_SETTINGS_MENU_LABELS_EN
const MENU_TITLE = 'Table settings';
const ITEM_COLUMNS = 'Columns';
const ITEM_SORT = 'Sorting';
const ITEM_DENSITY = 'Density (dev)';
const LABEL_BACK = 'Back';
const LABEL_RESET = 'Reset to default';

const openMenu = async (page: Page): Promise<void> => {
    await page.locator('.kbq-settings-menu-trigger').click();
    await page.locator('.kbq-settings-menu-panel').waitFor({ state: 'visible' });
};

const getItem = (page: Page, label: string): Locator =>
    page.locator('kbq-settings-menu-item').filter({ hasText: label });

const getSortRow = (page: Page, columnName: string): Locator =>
    page.locator('kbq-sort-menu-row').filter({ hasText: columnName });

// The keyboard focus of a sort row lands on its checkbox, which carries the row's role and state.
const getSortRowCheckbox = (page: Page, columnName: string): Locator =>
    getSortRow(page, columnName).locator('.kbq-column-menu-checkbox');

const openSortScreen = async (page: Page): Promise<void> => {
    await openMenu(page);
    await getItem(page, ITEM_SORT).click();
    await page.locator('.kbq-ag-grid-sort-panel').waitFor({ state: 'visible' });
};

const getSortState = async (
    page: Page
): Promise<{ colId: string; sort: string | null; sortIndex: number | null }[]> => {
    const api = await getAgGridApi(page);

    return api.evaluate((gridApi) =>
        gridApi
            .getColumnState()
            .filter((state) => !!state.sort)
            .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
            .map((state) => ({ colId: state.colId, sort: state.sort ?? null, sortIndex: state.sortIndex ?? null }))
    );
};

/** CDK DragDrop uses pointer events — manual mouse simulation is required. */
const drag = async (page: Page, source: Locator, target: Locator): Promise<void> => {
    const from = await source.boundingBox();
    const to = await target.boundingBox();
    if (!from || !to) throw new Error('Bounding box not found');

    const srcX = from.x + from.width / 2;
    const srcY = from.y + from.height / 2;
    const tgtX = to.x + to.width / 2;
    const tgtY = to.y + to.height / 2;

    await page.mouse.move(srcX, srcY);
    await page.mouse.down();
    await page.mouse.move(srcX, srcY - 10); // past CDK's 5-px drag-start threshold
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await page.waitForTimeout(100);
    await page.mouse.move(tgtX, tgtY, { steps: 50 }); // slow enough for CDK to register each position
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await page.waitForTimeout(150); // hold so CDK registers the active drop list
    await page.mouse.up();
};

test.describe('KbqAgGridSettingsMenu', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/e2e/settings-menu');
        // Wait for row data to load via HTTP before manipulating grid state.
        await page.locator('.ag-row[row-index]').first().waitFor();
    });

    // Screenshots differ across OS — always update snapshots via Docker: `yarn run e2e:docker:update-snapshots`
    test('root level visual', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 700 });
        const api = await getAgGridApi(page);

        // Sorting applied up front, so that the item shows its value, direction and counter.
        await api.evaluate((gridApi) =>
            gridApi.applyColumnState({
                state: [
                    { colId: 'title', sort: 'asc', sortIndex: 0 },
                    { colId: 'riskScore', sort: 'desc', sortIndex: 1 }
                ]
            })
        );
        await openMenu(page);

        await expect(page.getByTestId('e2eScreenshotTarget')).toHaveScreenshot('settings-menu-root-light.png');
        await enableDarkTheme(page);
        await expect(page.getByTestId('e2eScreenshotTarget')).toHaveScreenshot('settings-menu-root-dark.png');
    });

    test('sort screen visual', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 700 });
        await openSortScreen(page);
        await getSortRow(page, 'Title').click();
        await getSortRow(page, 'Risk score').click();
        await getSortRow(page, 'Title').hover();

        await expect(page.getByTestId('e2eScreenshotTarget')).toHaveScreenshot('settings-menu-sort-light.png');
        await enableDarkTheme(page);
        await expect(page.getByTestId('e2eScreenshotTarget')).toHaveScreenshot('settings-menu-sort-dark.png');
    });

    test('columns screen visual', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 700 });
        await openMenu(page);
        await getItem(page, ITEM_COLUMNS).click();
        await page.locator('.kbq-ag-grid-columns-panel').waitFor({ state: 'visible' });

        await expect(page.getByTestId('e2eScreenshotTarget')).toHaveScreenshot('settings-menu-columns-light.png');
        await enableDarkTheme(page);
        await expect(page.getByTestId('e2eScreenshotTarget')).toHaveScreenshot('settings-menu-columns-dark.png');
    });

    test('opens a nested level and returns back by the header button', async ({ page }) => {
        await openMenu(page);
        await getItem(page, ITEM_SORT).click();

        await expect(page.locator('.kbq-settings-menu-panel-title')).toHaveText(ITEM_SORT);

        await page.locator(`.kbq-settings-menu-header-btn[title="${LABEL_BACK}"]`).click();

        await expect(page.locator('.kbq-settings-menu-panel-title')).toHaveText(MENU_TITLE);
    });

    test('enabling sorting from the menu sorts the grid', async ({ page }) => {
        await openSortScreen(page);
        await getSortRow(page, 'Title').click();

        await expect.poll(async () => getSortState(page)).toEqual([{ colId: 'title', sort: 'asc', sortIndex: 0 }]);
        await expect(page.locator('.ag-header-cell[col-id="title"] .ag-sort-ascending-icon')).toBeVisible();
    });

    test('enabling sorting for several columns applies multi-column sorting in click order', async ({ page }) => {
        await openSortScreen(page);
        await getSortRow(page, 'Title').click();
        await getSortRow(page, 'Risk score').click();

        await expect
            .poll(async () => getSortState(page))
            .toEqual([
                { colId: 'title', sort: 'asc', sortIndex: 0 },
                { colId: 'riskScore', sort: 'asc', sortIndex: 1 }
            ]);
    });

    test('the direction button switches the sort direction', async ({ page }) => {
        await openSortScreen(page);
        await getSortRow(page, 'Title').click();
        await getSortRow(page, 'Title').locator('.kbq-sort-menu-direction-btn').click();

        await expect.poll(async () => getSortState(page)).toEqual([{ colId: 'title', sort: 'desc', sortIndex: 0 }]);
    });

    test('the direction button is disabled for a column with a single sorting order', async ({ page }) => {
        await openSortScreen(page);
        // DevSettingsMenu defines `sortingOrder: ['asc']` for the Status column.
        await getSortRow(page, 'Status').click();

        const button = getSortRow(page, 'Status').locator('.kbq-sort-menu-direction-btn');

        await expect(button).toHaveAttribute('aria-disabled', 'true');
        await expect(button).toHaveAttribute('title', /.+/);

        // Playwright refuses to click an aria-disabled control, so the click is forced to prove
        // that the handler itself ignores it.
        // eslint-disable-next-line playwright/no-force-option
        await button.click({ force: true });

        await expect.poll(async () => getSortState(page)).toEqual([{ colId: 'status', sort: 'asc', sortIndex: 0 }]);
    });

    test('columns without sorting are not listed', async ({ page }) => {
        await openSortScreen(page);

        // DevSettingsMenu defines `sortable: false` for the Attack type column.
        await expect(getSortRow(page, 'Attack type')).toHaveCount(0);
        await expect(getSortRow(page, 'Title')).toHaveCount(1);
    });

    test('dragging a sorted column changes the multi-column sorting order', async ({ page }) => {
        await openSortScreen(page);
        await getSortRow(page, 'Title').click();
        await getSortRow(page, 'Risk score').click();

        const riskScore = getSortRow(page, 'Risk score');
        await riskScore.hover();

        await drag(page, riskScore.locator('.kbq-column-menu-drag-handle'), getSortRow(page, 'Title'));

        await expect
            .poll(async () => getSortState(page))
            .toEqual([
                { colId: 'riskScore', sort: 'asc', sortIndex: 0 },
                { colId: 'title', sort: 'asc', sortIndex: 1 }
            ]);
    });

    test('the reset button restores the default sorting', async ({ page }) => {
        await openSortScreen(page);
        await getSortRow(page, 'Title').click();

        await expect.poll(async () => getSortState(page)).toHaveLength(1);

        await page.locator(`.kbq-settings-menu-header-btn[title="${LABEL_RESET}"]`).click();

        await expect.poll(async () => getSortState(page)).toEqual([]);
    });

    test('the columns reset button restores the default layout and keeps the sorting', async ({ page }) => {
        const api = await getAgGridApi(page);
        const initialOrder = await api.evaluate((gridApi) => gridApi.getAllGridColumns().map((col) => col.getColId()));

        await api.evaluate((gridApi) => {
            gridApi.setColumnsVisible(['severity'], false);
            gridApi.setColumnsPinned(['title'], 'left');
            gridApi.moveColumns(['alerts'], 1);
            gridApi.applyColumnState({ state: [{ colId: 'riskScore', sort: 'desc' }] });
        });

        await openMenu(page);
        await getItem(page, ITEM_COLUMNS).click();
        await page.locator(`.kbq-settings-menu-header-btn[title="${LABEL_RESET}"]`).click();

        await expect
            .poll(async () => api.evaluate((gridApi) => gridApi.getAllGridColumns().map((col) => col.getColId())))
            .toEqual(initialOrder);
        await expect
            .poll(async () =>
                api.evaluate((gridApi) =>
                    gridApi
                        .getColumnState()
                        .filter(({ colId }) => ['severity', 'title', 'detectedOn', 'riskScore'].includes(colId))
                        .map(({ colId, hide, pinned, sort }) => ({ colId, hide, pinned, sort }))
                )
            )
            .toEqual([
                { colId: 'title', hide: false, pinned: null, sort: null },
                { colId: 'riskScore', hide: false, pinned: null, sort: 'desc' },
                { colId: 'severity', hide: false, pinned: null, sort: null },
                { colId: 'detectedOn', hide: false, pinned: 'right', sort: null }
            ]);
        await expect(page.locator('.kbq-column-menu-panel-footer')).toHaveCount(0);
    });

    test('the sorting item shows the applied sorting and the counter of the remaining ones', async ({ page }) => {
        await openSortScreen(page);
        await getSortRow(page, 'Title').click();
        await getSortRow(page, 'Risk score').click();
        await page.locator(`.kbq-settings-menu-header-btn[title="${LABEL_BACK}"]`).click();

        const item = getItem(page, ITEM_SORT);

        await expect(item.locator('.kbq-settings-menu-item-value')).toHaveText('Title');
        await expect(item.locator('.kbq-settings-menu-item-counter')).toHaveText('+1');
    });

    test('a single selection level marks the selected item and updates the parent value', async ({ page }) => {
        await openMenu(page);
        await getItem(page, ITEM_DENSITY).click();

        await expect(page.locator('kbq-settings-menu-item[aria-checked="true"]')).toHaveText(/Normal/);

        // DevSettingsMenu sets `keepOpen: true` on the density values, so selecting one keeps the level open.
        await getItem(page, 'Compact').click();

        await expect(page.locator('.kbq-settings-menu-panel-title')).toHaveText(ITEM_DENSITY);
        await expect(page.locator('kbq-settings-menu-item[aria-checked="true"]')).toHaveText(/Compact/);

        await page.locator(`.kbq-settings-menu-header-btn[title="${LABEL_BACK}"]`).click();

        await expect(getItem(page, ITEM_DENSITY).locator('.kbq-settings-menu-item-value')).toHaveText('Compact');
    });

    test('a leaf item without keepOpen closes the menu', async ({ page }) => {
        await openMenu(page);
        await getItem(page, 'Refresh (dev)').click();

        await expect(page.locator('.kbq-settings-menu-panel')).toBeHidden();
    });

    test('keyboard navigation walks the levels', async ({ page }) => {
        await openMenu(page);

        await expect(getItem(page, ITEM_COLUMNS)).toBeFocused();

        await page.keyboard.press('ArrowDown');
        await expect(getItem(page, ITEM_SORT)).toBeFocused();

        await page.keyboard.press('ArrowRight');
        await expect(page.locator('.kbq-settings-menu-panel-title')).toHaveText(ITEM_SORT);
        await expect(page.locator('.kbq-column-menu-search-input')).toBeFocused();

        await page.keyboard.press('Escape');
        await expect(page.locator('.kbq-settings-menu-panel-title')).toHaveText(MENU_TITLE);

        await page.keyboard.press('Escape');
        await expect(page.locator('.kbq-settings-menu-panel')).toBeHidden();
        await expect(page.locator('.kbq-settings-menu-trigger')).toBeFocused();
    });

    test('Enter toggles sorting and keeps the focus on the row', async ({ page }) => {
        await openSortScreen(page);
        await page.keyboard.press('ArrowDown');

        await expect(getSortRowCheckbox(page, 'Affected hosts')).toBeFocused();

        await page.keyboard.press('Enter');

        await expect
            .poll(async () => getSortState(page))
            .toEqual([{ colId: 'affectedHosts', sort: 'asc', sortIndex: 0 }]);
        await expect(getSortRowCheckbox(page, 'Affected hosts')).toBeFocused();
    });

    test('Enter on the direction button switches the direction without removing the sort', async ({ page }) => {
        await openSortScreen(page);
        await getSortRow(page, 'Title').click();

        await expect(getSortRowCheckbox(page, 'Title')).toBeFocused();

        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Enter');

        await expect.poll(async () => getSortState(page)).toEqual([{ colId: 'title', sort: 'desc', sortIndex: 0 }]);
    });

    test('running a leaf item from the keyboard returns the focus to the trigger', async ({ page }) => {
        await openMenu(page);
        // The menu focuses its first item once it has rendered; move on from there.
        await expect(getItem(page, ITEM_COLUMNS)).toBeFocused();
        await getItem(page, 'Refresh (dev)').focus();
        await page.keyboard.press('Enter');

        await expect(page.locator('.kbq-settings-menu-panel')).toBeHidden();
        await expect(page.locator('.kbq-settings-menu-trigger')).toBeFocused();
    });

    test('Tab cycles between the header buttons and the active item of a list level', async ({ page }) => {
        await openMenu(page);
        await getItem(page, ITEM_DENSITY).click();
        await expect(getItem(page, 'Compact')).toBeFocused();
        await page.keyboard.press('ArrowDown');
        await expect(getItem(page, 'Normal')).toBeFocused();

        await page.keyboard.press('Tab');
        await expect(page.locator('.kbq-settings-menu-back-btn')).toBeFocused();

        await page.keyboard.press('Tab');
        await expect(getItem(page, 'Normal')).toBeFocused();

        await page.keyboard.press('Shift+Tab');
        await expect(page.locator('.kbq-settings-menu-back-btn')).toBeFocused();
        await expect(page.locator('.kbq-settings-menu-panel')).toBeVisible();
    });

    test('Tab keeps the focus on the active item at the root level', async ({ page }) => {
        await openMenu(page);
        await expect(getItem(page, ITEM_COLUMNS)).toBeFocused();
        await page.keyboard.press('ArrowDown');

        await page.keyboard.press('Tab');

        await expect(getItem(page, ITEM_SORT)).toBeFocused();
        await expect(page.locator('.kbq-settings-menu-panel')).toBeVisible();
    });
});
