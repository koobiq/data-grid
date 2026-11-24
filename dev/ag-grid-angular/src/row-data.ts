import { formatDate } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ColDef, IDatasource, IGetRowsParams } from 'ag-grid-community';
import { catchError, of, shareReplay } from 'rxjs';

export const DEV_SEVERITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
export const DEV_INCIDENT_STATUSES = ['New', 'In progress', 'Resolved'] as const;
export const DEV_ATTACK_TYPES = ['Phishing', 'Brute force', 'Malware', 'Data exposure', 'Suspicious access'] as const;

export const DEV_UNASSIGNED_OPERATOR = 'Unassigned';
const OPERATORS = ['Anna Petrova', 'Alexey Smirnov', 'Ivan Ivanov'];

export type DevRowData = {
    id: string;
    incidentNumber: string;
    title: string;
    operator: string | null;
    source: string;
    severity: (typeof DEV_SEVERITIES)[number];
    status: (typeof DEV_INCIDENT_STATUSES)[number];
    attackType: (typeof DEV_ATTACK_TYPES)[number];
    detectedOn: string;
    reviewBy: string | null;
    riskScore: number;
    alerts: number;
    affectedHosts: number;
    escalated: boolean;
    comment: string;
};

const INCIDENT_COLUMNS = {
    id: { headerName: 'UUID', editable: false },
    incidentNumber: { headerName: 'ID', editable: false },
    title: { headerName: 'Title' },
    source: { headerName: 'Source' },
    operator: {
        headerName: 'Operator',
        cellDataType: 'text',
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: [DEV_UNASSIGNED_OPERATOR, ...OPERATORS] },
        valueGetter: ({ data }: { data?: Pick<DevRowData, 'operator'> }): string | undefined =>
            data?.operator === null ? DEV_UNASSIGNED_OPERATOR : data?.operator,
        valueSetter: ({ data, newValue }: { data: Pick<DevRowData, 'operator'>; newValue: string | null }): boolean => {
            const operator = newValue === DEV_UNASSIGNED_OPERATOR ? null : newValue;
            if (data.operator === operator) return false;
            data.operator = operator;
            return true;
        }
    },
    severity: {
        headerName: 'Severity',
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: DEV_SEVERITIES }
    },
    status: {
        headerName: 'Status',
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: DEV_INCIDENT_STATUSES }
    },
    attackType: {
        headerName: 'Attack type',
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: DEV_ATTACK_TYPES }
    },
    detectedOn: { headerName: 'Detected on', cellDataType: 'dateString' },
    reviewBy: { headerName: 'Review by', cellDataType: 'dateString' },
    riskScore: { headerName: 'Risk score', cellEditorParams: { min: 0, max: 100 } },
    alerts: { headerName: 'Alerts', cellEditorParams: { min: 0 } },
    affectedHosts: { headerName: 'Affected hosts', cellEditorParams: { min: 0 } },
    escalated: { headerName: 'Escalated', cellDataType: 'boolean' },
    comment: { headerName: 'Comment', cellEditor: 'agLargeTextCellEditor', cellEditorPopup: true }
} satisfies Record<keyof DevRowData, ColDef<DevRowData>>;

/** Looks up the header and editor shared by examples for this incident field. */
export function devIncidentColumn(
    field: keyof DevRowData
): { field: keyof DevRowData } & (typeof INCIDENT_COLUMNS)[keyof DevRowData] {
    return { field, ...INCIDENT_COLUMNS[field] };
}

/** Builds the columns a scenario needs, in its display order. */
export function devIncidentColumns(...fields: (keyof DevRowData)[]): ColDef<DevRowData>[] {
    return fields.map(devIncidentColumn);
}

/** Full-width column set used by the clipboard, persistence, export and overlay examples. */
export const DEV_INCIDENT_COLUMNS = devIncidentColumns(
    'title',
    'riskScore',
    'severity',
    'status',
    'detectedOn',
    'attackType',
    'alerts',
    'reviewBy',
    'comment',
    'affectedHosts',
    'incidentNumber',
    'operator',
    'source'
);

/** The Date editor uses local calendar dates. The underlying row and clipboard keep the ISO date string. */
export const DEV_REVIEW_DATE_COLUMN: ColDef<DevRowData, Date | string | null> = {
    field: 'reviewBy',
    headerName: INCIDENT_COLUMNS.reviewBy.headerName,
    cellDataType: 'date',
    valueGetter: ({ data }) => (data?.reviewBy ? new Date(data.reviewBy + 'T00:00:00') : null),
    valueSetter: ({ data, newValue }) => {
        const reviewBy = newValue instanceof Date ? formatDate(newValue, 'yyyy-MM-dd', 'en-US') : (newValue ?? null);
        if (data.reviewBy === reviewBy) return false;
        data.reviewBy = reviewBy;
        return true;
    }
};

@Injectable({ providedIn: 'root' })
export class DevRowDataService {
    private readonly data$ = inject(HttpClient)
        .get<DevRowData[]>('/security-incidents.json')
        .pipe(
            catchError(() => of([])),
            shareReplay({ bufferSize: 1, refCount: false })
        );

    readonly data: Signal<DevRowData[]> = toSignal(this.data$, { initialValue: [] });
}

export function devInjectRowData(): Signal<DevRowData[]> {
    return inject(DevRowDataService).data;
}

/** Gives each editable grid its own copy of the incident rows. */
export function devInjectEditableIncidents(): Signal<DevRowData[]> {
    const incidents = devInjectRowData();

    return computed(() => incidents().map((row) => ({ ...row })));
}

export function devInjectDatasource(delay = 1300): Signal<IDatasource> {
    let timeout: ReturnType<typeof setTimeout> | undefined = undefined;
    const rowData = devInjectRowData();

    return computed((): IDatasource => {
        const data = rowData();
        return {
            rowCount: data.length,
            getRows(params: IGetRowsParams): void {
                timeout = setTimeout(() => {
                    const rows = data.slice(params.startRow, params.endRow);
                    const lastRow = params.endRow >= data.length ? data.length : -1;
                    params.successCallback(rows, lastRow);
                }, delay);
            },
            destroy(): void {
                clearTimeout(timeout);
            }
        };
    });
}
