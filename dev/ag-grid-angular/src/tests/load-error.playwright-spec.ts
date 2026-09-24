import { expect, Locator, Page, test } from '@playwright/test';
import { enableDarkTheme } from './utils/theme';

const getScreenshotTarget = (page: Page): Locator => page.getByTestId('e2eScreenshotTarget');
const getBanner = (page: Page): Locator => page.locator('kbq-ag-grid-load-error-row');
const getRetryLink = (page: Page): Locator => page.locator('.kbq-ag-grid-load-error-row__retry');
const getSkeletonCell = (page: Page): Locator => page.locator('.kbq-ag-grid-skeleton-cell-renderer');

const scrollToBottom = async (page: Page): Promise<void> => {
    await getScreenshotTarget(page).evaluate((element: HTMLElement) => {
        element.querySelector('.ag-body-viewport')?.scrollTo(0, 1_000_000);
    });
};

const readNetworkRequests = async (page: Page): Promise<number> => {
    const text = (await page.getByTestId('networkRequests').textContent()) ?? '';

    return Number(text.replace(/\D/g, ''));
};

/** Scrolls page by page until the demo datasource fails on the fourth one. */
const scrollUntilError = async (page: Page): Promise<void> => {
    await page.locator('.ag-row[row-index]').first().waitFor();

    await expect(async () => {
        await scrollToBottom(page);
        await expect(getBanner(page)).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 30_000 });
};

test.describe('KbqAgGridSkeletonSelection', () => {
    test('replaces the selection checkbox with a skeleton while the row has no data', async ({ page }) => {
        await page.goto('/e2e/load-error');

        const skeletonCheckbox = page.locator('kbq-ag-grid-skeleton-selection-cell').first();

        await expect(skeletonCheckbox).toBeVisible();
        await expect(
            skeletonCheckbox
                .locator('xpath=ancestor::div[contains(@class, "ag-cell-wrapper")][1]')
                .locator('.ag-selection-checkbox')
        ).toBeHidden();
    });

    test('restores the real checkbox once the row has loaded', async ({ page }) => {
        await page.goto('/e2e/load-error');

        // The selection column sits in the pinned-left section here, so the cell has to be located
        // by its column id rather than by taking the first `row-index="0"` element in the DOM.
        const selectionCell = page.locator('.ag-row[row-index="0"] .ag-cell[col-id="ag-Grid-SelectionColumn"]');

        await expect(selectionCell.locator('.ag-checkbox-input')).toBeVisible();
        await expect(selectionCell.locator('kbq-ag-grid-skeleton-selection-cell')).toHaveCount(0);
    });
});

test.describe('KbqAgGridLoadError', () => {
    test('shows a skeleton row while the next page is loading', async ({ page }) => {
        await page.goto('/e2e/load-error');
        await page.locator('.ag-row[row-index]').first().waitFor();
        await scrollToBottom(page);

        await expect(getSkeletonCell(page).first()).toBeVisible();
    });

    // Screenshots differ across OS — always update snapshots via Docker: `yarn run e2e:docker:update-snapshots`
    test('shows the error row when a page fails to load', async ({ page }) => {
        test.setTimeout(40_000);
        await page.setViewportSize({ width: 768, height: 500 });
        await page.goto('/e2e/load-error');
        await scrollUntilError(page);

        await expect(getBanner(page)).toContainText('Не удалось загрузить данные');
        await expect(getRetryLink(page)).toHaveText('Повторить');
        await expect(page.getByTestId('lastRowKnown')).toHaveText('lastRowKnown: true');

        await expect(getScreenshotTarget(page)).toHaveScreenshot('load-error-banner-light.png');
        await enableDarkTheme(page);
        await expect(getScreenshotTarget(page)).toHaveScreenshot('load-error-banner-dark.png');
    });

    test('keeps the error row in place while scrolling horizontally', async ({ page }) => {
        test.setTimeout(40_000);
        await page.setViewportSize({ width: 768, height: 500 });
        await page.goto('/e2e/load-error');
        await scrollUntilError(page);

        const before = await getBanner(page).boundingBox();

        await page
            .locator('.ag-center-cols-viewport')
            .evaluate((element: HTMLElement) => element.scrollTo({ left: 300 }));

        const after = await getBanner(page).boundingBox();

        expect(after?.x).toBe(before?.x);
        expect(after?.width).toBe(before?.width);
    });

    test('spans the pinned columns', async ({ page }) => {
        test.setTimeout(40_000);
        await page.setViewportSize({ width: 768, height: 500 });
        await page.goto('/e2e/load-error');
        await scrollUntilError(page);

        const banner = await getBanner(page).boundingBox();
        const pinnedLeft = await page.locator('.ag-pinned-left-cols-container').boundingBox();
        const pinnedRight = await page.locator('.ag-pinned-right-cols-container').boundingBox();

        expect(banner!.x).toBeLessThanOrEqual(pinnedLeft!.x);
        expect(banner!.x + banner!.width).toBeGreaterThanOrEqual(pinnedRight!.x + pinnedRight!.width);
    });

    test('matches the grid row height', async ({ page }) => {
        test.setTimeout(40_000);
        await page.goto('/e2e/load-error');
        await scrollUntilError(page);

        const banner = await getBanner(page).boundingBox();
        const dataRow = await page.locator('.ag-center-cols-container .ag-row').first().boundingBox();

        expect(banner?.height).toBe(dataRow?.height);
    });

    test('re-requests only the failed page on retry', async ({ page }) => {
        test.setTimeout(40_000);
        await page.goto('/e2e/load-error');
        await scrollUntilError(page);

        const requestsBeforeRetry = await readNetworkRequests(page);

        await getRetryLink(page).click();

        await expect(getBanner(page)).toBeHidden();
        await expect(page.getByTestId('lastRowKnown')).toHaveText('lastRowKnown: false');
        // Cached pages are served from memory, so exactly one page reaches the network.
        await expect.poll(async () => readNetworkRequests(page)).toBe(requestsBeforeRetry + 1);
        await expect(page.getByTestId('rowCount')).toHaveText('строк: 201');
    });

    test('does not let the error row be selected', async ({ page }) => {
        test.setTimeout(40_000);
        await page.goto('/e2e/load-error');
        await scrollUntilError(page);

        const bannerRow = page.locator('.ag-row', { has: getBanner(page) });

        await expect(bannerRow.locator('.ag-checkbox-input')).toHaveCount(0);
    });
});
