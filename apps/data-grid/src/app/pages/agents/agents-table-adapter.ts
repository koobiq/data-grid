import { GridOptions } from '@ag-grid-community/core';
import { inject, Injectable } from '@angular/core';
import { selectStream, TableGridUtils } from '@koobiq/ag-grid';
import { DataViewAdapter, injectDataViewAdapterOptions } from '@koobiq/data-view';
import { AgDataService } from '../../data/ag-data.service';
import { colIP, colName, colNameGroup } from './agents-table-cols';

@Injectable()
export class AgentsTableAdapter implements DataViewAdapter<any> {
    private db = inject(AgDataService);
    private config = injectDataViewAdapterOptions<any>({ optional: true });
    private utils = inject(TableGridUtils<any>);

    entityID(item: any): string {
        return item.heroesId.toLocaleLowerCase();
    }

    connect() {
        return this.source$;
    }

    gridOptions(): GridOptions<any> {
        if (this.config?.gridOptions) {
            return this.config.gridOptions(this.utils);
        }

        return buildCommonAgentsGridOptions(this.utils);
    }

    private source$ = selectStream(this.db.agents, (items) => {
        return items['data']['agents'];
    });
}

export function buildCommonAgentsGridOptions(util: TableGridUtils<any>) {
    const result: GridOptions<any> = {
        rowSelection: {
            mode: 'multiRow'
        },
        columnDefs: [
            colName(util),
            colIP(util),
            colNameGroup(util)]
    };

    return result;
}
