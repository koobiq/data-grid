import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import { AgGridEvent, ModuleRegistry } from '@ag-grid-community/core';
import { CsvExportModule } from '@ag-grid-community/csv-export';
import { InfiniteRowModelModule } from '@ag-grid-community/infinite-row-model';

ModuleRegistry.registerModules([ClientSideRowModelModule, InfiniteRowModelModule, CsvExportModule]);

export type AgGrid<T = any, C = any> = AgGridEvent<T, C>;
