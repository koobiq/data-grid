import { inject, Injectable } from '@angular/core';
import { AgDataLoaderService } from './ag-data-loader.service';

export type DataUri<T> = {
    uri: string;
};

@Injectable({ providedIn: 'root' })
export class AgDataService {
    readonly data = inject(AgDataLoaderService);

    load<T>(uri: DataUri<T>) {
        return this.data.load<T[]>(uri.uri);
    }

    items = this.load<any>({ uri: 'metadata.json' });

    agents = this.load<any>({ uri: 'agents.json' });
}
