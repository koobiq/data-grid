import { expect, Locator, Page, test } from '@playwright/test';
import { getAgGridApi } from './utils/api';
import { enableDarkTheme } from './utils/theme';

// DevColumnMenu uses KBQ_AG_GRID_COLUMN_MENU_LABELS_EN
const LABEL_PIN_LEFT = 'Pin Left';
const LABEL_UNPIN = 'Unpin';

const openPanel = async (page: Page): Promise<void> => {
    await page.locator('.kbq-column-menu-trigger').click();
    await page.locator('.kbq-column-menu-panel').waitFor({ state: 'visible' });
};

const getSection = (page: Page, sectionLabel: string): Locator =>
    page.locator('section').filter({ has: page.locator('.kbq-column-menu-section-label', { hasText: sectionLabel }) });

const getRow = (section: Locator, columnName: string): Locator =>
    section.locator('.kbq-column-menu-row').filter({ hasText: columnName });

const getDragHandle = (section: Locator, rowIndex: number): Locator =>
    section.locator('.kbq-column-menu-row').nth(rowIndex).locator('.kbq-column-menu-drag-handle');

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
    await page.waitForTimeout(100);
    await page.mouse.move(tgtX, tgtY, { steps: 50 }); // slow enough for CDK to register each position
    await page.waitForTimeout(150); // hold so CDK registers the active drop list
    await page.mouse.up();
};

const getHeaderCellLeft = async (page: Page, colId: string): Promise<number> =>
    page.locator(`.ag-header-cell[col-id="${colId}"]`).evaluate((el: Element) => el.getBoundingClientRect().left);

test.describe('KbqAgGridColumnMenu', () => {
    // Screenshots differ across OS — always update snapshots via Docker: `yarn run e2e:docker:update-snapshots`
    test('open panel visual', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 700 });
        await page.goto('/e2e/column-menu');
        const api = await getAgGridApi(page);
        // Wait for row data to load via HTTP before manipulating grid state.
        await page.locator('.ag-row[row-index]').first().waitFor();
        await api.evaluate((gridApi) => {
            gridApi.setColumnsPinned(['athlete'], 'left');
            gridApi.setColumnsVisible(['year', 'sport', 'gold', 'silver', 'bronze', 'total'], false);
        });
        await openPanel(page);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Tab');
        await page.keyboard.press('ArrowRight');
        await expect(page.getByTestId('e2eScreenshotTarget')).toHaveScreenshot('column-menu-opened-light.png');
        await enableDarkTheme(page);
        await expect(page.getByTestId('e2eScreenshotTarget')).toHaveScreenshot('column-menu-opened-dark.png');
    });

    test('hiding a column via panel removes its header cell from the grid', async ({ page }) => {
        await page.goto('/e2e/column-menu');
        await openPanel(page);

        await getRow(getSection(page, 'Visible'), 'Country').locator('.kbq-column-menu-checkbox').click();

        await expect(page.locator('.ag-header-cell[col-id="country"]')).not.toBeVisible();
    });

    test('showing a hidden column via panel removes it from the Hidden section', async ({ page }) => {
        await page.goto('/e2e/column-menu');
        const api = await getAgGridApi(page);
        await api.evaluate((gridApi) => gridApi.setColumnsVisible(['country'], false));

        await openPanel(page);

        const hiddenCountry = getRow(getSection(page, 'Hidden'), 'Country');
        await expect(hiddenCountry).toBeVisible();
        await hiddenCountry.click();

        // Column virtualization may push Country off-screen after it is moved to the last position,
        // so verify via the column state API rather than the grid DOM.
        await expect
            .poll(async () => {
                const state = await api.evaluate((gridApi) =>
                    gridApi.getColumnState().find((s) => s.colId === 'country')
                );
                return state?.hide;
            })
            .toBeFalsy();
    });

    test('lockVisible column checkbox is disabled and clicking the row does not hide the column', async ({ page }) => {
        await page.goto('/e2e/column-menu');
        await openPanel(page);

        const athleteCheckbox = getRow(getSection(page, 'Visible'), 'Athlete').locator('.kbq-column-menu-checkbox');
        await expect(athleteCheckbox).toHaveAttribute('aria-disabled', 'true');

        await getRow(getSection(page, 'Visible'), 'Athlete').click();

        await expect(page.locator('.ag-header-cell[col-id="athlete"]')).toBeVisible();
    });

    test('pinning a column left via panel moves its header cell to the pinned-left container', async ({ page }) => {
        await page.goto('/e2e/column-menu');
        await openPanel(page);

        await getRow(getSection(page, 'Visible'), 'Athlete').locator(`[title="${LABEL_PIN_LEFT}"]`).click();

        await expect(page.locator('.ag-pinned-left-header .ag-header-cell[col-id="athlete"]')).toBeVisible();
    });

    test('unpinning Date (pre-pinned right) via panel removes it from the pinned-right area', async ({ page }) => {
        await page.goto('/e2e/column-menu');
        const api = await getAgGridApi(page);
        await openPanel(page);

        await getRow(getSection(page, 'Pinned Right'), 'Date').locator(`[title="${LABEL_UNPIN}"]`).click();

        await expect(page.locator('.ag-pinned-right-header .ag-header-cell[col-id="date"]')).not.toBeVisible();
        await expect
            .poll(async () => {
                const state = await api.evaluate((gridApi) => gridApi.getColumnState().find((s) => s.colId === 'date'));
                return state?.pinned;
            })
            .toBeFalsy();
    });

    test('reset restores all columns to their initial state', async ({ page }) => {
        await page.goto('/e2e/column-menu');
        const api = await getAgGridApi(page);

        await api.evaluate((gridApi) => {
            gridApi.setColumnsVisible(['age'], false);
            gridApi.setColumnsPinned(['athlete'], 'left');
        });

        await openPanel(page);

        await expect(page.locator('.kbq-column-menu-section-label', { hasText: 'Pinned Left' })).toBeVisible();
        await expect(getSection(page, 'Hidden').locator('.kbq-column-menu-row', { hasText: 'Age' })).toBeVisible();

        await page.locator('.kbq-column-menu-reset-btn').click();

        await expect(page.locator('.ag-header-cell[col-id="age"]')).toBeVisible();
        await expect(page.locator('.ag-pinned-left-header .ag-header-cell[col-id="athlete"]')).not.toBeVisible();
        await expect(page.locator('.ag-pinned-right-header .ag-header-cell[col-id="date"]')).toBeVisible();
    });

    test('drag-and-drop reorders columns within the visible section', async ({ page }) => {
        await page.goto('/e2e/column-menu');
        await openPanel(page);

        const athleteLeftBefore = await getHeaderCellLeft(page, 'athlete');
        const countryLeftBefore = await getHeaderCellLeft(page, 'country');
        expect(athleteLeftBefore).toBeLessThan(countryLeftBefore);

        const visibleSection = getSection(page, 'Visible');
        await drag(page, getDragHandle(visibleSection, 0), visibleSection.locator('.kbq-column-menu-row').nth(2));

        await expect
            .poll(async () => {
                const [athleteLeft, countryLeft] = await Promise.all([
                    getHeaderCellLeft(page, 'athlete'),
                    getHeaderCellLeft(page, 'country')
                ]);
                return athleteLeft > countryLeft;
            })
            .toBe(true);
    });

    test('drag-and-drop moves a column from the Pinned Left section to the Visible section', async ({ page }) => {
        await page.goto('/e2e/column-menu');
        const api = await getAgGridApi(page);

        await api.evaluate((gridApi) => gridApi.setColumnsPinned(['athlete'], 'left'));

        await openPanel(page);

        // Drag DOWN from Pinned Left into Visible (below) — more reliable than dragging upward
        // because CDK gets a longer travel distance to register the target drop list.
        const pinnedLeftSection = getSection(page, 'Pinned Left');
        await expect(pinnedLeftSection).toBeVisible();

        await drag(
            page,
            getDragHandle(pinnedLeftSection, 0),
            getSection(page, 'Visible').locator('.kbq-column-menu-row').nth(3)
        );

        await expect
            .poll(async () => {
                const state = await api.evaluate((gridApi) =>
                    gridApi.getColumnState().find((s) => s.colId === 'athlete')
                );
                return state?.pinned;
            })
            .toBeFalsy();

        await expect(page.locator('.kbq-column-menu-section-label', { hasText: 'Pinned Left' })).not.toBeVisible();
    });
});
