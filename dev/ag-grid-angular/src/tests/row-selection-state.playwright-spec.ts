import { expect, Page, test } from '@playwright/test';
import { isRowSelected, toggleRowSelection, waitForRowSelected } from './utils/helpers';

const rowSelectionStateStorageKey = 'dev-ag-grid-row-selection-state';
const rowSelectionStateQueryParamKey = 'dev-ag-grid-row-selection-state';

const clearRowSelectionState = async (page: Page): Promise<void> => {
    await page.evaluate((key: string) => localStorage.removeItem(key), rowSelectionStateStorageKey);
};

const getRowSelectionState = async (page: Page): Promise<string[] | null> => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return page.evaluate((key) => {
        const stored = localStorage.getItem(key);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return stored ? JSON.parse(stored) : null;
    }, rowSelectionStateStorageKey);
};

const getRowSelectionStateFromUrl = async (page: Page): Promise<string[] | null> => {
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
    }, rowSelectionStateQueryParamKey);
};

const buildStateUrl = (ids: string[]): string => {
    const encoded = encodeURIComponent(JSON.stringify(ids));
    return `/e2e/row-selection-state-query-params?${rowSelectionStateQueryParamKey}=${encoded}`;
};

test.describe('KbqAgGridRowSelectionState', () => {
    test.describe('KbqAgGridRowSelectionStateLocalStorageStore', () => {
        test('saves selection to localStorage when a row is selected', async ({ page }) => {
            await page.goto('/e2e/row-selection-state');
            await clearRowSelectionState(page);

            await toggleRowSelection(page, 0);

            await expect.poll(async () => getRowSelectionState(page)).not.toBeNull();
        });

        test('restores selection from localStorage on page reload', async ({ page }) => {
            await page.goto('/e2e/row-selection-state');
            await clearRowSelectionState(page);

            await toggleRowSelection(page, 2);
            await expect.poll(async () => getRowSelectionState(page)).not.toBeNull();

            await page.reload();

            await waitForRowSelected(page, 2);
        });

        test('removes stored selection when the row is deselected', async ({ page }) => {
            await page.goto('/e2e/row-selection-state');
            await clearRowSelectionState(page);

            await toggleRowSelection(page, 0);
            await expect.poll(async () => getRowSelectionState(page)).not.toBeNull();

            await toggleRowSelection(page, 0);

            await expect.poll(async () => getRowSelectionState(page)).toBeNull();
        });

        test('reset clears selection and stored state', async ({ page }) => {
            await page.goto('/e2e/row-selection-state');
            await clearRowSelectionState(page);

            await toggleRowSelection(page, 0);
            await expect.poll(async () => isRowSelected(page, 0)).toBe(true);

            await page.getByRole('button', { name: 'Reset state' }).click();

            await expect.poll(async () => isRowSelected(page, 0)).toBe(false);
            await expect.poll(async () => getRowSelectionState(page)).toBeNull();
        });
    });

    test.describe('KbqAgGridRowSelectionStateQueryParamsStore', () => {
        test('saves selection to URL when a row is selected', async ({ page }) => {
            await page.goto('/e2e/row-selection-state-query-params');

            await toggleRowSelection(page, 0);

            await expect.poll(async () => getRowSelectionStateFromUrl(page)).not.toBeNull();
        });

        test('restores selection from URL on page reload', async ({ page }) => {
            await page.goto('/e2e/row-selection-state-query-params');

            await toggleRowSelection(page, 2);
            await expect.poll(async () => getRowSelectionStateFromUrl(page)).not.toBeNull();

            await page.reload();

            await waitForRowSelected(page, 2);
        });

        test('applies pre-existing selection from URL on page load', async ({ page }) => {
            await page.goto(buildStateUrl(['4f32fc42-54ea-4afe-bcb3-d3e15fff11a5']));

            await waitForRowSelected(page, 0);
        });
    });
});
