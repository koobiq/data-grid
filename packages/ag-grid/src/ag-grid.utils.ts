import { GridApi } from '@ag-grid-community/core';

export function gridGetPinnedTopRows(api: GridApi) {
    return Array.from({ length: api.getPinnedTopRowCount() })
        .map((_, i) => api.getPinnedTopRow(i))
        .filter((it) => !!it);
}

export function gridGetPinnedTopData(api: GridApi) {
    return gridGetPinnedTopRows(api)?.map((it) => it.data);
}

export function gridGetPinnedBottomRows(api: GridApi) {
    return Array.from({ length: api.getPinnedBottomRowCount() })
        .map((_, i) => api.getPinnedBottomRow(i))
        .filter((it) => !!it);
}

export function gridGetPinnedBottomData(api: GridApi) {
    return gridGetPinnedBottomRows(api)?.map((it) => it.data);
}
