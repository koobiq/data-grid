import { expect, Page, test } from '@playwright/test';
import { FilterModel } from 'ag-grid-community';

const filterStateStorageKey = 'dev-ag-grid-filter-state';
const filterStateQueryParamKey = 'dev-ag-grid-filter-state';

const floatingFilterInput = (colId: string): string =>
    `.ag-header-cell[col-id="${colId}"] .ag-floating-filter-input input`;

const clearFilterState = async (page: Page): Promise<void> => {
    await page.evaluate((key: string) => localStorage.removeItem(key), filterStateStorageKey);
};

const getFilterStateFromLocalStorage = async (page: Page): Promise<FilterModel | null> => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return page.evaluate((key) => {
        const stored = localStorage.getItem(key);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return stored ? JSON.parse(stored) : null;
    }, filterStateStorageKey);
};

const getFilterStateFromUrl = async (page: Page): Promise<FilterModel | null> => {
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
    }, filterStateQueryParamKey);
};

const buildFilterUrl = (model: object): string => {
    const encoded = encodeURIComponent(JSON.stringify(model));
    return `/e2e/filter-state-query-params?${filterStateQueryParamKey}=${encoded}`;
};

const expectFilterValue = async ({
    page,
    getter,
    colId,
    value
}: {
    page: Page;
    getter: (page: Page) => Promise<FilterModel | null>;
    colId: string;
    value: string;
}): Promise<void> => {
    await expect
        .poll(async () => {
            const model = await getter(page);
            const colFilter: unknown = model?.[colId];

            if (typeof colFilter === 'object' && colFilter !== null && 'filter' in colFilter) {
                return colFilter.filter;
            }

            return undefined;
        })
        .toBe(value);
};

test.describe('KbqAgGridFilterState', () => {
    test.describe('KbqAgGridFilterStateLocalStorageStore', () => {
        test('saves filter state to localStorage when filter is applied', async ({ page }) => {
            await page.goto('/e2e/filter-state');
            await clearFilterState(page);

            await page.locator(floatingFilterInput('athlete')).fill('Michael');

            await expectFilterValue({
                page,
                getter: getFilterStateFromLocalStorage,
                colId: 'athlete',
                value: 'Michael'
            });
        });

        test('restores filter state from localStorage on page reload', async ({ page }) => {
            await page.goto('/e2e/filter-state');
            await clearFilterState(page);

            await page.locator(floatingFilterInput('athlete')).fill('Michael');

            await expectFilterValue({
                page,
                getter: getFilterStateFromLocalStorage,
                colId: 'athlete',
                value: 'Michael'
            });

            await page.reload();

            await expect(page.locator(floatingFilterInput('athlete'))).toHaveValue('Michael');
        });

        test('removes filter state from localStorage when filter is cleared', async ({ page }) => {
            await page.goto('/e2e/filter-state');
            await clearFilterState(page);

            await page.locator(floatingFilterInput('athlete')).fill('Michael');

            await expect.poll(async () => getFilterStateFromLocalStorage(page)).not.toBeNull();

            await page.locator(floatingFilterInput('athlete')).clear();

            await expect.poll(async () => getFilterStateFromLocalStorage(page)).toBeNull();
        });

        test('applies pre-existing filter state from localStorage on page load', async ({ page }) => {
            await page.addInitScript(
                ({ key, value }: { key: string; value: string }) => localStorage.setItem(key, value),
                {
                    key: filterStateStorageKey,
                    value: JSON.stringify({
                        athlete: { filterType: 'text', type: 'contains', filter: 'Phelps' }
                    })
                }
            );
            await page.goto('/e2e/filter-state');

            await expect(page.locator(floatingFilterInput('athlete'))).toHaveValue('Phelps');
        });
    });

    test.describe('KbqAgGridFilterStateQueryParamsStore', () => {
        test('saves filter state to URL when filter is applied', async ({ page }) => {
            await page.goto('/e2e/filter-state-query-params');

            await page.locator(floatingFilterInput('athlete')).fill('Michael');

            await expectFilterValue({
                page,
                getter: getFilterStateFromUrl,
                colId: 'athlete',
                value: 'Michael'
            });
        });

        test('restores filter state from URL on page reload', async ({ page }) => {
            await page.goto('/e2e/filter-state-query-params');

            await page.locator(floatingFilterInput('athlete')).fill('Michael');

            await expectFilterValue({
                page,
                getter: getFilterStateFromUrl,
                colId: 'athlete',
                value: 'Michael'
            });

            await page.reload();

            await expect(page.locator(floatingFilterInput('athlete'))).toHaveValue('Michael');
        });

        test('removes filter state from URL when filter is cleared', async ({ page }) => {
            await page.goto('/e2e/filter-state-query-params');

            await page.locator(floatingFilterInput('athlete')).fill('Michael');

            await expect.poll(async () => getFilterStateFromUrl(page)).not.toBeNull();

            await page.locator(floatingFilterInput('athlete')).clear();

            await expect.poll(async () => getFilterStateFromUrl(page)).toBeNull();
        });

        test('applies pre-existing filter state from URL on page load', async ({ page }) => {
            await page.goto(
                buildFilterUrl({
                    athlete: { filterType: 'text', type: 'contains', filter: 'Phelps' }
                })
            );

            await expect(page.locator(floatingFilterInput('athlete'))).toHaveValue('Phelps');
        });
    });
});
