import { expect, Locator, Page, test } from '@playwright/test';
import { getAgGridApi } from './utils/api';
import { getCell, getRow, toggleRowSelection, waitForRowSelected } from './utils/helpers';
import { enableDarkTheme } from './utils/theme';

const getScreenshotTarget = (page: Page): Locator => page.getByTestId('e2eScreenshotTarget');

// Pinned columns split a row into one `.ag-row` element per container, so every part is returned.
const getRowBackgrounds = async (page: Page, rowIndex: number): Promise<string[]> =>
    getRow(page, rowIndex).evaluateAll((rows) => rows.map((row) => getComputedStyle(row).backgroundColor));

test.describe('KbqAgGridAngularTheme', () => {
    test('does not let the browser skip rendering the grid', async ({ page }) => {
        await page.goto('/e2e/theme');

        await expect(getScreenshotTarget(page).locator('.ag-root-wrapper')).toHaveCSS('content-visibility', 'visible');
    });

    test('places the header border on top of the height of the header rows', async ({ page }) => {
        await page.goto('/e2e/theme');

        const header = getScreenshotTarget(page).locator('.ag-header');

        await header.waitFor();

        const { headerHeight, rowHeight } = await header.evaluate((element) => ({
            headerHeight: element.getBoundingClientRect().height,
            rowHeight: element.querySelector('.ag-header-row')!.getBoundingClientRect().height
        }));

        expect(headerHeight).toBe(rowHeight + 1);
    });

    // Screenshots differ across OS — always update snapshots via Docker: `yarn run e2e:docker:update-snapshots`
    test('default state', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 500 });
        await page.goto('/e2e/theme');
        // Wait for row data to load via HTTP before manipulating grid state.
        await page.locator('.ag-row[row-index]').first().waitFor();
        await (
            await getAgGridApi(page)
        ).evaluate((api) => {
            api.setGridOption('pagination', true);
            api.applyColumnState({
                state: [
                    { colId: 'year', sort: 'asc', sortIndex: 1 },
                    { colId: 'date', sort: 'asc', sortIndex: 2 }
                ]
            });
        });
        await toggleRowSelection(page, 4);
        await toggleRowSelection(page, 5);
        await getCell(page, 0, 'athlete').click();
        await expect(page.locator('.ag-paging-panel')).toBeVisible();
        await expect(getScreenshotTarget(page)).toHaveScreenshot('theme-default-light.png');
        await enableDarkTheme(page);
        await expect(getScreenshotTarget(page)).toHaveScreenshot('theme-default-dark.png');
    });

    // Screenshots differ across OS — always update snapshots via Docker: `yarn run e2e:docker:update-snapshots`
    test('with pinned columns', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 500 });
        await page.goto('/e2e/theme');
        // Wait for row data to load via HTTP before manipulating grid state.
        await page.locator('.ag-row[row-index]').first().waitFor();
        await (
            await getAgGridApi(page)
        ).evaluate((api) => {
            api.setFocusedCell(0, 'athlete');
            api.applyColumnState({
                state: [
                    { colId: 'athlete', pinned: 'left' },
                    { colId: 'total', pinned: 'right' }
                ]
            });
        });
        await toggleRowSelection(page, 3);
        await toggleRowSelection(page, 5);
        await toggleRowSelection(page, 6);
        await page
            .locator('.ag-center-cols-viewport')
            .evaluate((element: HTMLElement) => element.scrollTo({ left: 10 }));
        await expect(getScreenshotTarget(page)).toHaveScreenshot('theme-pinned-columns-light.png');
    });

    // Screenshots differ across OS — always update snapshots via Docker: `yarn run e2e:docker:update-snapshots`
    test('with opened filter popup', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 500 });
        await page.goto('/e2e/theme');
        // Wait for async row data and the generated selection column before capturing the grid.
        await page.locator('.ag-row[row-index]').first().waitFor();
        await page.locator('.ag-header-cell input[type="checkbox"]').first().waitFor();
        await page.locator('.ag-header-cell[col-id="athlete"]').hover();
        await page.locator('.ag-header-cell[col-id="athlete"] .ag-header-cell-filter-button').click();
        await page.locator('.ag-menu .ag-filter-select').click();
        await page.getByRole('option', { name: 'Contains', exact: true }).waitFor();
        // Navigate to "Equals" by keyboard (rather than hover) to deterministically capture
        // the select item's highlighted state regardless of pointer/layout timing.
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await expect(page.getByRole('option', { name: 'Equals', exact: true })).toHaveClass(/ag-active-item/);
        await expect(getScreenshotTarget(page)).toHaveScreenshot('theme-filter-popup-light.png');
        await enableDarkTheme(page);
        await expect(getScreenshotTarget(page)).toHaveScreenshot('theme-filter-popup-dark.png');
    });

    test('keeps the columns in place while the grid loads', async ({ page }) => {
        // Sampled from the first frame: a position read after the page has loaded says nothing about how it got there.
        await page.addInitScript(() => {
            const lefts = new Set<string>();
            const sample = (): void => {
                const header = document.querySelector('.ag-header-cell[col-id="athlete"]');

                if (header) {
                    lefts.add(getComputedStyle(header).left);
                    document.documentElement.dataset.devHeaderLefts = [...lefts].join();
                }

                requestAnimationFrame(sample);
            };

            requestAnimationFrame(sample);
        });
        await page.goto('/e2e/theme');
        await page.locator('.ag-row[row-index]').first().waitFor();

        await expect(page.locator('html')).toHaveAttribute('data-dev-header-lefts', '36px');
    });

    test('shades the columns hidden behind the pinned ones before the grid is scrolled', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 500 });
        await page.goto('/e2e/theme-pinned-columns');
        // Wait for row data to load via HTTP before measuring the grid.
        await page.locator('.ag-row[row-index]').first().waitFor();
        const grid = getScreenshotTarget(page);

        await expect(grid).toHaveClass(/ag-theme-koobiq_pinned-right-cols-overflow/);
        await expect(grid).not.toHaveClass(/ag-theme-koobiq_pinned-left-cols-overflow/);

        await page
            .locator('.ag-center-cols-viewport')
            .evaluate((element: HTMLElement) => element.scrollTo({ left: element.scrollWidth }));

        await expect(grid).toHaveClass(/ag-theme-koobiq_pinned-left-cols-overflow/);
        await expect(grid).not.toHaveClass(/ag-theme-koobiq_pinned-right-cols-overflow/);
    });

    // Screenshots differ across OS — always update snapshots via Docker: `yarn run e2e:docker:update-snapshots`
    test('paints a row across the space left by columns narrower than the grid', async ({ page }) => {
        await page.goto('/e2e/theme-narrow-columns');
        // Wait for row data to load via HTTP before measuring the grid.
        await page.locator('.ag-row[row-index]').first().waitFor();
        await toggleRowSelection(page, 1);
        await waitForRowSelected(page, 1);

        const measured = await page
            .locator('.ag-center-cols-container .ag-row[row-index="1"]')
            .evaluate((row: HTMLElement) => {
                const viewport = row.closest<HTMLElement>('.ag-center-cols-viewport')!;
                const cells = Array.from(row.querySelectorAll('.ag-cell'));

                return {
                    row: Math.round(row.getBoundingClientRect().width),
                    viewport: viewport.clientWidth,
                    cells: Math.round(cells.reduce((width, cell) => width + cell.getBoundingClientRect().width, 0))
                };
            });

        // Without empty space left by the columns the assertion below would hold on its own.
        expect(measured.cells).toBeLessThan(measured.viewport);
        expect(measured.row).toBe(measured.viewport);

        await expect(getScreenshotTarget(page)).toHaveScreenshot('theme-narrow-columns-light.png');
    });

    test('keeps the active background across the row parts split by a pinned column', async ({ page }) => {
        await page.goto('/e2e/theme-narrow-columns');
        // Wait for row data to load via HTTP before interacting with the grid.
        await page.locator('.ag-row[row-index]').first().waitFor();
        await expect(getRow(page, 2)).toHaveCount(2);

        // Hovers the target, then returns the backgrounds of every row part before and while it is pressed.
        const press = async (
            target: Locator,
            position?: { x: number; y: number }
        ): Promise<{ hover: string[]; active: string[] }> => {
            await target.hover({ position });
            const hover = await getRowBackgrounds(page, 2);

            await page.mouse.down();
            const active = await getRowBackgrounds(page, 2);

            await page.mouse.up();

            return { hover, active };
        };

        // The space left by the narrow columns: pressing it keeps the focus out of the row.
        const centerPart = getRow(page, 2).first();
        const emptySpace = { x: (await centerPart.evaluate((row) => row.clientWidth)) - 40, y: 10 };

        const plain = await press(centerPart, emptySpace);

        expect(plain.active).toEqual([plain.active[0], plain.active[0]]);
        expect(plain.active[0]).not.toBe(plain.hover[0]);

        await (await getAgGridApi(page)).evaluate((api) => api.getDisplayedRowAtIndex(2)?.setSelected(true));
        await waitForRowSelected(page, 2);

        const selected = await press(centerPart, emptySpace);

        expect(selected.active).toEqual([selected.active[0], selected.active[0]]);
        expect(selected.active[0]).not.toBe(selected.hover[0]);
        expect(selected.active[0]).not.toBe(plain.active[0]);

        // Pressing a cell moves the focus into the row, and the pinned part is the pressed one this time.
        const focused = await press(getCell(page, 2, 'total'));

        expect(focused.active).toEqual([focused.active[0], focused.active[0]]);
        expect(focused.active[0]).not.toBe(selected.active[0]);
    });

    test('drops the shadows of the pinned columns once every column fits the resized grid', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 500 });
        await page.goto('/e2e/theme-pinned-columns');
        // Wait for row data to load via HTTP before measuring the grid.
        await page.locator('.ag-row[row-index]').first().waitFor();
        const grid = getScreenshotTarget(page);

        await expect(grid).toHaveClass(/ag-theme-koobiq_pinned-right-cols-overflow/);

        await page.setViewportSize({ width: 2400, height: 500 });

        await expect(grid).not.toHaveClass(/ag-theme-koobiq_pinned-(left|right)-cols-overflow/);

        await page.setViewportSize({ width: 768, height: 500 });

        await expect(grid).toHaveClass(/ag-theme-koobiq_pinned-right-cols-overflow/);
    });

    test('highlights the focused row only while focus is inside it', async ({ page }) => {
        await page.goto('/e2e/theme');
        // Wait for row data to load via HTTP before manipulating grid state.
        await page.locator('.ag-row[row-index]').first().waitFor();
        await (
            await getAgGridApi(page)
        ).evaluate((api) => {
            api.applyColumnState({ state: [{ colId: 'athlete', pinned: 'left' }] });
            api.setFocusedCell(1, 'country');
        });
        await expect(getRow(page, 1)).toHaveCount(2);
        const [unfocusedBackground] = await getRowBackgrounds(page, 2);
        const focusedBackgrounds = await getRowBackgrounds(page, 1);

        expect(focusedBackgrounds).toEqual([focusedBackgrounds[0], focusedBackgrounds[0]]);
        expect(focusedBackgrounds[0]).not.toBe(unfocusedBackground);

        await getCell(page, 1, 'country').blur();

        expect(await getRowBackgrounds(page, 1)).toEqual([unfocusedBackground, unfocusedBackground]);
    });

    test('keeps the selection background after focus leaves a selected row', async ({ page }) => {
        await page.goto('/e2e/theme');
        // Wait for row data to load via HTTP before manipulating grid state.
        await page.locator('.ag-row[row-index]').first().waitFor();
        await (
            await getAgGridApi(page)
        ).evaluate((api) => {
            api.getDisplayedRowAtIndex(1)?.setSelected(true);
            api.getDisplayedRowAtIndex(3)?.setSelected(true);
            api.setFocusedCell(1, 'athlete');
        });
        const selectedBackgrounds = await getRowBackgrounds(page, 3);

        expect(await getRowBackgrounds(page, 1)).not.toEqual(selectedBackgrounds);

        await getCell(page, 1, 'athlete').blur();

        expect(await getRowBackgrounds(page, 1)).toEqual(selectedBackgrounds);
    });
});
