import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    Directive,
    inject,
    InjectionToken,
    input,
    output,
    Provider,
    signal,
    Signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular, ICellRendererAngularComp } from 'ag-grid-angular';
import { GridApi, ICellRendererParams, IRowNode, IsFullWidthRowParams } from 'ag-grid-community';

/** Localization strings used by the load error row. */
export type KbqAgGridLoadErrorLabels = {
    /** Text shown in the error row. */
    message: string;
    /** Label of the retry link. */
    retryButton: string;
};

/** Preset English labels for the load error row. */
export const KBQ_AG_GRID_LOAD_ERROR_LABELS_EN: KbqAgGridLoadErrorLabels = {
    message: 'Failed to load data',
    retryButton: 'Retry'
};

/** Preset Russian labels for the load error row. */
export const KBQ_AG_GRID_LOAD_ERROR_LABELS_RU: KbqAgGridLoadErrorLabels = {
    message: 'Не удалось загрузить данные',
    retryButton: 'Повторить'
};

/**
 * Injection token that provides {@link KbqAgGridLoadErrorLabels} to {@link KbqAgGridLoadError}.
 * Defaults to {@link KBQ_AG_GRID_LOAD_ERROR_LABELS_RU}.
 *
 * @see kbqAgGridLoadErrorLabelsProvider
 */
export const KBQ_AG_GRID_LOAD_ERROR_LABELS = new InjectionToken<KbqAgGridLoadErrorLabels>(
    'KBQ_AG_GRID_LOAD_ERROR_LABELS',
    { factory: (): KbqAgGridLoadErrorLabels => KBQ_AG_GRID_LOAD_ERROR_LABELS_RU }
);

/**
 * Provides localization strings for {@link KbqAgGridLoadError}.
 *
 * @example
 * ```typescript
 * providers: [kbqAgGridLoadErrorLabelsProvider(KBQ_AG_GRID_LOAD_ERROR_LABELS_EN)]
 * ```
 */
export const kbqAgGridLoadErrorLabelsProvider = (labels: KbqAgGridLoadErrorLabels): Provider => ({
    provide: KBQ_AG_GRID_LOAD_ERROR_LABELS,
    useValue: labels
});

/** Params passed to {@link KbqAgGridLoadErrorRowComponent} by {@link KbqAgGridLoadError}. */
export type KbqAgGridLoadErrorRowParams = ICellRendererParams & {
    /** Labels resolved by the directive. Passed as a signal so that late changes reach a rendered row. */
    labels: Signal<KbqAgGridLoadErrorLabels>;
    /** Invoked when the user activates the retry link. */
    retry: () => void;
};

/**
 * Full width row that reports a failed data load and offers a retry.
 * Used internally by the {@link KbqAgGridLoadError} directive.
 */
@Component({
    standalone: true,
    selector: 'kbq-ag-grid-load-error-row',
    host: {
        class: 'kbq-ag-grid-load-error-row',
        role: 'alert'
    },
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <i class="kbq kbq-icon kbq-triangle-exclamation_16 kbq-ag-grid-load-error-row__icon" aria-hidden="true"></i>
        <span class="kbq-ag-grid-load-error-row__message">{{ labels().message }}</span>
        <button class="kbq-ag-grid-load-error-row__retry" type="button" (click)="retry()">
            {{ labels().retryButton }}
        </button>
    `
})
export class KbqAgGridLoadErrorRowComponent implements ICellRendererAngularComp {
    private readonly fallbackLabels = inject(KBQ_AG_GRID_LOAD_ERROR_LABELS);
    private readonly params = signal<KbqAgGridLoadErrorRowParams | null>(null);

    protected readonly labels = computed(() => this.params()?.labels() ?? this.fallbackLabels);

    agInit(params: KbqAgGridLoadErrorRowParams): void {
        this.params.set(params);
    }

    refresh(params: KbqAgGridLoadErrorRowParams): boolean {
        this.params.set(params);

        return true;
    }

    protected retry(): void {
        this.params()?.retry();
    }
}

/**
 * Shows a full width error row in place of a data page that failed to load, with a retry link.
 *
 * Requires `rowModelType="infinite"`. AG Grid's own `failCallback()` leaves the rows of a failed
 * block blank forever and raises no grid event, so the datasource has to report the failure to
 * this directive explicitly.
 *
 * The number of skeleton rows shown while the next page loads is AG Grid's own `cacheOverflowSize`
 * (default `1`), not an option of this directive.
 *
 * This directive owns the `fullWidthCellRenderer` grid option; combining it with custom full width
 * rows is not supported.
 *
 * @example
 * ```html
 * <ag-grid-angular
 *     #loadError="kbqAgGridLoadError"
 *     kbqAgGridTheme
 *     kbqAgGridLoadError
 *     rowModelType="infinite"
 *     [datasource]="datasource"
 *     (kbqAgGridLoadErrorRetry)="reload()"
 * />
 * ```
 * ```typescript
 * getRows: (params: IGetRowsParams): void => {
 *     this.fetchPage(params.startRow, params.endRow).subscribe({
 *         next: ({ rows, lastRow }) => params.successCallback(rows, lastRow),
 *         error: () => {
 *             params.failCallback();
 *             this.loadError().fail(params.startRow);
 *         }
 *     });
 * };
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridLoadError]',
    exportAs: 'kbqAgGridLoadError'
})
export class KbqAgGridLoadError {
    private readonly grid = inject(AgGridAngular);
    private readonly destroyRef = inject(DestroyRef);
    private readonly failedRow = signal<number | null>(null);

    /** Localization strings. Defaults to the value provided by {@link KBQ_AG_GRID_LOAD_ERROR_LABELS}. */
    readonly labels = input(inject(KBQ_AG_GRID_LOAD_ERROR_LABELS), { alias: 'kbqAgGridLoadErrorLabels' });

    /** Emitted when the user activates the retry link, after the grid cache has been refreshed. */
    readonly retryRequested = output({ alias: 'kbqAgGridLoadErrorRetry' });

    /** Index of the row currently occupied by the error row, or `null` when there is no error. */
    readonly failedAtRow: Signal<number | null> = this.failedRow.asReadonly();

    constructor() {
        this.grid.gridReady
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(({ api }: { api: GridApi }) => this.configureGrid(api));
    }

    /**
     * Replaces the failed page with the error row. Call this from the datasource `getRows` error path,
     * passing the `startRow` of the request that failed.
     *
     * `setRowCount(startRow + 1, true)` makes that row the last one, so the grid stops requesting
     * further blocks — a deliberate lie that {@link clear} undoes. `redrawRows()` is required because
     * `isFullWidthRow` is only evaluated while a row is being created.
     */
    fail(startRow: number): void {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!this.grid.api) return;

        this.failedRow.set(startRow);
        this.grid.api.setRowCount(startRow + 1, true);
        this.grid.api.redrawRows();
    }

    /**
     * Removes the error row and re-requests the failed page.
     *
     * `refreshInfiniteCache()` marks every cached block for reload — Community has no per-block
     * retry. Keep a page cache in the datasource so that only the failed page reaches the network.
     */
    retry(): void {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (this.failedRow() === null || !this.grid.api) return;

        this.clear();
        this.grid.api.refreshInfiniteCache();
        this.retryRequested.emit();
    }

    /**
     * Removes the error row without requesting anything, and hands the grid back the rows the error
     * row was covering. Call this before reloading the grid for an unrelated reason — a new search,
     * a filter change, `purgeInfiniteCache()` — otherwise the stale error row survives the reload
     * and the grid stays convinced the dataset ended where the failure happened.
     *
     * `setRowCount(startRow, false)` is what restores the grid's "last row unknown" state, undoing
     * the lie told by {@link fail}.
     */
    clear(): void {
        const startRow = this.failedRow();

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (startRow === null || !this.grid.api) return;

        this.failedRow.set(null);
        this.grid.api.setRowCount(startRow, false);
        this.grid.api.redrawRows();
    }

    /** Composes with grid options already set by the consumer or by another directive on the same grid. */
    private configureGrid(api: GridApi): void {
        const isFullWidthRow = api.getGridOption('isFullWidthRow');
        const isRowSelectable = api.getGridOption('isRowSelectable');

        api.setGridOption(
            'isFullWidthRow',
            (params: IsFullWidthRowParams): boolean =>
                this.isErrorRow(params.rowNode) || (isFullWidthRow?.(params) ?? false)
        );

        api.setGridOption(
            'isRowSelectable',
            (node: IRowNode): boolean => !this.isErrorRow(node) && (isRowSelectable?.(node) ?? true)
        );

        api.setGridOption('fullWidthCellRenderer', KbqAgGridLoadErrorRowComponent);
        api.setGridOption('fullWidthCellRendererParams', {
            labels: this.labels,
            retry: (): void => this.retry()
        });
    }

    private isErrorRow(node: IRowNode): boolean {
        return node.rowIndex !== null && node.rowIndex === this.failedRow();
    }
}
