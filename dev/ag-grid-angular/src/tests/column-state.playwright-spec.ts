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

test.describe('KbqAgGridColumnState', () => {
    test.describe('KbqAgGridColumnStateLocalStorageStore', () => {
        test('saves sort state to localStorage when column header is clicked', async ({ page }) => {
            await page.goto('/e2e/column-state');
            await clearColumnState(page);
            await page.locator('.ag-header-cell[col-id="athlete"] .ag-header-cell-label').click();

            const state = await getColumnState(page);
            const athleteState = state?.find((s) => s.colId === 'athlete');

            expect(athleteState?.sort).toBe('asc');
            expect(athleteState?.sortIndex).toBe(0);
        });

        test('restores sort state from localStorage on page reload', async ({ page }) => {
            await page.goto('/e2e/column-state');
            await clearColumnState(page);
            await page.locator('.ag-header-cell[col-id="athlete"] .ag-header-cell-label').click();
            await page.reload();

            await expect(page.locator('.ag-header-cell[col-id="athlete"][aria-sort="ascending"]')).toBeVisible();
        });

        test('saves column width to localStorage when column is resized', async ({ page }) => {
            await page.goto('/e2e/column-state');
            await clearColumnState(page);

            const headerCell = page.locator('.ag-header-cell[col-id="athlete"]');
            const resizer = headerCell.locator('.ag-header-cell-resize');

            const initialWidth = await headerCell.evaluate((el: Element) => el.getBoundingClientRect().width);
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
                .toBeGreaterThan(initialWidth);
        });

        test('restores column width from localStorage on page reload', async ({ page }) => {
            await page.goto('/e2e/column-state');
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
                key: columnStateStorageKey,
                value: JSON.stringify([
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
            await page.goto('/e2e/column-state');

            await expect(page.locator('.ag-header-cell[col-id="athlete"][aria-sort="descending"]')).toBeVisible();
        });

        test('applies pre-existing column order from localStorage on page load', async ({ page }) => {
            await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
                key: columnStateStorageKey,
                value: JSON.stringify([
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
            await page.goto('/e2e/column-state');

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
            await page.goto('/e2e/column-state');
            await clearColumnState(page);

            await setColumnsVisible(page, ['athlete'], false);

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
                    key: columnStateStorageKey,
                    value: JSON.stringify([
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
            await page.goto('/e2e/column-state');

            await expect(page.locator('.ag-header-cell[col-id="athlete"]')).not.toBeVisible();
        });
    });

    test.describe('KbqAgGridColumnStateQueryParamsStore', () => {
        test('saves sort state to URL when column header is clicked', async ({ page }) => {
            await page.goto('/e2e/column-state-query-params');
            await page.locator('.ag-header-cell[col-id="athlete"] .ag-header-cell-label').click();

            await expect
                .poll(async () => {
                    const state = await getColumnStateFromUrl(page);
                    return state?.find((s) => s.colId === 'athlete')?.sort;
                })
                .toBe('asc');
        });

        test('restores sort state from URL on page reload', async ({ page }) => {
            await page.goto('/e2e/column-state-query-params');
            await page.locator('.ag-header-cell[col-id="athlete"] .ag-header-cell-label').click();

            await expect
                .poll(async () => {
                    const state = await getColumnStateFromUrl(page);
                    return state?.find((s) => s.colId === 'athlete')?.sort;
                })
                .toBe('asc');

            await page.reload();

            await expect(page.locator('.ag-header-cell[col-id="athlete"][aria-sort="ascending"]')).toBeVisible();
        });

        test('saves column width to URL when column is resized', async ({ page }) => {
            await page.goto('/e2e/column-state-query-params');

            const headerCell = page.locator('.ag-header-cell[col-id="athlete"]');
            const resizer = headerCell.locator('.ag-header-cell-resize');

            const initialWidth = await headerCell.evaluate((el: Element) => el.getBoundingClientRect().width);
            const bounds = await resizer.boundingBox();

            if (!bounds) throw new Error('resizer not found');

            await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            await page.mouse.down();
            await page.mouse.move(bounds.x + bounds.width / 2 + 60, bounds.y);
            await page.mouse.up();

            await expect
                .poll(async () => {
                    const state = await getColumnStateFromUrl(page);
                    return state?.find((s) => s.colId === 'athlete')?.width;
                })
                .toBeGreaterThan(initialWidth);
        });

        test('restores column width from URL on page reload', async ({ page }) => {
            await page.goto('/e2e/column-state-query-params');

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

        test('applies pre-existing sort state from URL on page load', async ({ page }) => {
            await page.goto(
                buildStateUrl([
                    { colId: 'athlete', width: 200, sort: 'desc', sortIndex: 0 },
                    { colId: 'age', width: 200 },
                    { colId: 'country', width: 200 },
                    { colId: 'year', width: 200 },
                    { colId: 'date', width: 200 },
                    { colId: 'sport', width: 200 },
                    { colId: 'gold', width: 200 },
                    { colId: 'silver', width: 200 },
                    { colId: 'bronze', width: 200 },
                    { colId: 'total', width: 200 }
                ])
            );

            await expect(page.locator('.ag-header-cell[col-id="athlete"][aria-sort="descending"]')).toBeVisible();
        });

        test('applies pre-existing column order from URL on page load', async ({ page }) => {
            await page.goto(
                buildStateUrl([
                    { colId: 'country', width: 200 },
                    { colId: 'athlete', width: 200 },
                    { colId: 'age', width: 200 },
                    { colId: 'year', width: 200 },
                    { colId: 'date', width: 200 },
                    { colId: 'sport', width: 200 },
                    { colId: 'gold', width: 200 },
                    { colId: 'silver', width: 200 },
                    { colId: 'bronze', width: 200 },
                    { colId: 'total', width: 200 }
                ])
            );

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

        test('saves column visibility to URL when column is hidden', async ({ page }) => {
            await page.goto('/e2e/column-state-query-params');

            await setColumnsVisible(page, ['athlete'], false);

            await expect
                .poll(async () => {
                    const state = await getColumnStateFromUrl(page);
                    return state?.find((s) => s.colId === 'athlete')?.hide;
                })
                .toBe(true);
        });

        test('restores column visibility from URL on page load', async ({ page }) => {
            await page.goto(
                buildStateUrl([
                    { colId: 'athlete', hide: true, width: 200 },
                    { colId: 'age', width: 200 },
                    { colId: 'country', width: 200 },
                    { colId: 'year', width: 200 },
                    { colId: 'date', width: 200 },
                    { colId: 'sport', width: 200 },
                    { colId: 'gold', width: 200 },
                    { colId: 'silver', width: 200 },
                    { colId: 'bronze', width: 200 },
                    { colId: 'total', width: 200 }
                ])
            );

            await expect(page.locator('.ag-header-cell[col-id="athlete"]')).not.toBeVisible();
        });
    });
});
