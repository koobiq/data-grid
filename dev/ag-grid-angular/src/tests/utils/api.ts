import { JSHandle, Page } from '@playwright/test';
import { GridApi } from 'ag-grid-community';

// AG Grid v34 has no column menu button in Community edition, so there's no UI to hide a column.
// `window.ng` is Angular's global debug API (available in dev mode) that exposes the component
// instance for a given DOM element. This is the only way to call the GridApi from Playwright.
// Returns a JSHandle so GridApi methods remain callable via handle.evaluate().
// eslint-disable-next-line @typescript-eslint/naming-convention
export const getAgGridApi = async (page: Page): Promise<JSHandle<GridApi>> =>
    page.evaluateHandle(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        () => (window as any).ng.getComponent(document.querySelector('ag-grid-angular')).api as GridApi
    );
