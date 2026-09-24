import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { KbqAgGridLoadError, KbqAgGridSkeletonCellRenderer, KbqAgGridThemeModule } from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import {
    AllCommunityModule,
    ColDef,
    GridApi,
    GridReadyEvent,
    ICellRendererParams,
    IDatasource,
    IGetRowsParams,
    ModuleRegistry,
    RowSelectionOptions,
    SelectionColumnDef
} from 'ag-grid-community';
import { DevRowData } from '../row-data';

ModuleRegistry.registerModules([AllCommunityModule]);

/** Размер блока кэша. Он же «страница» в терминах спеки DS-4087. */
const PAGE_SIZE = 50;

/** Искусственная задержка сети, чтобы скелетон-строки были видны глазами. */
const REQUEST_DELAY = 500;

/** Первая строка 4-й страницы — именно её загрузка падает по сценарию из спеки. */
const FAILING_PAGE_START_ROW = PAGE_SIZE * 3;

/**
 * Данные генерируются на месте, а не берутся из `devInjectRowData()`: тот тянет по HTTP
 * `olympic-winners.json` на 2.7 МБ, а этот стенд открывается в семи e2e-тестах подряд, у каждого
 * свой контекст браузера и свой кэш. Под параллельным прогоном загрузка становилась дороже самого
 * сценария и роняла тесты по таймауту.
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
    { field: 'athlete', headerName: 'Athlete', pinned: 'left', width: 180 },
    { field: 'country', headerName: 'Country', width: 160 },
    { field: 'sport', headerName: 'Sport', width: 160 },
    { field: 'year', headerName: 'Year', width: 110 },
    { field: 'date', headerName: 'Date', width: 140 },
    { field: 'age', headerName: 'Age', width: 100 },
    { field: 'gold', headerName: 'Gold', width: 100 },
    { field: 'silver', headerName: 'Silver', width: 100 },
    { field: 'bronze', headerName: 'Bronze', width: 110 },
    { field: 'total', headerName: 'Total', pinned: 'right', width: 100 }
];

/** Pinned alongside the pinned first column, so the checkbox stays on the left edge of the grid. */
const SELECTION_COLUMN_DEF: SelectionColumnDef = { pinned: 'left' };

const ROW_SELECTION: RowSelectionOptions = {
    mode: 'multiRow',
    checkboxes: true,
    headerCheckbox: false
};

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-load-error',
    template: `
        <div class="dev-controls">
            <button type="button" data-testid="resetBtn" (click)="reset()">Сбросить сценарий</button>
            <span data-testid="networkRequests">запросов в сеть: {{ networkRequests() }}</span>
            <span data-testid="lastRowKnown">lastRowKnown: {{ lastRowKnown() }}</span>
            <span data-testid="rowCount">строк: {{ rowCount() }}</span>
        </div>
        <ag-grid-angular
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            kbqAgGridThemeDisableCellFocusStyles
            kbqAgGridLoadError
            kbqAgGridSkeletonSelection
            rowModelType="infinite"
            animateRows="false"
            [columnDefs]="columnDefs"
            [defaultColDef]="defaultColDef"
            [datasource]="datasource"
            [rowSelection]="rowSelection"
            [selectionColumnDef]="selectionColumnDef"
            [cacheBlockSize]="pageSize"
            [infiniteInitialRowCount]="pageSize"
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

    /** Страницы, уже успешно полученные «с сервера». Повтор отдаёт их из памяти, не дёргая сеть. */
    private readonly pageCache = new Map<number, DevRowData[]>();
    private readonly pendingRequests = new Set<ReturnType<typeof setTimeout>>();

    private api?: GridApi;
    private failingPageAlreadyFailed = false;

    protected readonly pageSize = PAGE_SIZE;
    protected readonly columnDefs = COLUMN_DEFS;
    protected readonly rowSelection = ROW_SELECTION;
    protected readonly selectionColumnDef = SELECTION_COLUMN_DEF;

    protected readonly networkRequests = signal(0);
    protected readonly lastRowKnown = signal(false);
    protected readonly rowCount = signal(0);

    protected readonly defaultColDef: ColDef = {
        cellRendererSelector: (params: ICellRendererParams) =>
            params.data === undefined ? { component: KbqAgGridSkeletonCellRenderer } : undefined
    };

    protected readonly datasource: IDatasource = {
        getRows: (params: IGetRowsParams): void => this.getRows(params)
    };

    protected onGridReady({ api }: GridReadyEvent): void {
        this.api = api;
    }

    /** Возвращает сценарий в исходное состояние: кэш пуст, 4-я страница снова упадёт. */
    protected reset(): void {
        // Запросы, начатые до сброса, грид уже не ждёт: их ответы приехали бы поверх нового состояния.
        this.pendingRequests.forEach((request) => clearTimeout(request));
        this.pendingRequests.clear();
        // Без этого баннер пережил бы перезагрузку, а грид остался бы уверен, что данные кончились.
        this.loadError().clear();
        this.pageCache.clear();
        this.failingPageAlreadyFailed = false;
        this.networkRequests.set(0);
        this.api?.purgeInfiniteCache();
        this.readGridState();
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

            const shouldFail = params.startRow === FAILING_PAGE_START_ROW && !this.failingPageAlreadyFailed;

            if (shouldFail) {
                this.failingPageAlreadyFailed = true;
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
