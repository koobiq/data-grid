import { expect, test } from '@playwright/test';
import type { GridApi } from 'ag-grid-community';
import type { DevRowData } from '../row-data';
import { getAgGridApi } from './utils/api';

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

test.describe('Overview dates', () => {
    test.use({ timezoneId: 'Europe/Moscow', permissions: ['clipboard-read', 'clipboard-write'] });

    test('edits and copies calendar dates while preserving the incident ID', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.getByText('Options', { exact: true }).click();
        await page.getByLabel('Editable Cell', { exact: true }).check();
        await page.getByTestId('e2eCopyFormatSelect').selectOption('json');
        await page.getByText('Options', { exact: true }).click();

        const row = page.locator('.ag-center-cols-container .ag-row[row-index="0"]');
        await expect(row).toBeVisible();
        const rowId = await row.getAttribute('row-id');
        const incidentNumber = await row.locator('[col-id="incidentNumber"]').innerText();
        expect(incidentNumber).toMatch(/^INC-\d{8}-\d{4}$/);
        const api = await getAgGridApi(page);

        for (const field of ['detectedOn', 'reviewBy'] as const) {
            await api.evaluate((grid, col) => grid.ensureColumnVisible(col), field);
            const cell = row.locator(`[col-id="${field}"]`);
            await cell.dblclick();
            const editor = cell.locator('input[type="date"]');
            await editor.fill('2026-12-01');
            await editor.press('Enter');
            expect(
                await api.evaluate(
                    (grid: GridApi<DevRowData>, key: 'reviewBy' | 'detectedOn') =>
                        grid.getDisplayedRowAtIndex(0)?.data?.[key],
                    field
                )
            ).toBe('2026-12-01');
            await cell.dblclick();
            await expect(editor).toHaveValue('2026-12-01');
            await editor.press('Escape');
        }

        await api.evaluate((grid) => grid.ensureColumnVisible('incidentNumber'));
        const idCell = row.locator('[col-id="incidentNumber"]');
        await idCell.dblclick();
        await expect(idCell).toHaveText(incidentNumber);
        await expect(row).toHaveAttribute('row-id', rowId!);
        await expect(idCell.locator('input')).toHaveCount(0);

        await api.evaluate((grid) => {
            grid.deselectAll();
            grid.getDisplayedRowAtIndex(0)?.setSelected(true);
        });
        await idCell.click();
        await page.keyboard.press('ControlOrMeta+c');
        const clipboard = async (): Promise<string> => page.evaluate(async () => navigator.clipboard.readText());
        await expect.poll(clipboard).toContain('"detectedOn": "2026-12-01"');
        await expect.poll(clipboard).toContain('"reviewBy": "2026-12-01"');
    });
});

test('overview assigns an operator and returns the incident to the unassigned queue', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByText('Options', { exact: true }).click();
    await page.getByLabel('Editable Cell', { exact: true }).check();
    await page.getByText('Options', { exact: true }).click();

    const row = page.locator('.ag-center-cols-container .ag-row[row-index="0"]');
    const operator = row.locator('[col-id="operator"]');
    await expect(operator).toHaveText('Unassigned');
    const rowId = await row.getAttribute('row-id');
    const api = await getAgGridApi(page);

    for (const name of ['Anna Petrova', 'Unassigned']) {
        await operator.dblclick();
        await operator.locator('.ag-picker-field-wrapper').click();
        await page.getByRole('option', { name, exact: true }).click();
        await expect(operator).toHaveText(name);
    }

    expect(
        await api.evaluate((grid: GridApi<DevRowData>, id) => grid.getRowNode(id!)?.data?.operator, rowId)
    ).toBeNull();
    await api.evaluate((grid) =>
        grid.setFilterModel({ operator: { filterType: 'text', type: 'equals', filter: 'Unassigned' } })
    );
    await expect(operator).toHaveText('Unassigned');
    await expect(page.locator('.ag-row [col-id="operator"]').filter({ hasText: 'Anna Petrova' })).toHaveCount(0);
});

test('overview shows the incident register through the detection date on its first screen', async ({ page }) => {
    await page.route('https://img.shields.io/**', async (route) => route.abort());
    await page.setViewportSize({ width: 1200, height: 500 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const grid = page.getByTestId('e2eScreenshotTarget');
    const row = grid.locator('.ag-center-cols-container .ag-row[row-index="0"]');
    await expect(row.locator('[col-id="title"]')).toHaveText('Phishing link in email');
    await expect(row.locator('[col-id="detectedOn"]')).toBeInViewport({ ratio: 1 });
    await expect(grid).toHaveScreenshot('overview-incidents-light.png');
});

test('overview preserves a resized column when tooltips are toggled', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const api = await getAgGridApi(page);
    await api.evaluate((grid) => grid.setColumnWidths([{ key: 'title', newWidth: 320 }]));
    await page.getByText('Options', { exact: true }).click();
    await page.getByTestId('e2eTooltipToggle').getByRole('checkbox').check();
    await expect.poll(async () => api.evaluate((grid) => grid.getColumnDef('title')?.headerTooltip)).toBe('Title');
    expect(await api.evaluate((grid) => grid.getColumn('title')?.getActualWidth())).toBe(320);
});
