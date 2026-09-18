import { expect, Locator, Page, test } from '@playwright/test';
import { enableDarkTheme } from './utils/theme';

const getScreenshotTarget = (page: Page): Locator => page.getByTestId('e2eScreenshotTarget');

// The expanded part hosts a nested grid with rows and containers of its own, so every locator
// below is scoped to the outer grid's own row container.
const getRowsContainer = (page: Page): Locator =>
    getScreenshotTarget(page).locator('.ag-center-cols-container').first();

const getRow = (page: Page, rowIndex: number): Locator =>
    getRowsContainer(page).locator(`> .ag-row[row-index="${rowIndex}"]`);

const getToggle = (page: Page, rowIndex: number): Locator =>
    getRow(page, rowIndex).locator('.kbq-ag-grid-row-detail-cell-renderer__toggle');

const getDetail = (page: Page, rowIndex: number): Locator =>
    getRow(page, rowIndex).locator('> .kbq-ag-grid-row-detail');

const getRowHeight = async (page: Page, rowIndex: number): Promise<number> =>
    getRow(page, rowIndex).evaluate((element: HTMLElement) => element.getBoundingClientRect().height);

const scrollBody = async (page: Page, top: number): Promise<void> =>
    getScreenshotTarget(page)
        .locator('.ag-body-viewport')
        .first()
        .evaluate((element: HTMLElement, value: number) => element.scrollTo({ top: value }), top);

const STATE_KEY = 'dev-ag-grid-row-detail-state';

const getStoredState = async (page: Page): Promise<string[] | null> =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    page.evaluate((key) => {
        const stored = localStorage.getItem(key);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return stored ? JSON.parse(stored) : null;
    }, STATE_KEY);

const getStateFromUrl = async (page: Page): Promise<string[] | null> =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    page.evaluate((key) => {
        const item = new URLSearchParams(window.location.search).get(key);

        if (!item) return null;

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return JSON.parse(item);
        } catch {
            return null;
        }
    }, STATE_KEY);

const buildStateUrl = (ids: string[]): string =>
    `/e2e/row-detail-state-query-params?${STATE_KEY}=${encodeURIComponent(JSON.stringify(ids))}`;

/** Id of the first row in `olympic-winners.json`, used to preload state into the URL. */
const FIRST_ROW_ID = '4f32fc42-54ea-4afe-bcb3-d3e15fff11a5';

test.describe('KbqAgGridRowDetail', () => {
    test.describe('expanding', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/e2e/row-detail');
            await getRow(page, 0).waitFor({ state: 'visible' });
        });

        test('expands and collapses a row by the toggle', async ({ page }) => {
            const collapsedHeight = await getRowHeight(page, 0);

            await getToggle(page, 0).click();
            await expect(getDetail(page, 0)).toBeVisible();
            await expect(getToggle(page, 0)).toHaveAttribute('aria-expanded', 'true');
            expect(await getRowHeight(page, 0)).toBeGreaterThan(collapsedHeight);

            await getToggle(page, 0).click();
            await expect(getDetail(page, 0)).toBeHidden();
            expect(await getRowHeight(page, 0)).toBe(collapsedHeight);
        });

        test('keeps the expanded row after scrolling it out of view and back', async ({ page }) => {
            await getToggle(page, 0).click();
            await expect(page.getByTestId('e2eRowDetailGrid')).toBeVisible();

            // Moves focus off the expanded row: AG Grid keeps the row holding the focused cell
            // rendered, which would leave nothing for the scroll below to destroy.
            await getRow(page, 5).locator('.ag-cell').first().click();
            await scrollBody(page, 5000);
            await expect(getRow(page, 0)).toHaveCount(0);

            await scrollBody(page, 0);
            await expect(getDetail(page, 0)).toBeVisible();
            await expect(page.getByTestId('e2eRowDetailGrid')).toBeVisible();
        });

        test('collapses the previously expanded row in single expand mode', async ({ page }) => {
            await page.getByTestId('e2eSingleExpandButton').click();
            await getToggle(page, 0).click();
            await expect(getDetail(page, 0)).toBeVisible();

            await getToggle(page, 2).click();
            await expect(getDetail(page, 0)).toBeHidden();
            await expect(getDetail(page, 2)).toBeVisible();
        });

        test('collapses every row by the collapse all button', async ({ page }) => {
            await getToggle(page, 0).click();
            await getToggle(page, 2).click();
            await expect(getRowsContainer(page).locator('> .ag-row .kbq-ag-grid-row-detail')).toHaveCount(2);

            await page.getByTestId('e2eCollapseAllButton').click();
            await expect(getRowsContainer(page).locator('> .ag-row .kbq-ag-grid-row-detail')).toHaveCount(0);
        });

        test('moves focus into the expanded part and back by Tab', async ({ page }) => {
            await getToggle(page, 0).click();
            await expect(getDetail(page, 0)).toBeVisible();
            await getToggle(page, 0).focus();

            await page.keyboard.press('Tab');
            await expect
                .poll(async () => page.evaluate(() => !!document.activeElement?.closest('.kbq-ag-grid-row-detail')))
                .toBe(true);

            await page.keyboard.press('Shift+Tab');
            await expect(getToggle(page, 0)).toBeFocused();
        });

        // Screenshots differ across OS — always update snapshots via Docker: `yarn run e2e:docker:update-snapshots`
        test('renders the expanded row', async ({ page }) => {
            await getToggle(page, 0).click();
            await expect(page.getByTestId('e2eRowDetailGrid')).toBeVisible();
            await expect(getScreenshotTarget(page)).toHaveScreenshot('row-detail-expanded-light.png');
        });

        test('renders the expanded row in dark theme', async ({ page }) => {
            await enableDarkTheme(page);
            await getToggle(page, 0).click();
            await expect(page.getByTestId('e2eRowDetailGrid')).toBeVisible();
            await expect(getScreenshotTarget(page)).toHaveScreenshot('row-detail-expanded-dark.png');
        });
    });

    test('keeps the expanded part in the center section with pinned columns', async ({ page }) => {
        await page.goto('/e2e/row-detail-pinned-columns');
        await getRow(page, 0).waitFor({ state: 'visible' });
        await getToggle(page, 0).click();
        await expect(page.getByTestId('e2eRowDetailGrid')).toBeVisible();
        await expect(getScreenshotTarget(page)).toHaveScreenshot('row-detail-pinned-columns-light.png');
    });

    test.describe('state persistence', () => {
        test.describe('KbqAgGridRowDetailStateLocalStorageStore', () => {
            test.beforeEach(async ({ page }) => {
                await page.goto('/e2e/row-detail-state');
                await page.evaluate((key: string) => localStorage.removeItem(key), STATE_KEY);
                await getRow(page, 0).waitFor({ state: 'visible' });
            });

            test('saves the expanded rows to localStorage', async ({ page }) => {
                await getToggle(page, 0).click();

                await expect.poll(async () => getStoredState(page)).toEqual([FIRST_ROW_ID]);
            });

            test('restores the expanded rows from localStorage on page reload', async ({ page }) => {
                await getToggle(page, 1).click();
                await expect.poll(async () => getStoredState(page)).not.toBeNull();

                await page.reload();

                await expect(getDetail(page, 1)).toBeVisible();
            });

            test('removes the stored state when the row is collapsed', async ({ page }) => {
                await getToggle(page, 0).click();
                await expect.poll(async () => getStoredState(page)).not.toBeNull();

                await getToggle(page, 0).click();

                await expect.poll(async () => getStoredState(page)).toBeNull();
            });

            test('reset collapses every row and clears the stored state', async ({ page }) => {
                await getToggle(page, 0).click();
                await expect(getDetail(page, 0)).toBeVisible();

                await page.getByRole('button', { name: 'Reset state' }).click();

                await expect(getDetail(page, 0)).toBeHidden();
                await expect.poll(async () => getStoredState(page)).toBeNull();
            });
        });

        test.describe('KbqAgGridRowDetailStateQueryParamsStore', () => {
            test.beforeEach(async ({ page }) => {
                await page.goto('/e2e/row-detail-state-query-params');
                await getRow(page, 0).waitFor({ state: 'visible' });
            });

            test('saves the expanded rows to the URL', async ({ page }) => {
                await getToggle(page, 0).click();

                await expect.poll(async () => getStateFromUrl(page)).toEqual([FIRST_ROW_ID]);
            });

            test('restores the expanded rows from the URL on page reload', async ({ page }) => {
                await getToggle(page, 1).click();
                await expect.poll(async () => getStateFromUrl(page)).not.toBeNull();

                await page.reload();

                await expect(getDetail(page, 1)).toBeVisible();
            });

            test('applies pre-existing state from the URL on page load', async ({ page }) => {
                await page.goto(buildStateUrl([FIRST_ROW_ID]));

                await expect(getDetail(page, 0)).toBeVisible();
            });
        });
    });
});
