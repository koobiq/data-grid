import { expect, Page, test } from '@playwright/test';
import { ColumnState } from 'ag-grid-community';
import { getAgGridApi } from './utils/api';

const columnStateStorageKey = 'dev-ag-grid-column-state';
const columnStateQueryParamKey = 'dev-ag-grid-column-state';

const setColumnsVisible = async (page: Page, colIds: string[], visible: boolean): Promise<void> =>
    (await getAgGridApi(page)).evaluate((api, args) => api.setColumnsVisible(args.colIds, args.visible), {
        colIds,
        visible
    });

const clearColumnState = async (page: Page): Promise<void> => {
    await page.evaluate((key: string) => localStorage.removeItem(key), columnStateStorageKey);
};

const getColumnState = async (page: Page): Promise<ColumnState[] | null> => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return page.evaluate((key) => {
        const stored = localStorage.getItem(key);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return stored ? JSON.parse(stored) : null;
    }, columnStateStorageKey);
};

const getColumnStateFromUrl = async (page: Page): Promise<ColumnState[] | null> => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return page.evaluate((key) => {
        const item = new URLSearchParams(window.location.search).get(key);
        if (!item) return null;

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return JSON.parse(item);
        } catch {
            return null;
        }
    }, columnStateQueryParamKey);
};

const buildStateUrl = (state: object[]): string => {
    const encoded = encodeURIComponent(JSON.stringify(state));
    return `/e2e/column-state-query-params?${columnStateQueryParamKey}=${encoded}`;
};

/**
 * Waits for the grid to render its rows, which come over HTTP. Without it an assertion after a navigation shares its
 * timeout with loading the app, and `toBeHidden` passes before the grid exists. The column state may be restored
 * after the rows, so keep the assertions that follow it retrying.
 */
const waitForRows = async (page: Page): Promise<void> => {
    await page.locator('.ag-row[row-index]').first().waitFor();
};

test.describe('KbqAgGridColumnState', () => {
    test.describe('KbqAgGridColumnStateLocalStorageStore', () => {
        test('saves sort state to localStorage when column header is clicked', async ({ page }) => {
            await page.goto('/e2e/column-state');
            await clearColumnState(page);
            await page.locator('.ag-header-cell[col-id="title"] .ag-header-cell-label').click();

            const state = await getColumnState(page);
            const titleState = state?.find((s) => s.colId === 'title');

            expect(titleState?.sort).toBe('asc');
            expect(titleState?.sortIndex).toBe(0);
        });

        test('restores sort state from localStorage on page reload', async ({ page }) => {
            await page.goto('/e2e/column-state');
            await clearColumnState(page);
            await page.locator('.ag-header-cell[col-id="title"] .ag-header-cell-label').click();
            await page.reload();
            await waitForRows(page);

            await expect(page.locator('.ag-header-cell[col-id="title"][aria-sort="ascending"]')).toBeVisible();
        });

        test('saves column width to localStorage when column is resized', async ({ page }) => {
            await page.goto('/e2e/column-state');
            await clearColumnState(page);

            const headerCell = page.locator('.ag-header-cell[col-id="title"]');
            const resizer = headerCell.locator('.ag-header-cell-resize');

            const initialWidth = await headerCell.evaluate((el: Element) => el.getBoundingClientRect().width);
            const bounds = await resizer.boundingBox();

            expect(bounds).not.toBeNull();

            await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
            await page.mouse.down();
            await page.mouse.move(bounds!.x + bounds!.width / 2 + 60, bounds!.y);
            await page.mouse.up();

            await expect
                .poll(async () => {
                    const state = await getColumnState(page);
                    return state?.find((s) => s.colId === 'title')?.width;
                })
                .toBeGreaterThan(initialWidth);
        });

        test('restores column width from localStorage on page reload', async ({ page }) => {
            await page.goto('/e2e/column-state');
            await clearColumnState(page);

            const resizer = page.locator('.ag-header-cell[col-id="title"] .ag-header-cell-resize');
            const bounds = await resizer.boundingBox();

            expect(bounds).not.toBeNull();

            await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
            await page.mouse.down();
            await page.mouse.move(bounds!.x + bounds!.width / 2 + 60, bounds!.y);
            await page.mouse.up();

            const widthBeforeReload = await page
                .locator('.ag-header-cell[col-id="title"]')
                .evaluate((el: Element) => Math.round(el.getBoundingClientRect().width));

            await page.reload();
            await waitForRows(page);

            await expect
                .poll(async () =>
                    page
                        .locator('.ag-header-cell[col-id="title"]')
                        .evaluate((el: Element) => Math.round(el.getBoundingClientRect().width))
                )
                .toBe(widthBeforeReload);
        });

        test('applies pre-existing sort state from localStorage on page load', async ({ page }) => {
            await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
                key: columnStateStorageKey,
                value: JSON.stringify([
                    { colId: 'title', hide: false, width: 200, sort: 'desc', sortIndex: 0 },
                    { colId: 'riskScore', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'severity', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'status', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'detectedOn', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'attackType', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'alerts', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'reviewBy', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'comment', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'affectedHosts', hide: false, width: 200, sort: null, sortIndex: null }
                ])
            });
            await page.goto('/e2e/column-state');
            await waitForRows(page);

            await expect(page.locator('.ag-header-cell[col-id="title"][aria-sort="descending"]')).toBeVisible();
        });

        test('applies pre-existing column order from localStorage on page load', async ({ page }) => {
            await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
                key: columnStateStorageKey,
                value: JSON.stringify([
                    { colId: 'severity', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'title', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'riskScore', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'status', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'detectedOn', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'attackType', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'alerts', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'reviewBy', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'comment', hide: false, width: 200, sort: null, sortIndex: null },
                    { colId: 'affectedHosts', hide: false, width: 200, sort: null, sortIndex: null }
                ])
            });
            await page.goto('/e2e/column-state');
            await waitForRows(page);

            // AG Grid uses absolute positioning, so visual order is determined by CSS left, not DOM order.
            // Severity should appear to the left of Title after the saved order is restored.
            await expect
                .poll(async () => {
                    const [severityLeft, titleLeft] = await Promise.all([
                        page
                            .locator('.ag-header-cell[col-id="severity"]')
                            .evaluate((el: Element) => el.getBoundingClientRect().left),
                        page
                            .locator('.ag-header-cell[col-id="title"]')
                            .evaluate((el: Element) => el.getBoundingClientRect().left)
                    ]);

                    return severityLeft < titleLeft;
                })
                .toBe(true);
        });

        test('saves column visibility to localStorage when column is hidden', async ({ page }) => {
            await page.goto('/e2e/column-state');
            await clearColumnState(page);

            await setColumnsVisible(page, ['title'], false);

            await expect
                .poll(async () => {
                    const state = await getColumnState(page);
                    return state?.find((s) => s.colId === 'title')?.hide;
                })
                .toBe(true);
        });

        test('restores column visibility from localStorage on page reload', async ({ page }) => {
            await page.addInitScript(
                ({ key, value }: { key: string; value: string }) => localStorage.setItem(key, value),
                {
                    key: columnStateStorageKey,
                    value: JSON.stringify([
                        { colId: 'title', hide: true, width: 200, sort: null, sortIndex: null },
                        { colId: 'riskScore', hide: false, width: 200, sort: null, sortIndex: null },
                        { colId: 'severity', hide: false, width: 200, sort: null, sortIndex: null },
                        { colId: 'status', hide: false, width: 200, sort: null, sortIndex: null },
                        { colId: 'detectedOn', hide: false, width: 200, sort: null, sortIndex: null },
                        { colId: 'attackType', hide: false, width: 200, sort: null, sortIndex: null },
                        { colId: 'alerts', hide: false, width: 200, sort: null, sortIndex: null },
                        { colId: 'reviewBy', hide: false, width: 200, sort: null, sortIndex: null },
                        { colId: 'comment', hide: false, width: 200, sort: null, sortIndex: null },
                        { colId: 'affectedHosts', hide: false, width: 200, sort: null, sortIndex: null }
                    ])
                }
            );
            await page.goto('/e2e/column-state');
            await waitForRows(page);

            await expect(page.locator('.ag-header-cell[col-id="title"]')).toBeHidden();
        });
    });

    test.describe('KbqAgGridColumnStateQueryParamsStore', () => {
        test('saves sort state to URL when column header is clicked', async ({ page }) => {
            await page.goto('/e2e/column-state-query-params');
            await page.locator('.ag-header-cell[col-id="title"] .ag-header-cell-label').click();

            await expect
                .poll(async () => {
                    const state = await getColumnStateFromUrl(page);
                    return state?.find((s) => s.colId === 'title')?.sort;
                })
                .toBe('asc');
        });

        test('restores sort state from URL on page reload', async ({ page }) => {
            await page.goto('/e2e/column-state-query-params');
            await page.locator('.ag-header-cell[col-id="title"] .ag-header-cell-label').click();

            await expect
                .poll(async () => {
                    const state = await getColumnStateFromUrl(page);
                    return state?.find((s) => s.colId === 'title')?.sort;
                })
                .toBe('asc');

            await page.reload();
            await waitForRows(page);

            await expect(page.locator('.ag-header-cell[col-id="title"][aria-sort="ascending"]')).toBeVisible();
        });

        test('saves column width to URL when column is resized', async ({ page }) => {
            await page.goto('/e2e/column-state-query-params');

            const headerCell = page.locator('.ag-header-cell[col-id="title"]');
            const resizer = headerCell.locator('.ag-header-cell-resize');

            const initialWidth = await headerCell.evaluate((el: Element) => el.getBoundingClientRect().width);
            const bounds = await resizer.boundingBox();

            expect(bounds).not.toBeNull();

            await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
            await page.mouse.down();
            await page.mouse.move(bounds!.x + bounds!.width / 2 + 60, bounds!.y);
            await page.mouse.up();

            await expect
                .poll(async () => {
                    const state = await getColumnStateFromUrl(page);
                    return state?.find((s) => s.colId === 'title')?.width;
                })
                .toBeGreaterThan(initialWidth);
        });

        test('restores column width from URL on page reload', async ({ page }) => {
            await page.goto('/e2e/column-state-query-params');

            const resizer = page.locator('.ag-header-cell[col-id="title"] .ag-header-cell-resize');
            const bounds = await resizer.boundingBox();

            expect(bounds).not.toBeNull();

            await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
            await page.mouse.down();
            await page.mouse.move(bounds!.x + bounds!.width / 2 + 60, bounds!.y);
            await page.mouse.up();

            const widthBeforeReload = await page
                .locator('.ag-header-cell[col-id="title"]')
                .evaluate((el: Element) => Math.round(el.getBoundingClientRect().width));

            // The store persists to the URL asynchronously (router navigation) and isn't awaited
            // by the resize handler — wait for it to land before reloading, or the reload can race
            // ahead of the navigation and pick up the pre-resize width.
            await expect
                .poll(async () => {
                    const state = await getColumnStateFromUrl(page);
                    return state?.find((s) => s.colId === 'title')?.width;
                })
                .toBe(widthBeforeReload);

            await page.reload();
            await waitForRows(page);

            await expect
                .poll(async () =>
                    page
                        .locator('.ag-header-cell[col-id="title"]')
                        .evaluate((el: Element) => Math.round(el.getBoundingClientRect().width))
                )
                .toBe(widthBeforeReload);
        });

        test('applies pre-existing sort state from URL on page load', async ({ page }) => {
            await page.goto(
                buildStateUrl([
                    { colId: 'title', width: 200, sort: 'desc', sortIndex: 0 },
                    { colId: 'riskScore', width: 200 },
                    { colId: 'severity', width: 200 },
                    { colId: 'status', width: 200 },
                    { colId: 'detectedOn', width: 200 },
                    { colId: 'attackType', width: 200 },
                    { colId: 'alerts', width: 200 },
                    { colId: 'reviewBy', width: 200 },
                    { colId: 'comment', width: 200 },
                    { colId: 'affectedHosts', width: 200 }
                ])
            );
            await waitForRows(page);

            await expect(page.locator('.ag-header-cell[col-id="title"][aria-sort="descending"]')).toBeVisible();
        });

        test('applies pre-existing column order from URL on page load', async ({ page }) => {
            await page.goto(
                buildStateUrl([
                    { colId: 'severity', width: 200 },
                    { colId: 'title', width: 200 },
                    { colId: 'riskScore', width: 200 },
                    { colId: 'status', width: 200 },
                    { colId: 'detectedOn', width: 200 },
                    { colId: 'attackType', width: 200 },
                    { colId: 'alerts', width: 200 },
                    { colId: 'reviewBy', width: 200 },
                    { colId: 'comment', width: 200 },
                    { colId: 'affectedHosts', width: 200 }
                ])
            );
            await waitForRows(page);

            // AG Grid uses absolute positioning, so visual order is determined by CSS left, not DOM order.
            // Severity should appear to the left of Title after the saved order is restored.
            await expect
                .poll(async () => {
                    const [severityLeft, titleLeft] = await Promise.all([
                        page
                            .locator('.ag-header-cell[col-id="severity"]')
                            .evaluate((el: Element) => el.getBoundingClientRect().left),
                        page
                            .locator('.ag-header-cell[col-id="title"]')
                            .evaluate((el: Element) => el.getBoundingClientRect().left)
                    ]);

                    return severityLeft < titleLeft;
                })
                .toBe(true);
        });

        test('saves column visibility to URL when column is hidden', async ({ page }) => {
            await page.goto('/e2e/column-state-query-params');

            await setColumnsVisible(page, ['title'], false);

            await expect
                .poll(async () => {
                    const state = await getColumnStateFromUrl(page);
                    return state?.find((s) => s.colId === 'title')?.hide;
                })
                .toBe(true);
        });

        test('restores column visibility from URL on page load', async ({ page }) => {
            await page.goto(
                buildStateUrl([
                    { colId: 'title', hide: true, width: 200 },
                    { colId: 'riskScore', width: 200 },
                    { colId: 'severity', width: 200 },
                    { colId: 'status', width: 200 },
                    { colId: 'detectedOn', width: 200 },
                    { colId: 'attackType', width: 200 },
                    { colId: 'alerts', width: 200 },
                    { colId: 'reviewBy', width: 200 },
                    { colId: 'comment', width: 200 },
                    { colId: 'affectedHosts', width: 200 }
                ])
            );
            await waitForRows(page);

            await expect(page.locator('.ag-header-cell[col-id="title"]')).toBeHidden();
        });
    });
});
