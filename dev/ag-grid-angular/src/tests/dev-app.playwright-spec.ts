import { expect, test } from '@playwright/test';

test.describe('Dev app', () => {
    // A third-party request holds up the load event every navigation waits for, and its answer can change the page.
    // Covers `index.html` and the app shell shared by every e2e page, not what the dev component of each route loads.
    test('loads nothing from outside the dev server on an e2e page', async ({ page, baseURL }) => {
        const { origin } = new URL(baseURL!);
        const external: string[] = [];

        page.on('request', (request) => {
            const url = new URL(request.url());

            if (url.protocol.startsWith('http') && url.origin !== origin) external.push(url.href);
        });

        await page.goto('/e2e/theme');
        await page.locator('.ag-row[row-index]').first().waitFor();

        expect(external).toEqual([]);
    });
});
