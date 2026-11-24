import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
    KBQ_AG_GRID_ROW_DETAIL_PARAMS,
    KbqAgGridRowDetailComponent,
    KbqAgGridRowDetailStateLocalStorageStore,
    KbqAgGridRowDetailStateQueryParamsStore,
    KbqAgGridThemeModule
} from '@koobiq/ag-grid-angular-theme';
import { AgGridModule, ICellRendererAngularComp } from 'ag-grid-angular';
import {
    AllCommunityModule,
    ColDef,
    GetRowIdFunc,
    ICellRendererParams,
    ModuleRegistry,
    RowSelectionOptions
} from 'ag-grid-community';
import { DevRowData, devInjectRowData } from '../row-data';

ModuleRegistry.registerModules([AllCommunityModule]);

/** Renderer of the toggle column, checking that the expand toggle wraps an existing renderer. */
@Component({
    standalone: true,
    selector: 'dev-title-cell',
    template: `
        <b>{{ title() }}</b>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevTitleCell implements ICellRendererAngularComp {
    readonly title = signal('');

    agInit(params: ICellRendererParams): void {
        this.refresh(params);
    }

    refresh(params: ICellRendererParams): boolean {
        this.title.set(String(params.value ?? ''));

        return true;
    }
}

/** Plain text detail: a key/value card, as in the "Комплексный пример" part of the spec, with a
 * close button collapsing its own row through `KbqAgGridRowDetailParams.collapse`. */
@Component({
    standalone: true,
    selector: 'dev-row-detail-summary',
    template: `
        <dl data-testid="e2eRowDetailSummary">
            @for (item of items(); track item.label) {
                <div>
                    <dt>{{ item.label }}</dt>
                    <dd>{{ item.value }}</dd>
                </div>
            }
        </dl>
        <button type="button" data-testid="e2eRowDetailCloseButton" (click)="params.collapse()">Close</button>
    `,
    styles: `
        :host {
            display: block;
            margin: 0 var(--kbq-size-m) var(--kbq-size-m);
            padding: var(--kbq-size-m);
            border: 1px solid var(--kbq-line-contrast-less);
            border-radius: var(--kbq-size-border-radius);
            background: var(--kbq-background-card);
        }

        dl {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: var(--kbq-size-s) var(--kbq-size-xxl);
            margin: 0;
        }

        div {
            display: flex;
            gap: var(--kbq-size-s);
        }

        dt {
            color: var(--kbq-foreground-contrast-secondary);
        }

        dd {
            margin: 0;
        }

        button {
            margin-top: var(--kbq-size-m);
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevRowDetailSummary {
    protected readonly params = inject(KBQ_AG_GRID_ROW_DETAIL_PARAMS);

    readonly items = computed(() => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        const data = this.params.data as DevRowData;

        return [
            { label: 'Title', value: data.title },
            { label: 'Severity', value: data.severity },
            { label: 'Attack type', value: data.attackType },
            { label: 'Risk score', value: data.riskScore },
            { label: 'Status', value: data.status },
            { label: 'Detected on', value: data.detectedOn },
            { label: 'Alerts', value: data.alerts },
            { label: 'Review by', value: data.reviewBy },
            { label: 'Comment', value: data.comment }
        ];
    });
}

/** Nested grid detail, as in the "Дочерний грид в развернутой части" part of the spec. */
@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-row-detail-grid',
    template: `
        <ag-grid-angular
            data-testid="e2eRowDetailGrid"
            kbqAgGridTheme
            kbqAgGridThemeDisableCellFocusStyles
            domLayout="autoHeight"
            animateRows="false"
            [rowData]="rowData()"
            [columnDefs]="columnDefs"
        />
    `,
    styles: `
        :host {
            display: block;
            margin: 0 var(--kbq-size-m) var(--kbq-size-m);
            padding: var(--kbq-size-m);
            border: 1px solid var(--kbq-line-contrast-less);
            border-radius: var(--kbq-size-border-radius);
            background: var(--kbq-background-card);
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevRowDetailGrid {
    private readonly params = inject(KBQ_AG_GRID_ROW_DETAIL_PARAMS);

    readonly columnDefs: ColDef[] = [
        { field: 'metric', headerName: 'Metric', flex: 1 },
        { field: 'count', headerName: 'Count', flex: 1 }
    ];

    readonly rowData = computed(() => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        const data = this.params.data as DevRowData;

        return [
            { metric: 'Risk score', count: data.riskScore },
            { metric: 'Alerts', count: data.alerts },
            { metric: 'Affected hosts', count: data.affectedHosts }
        ];
    });
}

const COLUMN_DEFS: ColDef[] = [
    { field: 'title', headerName: 'Title', cellRenderer: DevTitleCell, width: 220 },
    { field: 'riskScore', headerName: 'Risk score' },
    { field: 'severity', headerName: 'Severity' },
    { field: 'status', headerName: 'Status' },
    { field: 'detectedOn', headerName: 'Detected on' },
    { field: 'attackType', headerName: 'Attack type' },
    { field: 'affectedHosts', headerName: 'Affected hosts' }
];

const ROW_SELECTION: RowSelectionOptions = {
    mode: 'multiRow',
    checkboxes: true,
    headerCheckbox: true
};

const GET_ROW_ID: GetRowIdFunc<DevRowData> = (params) => params.data.id;

/**
 * Both detail components side by side: odd rows show the nested grid, even rows the text card.
 * Incidents without affected hosts have no detail panel.
 *
 * Keyed on `sourceRowIndex`, the row's place in the data, rather than on `rowIndex`, its place on
 * screen: sorting or filtering would otherwise hand an expanded row a different component and the
 * directive would rebuild its panel.
 */
const DETAIL_COMPONENT: KbqAgGridRowDetailComponent = ({ data, node }) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const { affectedHosts } = data as DevRowData;

    if (!affectedHosts) return null;

    return node.sourceRowIndex % 2 === 1 ? DevRowDetailGrid : DevRowDetailSummary;
};

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-row-detail',
    template: `
        <div>
            <button type="button" data-testid="e2eCollapseAllButton" (click)="rowDetail.collapseAll()">
                Collapse all
            </button>
            <button type="button" data-testid="e2eSingleExpandButton" (click)="singleExpand.set(!singleExpand())">
                Single expand: {{ singleExpand() }}
            </button>
            <button type="button" data-testid="e2eFilledButton" (click)="filled.set(!filled())">
                Filled: {{ filled() }}
            </button>
            <button type="button" data-testid="e2eStickyButton" (click)="sticky.set(!sticky())">
                Sticky: {{ sticky() }}
            </button>
            <button type="button" data-testid="e2eAnimateRowsButton" (click)="animateRows.set(!animateRows())">
                Animate rows: {{ animateRows() }}
            </button>
            <span data-testid="e2eExpandedIds">{{ expanded().join(', ') }}</span>
        </div>
        <ag-grid-angular
            #rowDetail="kbqAgGridRowDetail"
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            kbqAgGridThemeDisableCellFocusStyles
            kbqAgGridRowDetail
            [animateRows]="animateRows()"
            [getRowId]="getRowId"
            [rowData]="rowData()"
            [columnDefs]="columnDefs"
            [rowSelection]="rowSelection"
            [kbqAgGridRowDetailComponent]="detailComponent"
            [kbqAgGridRowDetailSingleExpand]="singleExpand()"
            [kbqAgGridRowDetailFilled]="filled()"
            [kbqAgGridRowDetailSticky]="sticky()"
            [(kbqAgGridRowDetailExpanded)]="expanded"
        />
    `,
    styles: `
        :host {
            display: flex;
            flex-direction: column;
            gap: var(--kbq-size-m);
        }

        ag-grid-angular {
            flex: 1;
            min-height: 0;
            max-width: 2036px;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevRowDetail {
    readonly rowData = devInjectRowData();
    readonly columnDefs = COLUMN_DEFS;
    readonly rowSelection = ROW_SELECTION;
    readonly getRowId = GET_ROW_ID;
    readonly detailComponent = DETAIL_COMPONENT;
    readonly expanded = signal<string[]>([]);
    readonly singleExpand = signal(true);
    readonly filled = signal(false);
    readonly sticky = signal(true);
    /** Off by default, so that screenshots never catch a row halfway through its animation. */
    readonly animateRows = signal(false);
}

const STATE_KEY = 'dev-ag-grid-row-detail-state';

/** Expanded rows persisted in `localStorage`. */
@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-row-detail-state',
    template: `
        <button type="button" (click)="rowDetail.reset()">Reset state</button>
        <ag-grid-angular
            #rowDetail="kbqAgGridRowDetail"
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            kbqAgGridThemeDisableCellFocusStyles
            kbqAgGridRowDetail
            animateRows="false"
            [getRowId]="getRowId"
            [rowData]="rowData()"
            [columnDefs]="columnDefs"
            [kbqAgGridRowDetailComponent]="detailComponent"
            [kbqAgGridRowDetailState]="stateKey"
            [kbqAgGridRowDetailStateStore]="store"
        />
    `,
    styles: `
        :host {
            display: flex;
            flex-direction: column;
            gap: var(--kbq-size-m);
        }

        ag-grid-angular {
            flex: 1;
            min-height: 0;
            max-width: 2036px;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevRowDetailState {
    readonly rowData = devInjectRowData();
    readonly store = inject(KbqAgGridRowDetailStateLocalStorageStore);
    readonly stateKey = STATE_KEY;
    readonly columnDefs = COLUMN_DEFS;
    readonly getRowId = GET_ROW_ID;
    readonly detailComponent = DETAIL_COMPONENT;
}

/** Expanded rows persisted in URL query params. */
@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-row-detail-state-query-params',
    template: `
        <button type="button" (click)="rowDetail.reset()">Reset state</button>
        <ag-grid-angular
            #rowDetail="kbqAgGridRowDetail"
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            kbqAgGridThemeDisableCellFocusStyles
            kbqAgGridRowDetail
            animateRows="false"
            [getRowId]="getRowId"
            [rowData]="rowData()"
            [columnDefs]="columnDefs"
            [kbqAgGridRowDetailComponent]="detailComponent"
            [kbqAgGridRowDetailState]="stateKey"
            [kbqAgGridRowDetailStateStore]="store"
        />
    `,
    styles: `
        :host {
            display: flex;
            flex-direction: column;
            gap: var(--kbq-size-m);
        }

        ag-grid-angular {
            flex: 1;
            min-height: 0;
            max-width: 2036px;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevRowDetailStateQueryParams {
    readonly rowData = devInjectRowData();
    readonly store = inject(KbqAgGridRowDetailStateQueryParamsStore);
    readonly stateKey = STATE_KEY;
    readonly columnDefs = COLUMN_DEFS;
    readonly getRowId = GET_ROW_ID;
    readonly detailComponent = DETAIL_COMPONENT;
}

/** Same grid with a pinned column, checking that the expanded part stays in the center section. */
@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-row-detail-pinned-columns',
    template: `
        <ag-grid-angular
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            kbqAgGridThemeDisableCellFocusStyles
            kbqAgGridRowDetail
            animateRows="false"
            [getRowId]="getRowId"
            [rowData]="rowData()"
            [columnDefs]="columnDefs"
            [rowSelection]="rowSelection"
            [kbqAgGridRowDetailComponent]="detailComponent"
        />
    `,
    styles: `
        :host {
            display: flex;
            flex-direction: column;
        }

        ag-grid-angular {
            flex: 1;
            min-height: 0;
            max-width: 2036px;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevRowDetailPinnedColumns {
    readonly rowData = devInjectRowData();
    readonly columnDefs: ColDef[] = [
        { field: 'severity', headerName: 'Severity', pinned: 'left', width: 160 },
        ...COLUMN_DEFS.filter(({ field }) => field !== 'severity'),
        { field: 'alerts', headerName: 'Alerts', pinned: 'right', width: 120 }
    ];
    readonly rowSelection = ROW_SELECTION;
    readonly getRowId = GET_ROW_ID;
    readonly detailComponent = DETAIL_COMPONENT;
}
