import { GridOptions } from '@ag-grid-community/core';
import { inject, Injectable } from '@angular/core';
import { selectStream, TableGridUtils } from '@koobiq/ag-grid';
import { DataViewAdapter, injectDataViewAdapterOptions } from '@koobiq/data-view';
import { AgDataService } from '../../data/ag-data.service';
import { colAuthor, colDatePublished, colID, colTitle, colType } from './heroes-table-cols';

@Injectable()
export class HeroesTableAdapter implements DataViewAdapter<any> {
    private db = inject(AgDataService);
    private config = injectDataViewAdapterOptions<any>({ optional: true });
    private utils = inject(TableGridUtils<any>);

    entityID(item: any): string {
        console.log('entityID', item);
        return item.heroesId.toLocaleLowerCase();
    }

    connect() {
        return this.source$;
    }

    gridOptions(): GridOptions<any> {
        if (this.config?.gridOptions) {
            return this.config.gridOptions(this.utils);
        }

        return buildCommonHousingGridOptions(this.utils);
    }

    private source$ = selectStream(this.config?.source || this.db.items, (items) => {
        console.log(items);
        return items;
    });
}

export function buildCommonHousingGridOptions(util: TableGridUtils<any>) {
    const result: GridOptions<any> = {
        columnDefs: [
            colID(util),
            colDatePublished(util),
            colTitle(util),
            colType(util),
            colAuthor(util)]
    };

    return result;
}
