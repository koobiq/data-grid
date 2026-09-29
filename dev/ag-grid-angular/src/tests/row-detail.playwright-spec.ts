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

const getBackground = async (page: Page, rowIndex: number): Promise<string> =>
    getRow(page, rowIndex).evaluate((element: HTMLElement) => getComputedStyle(element).backgroundColor);

/** Resolves `--kbq-background-contrast-less` the same way the theme applies it to a row. */
const getContrastLessColor = async (page: Page): Promise<string> =>
    getScreenshotTarget(page).evaluate((grid: HTMLElement) => {
        const probe = document.createElement('div');

        probe.style.backgroundColor = 'var(--kbq-background-contrast-less)';
        grid.appendChild(probe);

        const color = getComputedStyle(probe).backgroundColor;

        probe.remove();

        return color;
    });

/** Odd rows expand into a nested grid, even ones into a text card, and both render asynchronously:
 * screenshots wait for the content of every expanded row, so none is captured while the panel is
 * still growing. */
const waitForDetails = async (page: Page, count = 1): Promise<void> => {
    await expect(page.locator('[data-testid="e2eRowDetailGrid"], [data-testid="e2eRowDetailSummary"]')).toHaveCount(
        count
    );

    const grids = page.getByTestId('e2eRowDetailGrid');
    const gridCount = await grids.count();

    if (gridCount > 0) await expect(grids.locator('.ag-row')).toHaveCount(gridCount * 4);

    // The row is given the height of its panel one task later, so without this a screenshot can
    // catch the row still at its collapsed height.
    await expect
        .poll(async () =>
            page.evaluate(() =>
                Array.from(document.querySelectorAll('.kbq-ag-grid-row-detail')).every((panel) => {
                    const row = panel.closest('.ag-row');

                    return !!row && row.getBoundingClientRect().height >= panel.getBoundingClientRect().height;
                })
            )
        )
        .toBe(true);
};

const getCenterViewport = (page: Page): Locator =>
    getScreenshotTarget(page).locator('.ag-center-cols-viewport').first();

/** Scrolls the columns as far right as asked, or to the end when the columns are narrower than
 * that, and returns how far they actually went. */
const scrollColumns = async (page: Page, left: number): Promise<number> => {
    const viewport = getCenterViewport(page);
    const scrolled = await viewport.evaluate((element: HTMLElement, value: number) => {
        const target = Math.min(value, element.scrollWidth - element.clientWidth);

        element.scrollTo({ left: target });

        return Math.round(target);
    }, left);

    await expect
        .poll(async () => viewport.evaluate((element: HTMLElement) => Math.round(element.scrollLeft)))
        .toBe(scrolled);

    return scrolled;
};

const expandFilledRow = async (page: Page): Promise<void> => {
    await page.getByTestId('e2eFilledButton').click();
    await getToggle(page, 0).click();
    await expect(getDetail(page, 0)).toBeVisible();
};

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
            // An odd row expands into the nested grid, whose own state would be lost if the detail
            // component were re-created when the row comes back.
            await getToggle(page, 1).click();
            await waitForDetails(page);

            // Moves focus off the expanded row: AG Grid keeps the row holding the focused cell
            // rendered, which would leave nothing for the scroll below to destroy.
            await getRow(page, 5).locator('.ag-cell').first().click();
            await scrollBody(page, 5000);
            await expect(getRow(page, 1)).toHaveCount(0);

            await scrollBody(page, 0);
            await expect(getDetail(page, 1)).toBeVisible();
            await waitForDetails(page);
        });

        test('collapses the previously expanded row in single expand mode', async ({ page }) => {
            await getToggle(page, 0).click();
            await expect(getDetail(page, 0)).toBeVisible();

            await getToggle(page, 2).click();
            await expect(getDetail(page, 0)).toBeHidden();
            await expect(getDetail(page, 2)).toBeVisible();
        });

        test('collapses every row by the collapse all button', async ({ page }) => {
            await page.getByTestId('e2eSingleExpandButton').click();
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

        test('collapses the row by a close button inside the expanded part', async ({ page }) => {
            // Even rows expand into the text card, which carries the close button.
            await getToggle(page, 0).click();
            await waitForDetails(page);

            await getRow(page, 0).getByTestId('e2eRowDetailCloseButton').click();

            await expect(getDetail(page, 0)).toBeHidden();
            await expect(getToggle(page, 0)).toHaveAttribute('aria-expanded', 'false');
            await expect(getToggle(page, 0)).toBeFocused();
        });

        test('keeps the default row states on an expanded row', async ({ page }) => {
            await getToggle(page, 0).click();
            await expect(getDetail(page, 0)).toBeVisible();
            // Drops the focus the toggle click left on the row, so only hover differs below.
            await page.evaluate(() => {
                if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
            });
            await getRow(page, 5).hover();

            const idle = await getBackground(page, 0);

            await getRow(page, 0).hover();
            await expect(getRow(page, 0)).toHaveClass(/ag-row-hover/);

            expect(await getBackground(page, 0)).not.toBe(idle);
        });

        test('keeps a static fill on the expanded row with kbqAgGridRowDetailFilled', async ({ page }) => {
            await expandFilledRow(page);

            const filled = await getBackground(page, 0);

            expect(filled).toBe(await getContrastLessColor(page));
            expect(await getBackground(page, 1)).not.toBe(filled);

            await getRow(page, 0).hover();
            await expect(getRow(page, 0)).toHaveClass(/ag-row-hover/);
            expect(await getBackground(page, 0)).toBe(filled);

            await getRow(page, 0).locator('.ag-checkbox-input').click();
            await expect(getRow(page, 0)).toHaveClass(/ag-row-selected/);
            expect(await getBackground(page, 0)).toBe(filled);
        });

        test('fills only the expanded rows with kbqAgGridRowDetailFilled', async ({ page }) => {
            await expandFilledRow(page);
            await getRow(page, 1).locator('.ag-checkbox-input').click();
            await expect(getRow(page, 1)).toHaveClass(/ag-row-selected/);
            await getRow(page, 1).hover();

            // A collapsed row keeps its states: selected and hovered, it is not the static fill.
            expect(await getBackground(page, 1)).not.toBe(await getBackground(page, 0));
        });

        test('keeps the expanded part in the visible area by default', async ({ page }) => {
            await getToggle(page, 0).click();
            await waitForDetails(page);

            const viewport = (await getCenterViewport(page).boundingBox())!;
            const before = (await getDetail(page, 0).boundingBox())!;

            expect(Math.round(before.x)).toBe(Math.round(viewport.x));
            expect(Math.round(before.width)).toBe(Math.round(viewport.width));

            const scrolled = await scrollColumns(page, 400);

            expect(scrolled).toBeGreaterThan(0);

            const after = (await getDetail(page, 0).boundingBox())!;

            expect(Math.round(after.x)).toBe(Math.round(viewport.x));
            expect(Math.round(after.width)).toBe(Math.round(before.width));
        });

        test('scrolls the expanded part with the columns once sticky is off', async ({ page }) => {
            await page.getByTestId('e2eStickyButton').click();
            await getToggle(page, 0).click();
            await waitForDetails(page);

            const viewport = (await getCenterViewport(page).boundingBox())!;
            const scrolled = await scrollColumns(page, 400);

            expect(scrolled).toBeGreaterThan(0);

            const after = (await getDetail(page, 0).boundingBox())!;

            expect(Math.round(after.x)).toBe(Math.round(viewport.x) - scrolled);
        });

        // Screenshots differ across OS — always update snapshots via Docker: `yarn run e2e:docker:update-snapshots`
        test('renders the sticky expanded row with the columns scrolled', async ({ page }) => {
            // Odd rows expand into the nested grid, which is wider than the visible area.
            await getToggle(page, 1).click();
            await waitForDetails(page);
            await scrollColumns(page, 400);
            await expect(getScreenshotTarget(page)).toHaveScreenshot('row-detail-sticky-light.png');
        });

        test('renders the expanded row with kbqAgGridRowDetailSticky off', async ({ page }) => {
            await page.getByTestId('e2eStickyButton').click();
            await getToggle(page, 1).click();
            await waitForDetails(page);
            await scrollColumns(page, 400);
            await expect(getScreenshotTarget(page)).toHaveScreenshot('row-detail-sticky-off-light.png');
        });

        test('renders the filled expanded row', async ({ page }) => {
            await expandFilledRow(page);
            await getRow(page, 0).locator('.ag-checkbox-input').click();
            await getRow(page, 0).hover();
            await waitForDetails(page);
            await expect(getScreenshotTarget(page)).toHaveScreenshot('row-detail-filled-light.png');
        });

        test('renders the filled expanded row in dark theme', async ({ page }) => {
            await enableDarkTheme(page);
            await expandFilledRow(page);
            await getRow(page, 0).locator('.ag-checkbox-input').click();
            await getRow(page, 0).hover();
            await waitForDetails(page);
            await expect(getScreenshotTarget(page)).toHaveScreenshot('row-detail-filled-dark.png');
        });

        test('restores the default row states once kbqAgGridRowDetailFilled is turned off', async ({ page }) => {
            await page.getByTestId('e2eSingleExpandButton').click();
            await expandFilledRow(page);
            await getRow(page, 0).locator('.ag-checkbox-input').click();
            await expect(getRow(page, 0)).toHaveClass(/ag-row-selected/);

            // Turned off on a row that is already expanded and selected.
            await page.getByTestId('e2eFilledButton').click();
            await expect(getRow(page, 0)).not.toHaveClass(/kbq-ag-grid-row-detail-row_filled/);

            // The next row is expanded too and keeps the focus the toggle click leaves in it.
            await getToggle(page, 1).click();
            await expect(getDetail(page, 1)).toBeVisible();
            await expect(getRow(page, 1)).toHaveClass(/ag-row-focus/);
            await page.mouse.move(0, 0);

            // A selected row is filled with the same color by default, so the focused one tells the states apart.
            expect(await getBackground(page, 1)).not.toBe(await getContrastLessColor(page));
            await waitForDetails(page, 2);
            await expect(getScreenshotTarget(page)).toHaveScreenshot('row-detail-filled-off-light.png');
        });

        test('renders the expanded row', async ({ page }) => {
            await getToggle(page, 0).click();
            await waitForDetails(page);
            await expect(getScreenshotTarget(page)).toHaveScreenshot('row-detail-expanded-light.png');
        });

        test('renders the expanded row in dark theme', async ({ page }) => {
            await enableDarkTheme(page);
            // An odd row, so that the nested grid keeps its dark theme coverage.
            await getToggle(page, 1).click();
            await waitForDetails(page);
            await expect(getScreenshotTarget(page)).toHaveScreenshot('row-detail-expanded-dark.png');
        });
    });

    test('keeps the expanded part in the center section with pinned columns', async ({ page }) => {
        await page.goto('/e2e/row-detail-pinned-columns');
        await getRow(page, 0).waitFor({ state: 'visible' });
        // An odd row, so that the nested grid is the one shown next to the pinned sections.
        await getToggle(page, 1).click();
        await waitForDetails(page);
        // The pinned column shadow appears once the theme has measured the overflow: waiting for the
        // class keeps the screenshot from racing that measurement.
        await expect(getScreenshotTarget(page)).toHaveClass(/ag-theme-koobiq_pinned-right-cols-overflow/);
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
