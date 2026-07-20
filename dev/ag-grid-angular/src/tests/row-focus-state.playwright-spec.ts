import { expect, Page, test } from '@playwright/test';
import { getCell, isCellFocused } from './utils/helpers';

const rowFocusStateStorageKey = 'dev-ag-grid-row-focus-state';
const rowFocusStateQueryParamKey = 'dev-ag-grid-row-focus-state';

type StoredRowFocusState = { rowId: string; colId: string };

const clearRowFocusState = async (page: Page): Promise<void> => {
    await page.evaluate((key: string) => localStorage.removeItem(key), rowFocusStateStorageKey);
};

const getRowFocusState = async (page: Page): Promise<StoredRowFocusState | null> => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return page.evaluate((key) => {
        const stored = localStorage.getItem(key);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return stored ? JSON.parse(stored) : null;
    }, rowFocusStateStorageKey);
};

const getRowFocusStateFromUrl = async (page: Page): Promise<StoredRowFocusState | null> => {
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
    }, rowFocusStateQueryParamKey);
};

const buildStateUrl = (state: StoredRowFocusState): string => {
    const encoded = encodeURIComponent(JSON.stringify(state));
    return `/e2e/row-focus-state-query-params?${rowFocusStateQueryParamKey}=${encoded}`;
};

test.describe('KbqAgGridRowFocusState', () => {
    test.describe('KbqAgGridRowFocusStateLocalStorageStore', () => {
        test('saves the active cell to localStorage when a cell is clicked', async ({ page }) => {
            await page.goto('/e2e/row-focus-state');
            await clearRowFocusState(page);

            await getCell(page, 0, 'athlete').click();

            await expect.poll(async () => (await getRowFocusState(page))?.colId).toBe('athlete');
        });

        test('restores the active cell from localStorage on page reload', async ({ page }) => {
            await page.goto('/e2e/row-focus-state');
            await clearRowFocusState(page);

            await getCell(page, 2, 'country').click();
            await expect.poll(async () => (await getRowFocusState(page))?.colId).toBe('country');

            await page.reload();

            await expect.poll(async () => isCellFocused(page, 2, 'country')).toBe(true);
        });

        test('reset clears the active cell and stored state', async ({ page }) => {
            await page.goto('/e2e/row-focus-state');
            await clearRowFocusState(page);

            await getCell(page, 0, 'athlete').click();
            await expect.poll(async () => isCellFocused(page, 0, 'athlete')).toBe(true);

            await page.getByRole('button', { name: 'Reset state' }).click();

            await expect.poll(async () => isCellFocused(page, 0, 'athlete')).toBe(false);
            await expect.poll(async () => getRowFocusState(page)).toBeNull();
        });
    });

    test.describe('KbqAgGridRowFocusStateQueryParamsStore', () => {
        test('saves the active cell to URL when a cell is clicked', async ({ page }) => {
            await page.goto('/e2e/row-focus-state-query-params');

            await getCell(page, 0, 'athlete').click();

            await expect.poll(async () => (await getRowFocusStateFromUrl(page))?.colId).toBe('athlete');
        });

        test('restores the active cell from URL on page reload', async ({ page }) => {
            await page.goto('/e2e/row-focus-state-query-params');

            await getCell(page, 2, 'country').click();
            await expect.poll(async () => (await getRowFocusStateFromUrl(page))?.colId).toBe('country');

            await page.reload();

            await expect.poll(async () => isCellFocused(page, 2, 'country')).toBe(true);
        });

        test('applies pre-existing active cell from URL on page load', async ({ page }) => {
            await page.goto(buildStateUrl({ rowId: '4f32fc42-54ea-4afe-bcb3-d3e15fff11a5', colId: 'athlete' }));

            await expect.poll(async () => isCellFocused(page, 0, 'athlete')).toBe(true);
        });
    });
});
