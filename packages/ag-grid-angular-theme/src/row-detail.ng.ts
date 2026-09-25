import { SharedResizeObserver } from '@angular/cdk/observers/private';
import { DOCUMENT } from '@angular/common';
import {
    ApplicationRef,
    booleanAttribute,
    ChangeDetectionStrategy,
    Component,
    ComponentRef,
    computed,
    createComponent,
    DestroyRef,
    Directive,
    effect,
    ElementRef,
    EnvironmentInjector,
    inject,
    Injectable,
    InjectionToken,
    Injector,
    input,
    model,
    Provider,
    reflectComponentType,
    signal,
    Type,
    untracked,
    viewChild,
    ViewContainerRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AgGridAngular, ICellRendererAngularComp } from 'ag-grid-angular';
import { ColDef, ColGroupDef, GridApi, ICellRendererParams, IRowNode } from 'ag-grid-community';
import { merge, Subscription } from 'rxjs';
import { kbqMapColDefTree } from './col-defs';
import { KbqAgGridStateStore } from './state-store';

/** Class of the element wrapping the detail component below the row's cells. */
const PANEL_CLASS = 'kbq-ag-grid-row-detail';

/** Class set on every `.ag-row` element (one per pinned/center container) of an expanded row. */
const EXPANDED_ROW_CLASS = 'kbq-ag-grid-row-detail-row';

/** Modifier of {@link EXPANDED_ROW_CLASS} set while `kbqAgGridRowDetailFilled` is on. */
const FILLED_ROW_CLASS = 'kbq-ag-grid-row-detail-row_filled';

/** Modifier of {@link PANEL_CLASS} set while `kbqAgGridRowDetailSticky` is on. */
const STICKY_PANEL_CLASS = 'kbq-ag-grid-row-detail_sticky';

/** Custom property carrying the width of {@link CENTER_VIEWPORT_SELECTOR}, read by the theme in
 * the sticky layout. */
const VIEWPORT_WIDTH_PROPERTY = '--kbq-ag-grid-row-detail-viewport-width';

/** Custom property carrying the row's collapsed height, used by the theme to keep cells on top
 * of an expanded (taller) row and to position the detail panel below them. */
const ROW_HEIGHT_PROPERTY = '--kbq-ag-grid-row-detail-row-height';

/** Prefix of AG Grid's own auto-generated columns (selection checkbox, row numbers, group column),
 * which can never host the expand toggle — they have no `ColDef` of their own in `columnDefs`. */
const AUTO_COLUMN_PREFIX = 'ag-Grid-';

/** Elements considered focusable when moving focus into the expanded part by `Tab`. */
const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Parameters provided to a row detail component via {@link KBQ_AG_GRID_ROW_DETAIL_PARAMS}. */
export type KbqAgGridRowDetailParams = {
    api: GridApi;
    node: IRowNode;
    data: unknown;
    rowIndex: number | null;
    /** Collapses this row and destroys the detail component, e.g. from a close button inside it. */
    collapse: () => void;
};

/**
 * Injection token that provides {@link KbqAgGridRowDetailParams} to the row detail component.
 *
 * @example
 * ```typescript
 * @Component({
 *     template: `<button type="button" (click)="params.collapse()">Close</button>`
 * })
 * export class MyRowDetailComponent {
 *     protected readonly params = inject(KBQ_AG_GRID_ROW_DETAIL_PARAMS);
 * }
 * ```
 */
export const KBQ_AG_GRID_ROW_DETAIL_PARAMS = new InjectionToken<KbqAgGridRowDetailParams>(
    'KBQ_AG_GRID_ROW_DETAIL_PARAMS'
);

/**
 * Component rendered in the expanded part of a row, or a function picking one per row — return
 * `null` to make that row non-expandable (no toggle is rendered for it), mirroring AG Grid
 * Enterprise's `isRowMaster`.
 */
export type KbqAgGridRowDetailComponent = Type<unknown> | ((params: KbqAgGridRowDetailParams) => Type<unknown> | null);

/** Labels of the expand/collapse toggle, announced by screen readers. */
export type KbqAgGridRowDetailLabels = {
    expandRow: string;
    collapseRow: string;
};

/** English labels of the expand/collapse toggle. */
export const KBQ_AG_GRID_ROW_DETAIL_LABELS_EN: KbqAgGridRowDetailLabels = {
    expandRow: 'Expand row',
    collapseRow: 'Collapse row'
};

/** Russian labels of the expand/collapse toggle. */
export const KBQ_AG_GRID_ROW_DETAIL_LABELS_RU: KbqAgGridRowDetailLabels = {
    expandRow: 'Развернуть строку',
    collapseRow: 'Свернуть строку'
};

/**
 * Injection token for {@link KbqAgGridRowDetailLabels}.
 *
 * Defaults to {@link KBQ_AG_GRID_ROW_DETAIL_LABELS_RU}.
 * Override it with {@link kbqAgGridRowDetailLabelsProvider}.
 */
export const KBQ_AG_GRID_ROW_DETAIL_LABELS = new InjectionToken<KbqAgGridRowDetailLabels>(
    'KBQ_AG_GRID_ROW_DETAIL_LABELS',
    { factory: (): KbqAgGridRowDetailLabels => KBQ_AG_GRID_ROW_DETAIL_LABELS_RU }
);

/**
 * Creates a provider that overrides the default expand/collapse toggle labels.
 *
 * @example
 * ```typescript
 * providers: [kbqAgGridRowDetailLabelsProvider(KBQ_AG_GRID_ROW_DETAIL_LABELS_EN)]
 * ```
 */
export const kbqAgGridRowDetailLabelsProvider = (labels: KbqAgGridRowDetailLabels): Provider => ({
    provide: KBQ_AG_GRID_ROW_DETAIL_LABELS,
    useValue: labels
});

/** What {@link KbqAgGridRowDetailCellRenderer} needs from the directive owning the expanded state. */
type KbqAgGridRowDetailToggleHost = {
    labels: () => KbqAgGridRowDetailLabels;
    isExpanded: (id: string) => boolean;
    isExpandable: (node: IRowNode) => boolean;
    toggle: (id: string) => void;
    focusDetail: (id: string) => boolean;
};

/** Whether a `ColDef.cellRenderer` value is an Angular component this renderer can host itself. */
const isAngularCellRenderer = (renderer: unknown): renderer is Type<ICellRendererAngularComp> =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    typeof renderer === 'function' && !!reflectComponentType(renderer as Type<unknown>);

/** Params passed to {@link KbqAgGridRowDetailCellRenderer} by {@link KbqAgGridRowDetail}. */
type KbqAgGridRowDetailCellRendererParams = ICellRendererParams & {
    /** Directive owning the expanded state. Absent when the renderer is placed by the consumer. */
    rowDetail?: KbqAgGridRowDetailToggleHost;
    /** Renderer the wrapped column had before the toggle was injected. */
    kbqInnerRenderer?: unknown;
    /** Params the wrapped column's renderer had before the toggle was injected. */
    kbqInnerParams?: Record<string, unknown>;
};

/**
 * Cell renderer drawing the expand/collapse toggle in front of the cell value.
 *
 * Internal: {@link KbqAgGridRowDetail} injects it into the toggle column together with the
 * `cellRendererParams` it needs, and `kbqAgGridRowDetailToggleColumn` picks which column that is.
 * Setting it as a column's `cellRenderer` by hand renders no toggle at all.
 */
@Component({
    standalone: true,
    selector: 'kbq-ag-grid-row-detail-cell-renderer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'kbq-ag-grid-row-detail-cell-renderer' },
    template: `
        @if (expandable()) {
            <!-- A native <button> gets keyboard (Enter/Space) and focus handling for free —
                 no manual role/tabindex/keydown wiring needed for WCAG 2.1.1 operability. -->
            <button
                type="button"
                class="kbq-ag-grid-row-detail-cell-renderer__toggle"
                [attr.aria-expanded]="expanded()"
                [attr.aria-label]="expanded() ? labels().collapseRow : labels().expandRow"
                (click)="toggle($event)"
                (keydown)="onToggleKeydown($event)"
            >
                <i
                    class="kbq-ag-grid-row-detail-cell-renderer__icon kbq kbq-icon"
                    [class.kbq-chevron-down_16]="expanded()"
                    [class.kbq-chevron-right_16]="!expanded()"
                ></i>
            </button>
        } @else {
            <span class="kbq-ag-grid-row-detail-cell-renderer__toggle-placeholder"></span>
        }
        <ng-container #innerHost />
        @if (!innerComponent()) {
            <span class="kbq-ag-grid-row-detail-cell-renderer__value">{{ value() }}</span>
        }
    `
})
class KbqAgGridRowDetailCellRenderer implements ICellRendererAngularComp {
    /** Anchor for the renderer the column had before the toggle was injected. */
    private readonly innerHost = viewChild('innerHost', { read: ViewContainerRef });
    /** Used until the directive's own (overridable) labels arrive with the cell params. */
    private readonly defaultLabels = inject(KBQ_AG_GRID_ROW_DETAIL_LABELS);

    protected readonly rowDetail = signal<KbqAgGridRowDetailToggleHost | null>(null);
    protected readonly rowId = signal<string | null>(null);
    protected readonly value = signal<string>('');
    protected readonly expandable = signal(false);
    protected readonly expanded = computed(() => {
        const rowDetail = this.rowDetail();
        const rowId = this.rowId();

        return !!rowDetail && !!rowId && rowDetail.isExpanded(rowId);
    });
    protected readonly labels = computed(() => this.rowDetail()?.labels() ?? this.defaultLabels);
    /** The wrapped column's own renderer, when it is an Angular component — anything else
     * (a string name or a plain JS renderer class) falls back to the cell's formatted value. */
    protected readonly innerComponent = signal<Type<ICellRendererAngularComp> | null>(null);

    private readonly innerParams = signal<ICellRendererParams | null>(null);
    private innerRef: ComponentRef<ICellRendererAngularComp> | null = null;

    constructor() {
        effect(() => {
            const host = this.innerHost();
            const component = this.innerComponent();
            const params = this.innerParams();

            untracked(() => this.renderInner(host, component, params));
        });

        inject(DestroyRef).onDestroy(() => this.innerRef?.destroy());
    }

    agInit(params: KbqAgGridRowDetailCellRendererParams): void {
        this.update(params);
    }

    refresh(params: KbqAgGridRowDetailCellRendererParams): boolean {
        this.update(params);

        return true;
    }

    /** Toggles the row this cell belongs to. Stops propagation so the click does not also
     * select the row (see `kbqAgGridSelectRowsByCtrlClick` and AG Grid's own click selection). */
    protected toggle(event: MouseEvent): void {
        event.stopPropagation();

        const rowId = this.rowId();

        if (rowId) this.rowDetail()?.toggle(rowId);
    }

    /** Moves focus from the toggle into the expanded part instead of the next cell. */
    protected onToggleKeydown(event: KeyboardEvent): void {
        if (event.key !== 'Tab' || event.shiftKey || !this.expanded()) return;

        const rowId = this.rowId();

        if (rowId && this.rowDetail()?.focusDetail(rowId)) event.preventDefault();
    }

    private update(params: KbqAgGridRowDetailCellRendererParams): void {
        const rowDetail = params.rowDetail ?? null;
        const { kbqInnerRenderer, kbqInnerParams } = params;

        // untracked: `refresh` may be called from within an Angular effect context (the grid
        // refreshes cells from one), and signal writes are not allowed there.
        untracked(() => {
            this.rowDetail.set(rowDetail);
            this.rowId.set(params.node.id ?? null);
            this.value.set(params.valueFormatted ?? String(params.value ?? ''));
            this.expandable.set(!!rowDetail?.isExpandable(params.node));
            this.innerComponent.set(isAngularCellRenderer(kbqInnerRenderer) ? kbqInnerRenderer : null);
            this.innerParams.set({ ...params, ...(kbqInnerParams ?? {}) });
        });
    }

    private renderInner(
        host: ViewContainerRef | undefined,
        component: Type<ICellRendererAngularComp> | null,
        params: ICellRendererParams | null
    ): void {
        if (!host) return;

        if (!component) {
            this.innerRef?.destroy();
            this.innerRef = null;

            return;
        }

        let { innerRef } = this;
        let created = false;

        if (innerRef?.componentType !== component) {
            innerRef?.destroy();
            innerRef = host.createComponent(component);
            created = true;
        }

        if (params) {
            // A renderer that is already up gets `refresh`, the way AG Grid itself would call it:
            // another `agInit` would repeat whatever the consumer does on init, subscriptions and
            // requests included. Only a renderer that declines the refresh is built again.
            if (!created && !innerRef.instance.refresh(params)) {
                innerRef.destroy();
                innerRef = host.createComponent(component);
                created = true;
            }

            if (created) innerRef.instance.agInit(params);
        }

        this.innerRef = innerRef;
    }
}

/** Distinguishes a component class from a per-row selector function — both are functions at
 * runtime, but only a component carries Angular's component metadata. */
const isAngularComponentType = (component: KbqAgGridRowDetailComponent): component is Type<unknown> =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    !!reflectComponentType(component as Type<unknown>);

/**
 * Storage interface for persisting and retrieving the ids (see `getRowId`) of the expanded rows.
 *
 * Supports both synchronous and Promise-based implementations.
 */
export type KbqAgGridRowDetailStateStore = KbqAgGridStateStore<string[]>;

/**
 * {@link KbqAgGridRowDetailStateStore} implementation backed by `localStorage`.
 */
@Injectable({ providedIn: 'root' })
export class KbqAgGridRowDetailStateLocalStorageStore implements KbqAgGridRowDetailStateStore {
    private readonly localStorage = window.localStorage;

    getItem(key: string): string[] | null {
        const item = this.localStorage.getItem(key);

        if (!item) return null;

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            return JSON.parse(item) as string[];
        } catch {
            return null;
        }
    }

    setItem(key: string, value: string[]): void {
        this.localStorage.setItem(key, JSON.stringify(value));
    }

    removeItem(key: string): void {
        this.localStorage.removeItem(key);
    }
}

/**
 * {@link KbqAgGridRowDetailStateStore} implementation backed by URL query parameters.
 *
 * @example
 * ```typescript
 * providers: [kbqAgGridRowDetailStateStoreProvider(KbqAgGridRowDetailStateQueryParamsStore)]
 * ```
 */
@Injectable({ providedIn: 'root' })
export class KbqAgGridRowDetailStateQueryParamsStore implements KbqAgGridRowDetailStateStore {
    private readonly router = inject(Router);
    private readonly location = window.location;

    getItem(key: string): string[] | null {
        const item = new URLSearchParams(this.location.search).get(key);

        if (!item) return null;

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            return JSON.parse(item) as string[];
        } catch {
            return null;
        }
    }

    async setItem(key: string, value: string[]): Promise<void> {
        await this.router.navigate([], {
            queryParams: { [key]: JSON.stringify(value) },
            queryParamsHandling: 'merge',
            replaceUrl: true
        });
    }

    async removeItem(key: string): Promise<void> {
        await this.router.navigate([], {
            queryParams: { [key]: null },
            queryParamsHandling: 'merge',
            replaceUrl: true
        });
    }
}

/**
 * Injection token for {@link KbqAgGridRowDetailStateStore}.
 *
 * Defaults to {@link KbqAgGridRowDetailStateLocalStorageStore}.
 * Override it with {@link kbqAgGridRowDetailStateStoreProvider}.
 */
export const KBQ_AG_GRID_ROW_DETAIL_STATE_STORE = new InjectionToken<KbqAgGridRowDetailStateStore>(
    'KBQ_AG_GRID_ROW_DETAIL_STATE_STORE',
    { factory: (): KbqAgGridRowDetailStateStore => inject(KbqAgGridRowDetailStateLocalStorageStore) }
);

/**
 * Creates an Angular {@link Provider} that binds {@link KBQ_AG_GRID_ROW_DETAIL_STATE_STORE}
 * to the given store class or instance.
 *
 * @example
 * ```typescript
 * providers: [kbqAgGridRowDetailStateStoreProvider(KbqAgGridRowDetailStateQueryParamsStore)]
 * ```
 */
export const kbqAgGridRowDetailStateStoreProvider = (
    store: Type<KbqAgGridRowDetailStateStore> | KbqAgGridRowDetailStateStore
): Provider => {
    return store instanceof Type
        ? { provide: KBQ_AG_GRID_ROW_DETAIL_STATE_STORE, useClass: store }
        : { provide: KBQ_AG_GRID_ROW_DETAIL_STATE_STORE, useValue: store };
};

/** A detail panel alive for one expanded row. */
type KbqAgGridRowDetailPanel = {
    /** The consumer's component instance. Kept alive while the row stays expanded, even while the
     * row is scrolled out of view and AG Grid has destroyed its DOM — re-creating it would reset
     * the component's own state and repeat whatever it loads on init. */
    readonly componentRef: ComponentRef<unknown>;
    /** Wrapper inserted below the row's cells; hosts `componentRef`'s element. */
    readonly element: HTMLElement;
    readonly node: IRowNode;
    /** Height the row had while collapsed — cells keep it, the panel starts below it. Resolved
     * lazily: a row that has never been displayed (filtered out, or expanded before the first
     * render) has no height of its own yet, and 0 would collapse its cells. */
    baseHeight: number | null;
    /** Measured (or fixed, see `kbqAgGridRowDetailHeight`) height of the panel. */
    height: number;
    /** Alive while the panel's height is measured instead of fixed by `kbqAgGridRowDetailHeight`. */
    resize: Subscription | null;
};

/** `colId` of a `ColDef`, defaulting to `field` exactly like AG Grid's own default. */
const colDefId = (def: ColDef): string | undefined => def.colId ?? def.field;

/** First leaf `ColDef` in a `columnDefs` tree matching `predicate`. */
const findColDef = (
    defs: readonly (ColDef | ColGroupDef)[],
    predicate: (def: ColDef) => boolean
): ColDef | undefined => {
    for (const def of defs) {
        if (!('children' in def)) {
            if (predicate(def)) return def;

            continue;
        }

        const found = findColDef(def.children, predicate);

        if (found) return found;
    }

    return undefined;
};

/** Whether a `ColDef` already hosts the expand toggle. */
const isWrappedColDef = (def: ColDef): boolean => def.cellRenderer === KbqAgGridRowDetailCellRenderer;
/** Restores the renderer a column had before {@link KbqAgGridRowDetail} injected its toggle. */
const unwrapColDef = (def: ColDef): ColDef => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const params = def.cellRendererParams as Partial<KbqAgGridRowDetailCellRendererParams> | undefined;

    return { ...def, cellRenderer: params?.kbqInnerRenderer, cellRendererParams: params?.kbqInnerParams };
};

/**
 * Directive that expands a row to show a custom component below its cells, without AG Grid
 * Enterprise's Master Detail.
 *
 * The expanded part is not a separate grid row: the row itself grows by the height of the
 * detail component, so row indexes, row counts, selection, sorting, filtering, pagination and
 * CSV export stay exactly as they are without this directive.
 *
 * The toggle is rendered in the first non-pinned column (override with
 * `kbqAgGridRowDetailToggleColumn`), in front of that column's value. The component is created
 * on expand and destroyed on collapse, and receives {@link KbqAgGridRowDetailParams} via the
 * {@link KBQ_AG_GRID_ROW_DETAIL_PARAMS} injection token.
 *
 * **Height:** the component's own host element defines the height of the expanded part — it is
 * measured and reported to the grid, so a component that grows while loading its data (skeleton,
 * then content) grows the row with it. Set `kbqAgGridRowDetailHeight` to use a fixed height
 * instead and skip the measurement.
 *
 * **Recommended:** set `getRowId`, since the expanded rows are tracked by row id.
 *
 * **Known limitations:**
 * - Not supported with the infinite row model, which gives every row the same height.
 * - The toggle column must not use `cellRendererSelector`: AG Grid gives it precedence over the
 *   `cellRenderer` this directive injects, so the toggle would not be rendered.
 * - With pinned columns, the expanded part spans the center (non-pinned) section only; the
 *   pinned sections of the row stay empty.
 * - Not combinable with `kbqAgGridRowGroup`: that directive rebuilds `columnDefs` from its own
 *   snapshot of the consumer's definitions, dropping the injected toggle, which this directive
 *   then re-injects — the toggle column would be rewritten on every grouping change.
 * - Not combinable with `kbqAgGridRowActions` while `kbqAgGridRowDetailSticky` is on: that
 *   directive floats its overlay into the same row element, and a float cannot rise above the
 *   expanded part below the cells, so the actions would be pushed under it.
 * - `kbqAgGridRowDetailSticky` is not supported with `domLayout="print"`, where AG Grid positions
 *   rows relatively and the offset of the expanded part collapses out of the row.
 *
 * @example
 * ```html
 * <ag-grid-angular
 *   #rowDetail="kbqAgGridRowDetail"
 *   kbqAgGridTheme
 *   kbqAgGridRowDetail
 *   [getRowId]="getRowId"
 *   [kbqAgGridRowDetailComponent]="detailComponent"
 *   [(kbqAgGridRowDetailExpanded)]="expandedIds"
 * />
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridRowDetail]',
    exportAs: 'kbqAgGridRowDetail'
})
export class KbqAgGridRowDetail implements KbqAgGridRowDetailToggleHost {
    private readonly grid = inject(AgGridAngular);
    private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly applicationRef = inject(ApplicationRef);
    private readonly environmentInjector = inject(EnvironmentInjector);
    private readonly document = inject(DOCUMENT);
    private readonly destroyRef = inject(DestroyRef);
    private readonly sharedResizeObserver = inject(SharedResizeObserver);

    /** Component rendered in the expanded part, or a function picking one per row. */
    readonly component = input.required<KbqAgGridRowDetailComponent>({ alias: 'kbqAgGridRowDetailComponent' });

    /**
     * Collapses the previously expanded row when another one is expanded. Set it to `false` to
     * keep several rows expanded at once. Governs expanding only: a persisted state (see
     * `kbqAgGridRowDetailState`) is restored with every row it holds.
     *
     * @default true
     */
    readonly singleExpand = input(true, { transform: booleanAttribute, alias: 'kbqAgGridRowDetailSingleExpand' });

    /**
     * Keeps the expanded part within the visible width of the grid: it stays put while the columns
     * scroll horizontally and scrolls its own content when that does not fit. Set it to `false` to
     * stretch the expanded part across every column instead.
     *
     * @default true
     */
    readonly sticky = input(true, { transform: booleanAttribute, alias: 'kbqAgGridRowDetailSticky' });

    /** `colId` of the column hosting the expand toggle. Defaults to the first non-pinned column. */
    readonly toggleColumn = input<string | undefined>(undefined, { alias: 'kbqAgGridRowDetailToggleColumn' });

    /**
     * Fills an expanded row with `--kbq-background-contrast-less` and stops it from reacting to
     * hover, active, selection and focus. Collapsed rows keep the default states.
     *
     * @default false
     */
    readonly filled = input(false, { transform: booleanAttribute, alias: 'kbqAgGridRowDetailFilled' });

    /** Fixed height (px) of the expanded part. Omit to measure the detail component's host instead. */
    readonly detailHeight = input<number | undefined>(undefined, { alias: 'kbqAgGridRowDetailHeight' });

    /** Ids (see `getRowId`) of the expanded rows. Supports two-way binding. */
    readonly expanded = model<string[]>([], { alias: 'kbqAgGridRowDetailExpanded' });

    /**
     * Key under which the expanded rows are stored. Must be unique per grid.
     * Omit to disable persistence (the default).
     */
    readonly stateKey = input<string | undefined>(undefined, { alias: 'kbqAgGridRowDetailState' });

    /** Labels of the expand/collapse toggle. Defaults to {@link KBQ_AG_GRID_ROW_DETAIL_LABELS}. */
    readonly labels = input(inject(KBQ_AG_GRID_ROW_DETAIL_LABELS), { alias: 'kbqAgGridRowDetailLabels' });

    /** Store used to persist and restore the expanded rows. Defaults to {@link KBQ_AG_GRID_ROW_DETAIL_STATE_STORE}. */
    readonly stateStore = input(inject(KBQ_AG_GRID_ROW_DETAIL_STATE_STORE), {
        alias: 'kbqAgGridRowDetailStateStore'
    });

    private readonly api = signal<GridApi | null>(null);
    private readonly panels = new Map<string, KbqAgGridRowDetailPanel>();
    private readonly stateRestored = signal(false);
    /** Rows that were collapsed and still have to be given their collapsed height back. */
    private readonly collapsedNodes = new Map<IRowNode, number>();
    private heightUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
    private viewportWidth: number | null = null;
    private toggleColId: string | null = null;
    private destroyed = false;

    constructor() {
        this.grid.gridReady.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ api }) => {
            this.api.set(api);
            this.syncToggleColumn(api);
            this.syncViewportWidth();
        });

        // Everything that changes the width of the center section: the grid itself resizing, and
        // columns being pinned, resized, shown or hidden without the grid changing size.
        merge(
            this.sharedResizeObserver.observe(this.elementRef.nativeElement),
            this.grid.gridSizeChanged,
            this.grid.columnPinned,
            this.grid.columnResized,
            this.grid.displayedColumnsChanged,
            // A changed row count makes the vertical scrollbar appear or disappear, which narrows
            // the center section without resizing the grid and without touching the columns.
            this.grid.modelUpdated
        )
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => this.syncViewportWidth());

        // Subscribed here, in the constructor, rather than from inside the `gridReady` callback:
        // ag-grid-angular only defers native events for outputs that already have a subscriber, so
        // a listener registered later can miss `firstDataRendered` permanently.
        this.grid.firstDataRendered.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => void this.restoreState());

        // Rendered row elements are re-created while scrolling, sorting, filtering and on data
        // updates: re-attach the panels that are alive to whatever element now carries their row.
        merge(this.grid.viewportChanged, this.grid.modelUpdated, this.grid.firstDataRendered)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => this.sync());

        merge(this.grid.columnMoved, this.grid.columnPinned, this.grid.columnVisible, this.grid.newColumnsLoaded)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
                const api = this.api();

                if (api) this.syncToggleColumn(api);
            });

        effect(() => {
            this.expanded();
            this.component();
            this.filled();
            this.sticky();

            untracked(() => this.sync());
        });

        effect(() => {
            this.sticky();

            untracked(() => this.syncViewportWidth());
        });

        effect(() => {
            const detailHeight = this.detailHeight();

            untracked(() => this.applyDetailHeight(detailHeight));
        });

        // The toggle lives in a column of its own choosing, so a new `kbqAgGridRowDetailToggleColumn`
        // has to move it right away instead of waiting for an unrelated column event.
        effect(() => {
            this.toggleColumn();

            untracked(() => {
                const api = this.api();

                if (api) this.syncToggleColumn(api);
            });
        });

        // Whether a row is expandable at all comes from `kbqAgGridRowDetailComponent`, so a new
        // component (or selector function) has to be re-evaluated in the cells already rendered.
        effect(() => {
            this.component();

            untracked(() => {
                const api = this.api();

                if (api && this.toggleColId) api.refreshCells({ columns: [this.toggleColId], force: true });
            });
        });

        effect(() => {
            const key = this.stateKey();
            const ids = this.expanded();

            if (!key || !this.stateRestored()) return;

            untracked(() => {
                const store = this.stateStore();

                if (ids.length === 0) {
                    void store.removeItem(key);
                } else {
                    void store.setItem(key, [...ids]);
                }
            });
        });

        this.destroyRef.onDestroy(() => {
            this.destroyed = true;
            this.elementRef.nativeElement.style.removeProperty(VIEWPORT_WIDTH_PROPERTY);

            if (this.heightUpdateTimeout !== null) clearTimeout(this.heightUpdateTimeout);

            for (const [id, panel] of this.panels) this.destroyPanel(id, panel);
        });
    }

    /** Whether the row with the given id is expanded. */
    isExpanded(id: string): boolean {
        return this.expanded().includes(id);
    }

    /** Whether the row can be expanded, i.e. `kbqAgGridRowDetailComponent` resolves a component for it. */
    isExpandable(node: IRowNode): boolean {
        const api = this.api();

        return !!api && !!this.resolveComponent(this.makeParams(api, node));
    }

    /** Expands the row with the given id. */
    expand(id: string): void {
        if (this.isExpanded(id)) return;

        this.expanded.set(this.singleExpand() ? [id] : [...this.expanded(), id]);
    }

    /** Collapses the row with the given id. */
    collapse(id: string): void {
        if (!this.isExpanded(id)) return;

        this.expanded.set(this.expanded().filter((expandedId) => expandedId !== id));
    }

    /** Expands the row with the given id when it is collapsed, and collapses it when it is expanded. */
    toggle(id: string): void {
        if (this.isExpanded(id)) {
            this.collapse(id);
        } else {
            this.expand(id);
        }
    }

    /** Collapses every expanded row. */
    collapseAll(): void {
        if (this.expanded().length === 0) return;

        this.expanded.set([]);
    }

    /** Collapses every expanded row and removes the persisted state for the current key. */
    reset(): void {
        const key = this.stateKey();
        const wasExpanded = this.expanded().length > 0;

        this.collapseAll();

        // Collapsing already drops the stored value through the save effect; with nothing expanded
        // that effect never runs, so the stored value is dropped here instead.
        if (key && !wasExpanded) void this.stateStore().removeItem(key);
    }

    /**
     * Moves focus to the first focusable element inside the expanded part of the given row.
     * Returns `false` when the row is collapsed or holds nothing focusable.
     */
    focusDetail(id: string): boolean {
        const panel = this.panels.get(id);

        if (!panel) return false;

        const focusable = this.focusableElements(panel.element).at(0);

        if (!focusable) return false;

        focusable.focus();

        return true;
    }

    /** Reconciles alive panels with the expanded row ids and with the currently rendered rows. */
    private sync(): void {
        const api = this.api();

        if (!api || this.destroyed) return;

        const expanded = new Set(this.expanded());

        for (const [id, panel] of this.panels) {
            // A row that is only filtered out keeps its node, so this is about rows that left the
            // model for good: their panel would otherwise stay alive with its component and
            // subscription, and its height would keep being written to a node nobody displays.
            if (!expanded.has(id) || !api.getRowNode(id)) {
                this.destroyPanel(id, panel);

                continue;
            }

            // The selector may now resolve a different component (or none) for this row.
            if (this.resolveComponent(this.makeParams(api, panel.node)) !== panel.componentRef.componentType) {
                this.destroyPanel(id, panel);
            }
        }

        for (const id of expanded) {
            if (this.panels.has(id)) continue;

            const node = api.getRowNode(id);

            // The row may simply not be in the model yet (data still loading, or filtered out):
            // the panel is created by a later `sync` once the node shows up.
            if (node) this.createPanel(api, id, node);
        }

        for (const [id, panel] of this.panels) this.attachPanel(id, panel);

        // A panel whose row had no height yet needs another pass once the row shows up.
        if (Array.from(this.panels.values()).some(({ baseHeight }) => baseHeight === null)) {
            this.scheduleHeightUpdate();
        }
    }

    private makeParams(api: GridApi, node: IRowNode): KbqAgGridRowDetailParams {
        return {
            api,
            node,
            data: node.data,
            rowIndex: node.rowIndex,
            collapse: (): void => {
                if (node.id !== undefined) this.collapse(node.id);
            }
        };
    }

    private createPanel(api: GridApi, id: string, node: IRowNode): void {
        const params = this.makeParams(api, node);
        const component = this.resolveComponent(params);

        if (!component) return;

        const componentRef = createComponent(component, {
            environmentInjector: this.environmentInjector,
            elementInjector: Injector.create({
                providers: [{ provide: KBQ_AG_GRID_ROW_DETAIL_PARAMS, useValue: params }]
            })
        });

        this.applicationRef.attachView(componentRef.hostView);

        const element = this.document.createElement('div');

        element.classList.add(PANEL_CLASS);
        element.addEventListener('keydown', (event: KeyboardEvent) => this.onPanelKeydown(event, id));
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const componentElement: HTMLElement = componentRef.location.nativeElement;

        element.appendChild(componentElement);

        const panel: KbqAgGridRowDetailPanel = {
            componentRef,
            element,
            node,
            baseHeight: node.rowHeight ?? null,
            height: this.detailHeight() ?? 0,
            resize: null
        };

        this.panels.set(id, panel);
        this.collapsedNodes.delete(node);
        this.observePanel(panel);
        this.scheduleHeightUpdate();
    }

    private destroyPanel(id: string, panel: KbqAgGridRowDetailPanel): void {
        // Focus inside the panel would go away together with the destroyed component, e.g. after a
        // close button inside it collapsed the row: it is handed back to the row's toggle below.
        const hadFocus = !this.destroyed && panel.element.contains(this.document.activeElement);

        this.panels.delete(id);
        this.unobservePanel(panel);
        panel.element.remove();
        this.applicationRef.detachView(panel.componentRef.hostView);
        panel.componentRef.destroy();

        for (const rowElement of this.rowElements(id)) {
            rowElement.classList.remove(EXPANDED_ROW_CLASS, FILLED_ROW_CLASS);
            rowElement.style.removeProperty(ROW_HEIGHT_PROPERTY);
        }

        if (panel.baseHeight !== null) this.collapsedNodes.set(panel.node, panel.baseHeight);

        this.scheduleHeightUpdate();

        if (hadFocus) this.toggleElement(id)?.focus();
    }

    /** Puts the panel into the row's center-section element, marking every section of the row as
     * expanded. Rows are re-created by AG Grid while scrolling, so this runs on every `sync`;
     * moving the wrapper element keeps the detail component itself alive. */
    private attachPanel(id: string, panel: KbqAgGridRowDetailPanel): void {
        const sticky = this.sticky();
        const rowElements = this.rowElements(id);

        panel.element.classList.toggle(STICKY_PANEL_CLASS, sticky);

        // The sticky layout scrolls the panel's own content, and a scrollable region has to be
        // reachable by keyboard even when the detail component holds nothing focusable (AXE's
        // `scrollable-region-focusable`).
        if (sticky) {
            panel.element.setAttribute('tabindex', '0');
        } else {
            panel.element.removeAttribute('tabindex');
        }

        if (rowElements.length === 0) {
            panel.element.remove();

            return;
        }

        for (const rowElement of rowElements) {
            rowElement.classList.add(EXPANDED_ROW_CLASS);
            rowElement.classList.toggle(FILLED_ROW_CLASS, this.filled());

            // Until the collapsed height is known, the theme falls back to `--ag-row-height`.
            if (panel.baseHeight !== null) {
                rowElement.style.setProperty(ROW_HEIGHT_PROPERTY, `${panel.baseHeight}px`);
            }
        }

        const centerRowElement = rowElements.find((rowElement) => rowElement.closest('.ag-center-cols-container'));

        if (centerRowElement && panel.element.parentElement !== centerRowElement) {
            centerRowElement.appendChild(panel.element);
        }
    }

    /**
     * Publishes the width of the grid's center section to the theme, which the sticky layout uses
     * instead of the full width of the columns. Read from the api rather than from the DOM of the
     * grid, the same way `KbqAgGridTheme` reads it: the range the body is laid out with, without
     * the rounding of `clientWidth` and without depending on AG Grid's own class names.
     */
    private syncViewportWidth(): void {
        const api = this.api();
        const host = this.elementRef.nativeElement;

        if (!this.sticky()) {
            this.viewportWidth = null;
            host.style.removeProperty(VIEWPORT_WIDTH_PROPERTY);

            return;
        }

        if (!api || api.isDestroyed()) return;

        const { left, right } = api.getHorizontalPixelRange();
        const width = right - left;

        // A grid that is hidden or not laid out yet measures nothing. Keeping the last known width
        // leaves the theme's own `100%` fallback in charge instead of collapsing the panel to zero.
        if (width <= 0 || width === this.viewportWidth) return;

        this.viewportWidth = width;
        host.style.setProperty(VIEWPORT_WIDTH_PROPERTY, `${width}px`);
    }

    private rowElements(id: string): HTMLElement[] {
        const host = this.elementRef.nativeElement;

        return Array.from(host.querySelectorAll<HTMLElement>(`.ag-row[row-id="${CSS.escape(id)}"]`)).filter(
            // An expanded panel can host a grid of its own, whose rows carry `row-id` too and can
            // collide with this grid's ids (both grids number their rows from 0 without `getRowId`).
            (element) => element.closest('ag-grid-angular') === host
        );
    }

    /**
     * Queues a row height update for the next task. Deliberately not applied right away: AG Grid
     * must not be asked to re-measure rows from inside its own render pass (this directive syncs
     * on `viewportChanged`/`modelUpdated`) or from a `ResizeObserver` callback, or it leaves rows
     * unrendered. AG Grid Enterprise defers its own detail row auto height the same way.
     */
    private scheduleHeightUpdate(): void {
        if (this.destroyed || this.heightUpdateTimeout !== null) return;

        this.heightUpdateTimeout = setTimeout(() => {
            this.heightUpdateTimeout = null;
            this.applyRowHeights();
        });
    }

    private applyRowHeights(): void {
        const api = this.api();

        // The update is queued for the next task, and the grid can be destroyed before it runs.
        if (!api || this.destroyed || api.isDestroyed()) return;

        const heights: [IRowNode, number][] = [...this.collapsedNodes];

        this.collapsedNodes.clear();

        for (const panel of this.panels.values()) {
            // Captured on the first pass where the row reports a height of its own — never after
            // this directive has written one, since `??=` leaves a resolved value alone.
            panel.baseHeight ??= panel.node.rowHeight ?? null;

            if (panel.baseHeight !== null) heights.push([panel.node, panel.baseHeight + panel.height]);
        }

        const changed = heights.filter(([node, height]) => node.rowHeight !== height);

        for (const [node, height] of changed) node.setRowHeight(height);

        if (changed.length === 0) return;

        api.onRowHeightChanged();

        // Taller rows can push the grid into showing a vertical scrollbar, which takes its width
        // from the center section. No public event reports it, so the width is re-read here, right
        // after the grid has laid the new heights out.
        this.syncViewportWidth();
    }

    /**
     * Re-applies a changed `kbqAgGridRowDetailHeight` to the panels already open: a fixed height
     * replaces the measured one, and clearing the input starts measuring again.
     */
    private applyDetailHeight(detailHeight: number | undefined): void {
        if (this.panels.size === 0) return;

        for (const panel of this.panels.values()) {
            if (detailHeight === undefined) {
                const measured = Math.round(panel.element.getBoundingClientRect().height);

                // Zero means the panel is detached (its row is scrolled out of view): keep the
                // height it had and let the observer report the real one once it is back.
                if (measured > 0) panel.height = measured;

                this.observePanel(panel);
            } else {
                this.unobservePanel(panel);
                panel.height = detailHeight;
            }
        }

        this.scheduleHeightUpdate();
    }

    /** Keeps the row's height in sync with the detail component's own height, unless it is fixed
     * by `kbqAgGridRowDetailHeight`. */
    private observePanel(panel: KbqAgGridRowDetailPanel): void {
        if (this.detailHeight() !== undefined || panel.resize) return;

        // Border box, so that a scrollbar inside a sticky panel is part of the height the row has
        // to give it, and so that the observer wakes up when only that box changes.
        panel.resize = this.sharedResizeObserver
            .observe(panel.element, { box: 'border-box' })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((entries) => this.onPanelResize(panel, entries));
    }

    private unobservePanel(panel: KbqAgGridRowDetailPanel): void {
        panel.resize?.unsubscribe();
        panel.resize = null;
    }

    private onPanelResize(panel: KbqAgGridRowDetailPanel, entries: readonly ResizeObserverEntry[]): void {
        if (this.destroyed) return;

        const entry = entries.find(({ target }) => target === panel.element);

        if (!entry) return;

        // The size the observer reports is in layout pixels: `getBoundingClientRect` would hand
        // back the visual one, scaled by any transformed ancestor of the grid.
        const height = Math.round(entry.borderBoxSize.at(0)?.blockSize ?? 0);

        // A panel detached from the DOM (its row is scrolled out of view) measures zero: the row
        // keeps the height it had, so scrolling back does not re-measure from scratch.
        if (height === 0 || height === panel.height) return;

        panel.height = height;
        this.scheduleHeightUpdate();
    }

    private onPanelKeydown(event: KeyboardEvent, id: string): void {
        if (event.key !== 'Tab' || !event.shiftKey) return;

        const panel = this.panels.get(id);

        if (!panel) return;

        const first = this.focusableElements(panel.element).at(0);

        // Only the first focusable element hands focus back to the toggle; inside the panel,
        // Shift+Tab keeps its native behaviour.
        if (first && this.document.activeElement !== first) return;

        const toggle = this.toggleElement(id);

        if (!toggle) return;

        toggle.focus();
        event.preventDefault();
    }

    private toggleElement(id: string): HTMLElement | undefined {
        return this.rowElements(id)
            .map((rowElement) => rowElement.querySelector<HTMLElement>('.kbq-ag-grid-row-detail-cell-renderer__toggle'))
            .find((element): element is HTMLElement => !!element);
    }

    private focusableElements(root: HTMLElement): HTMLElement[] {
        return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
            // `offsetParent` is null for a visible `position: fixed` element, hence the rects check.
            (element) => element.offsetParent !== null || element.getClientRects().length > 0
        );
    }

    private resolveComponent(params: KbqAgGridRowDetailParams): Type<unknown> | null {
        const component = this.component();

        return isAngularComponentType(component) ? component : component(params);
    }

    /**
     * Injects the toggle renderer into the toggle column, restoring the previously wrapped one.
     * Reads the current `columnDefs` right before writing and keeps everything else untouched, so
     * a consumer's own `columnDefs` update (which arrives unwrapped) is re-wrapped rather than
     * overwritten.
     */
    private syncToggleColumn(api: GridApi): void {
        const defs = api.getGridOption('columnDefs');
        const toggleColId = this.resolveToggleColId(api);

        if (!defs || !toggleColId) return;

        this.toggleColId = toggleColId;

        const target = findColDef(defs, (def) => colDefId(def) === toggleColId);
        const wrapped = findColDef(defs, isWrappedColDef);

        // Nothing to do when the toggle column is already the wrapped one — including right after
        // this directive's own `setGridOption('columnDefs')` call, which re-enters here through
        // `newColumnsLoaded`. A consumer's own `columnDefs` update arrives unwrapped instead and
        // is wrapped again below.
        if (!target || (wrapped && colDefId(wrapped) === toggleColId)) return;

        api.setGridOption(
            'columnDefs',
            kbqMapColDefTree(defs, (def) => {
                if (colDefId(def) === toggleColId) return this.wrapColDef(def);

                return isWrappedColDef(def) ? unwrapColDef(def) : def;
            })
        );
    }

    private resolveToggleColId(api: GridApi): string | null {
        const explicit = this.toggleColumn();

        if (explicit) return explicit;

        const column = api
            .getAllDisplayedColumns()
            .find((col) => !col.getPinned() && !col.getColId().startsWith(AUTO_COLUMN_PREFIX));

        return column?.getColId() ?? this.toggleColId;
    }

    private wrapColDef(def: ColDef): ColDef {
        return {
            ...def,
            cellRenderer: KbqAgGridRowDetailCellRenderer,
            cellRendererParams: {
                rowDetail: this,
                kbqInnerRenderer: def.cellRenderer,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                kbqInnerParams: def.cellRendererParams
            } satisfies Partial<KbqAgGridRowDetailCellRendererParams>
        };
    }

    private async restoreState(): Promise<void> {
        const key = this.stateKey();

        if (!key) {
            this.stateRestored.set(true);

            return;
        }

        const stored: unknown = await this.stateStore().getItem(key);

        // The store's `getItem` can be a slow, consumer-provided Promise that resolves after this
        // directive has already been torn down; bail out before touching the grid.
        if (this.destroyed) return;

        // A store returns whatever `JSON.parse` produced, so a hand-edited url or a foreign value
        // left under the same key can be anything: a bare string would be spread into
        // single-character ids, and a value without `filter` would break `collapse()`.
        const ids = Array.isArray(stored) && stored.every((id): id is string => typeof id === 'string') ? stored : null;

        // Restored as stored, even with `kbqAgGridRowDetailSingleExpand` on: trimming here would go
        // straight back into the store through the save effect and drop the other ids for good.
        if (ids && ids.length > 0) this.expanded.set(ids);

        this.stateRestored.set(true);
    }
}
