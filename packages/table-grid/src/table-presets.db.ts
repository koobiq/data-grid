import { Injectable } from '@angular/core';
import { DBT_TABLE_PRESETS, DBT_TABLE_STATES } from './db/constants';
import { injectAppDB } from './db/db';
import { DBTable } from './db/db-table';
import { TablePresetRecord, TableStateRecord } from './types';

@Injectable({ providedIn: 'root' })
export class TablePresetDB extends DBTable<TablePresetRecord> {
    readonly db = injectAppDB();
    readonly table = this.db.table<TablePresetRecord>(DBT_TABLE_PRESETS);
}

@Injectable({ providedIn: 'root' })
export class TableStateDB extends DBTable<TableStateRecord> {
    readonly db = injectAppDB();
    readonly table = this.db.table<TableStateRecord>(DBT_TABLE_STATES);
}
