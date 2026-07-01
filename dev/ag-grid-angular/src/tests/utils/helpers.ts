// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable @typescript-eslint/naming-convention */

import { expect, Locator, Page } from '@playwright/test';

export const getRow = (page: Page, rowIndex: number): Locator => page.locator(`.ag-row[row-index="${rowIndex}"]`);

export const getCell = (page: Page, rowIndex: number, colField: string): Locator =>
    getRow(page, rowIndex).locator(`.ag-cell[col-id="${colField}"]`);

export const isRowSelected = async (page: Page, rowIndex: number): Promise<boolean> =>
    getRow(page, rowIndex).evaluate((el: Element) => el.classList.contains('ag-row-selected'));

export const isCellFocused = async (page: Page, rowIndex: number, colField: string): Promise<boolean> =>
    getCell(page, rowIndex, colField).evaluate((el: Element) => el.classList.contains('ag-cell-focus'));

export const toggleRowSelection = async (page: Page, rowIndex: number): Promise<void> =>
    getRow(page, rowIndex).locator('.ag-checkbox-input').click();

export const waitForRowSelected = async (page: Page, rowIndex: number): Promise<void> =>
    // .first() avoids strict-mode violation when columns are pinned:
    // AG Grid renders one .ag-row element per pinned column group.
    expect(getRow(page, rowIndex).first()).toHaveClass(/ag-row-selected/);
