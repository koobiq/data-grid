import { ColumnState, GridApi } from '@ag-grid-community/core';
import { EventEmitter, Injectable, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { gridGetPinnedBottomData, gridGetPinnedTopData } from '@koobiq/ag-grid';
import { PreferencesService } from './preferences/preferences.service';
import { StorageNode } from './storage';
import { TableStateDB } from './table-presets.db';
import { TableStateRecord } from './types';
import { decompressQueryParam } from './utils/compression';

const QUERY_PARAM_GRID_STATE = 'gridState';

@Injectable()
export class TableGridPersistenceService {
    private readonly storage = inject(TableStateDB);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);

    private filterStorage: StorageNode<{ filter: unknown }> = inject(PreferencesService).session.storageScope('grid:');

    onFilterApplied = new EventEmitter();
    onFilterSaved = new EventEmitter();

    async restoreState(api: GridApi, key: string, ignoreQueryParams = false) {
        const qState = ignoreQueryParams ? null : this.fromQueryParams();

        await this.loadColumnState(api, key, qState?.columns).catch(console.error);
        await this.loadFilterState(api, key, qState?.filter).catch(console.error);
        await this.clearQueryParams();
    }

    async loadColumnState(api: GridApi, key: string, state?: ColumnState[]) {
        if (!key || !api) {
            return;
        }

        const current = await this.storage.read(key).catch(() => null as TableStateRecord);
        const data = state ?? current?.columns;
        if (data) {
            api.applyColumnState({ state: data, applyOrder: true });
        }
    }

    async loadFilterState(api: GridApi, key: string, state?: any) {
        const data = state ?? this.filterStorage.get(key)?.filter;
        this.applyFilterState(api, data);
    }

    async saveColumnState(api: GridApi, key: string) {
        if (!api) {
            return;
        }
        const state = api.getColumnState();
        await this.writeColumnState(api, key, state);
    }

    async savePinnedState(api: GridApi, key: string, identify: (item: any) => string | number) {
        if (!key || !api || !identify) {
            return;
        }

        const state = await this.storage.read(key).catch(() => null as TableStateRecord);
        const pinnedTop = gridGetPinnedTopData(api)?.map(identify);
        const pinnedBottom = gridGetPinnedBottomData(api)?.map(identify);

        await this.storage.createOrUpdate({
            columns: null,
            ...(state || {}),
            id: key,
            pinnedTop: pinnedTop,
            pinnedBottom: pinnedBottom
        });
    }

    applyFilterState(api: GridApi, filter: any) {
        if (filter && api) {
            api.setFilterModel(filter);
            this.onFilterApplied.next(filter);
        }
    }

    async loadPinnedState(api: GridApi, key: string, identify: (item: any) => string | number) {
        if (!key || !api || !identify) {
            return;
        }
        const state = await this.storage.read(key).catch(() => null as TableStateRecord);
        const pinnedTop = resolvePinnedData(api, state?.pinnedTop, identify) || [];
        const pinnedBottom = resolvePinnedData(api, state?.pinnedBottom, identify) || [];
        api.updateGridOptions({
            pinnedTopRowData: pinnedTop,
            pinnedBottomRowData: pinnedBottom
        });
    }

    async saveFilterState(api: GridApi, key: string) {
        if (!api || !key) {
            return;
        }
        const filterState = api.getFilterModel();
        this.filterStorage.set(key, {
            filter: filterState
        });
        this.onFilterSaved.next(filterState);
    }

    private async writeColumnState(api: GridApi, key: string, state: ColumnState[]) {
        if (!key || !api) {
            return;
        }
        const current = await this.storage.read(key).catch(() => null as TableStateRecord);
        await this.storage
            .createOrUpdate({
                pinnedBottom: null,
                pinnedTop: null,
                ...(current || {}),
                id: key,
                columns: state?.length ? state : null
            })
            .catch(console.error);
    }

    private getQueryParam() {
        return this.route.snapshot.queryParamMap.get(QUERY_PARAM_GRID_STATE);
    }

    private async clearQueryParams() {
        const param = this.getQueryParam();
        if (!param) {
            return true;
        }
        return this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { [QUERY_PARAM_GRID_STATE]: null },
            queryParamsHandling: 'merge',
            replaceUrl: true
        });
    }

    private fromQueryParams() {
        const param = this.getQueryParam();
        const state = decompressQueryParam<{ columns: any; filter: any }>(param);
        return {
            columns: state?.columns as ColumnState[],
            filter: state?.filter
        };
    }
}

function resolvePinnedData(api: GridApi, ids: Array<string | number>, identify: (item: any) => string | number) {
    if (!Array.isArray(ids) || !ids?.length) {
        return null;
    }
    const result: any[] = [];
    api.forEachNode(({ data }) => {
        if (ids.includes(identify(data))) {
            result.push(data);
        }
    });
    return result;
}
