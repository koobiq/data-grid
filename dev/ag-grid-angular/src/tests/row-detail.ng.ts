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
    selector: 'dev-athlete-cell',
    template: `
        <b>{{ athlete() }}</b>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevAthleteCell implements ICellRendererAngularComp {
    readonly athlete = signal('');

    agInit(params: ICellRendererParams): void {
        this.refresh(params);
    }

    refresh(params: ICellRendererParams): boolean {
        this.athlete.set(String(params.value ?? ''));

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
            { label: 'Athlete', value: data.athlete },
            { label: 'Country', value: data.country },
            { label: 'Sport', value: data.sport },
            { label: 'Age', value: data.age },
            { label: 'Year', value: data.year },
            { label: 'Date', value: data.date },
            { label: 'Gold', value: data.gold },
            { label: 'Silver', value: data.silver },
            { label: 'Bronze', value: data.bronze }
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
        { field: 'medal', headerName: 'Medal', flex: 1 },
        { field: 'count', headerName: 'Count', flex: 1 }
    ];

    readonly rowData = computed(() => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        const data = this.params.data as DevRowData;

        return [
            { medal: 'Gold', count: data.gold },
            { medal: 'Silver', count: data.silver },
            { medal: 'Bronze', count: data.bronze },
            { medal: 'Total', count: data.total }
        ];
    });
}

const COLUMN_DEFS: ColDef[] = [
    { field: 'athlete', headerName: 'Athlete', cellRenderer: DevAthleteCell, width: 220 },
    { field: 'age', headerName: 'Age' },
    { field: 'country', headerName: 'Country' },
    { field: 'year', headerName: 'Year' },
    { field: 'date', headerName: 'Date' },
    { field: 'sport', headerName: 'Sport' },
    { field: 'total', headerName: 'Total' }
];

const ROW_SELECTION: RowSelectionOptions = {
    mode: 'multiRow',
    checkboxes: true,
    headerCheckbox: true
};

const GET_ROW_ID: GetRowIdFunc<DevRowData> = (params) => params.data.id;

/**
 * Both detail components side by side: odd rows show the nested grid, even rows the text card.
 * Rows with no athlete age (nothing to tell about them) cannot be expanded at all.
 *
 * Keyed on `sourceRowIndex`, the row's place in the data, rather than on `rowIndex`, its place on
 * screen: sorting or filtering would otherwise hand an expanded row a different component and the
 * directive would rebuild its panel.
 */
const DETAIL_COMPONENT: KbqAgGridRowDetailComponent = ({ data, node }) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const { age } = data as DevRowData;

    if (!age) return null;

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
            <span data-testid="e2eExpandedIds">{{ expanded().join(', ') }}</span>
        </div>
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
        { field: 'country', headerName: 'Country', pinned: 'left', width: 160 },
        ...COLUMN_DEFS,
        { field: 'gold', headerName: 'Gold', pinned: 'right', width: 120 }
    ];
    readonly rowSelection = ROW_SELECTION;
    readonly getRowId = GET_ROW_ID;
    readonly detailComponent = DETAIL_COMPONENT;
}
