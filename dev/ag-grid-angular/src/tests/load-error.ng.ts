import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import {
    KBQ_AG_GRID_LOAD_ERROR_LABELS_EN,
    KbqAgGridLoadError,
    kbqAgGridLoadErrorLabelsProvider,
    kbqAgGridSkeletonCells,
    kbqAgGridSkeletonCheckbox,
    KbqAgGridThemeModule
} from '@koobiq/ag-grid-angular-theme';
import { AgGridModule, ICellRendererAngularComp } from 'ag-grid-angular';
import {
    AllCommunityModule,
    ColDef,
    GridApi,
    GridReadyEvent,
    ICellRendererParams,
    IDatasource,
    IGetRowsParams,
    IsFullWidthRowParams,
    ModuleRegistry,
    RowSelectionOptions,
    SelectionColumnDef
} from 'ag-grid-community';
import { DevRowData } from '../row-data';

ModuleRegistry.registerModules([AllCommunityModule]);

/** Cache block size — a "page" in the wording of the DS-4087 spec. */
const PAGE_SIZE = 50;

/** Artificial network delay, so the skeleton rows stay on screen long enough to see. */
const REQUEST_DELAY = 500;

/** Skeleton rows the grid draws before the first page arrives. */
const INITIAL_ROW_COUNT = 3;

/**
 * Generated here rather than taken from `devInjectRowData()`, which fetches a 2.7 MB
 * `olympic-winners.json`. Several e2e tests open this page, each in its own browser context and
 * cache, and under a parallel run that download cost more than the scenario and timed them out.
 */
const ROW_DATA: DevRowData[] = Array.from({ length: 1000 }, (_, index) => ({
    id: String(index),
    athlete: `Athlete ${index}`,
    age: 20 + (index % 20),
    country: `Country ${index % 30}`,
    year: 2000 + (index % 16),
    date: `0${(index % 9) + 1}/01/${2000 + (index % 16)}`,
    sport: `Sport ${index % 12}`,
    gold: index % 4,
    silver: index % 3,
    bronze: index % 5,
    total: (index % 4) + (index % 3) + (index % 5)
}));

const COLUMN_DEFS: ColDef[] = [
    { field: 'athlete', headerName: 'Athlete', width: 180 },
    { field: 'country', headerName: 'Country', width: 160 },
    { field: 'sport', headerName: 'Sport', width: 160 },
    { field: 'year', headerName: 'Year', width: 110 },
    { field: 'date', headerName: 'Date', width: 140 },
    { field: 'age', headerName: 'Age', width: 100 },
    { field: 'gold', headerName: 'Gold', width: 100 },
    { field: 'silver', headerName: 'Silver', width: 100 },
    { field: 'bronze', headerName: 'Bronze', width: 110 },
    { field: 'total', headerName: 'Total', width: 100 }
];

/** Columns the toggle pins. First and last, so the banner has to cover both sections. */
const PINNED_LEFT = ['ag-Grid-SelectionColumn', 'athlete'];
const PINNED_RIGHT = ['total'];

/** Pinned along with the first column, so the checkbox stays at the left edge of the grid. */
const SELECTION_COLUMN_DEF: SelectionColumnDef = {
    pinned: 'left',
    cellRendererSelector: kbqAgGridSkeletonCheckbox()
};

const ROW_SELECTION: RowSelectionOptions = {
    mode: 'multiRow',
    checkboxes: true,
    headerCheckbox: false
};

/**
 * Text indicator in place of the skeleton rows. A full width row rather than a cell: a cell clips
 * what sticks out of it, so the label could not start where the selection checkbox does.
 */
@Component({
    standalone: true,
    selector: 'dev-load-error-text-row',
    template: `
        Loading...
    `,
    styles: `
        :host {
            display: flex;
            align-items: center;
            height: 100%;
            padding-left: calc(var(--ag-cell-horizontal-padding) + 1px);
            color: var(--kbq-foreground-contrast-secondary);
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevLoadErrorTextRow implements ICellRendererAngularComp {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    agInit(_params: ICellRendererParams): void {}

    refresh(): boolean {
        return false;
    }
}

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-load-error',
    // English labels, matching the rest of the e2e screenshots.
    providers: [kbqAgGridLoadErrorLabelsProvider(KBQ_AG_GRID_LOAD_ERROR_LABELS_EN)],
    template: `
        <div class="dev-controls">
            <button type="button" data-testid="resetBtn" (click)="reset()">Reset scenario</button>
            <label>
                <input
                    type="checkbox"
                    data-testid="textIndicatorToggle"
                    [checked]="textIndicator()"
                    (change)="toggleTextIndicator()"
                />
                Text instead of skeleton
            </label>
            <label>
                <input type="checkbox" data-testid="pinnedToggle" [checked]="pinned()" (change)="togglePinned()" />
                Pinned columns
            </label>
            <span data-testid="networkRequests">network requests: {{ networkRequests() }}</span>
            <span data-testid="lastRowKnown">lastRowKnown: {{ lastRowKnown() }}</span>
            <span data-testid="rowCount">rows: {{ rowCount() }}</span>
        </div>
        <ag-grid-angular
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            kbqAgGridThemeDisableCellFocusStyles
            kbqAgGridLoadError
            rowModelType="infinite"
            animateRows="false"
            [columnDefs]="columnDefs"
            [defaultColDef]="defaultColDef"
            [datasource]="datasource"
            [rowSelection]="rowSelection"
            [selectionColumnDef]="selectionColumnDef"
            [isFullWidthRow]="isFullWidthRow"
            [fullWidthCellRenderer]="textRow"
            [cacheBlockSize]="pageSize"
            [infiniteInitialRowCount]="initialRowCount"
            (gridReady)="onGridReady($event)"
        />
    `,
    styles: `
        :host {
            display: flex;
            flex-direction: column;
            gap: var(--kbq-size-m);
            padding: var(--kbq-size-m);
            height: calc(100vh - calc(var(--kbq-size-l) * 2));
        }

        .dev-controls {
            display: flex;
            align-items: center;
            gap: var(--kbq-size-l);
            font: var(--kbq-typography-text-compact);
        }

        ag-grid-angular {
            flex: 1;
            max-width: 2036px;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevLoadError {
    private readonly loadError = viewChild.required(KbqAgGridLoadError);

    /** Pages already fetched. A retry serves them from here, so only the failed page hits the network. */
    private readonly pageCache = new Map<number, DevRowData[]>();
    private readonly pendingRequests = new Set<ReturnType<typeof setTimeout>>();

    private api?: GridApi;

    protected readonly pageSize = PAGE_SIZE;
    protected readonly initialRowCount = INITIAL_ROW_COUNT;
    protected readonly columnDefs = COLUMN_DEFS;
    protected readonly rowSelection = ROW_SELECTION;
    protected readonly selectionColumnDef = SELECTION_COLUMN_DEF;
    protected readonly textRow = DevLoadErrorTextRow;

    protected readonly networkRequests = signal(0);
    protected readonly lastRowKnown = signal(false);
    protected readonly rowCount = signal(0);
    protected readonly textIndicator = signal(false);
    protected readonly pinned = signal(true);

    /**
     * In the text variant an unloaded row becomes a full width row. `KbqAgGridLoadError` adds the
     * failed row to this callback itself.
     *
     * One stable function reading the signal, not a `computed()` returning a new one: AG Grid
     * replaces the whole grid option on every new input reference, discarding what the directive
     * composed into it.
     */
    protected readonly isFullWidthRow = ({ rowNode }: IsFullWidthRowParams): boolean =>
        this.textIndicator() && rowNode.data === undefined;

    protected readonly defaultColDef: ColDef = { cellRendererSelector: kbqAgGridSkeletonCells() };

    protected readonly datasource: IDatasource = {
        getRows: (params: IGetRowsParams): void => this.getRows(params)
    };

    protected onGridReady({ api }: GridReadyEvent): void {
        this.api = api;
        this.applyPinned();
    }

    /** Puts the scenario back to its starting state: empty cache, request counter at zero. */
    protected reset(): void {
        // The grid no longer waits for requests started before the reset; their answers would land
        // on top of the new state.
        this.pendingRequests.forEach((request) => clearTimeout(request));
        this.pendingRequests.clear();
        // Without this the banner would survive the reload and the grid would stay convinced the
        // dataset ended where the failure happened.
        this.loadError().clear();
        this.pageCache.clear();
        this.networkRequests.set(0);
        this.api?.purgeInfiniteCache();
        this.readGridState();
    }

    protected toggleTextIndicator(): void {
        this.textIndicator.update((value) => !value);
        // `isFullWidthRow` is only evaluated while a row is being built.
        this.api?.redrawRows();
    }

    protected togglePinned(): void {
        this.pinned.update((value) => !value);
        this.applyPinned();
    }

    private applyPinned(): void {
        const pinned = this.pinned();

        this.api?.setColumnsPinned(PINNED_LEFT, pinned ? 'left' : null);
        this.api?.setColumnsPinned(PINNED_RIGHT, pinned ? 'right' : null);
    }

    private getRows(params: IGetRowsParams): void {
        const cached = this.pageCache.get(params.startRow);

        if (cached) {
            this.succeed(params, cached);
            return;
        }

        this.networkRequests.update((count) => count + 1);

        const request = setTimeout(() => {
            this.pendingRequests.delete(request);

            // Every second request that reaches the network fails, so the banner is a few scrolls
            // away and a retry — served after the failed one — always succeeds.
            if (this.networkRequests() % 2 === 0) {
                params.failCallback();
                this.loadError().fail(params.startRow);
                this.readGridState();
                return;
            }

            const rows = ROW_DATA.slice(params.startRow, params.endRow);

            this.pageCache.set(params.startRow, rows);
            this.succeed(params, rows);
        }, REQUEST_DELAY);

        this.pendingRequests.add(request);
    }

    private succeed(params: IGetRowsParams, rows: DevRowData[]): void {
        const total = ROW_DATA.length;
        const lastRow = params.endRow >= total ? total : -1;

        params.successCallback(rows, lastRow);
        this.readGridState();
    }

    private readGridState(): void {
        if (!this.api) return;

        this.lastRowKnown.set(this.api.isLastRowIndexKnown() ?? false);
        this.rowCount.set(this.api.getDisplayedRowCount());
    }
}
