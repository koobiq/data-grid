import { expect, Locator, Page, test } from '@playwright/test';
import { getAgGridApi } from './utils/api';

const externalFilterStateStorageKey = 'dev-ag-grid-external-filter-state';
const OPTION = 'Swimming';

const getSportSelect = (page: Page): Locator => page.getByTestId('e2eSportSelect');
const getResetButton = (page: Page): Locator => page.getByTestId('e2eResetExternalFilterState');

const getStoredExternalFilterState = async (page: Page): Promise<string | null> =>
    page.evaluate((key) => localStorage.getItem(key), externalFilterStateStorageKey);

const clearStoredExternalFilterState = async (page: Page): Promise<void> => {
    await page.evaluate((key: string) => localStorage.removeItem(key), externalFilterStateStorageKey);
};

const getDisplayedRowCount = async (page: Page): Promise<number> =>
    (await getAgGridApi(page)).evaluate((api) => api.getDisplayedRowCount());

const getExternalFilterStateFromUrl = async (page: Page): Promise<string | null> =>
    page.evaluate((key) => {
        const item = new URLSearchParams(window.location.search).get(key);

        if (!item) return null;

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            return JSON.parse(item) as string;
        } catch {
            return null;
        }
    }, externalFilterStateStorageKey);

const buildExternalFilterUrl = (value: string): string => {
    const encoded = encodeURIComponent(JSON.stringify(value));
    return `/e2e/external-filter-state-query-params?${externalFilterStateStorageKey}=${encoded}`;
};

test.describe('KbqAgGridExternalFilterState', () => {
    test.describe('KbqAgGridExternalFilterStateLocalStorageStore', () => {
        test('saves external filter value to localStorage when filter is set', async ({ page }) => {
            await page.goto('/e2e/external-filter-state');
            await clearStoredExternalFilterState(page);

            await getSportSelect(page).selectOption(OPTION);

            await expect
                .poll(async () => {
                    const raw = await getStoredExternalFilterState(page);

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
                    return raw ? (JSON.parse(raw) as string) : null;
                })
                .toBe(OPTION);
        });

        test('restores external filter from localStorage on page load', async ({ page }) => {
            await page.addInitScript(
                ({ key, value }: { key: string; value: string }) => localStorage.setItem(key, value),
                { key: externalFilterStateStorageKey, value: JSON.stringify(OPTION) }
            );
            await page.goto('/e2e/external-filter-state');

            await expect(getSportSelect(page)).toHaveValue(OPTION, { timeout: 10_000 });
        });

        test('filters rows when external filter is restored from localStorage', async ({ page }) => {
            await page.addInitScript(
                ({ key, value }: { key: string; value: string }) => localStorage.setItem(key, value),
                { key: externalFilterStateStorageKey, value: JSON.stringify(OPTION) }
            );
            await page.goto('/e2e/external-filter-state');

            await expect.poll(async () => getDisplayedRowCount(page), { timeout: 10_000 }).toBeGreaterThan(0);
            await expect(page.locator('.ag-overlay-no-rows-center')).not.toBeVisible();
        });

        test('removes external filter state from localStorage when filter is cleared', async ({ page }) => {
            await page.goto('/e2e/external-filter-state');
            await clearStoredExternalFilterState(page);

            await getSportSelect(page).selectOption(OPTION);
            await expect.poll(async () => getStoredExternalFilterState(page)).not.toBeNull();

            await getSportSelect(page).selectOption('');

            await expect.poll(async () => getStoredExternalFilterState(page)).toBeNull();
        });

        test('reset() clears external filter and removes state from localStorage', async ({ page }) => {
            await page.goto('/e2e/external-filter-state');
            await clearStoredExternalFilterState(page);

            await getSportSelect(page).selectOption(OPTION);
            await expect.poll(async () => getStoredExternalFilterState(page)).not.toBeNull();

            await getResetButton(page).click();

            expect(await getStoredExternalFilterState(page)).toBeNull();
            await expect(getSportSelect(page)).toHaveValue('');
        });
    });

    test.describe('KbqAgGridExternalFilterStateQueryParamsStore', () => {
        test('saves external filter value to URL when filter is set', async ({ page }) => {
            await page.goto('/e2e/external-filter-state-query-params');

            await getSportSelect(page).selectOption(OPTION);

            await expect.poll(async () => getExternalFilterStateFromUrl(page)).toBe(OPTION);
        });

        test('restores external filter from URL on page load', async ({ page }) => {
            await page.goto(buildExternalFilterUrl(OPTION));

            await expect(getSportSelect(page)).toHaveValue(OPTION, { timeout: 10_000 });
        });

        test('filters rows when external filter is restored from URL', async ({ page }) => {
            await page.goto(buildExternalFilterUrl(OPTION));

            await expect.poll(async () => getDisplayedRowCount(page), { timeout: 10_000 }).toBeGreaterThan(0);
            await expect(page.locator('.ag-overlay-no-rows-center')).not.toBeVisible();
        });

        test('removes external filter state from URL when filter is cleared', async ({ page }) => {
            await page.goto('/e2e/external-filter-state-query-params');

            await getSportSelect(page).selectOption(OPTION);
            await expect.poll(async () => getExternalFilterStateFromUrl(page)).toBe(OPTION);

            await getSportSelect(page).selectOption('');

            await expect.poll(async () => getExternalFilterStateFromUrl(page)).toBeNull();
        });

        test('reset() clears external filter and removes state from URL', async ({ page }) => {
            await page.goto('/e2e/external-filter-state-query-params');

            await getSportSelect(page).selectOption(OPTION);
            await expect.poll(async () => getExternalFilterStateFromUrl(page)).toBe(OPTION);

            await getResetButton(page).click();

            await expect.poll(async () => getExternalFilterStateFromUrl(page)).toBeNull();
            await expect(getSportSelect(page)).toHaveValue('');
        });
    });
});
