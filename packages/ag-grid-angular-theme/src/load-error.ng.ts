import {
    ChangeDetectionStrategy,
    Component,
    ComponentRef,
    computed,
    DestroyRef,
    Directive,
    effect,
    inject,
    InjectionToken,
    input,
    output,
    Provider,
    signal,
    Signal,
    Type,
    viewChild,
    ViewContainerRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular, ICellRendererAngularComp } from 'ag-grid-angular';
import { GridApi, ICellRendererParams, IRowNode, IsFullWidthRowParams, IsRowSelectable } from 'ag-grid-community';
import { merge } from 'rxjs';

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

/** AG Grid types both full width renderer options as `any`; each is narrowed once, right here. */
const fullWidthRendererOf = (api: GridApi): Type<ICellRendererAngularComp> | undefined =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    api.getGridOption('fullWidthCellRenderer') as Type<ICellRendererAngularComp> | undefined;

const fullWidthParamsOf = (api: GridApi): Record<string, unknown> | undefined =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    api.getGridOption('fullWidthCellRendererParams') as Record<string, unknown> | undefined;

/** Params passed to {@link KbqAgGridLoadErrorRowComponent} by {@link KbqAgGridLoadError}. */
export type KbqAgGridLoadErrorRowParams = ICellRendererParams & {
    /** Labels resolved by the directive. Passed as a signal so that late changes reach a rendered row. */
    labels: Signal<KbqAgGridLoadErrorLabels>;
    /** Invoked when the user activates the retry link. */
    retry: () => void;
    /** Tells the error row apart from any other full width row on the same grid. */
    isErrorRow: (node: IRowNode) => boolean;
    /** Renderer the grid had for its own full width rows before the directive took the option over. */
    fallbackRenderer?: Type<ICellRendererAngularComp>;
    /** Params that belonged to `fallbackRenderer`. */
    fallbackParams?: Record<string, unknown>;
};

/**
 * Full width row that reports a failed data load and offers a retry.
 * Used internally by the {@link KbqAgGridLoadError} directive.
 *
 * AG Grid allows a single `fullWidthCellRenderer` per grid, so this component doubles as the
 * dispatcher for it: on the error row it renders the banner, and on any other full width row it
 * hands over to the renderer the consumer had registered. Without such a renderer it is the banner
 * and nothing else, which is the out of the box case.
 */
@Component({
    standalone: true,
    selector: 'kbq-ag-grid-load-error-row',
    host: {
        class: 'kbq-ag-grid-load-error-row',
        '[class.kbq-ag-grid-load-error-row_error]': 'isErrorRow()',
        '[attr.role]': 'isErrorRow() ? "alert" : null'
    },
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (isErrorRow()) {
            <div class="kbq-ag-grid-load-error-row__content">
                <i
                    class="kbq kbq-icon kbq-triangle-exclamation_16 kbq-ag-grid-load-error-row__icon"
                    aria-hidden="true"
                ></i>
                <span class="kbq-ag-grid-load-error-row__message">{{ labels().message }}</span>
                <button class="kbq-ag-grid-load-error-row__retry" type="button" (click)="retry()">
                    {{ labels().retryButton }}
                </button>
            </div>
        }
        <ng-container #fallbackHost />
    `
})
export class KbqAgGridLoadErrorRowComponent implements ICellRendererAngularComp {
    private readonly fallbackLabels = inject(KBQ_AG_GRID_LOAD_ERROR_LABELS);
    private readonly params = signal<KbqAgGridLoadErrorRowParams | null>(null);

    private readonly fallbackHost = viewChild('fallbackHost', { read: ViewContainerRef });
    private fallbackRef: ComponentRef<ICellRendererAngularComp> | null = null;

    protected readonly isErrorRow = computed(() => {
        const params = this.params();

        return params?.isErrorRow(params.node) ?? false;
    });

    protected readonly labels = computed(() => this.params()?.labels() ?? this.fallbackLabels);

    constructor() {
        // The container is only reachable once the view exists, and AG Grid calls `agInit` before
        // that. Creating the consumer's renderer from an effect rather than from `agInit` waits for
        // both without an `ngAfterViewInit` that would then have to re-read the params by hand.
        effect(() => this.renderFallback());
    }

    agInit(params: KbqAgGridLoadErrorRowParams): void {
        this.params.set(params);
    }

    refresh(params: KbqAgGridLoadErrorRowParams): boolean {
        this.params.set(params);
        this.fallbackRef?.instance.refresh(params);

        return true;
    }

    protected retry(): void {
        this.params()?.retry();
    }

    private renderFallback(): void {
        const host = this.fallbackHost();
        const params = this.params();

        if (!host || !params || this.isErrorRow() || this.fallbackRef !== null) return;

        const renderer = params.fallbackRenderer;

        if (!renderer) return;

        this.fallbackRef = host.createComponent(renderer);
        // AG Grid renderers take their input through `agInit`, not through Angular inputs, so the
        // params the consumer registered alongside the renderer are merged back in here.
        this.fallbackRef.instance.agInit({ ...params, ...params.fallbackParams });
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
 * Sorting and filtering drop the error row. Both are server side in the infinite row model, and AG
 * Grid answers either by destroying the cache and re-requesting every block, so the failure is about
 * a query that no longer exists and the page it covered may well load this time. The banner is not
 * carried over or moved to the end of the new result: it marks the row where loading stopped, and
 * after a fresh query it marks nothing.
 *
 * Other things reset that cache without an event to listen to — a new `datasource`, a changed
 * `cacheBlockSize`, `columnDefs` carrying a different sort, `purgeInfiniteCache()`. Call
 * {@link clear} when you do any of them. Leaving it out costs a banner that lingers over a row that
 * has yet to load, never one drawn over data.
 *
 * The directive takes over the `fullWidthCellRenderer` grid option, of which AG Grid has exactly
 * one. A renderer already registered there keeps working: the directive draws the banner on the
 * failed row and hands every other full width row back to it. That is how a loading row of your own
 * coexists with the banner — `loadingCellRenderer`, AG Grid's dedicated hook for it, is driven by
 * `rowNode.stub`, which nothing in the Community edition ever sets.
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

        // The infinite row model wires both of these straight to its own `reset()`: the cache is
        // destroyed and every block re-requested. The failure belonged to a request of the previous
        // query and says nothing about the new one, so it is dropped — see `forget()`.
        merge(this.grid.sortChanged, this.grid.filterChanged)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => this.forget());
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
     * `purgeInfiniteCache()` — otherwise the stale error row survives the reload and the grid stays
     * convinced the dataset ended where the failure happened. Sorting and filtering are handled by
     * the directive itself.
     *
     * `setRowCount(startRow, false)` is what restores the grid's "last row unknown" state, undoing
     * the lie told by {@link fail}.
     */
    clear(): void {
        const startRow = this.failedRow();

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (startRow === null || !this.grid.api) return;

        this.forget();
        this.grid.api.setRowCount(startRow, false);
        this.grid.api.redrawRows();
    }

    /**
     * Drops the failure without touching the row count, for when the grid has already discarded the
     * model the failure was recorded against.
     *
     * The row count is deliberately left alone: the row model resets it itself, and the order in
     * which it and this directive receive `sortChanged` is not defined — writing the old count back
     * afterwards would tell a freshly emptied grid that it holds rows it does not have.
     *
     * Forgetting matters beyond the banner disappearing on its own. `isErrorRow` compares row
     * indexes, so a remembered index outlives the rows it referred to: once the new query fills that
     * position, a row with data would be drawn as the error row.
     */
    private forget(): void {
        const startRow = this.failedRow();

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (startRow === null || !this.grid.api) return;

        this.failedRow.set(null);
        this.releaseFocusFromErrorRow(this.grid.api, startRow);
    }

    /**
     * Clicking the retry link leaves AG Grid's focus parked on the error row's index, and the row
     * that takes its place — a skeleton while the page reloads — would come up looking focused.
     * The error row is not data, so the focus it collected goes with it. Focus anywhere else is the
     * user's and is left alone.
     */
    private releaseFocusFromErrorRow(api: GridApi, startRow: number): void {
        if (api.getFocusedCell()?.rowIndex === startRow) {
            api.clearFocusedCell();
        }
    }

    /** Composes with grid options already set by the consumer or by another directive on the same grid. */
    private configureGrid(api: GridApi): void {
        const isFullWidthRow = api.getGridOption('isFullWidthRow');

        api.setGridOption(
            'isFullWidthRow',
            (params: IsFullWidthRowParams): boolean =>
                this.isErrorRow(params.rowNode) || (isFullWidthRow?.(params) ?? false)
        );

        this.keepErrorRowUnselectable(api);

        // One `fullWidthCellRenderer` per grid is all AG Grid offers, and the banner needs it. The
        // renderer the consumer registered is carried into the params instead of being dropped, and
        // the banner component hands every non-error full width row over to it.
        const fallbackRenderer = fullWidthRendererOf(api);
        const fallbackParams = fullWidthParamsOf(api);

        api.setGridOption('fullWidthCellRenderer', KbqAgGridLoadErrorRowComponent);
        api.setGridOption('fullWidthCellRendererParams', {
            labels: this.labels,
            retry: (): void => this.retry(),
            isErrorRow: (node: IRowNode): boolean => this.isErrorRow(node),
            fallbackRenderer,
            fallbackParams
        });
    }

    /**
     * Takes the error row out of selection, writing the callback where AG Grid will actually read it.
     *
     * `rowSelection` given in its object form — the current API — is the only place AG Grid looks;
     * the top level `isRowSelectable` grid option is deprecated and consulted solely for the legacy
     * string form. Writing the top level option unconditionally would leave the error row selectable
     * for every consumer on the current API, and log a deprecation warning at them besides. Without
     * `rowSelection` there is no selection to guard, so nothing is written at all.
     */
    private keepErrorRowUnselectable(api: GridApi): void {
        const rowSelection = api.getGridOption('rowSelection');

        if (!rowSelection) return;

        if (typeof rowSelection === 'string') {
            const existing = api.getGridOption('isRowSelectable');

            api.setGridOption('isRowSelectable', (node: IRowNode): boolean => this.isSelectable(node, existing));

            return;
        }

        const existing = rowSelection.isRowSelectable;

        api.setGridOption('rowSelection', {
            ...rowSelection,
            isRowSelectable: ((node: IRowNode): boolean =>
                this.isSelectable(node, existing)) as typeof rowSelection.isRowSelectable
        });
    }

    private isSelectable(node: IRowNode, existing: IsRowSelectable | undefined): boolean {
        return !this.isErrorRow(node) && (existing?.(node) ?? true);
    }

    /**
     * A row index alone would not be enough. The index is a position in a model the grid is free to
     * throw away — `sortChanged` and `filterChanged` are handled above, but a new `datasource`, a
     * changed `cacheBlockSize` or `columnDefs` carrying a different sort reset the cache just as
     * quietly. Requiring the row to still be empty means a loaded row can never be drawn as the
     * banner, whichever reset went unnoticed; the page under a stale banner then either arrives and
     * takes the row back, or fails again and earns it.
     */
    private isErrorRow(node: IRowNode): boolean {
        return node.data === undefined && node.rowIndex !== null && node.rowIndex === this.failedRow();
    }
}
