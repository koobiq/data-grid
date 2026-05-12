import { expect, Locator, Page, test } from '@playwright/test';
import { getAgGridApi } from './utils/api';

const quickFilterStateStorageKey = 'dev-ag-grid-quick-filter-state';
const quickFilterStateQueryParamKey = 'dev-ag-grid-quick-filter-state';

const getQuickFilterInput = (page: Page): Locator => page.getByTestId('e2eQuickFilterInput');
const getResetButton = (page: Page): Locator => page.getByTestId('e2eResetQuickFilterState');

const getStoredQuickFilterState = async (page: Page): Promise<string | null> =>
    page.evaluate((key) => localStorage.getItem(key), quickFilterStateStorageKey);

const clearStoredQuickFilterState = async (page: Page): Promise<void> => {
    await page.evaluate((key: string) => localStorage.removeItem(key), quickFilterStateStorageKey);
};

const getActiveQuickFilter = async (page: Page): Promise<string> =>
    (await getAgGridApi(page)).evaluate((api) => api.getQuickFilter() ?? '');

const getDisplayedRowCount = async (page: Page): Promise<number> =>
    (await getAgGridApi(page)).evaluate((api) => api.getDisplayedRowCount());

const getQuickFilterStateFromUrl = async (page: Page): Promise<string | null> =>
    page.evaluate((key) => new URLSearchParams(window.location.search).get(key), quickFilterStateQueryParamKey);

const buildQuickFilterUrl = (value: string): string => {
    const encoded = encodeURIComponent(value);
    return `/e2e/quick-filter-state-query-params?${quickFilterStateQueryParamKey}=${encoded}`;
};

test.describe('KbqAgGridQuickFilterState', () => {
    test.describe('KbqAgGridQuickFilterStateLocalStorageStore', () => {
        test('saves quick filter text to localStorage when text is typed', async ({ page }) => {
            await page.goto('/e2e/quick-filter-state');
            await clearStoredQuickFilterState(page);

            await getQuickFilterInput(page).fill('Michael');

            await expect.poll(async () => getStoredQuickFilterState(page)).toBe('Michael');
        });

        test('restores quick filter text from localStorage on page load', async ({ page }) => {
            await page.addInitScript(
                ({ key, value }: { key: string; value: string }) => localStorage.setItem(key, value),
                { key: quickFilterStateStorageKey, value: 'Michael' }
            );
            await page.goto('/e2e/quick-filter-state');

            expect(await getActiveQuickFilter(page)).toBe('Michael');
        });

        test('syncs input value with restored quick filter on page load', async ({ page }) => {
            await page.addInitScript(
                ({ key, value }: { key: string; value: string }) => localStorage.setItem(key, value),
                { key: quickFilterStateStorageKey, value: 'Michael' }
            );
            await page.goto('/e2e/quick-filter-state');

            await expect(getQuickFilterInput(page)).toHaveValue('Michael');
        });

        test('filters rows when quick filter is restored from localStorage', async ({ page }) => {
            await page.addInitScript(
                ({ key, value }: { key: string; value: string }) => localStorage.setItem(key, value),
                { key: quickFilterStateStorageKey, value: 'Michael' }
            );
            await page.goto('/e2e/quick-filter-state');

            await expect.poll(async () => getDisplayedRowCount(page)).toBeGreaterThan(0);
            await expect(page.locator('.ag-row')).not.toHaveCount(0);
            await expect(page.locator('.ag-overlay-no-rows-center')).not.toBeVisible();
        });

        test('removes quick filter state from localStorage when text is cleared', async ({ page }) => {
            await page.goto('/e2e/quick-filter-state');
            await clearStoredQuickFilterState(page);

            await getQuickFilterInput(page).fill('Michael');
            await expect.poll(async () => getStoredQuickFilterState(page)).toBe('Michael');

            await getQuickFilterInput(page).fill('');

            await expect.poll(async () => getStoredQuickFilterState(page)).toBeNull();
        });

        test('reset() clears quick filter and removes state from localStorage', async ({ page }) => {
            await page.goto('/e2e/quick-filter-state');
            await clearStoredQuickFilterState(page);

            await getQuickFilterInput(page).fill('Michael');
            await expect.poll(async () => getStoredQuickFilterState(page)).toBe('Michael');

            await getResetButton(page).click();

            expect(await getStoredQuickFilterState(page)).toBeNull();
            expect(await getActiveQuickFilter(page)).toBe('');
            await expect(getQuickFilterInput(page)).toHaveValue('');
        });
    });

    test.describe('KbqAgGridQuickFilterStateQueryParamsStore', () => {
        test('saves quick filter text to URL when text is typed', async ({ page }) => {
            await page.goto('/e2e/quick-filter-state-query-params');

            await getQuickFilterInput(page).fill('Michael');

            await expect.poll(async () => getQuickFilterStateFromUrl(page)).toBe('Michael');
        });

        test('restores quick filter text from URL on page load', async ({ page }) => {
            await page.goto(buildQuickFilterUrl('Michael'));

            expect(await getActiveQuickFilter(page)).toBe('Michael');
        });

        test('syncs input value with restored quick filter from URL on page load', async ({ page }) => {
            await page.goto(buildQuickFilterUrl('Michael'));

            await expect(getQuickFilterInput(page)).toHaveValue('Michael');
        });

        test('filters rows when quick filter is restored from URL', async ({ page }) => {
            await page.goto(buildQuickFilterUrl('Michael'));

            const rowCount = await getDisplayedRowCount(page);

            expect(rowCount).toBeGreaterThan(0);
            await expect(page.locator('.ag-row')).not.toHaveCount(0);
            await expect(page.locator('.ag-overlay-no-rows-center')).not.toBeVisible();
        });

        test('removes quick filter state from URL when text is cleared', async ({ page }) => {
            await page.goto('/e2e/quick-filter-state-query-params');

            await getQuickFilterInput(page).fill('Michael');
            await expect.poll(async () => getQuickFilterStateFromUrl(page)).toBe('Michael');

            await getQuickFilterInput(page).fill('');

            await expect.poll(async () => getQuickFilterStateFromUrl(page)).toBeNull();
        });

        test('reset() clears quick filter and removes state from URL', async ({ page }) => {
            await page.goto('/e2e/quick-filter-state-query-params');

            await getQuickFilterInput(page).fill('Michael');
            await expect.poll(async () => getQuickFilterStateFromUrl(page)).toBe('Michael');

            await getResetButton(page).click();

            await expect.poll(async () => getQuickFilterStateFromUrl(page)).toBeNull();
            expect(await getActiveQuickFilter(page)).toBe('');
            await expect(getQuickFilterInput(page)).toHaveValue('');
        });
    });
});
