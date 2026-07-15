import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    Directive,
    effect,
    ElementRef,
    inject,
    InjectionToken,
    input,
    isDevMode,
    model,
    output,
    Provider,
    signal,
    untracked,
    viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular, ICellRendererAngularComp, IHeaderAngularComp } from 'ag-grid-angular';
import {
    CellRendererSelectorResult,
    CheckboxSelectionCallbackParams,
    ColDef,
    ColGroupDef,
    ColumnState,
    GridApi,
    ICellRendererParams,
    IHeaderParams,
    IRowNode,
    RowClassRules,
    SelectionColumnDef,
    SortDirection
} from 'ag-grid-community';

/** A plain input data row — any object with string keys. */
type RowData = Record<string, unknown>;

/** Extracts a stable unique identifier from a data row, used to track selection across
 * collapse/expand cycles. See `KbqAgGridRowGroup`'s `rowId` input. */
export type KbqAgGridRowGroupRowId = (row: RowData) => string | number;

/** Selection state of a row group or of the full dataset (see `overallSelectionState`). */
export type KbqAgGridRowGroupSelectionState = 'checked' | 'unchecked' | 'indeterminate';

/**
 * Ordered raw field values identifying a group and its ancestors — one value per active
 * `kbqAgGridRowGroupCols` level, outermost first — e.g. `['Russia', 'Diving']` for
 * `kbqAgGridRowGroupCols` `['country', 'sport']`. Passed to `KbqAgGridRowGroup.setExpanded`.
 */
export type KbqAgGridRowGroupPath = readonly unknown[];

const PATH_SEPARATOR = '::';

/** `colId` of the generated group column, used to find it again in AG Grid's column state. */
const GROUP_COL_ID = 'KbqAgGridRowGroup';

/** The single column currently driving native AG Grid sort UI — the group column or one data
 * column, never both (AG Grid itself clears every other column's sort state on a plain header
 * click; see the `sortChanged` subscription in `KbqAgGridRowGroup`). */
type ActiveSort = { readonly colId: string; readonly sort: 'asc' | 'desc' };

/** Partial AG Grid `ColDef` overrides applied to the generated group column. */
export type KbqAgGridRowGroupColOptions = Partial<ColDef>;

/** Default group column options. */
export const KBQ_AG_GRID_ROW_GROUP_COL_OPTIONS_DEFAULT: KbqAgGridRowGroupColOptions = {
    headerName: 'Группа'
};

/**
 * Injection token for supplying custom ColDef overrides for the generated group column.
 * Defaults to {@link KBQ_AG_GRID_ROW_GROUP_COL_OPTIONS_DEFAULT}.
 *
 * @see kbqAgGridRowGroupColOptionsProvider
 */
export const KBQ_AG_GRID_ROW_GROUP_COL_OPTIONS = new InjectionToken<KbqAgGridRowGroupColOptions>(
    'KBQ_AG_GRID_ROW_GROUP_COL_OPTIONS',
    { factory: (): KbqAgGridRowGroupColOptions => KBQ_AG_GRID_ROW_GROUP_COL_OPTIONS_DEFAULT }
);

/**
 * Creates a provider that overrides the default group column options.
 *
 * @example
 * ```ts
 * providers: [kbqAgGridRowGroupColOptionsProvider({ headerName: 'Группировка' })]
 * ```
 */
export const kbqAgGridRowGroupColOptionsProvider = (options: KbqAgGridRowGroupColOptions): Provider => ({
    provide: KBQ_AG_GRID_ROW_GROUP_COL_OPTIONS,
    useValue: options
});

/** A group header row rendered as an expand/collapse toggle. Contains no user data. */
type GroupHeaderRow = {
    readonly KbqAgGridRowGroup: {
        readonly isGroup: true;
        /** Nesting depth (0 = top level). */
        readonly level: number;
        /** Unique `PATH_SEPARATOR`- separated path identifying this group. */
        readonly path: string;
        /** Paths of all ancestor groups. */
        readonly ancestors: readonly string[];
        /** Display value of this group. */
        readonly key: string;
        /** Column field this group is based on. */
        readonly field: string;
        /** Total number of descendant data rows. */
        readonly count: number;
    };
};

/** A data row. Contains original user data plus grouping metadata in `KbqAgGridRowGroup`. */
type DataRow = RowData & {
    readonly KbqAgGridRowGroup: {
        readonly isGroup: false;
        /** Nesting depth. */
        readonly level: number;
        /** Paths of all ancestor groups. */
        readonly ancestors: readonly string[];
        /** Stable row identifier — see `KbqAgGridRowGroup`'s `rowId` input. */
        readonly id: string;
    };
};

/** Any row in the grouped dataset — either a group header or a data row. */
type Row = GroupHeaderRow | DataRow;

/**
 * Collision-safe grouping/path key for `value`. Strings pass through unchanged — group paths
 * built from string-valued fields (the common case) stay exactly as before, so a path like
 * `'Russia::Diving'` still reads the way `toggleCollapse`/`isCollapsed`/`getGroupSelectionState`
 * document it. Every other type is prefixed with its `typeof`, so e.g. the number `1` and the
 * string `"1"` (or `null`, `undefined`, and an object) never collapse into the same group,
 * despite `toDisplayLabel` rendering some of them the same way. Used everywhere group identity
 * is compared: `makeRowGroupData`'s bucketing, `collapsedPaths` path segments, and
 * `setExpanded`'s caller-supplied raw values — all funnel through this one function, so as long
 * as it's applied consistently they stay comparable to each other.
 */
const toKey = (value: unknown): string => (typeof value === 'string' ? value : `${typeof value}:${String(value)}`);

/** Human-readable label for a group's value, shown in the UI (see `KbqAgGridRowGroupCellRenderer`). */
const toDisplayLabel = (value: unknown): string =>
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';

/** Map from a `RowData` object (by reference, from the unfiltered input array) to its resolved id. */
type RowIdMap = ReadonlyMap<RowData, string>;

/**
 * Resolves a stable id per row via `rowId`, falling back to array position when absent.
 * Also reports any duplicate ids found, for the caller to warn about.
 */
function resolveRowIds(
    data: readonly RowData[],
    rowId: KbqAgGridRowGroupRowId | undefined
): { ids: RowIdMap; duplicateIds: ReadonlySet<string> } {
    const ids = new Map<RowData, string>();
    const seen = new Set<string>();
    const duplicateIds = new Set<string>();

    data.forEach((row, index) => {
        const id = rowId ? String(rowId(row)) : String(index);
        if (seen.has(id)) duplicateIds.add(id);
        seen.add(id);
        ids.set(row, id);
    });

    return { ids, duplicateIds };
}

/** The ancestor group paths for `row` given `groupFields`, shallowest first. */
function computeRowAncestorPaths(row: RowData, groupFields: readonly string[]): string[] {
    const paths: string[] = [];
    let prefix = '';
    for (const field of groupFields) {
        const key = toKey(row[field]);
        prefix = prefix ? `${prefix}${PATH_SEPARATOR}${key}` : key;
        paths.push(prefix);
    }
    return paths;
}

/** Structural equality for the small maps used as Angular `computed()` equality checks. */
function mapsEqual<K, V>(a: ReadonlyMap<K, V>, b: ReadonlyMap<K, V>): boolean {
    if (a.size !== b.size) return false;
    for (const [key, value] of a) {
        if (b.get(key) !== value) return false;
    }
    return true;
}

/**
 * Sorts group `[key, rows]` entries by key — numeric-aware (via `Intl`-backed
 * `localeCompare`), so a field like "year" orders `2 < 10` rather than lexicographically
 * (`"10" < "2"`), matching what a user comparing displayed group labels would expect.
 */
function sortGroupEntries(groups: ReadonlyMap<string, RowData[]>, sort: 'asc' | 'desc'): [string, RowData[]][] {
    const direction = sort === 'asc' ? 1 : -1;
    return [...groups].sort(
        ([a], [b]) => direction * a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
}

/**
 * Recursively walks a `(ColDef | ColGroupDef)[]` tree, applying `transform` to every leaf
 * `ColDef` — including ones nested under `ColGroupDef.children` — and returns a new tree.
 * `ColGroupDef` nodes are shallow-cloned with their `children` replaced; they have no
 * `field`/`comparator` of their own to transform.
 */
function mapColDefTree(
    defs: readonly (ColDef | ColGroupDef)[],
    transform: (def: ColDef) => ColDef
): (ColDef | ColGroupDef)[] {
    return defs.map((def) =>
        'children' in def ? { ...def, children: mapColDefTree(def.children, transform) } : transform(def)
    );
}

/**
 * Builds a `colId → field` map for every leaf `ColDef` in `defs`, recursing into
 * `ColGroupDef.children` — `colId` defaults to `field` when not explicitly set, matching AG
 * Grid's own default. Used to resolve which raw data field a native data-column sort (read from
 * `api.getColumnState()`, which only reports `colId`) should reorder leaf rows by. Columns
 * without a `field` (e.g. pure cellRenderer columns) are skipped — they can never be the target
 * of a leaf-row sort.
 */
function collectDataColIdToField(defs: readonly (ColDef | ColGroupDef)[]): ReadonlyMap<string, string> {
    const map = new Map<string, string>();
    for (const def of defs) {
        if ('children' in def) {
            for (const [colId, field] of collectDataColIdToField(def.children)) map.set(colId, field);
        } else if (def.field) {
            map.set(def.colId ?? def.field, def.field);
        }
    }
    return map;
}

/**
 * What `makeRowGroupData` should sort — derived from `_activeSort` by
 * `KbqAgGridRowGroup.resolveRowGroupDataSort`. At most one of `group`/`leaf` is ever non-null
 * (AG Grid clears every other column's sort on a plain header click, so only one column can be
 * the active sort at a time). `group` reorders group-header siblings at every nesting level
 * (existing behavior, driven by the group column's own sort); `leaf`, when set, reorders the
 * leaf data rows within each deepest group by a raw field value (a data column's sort).
 */
type RowGroupDataSort = {
    readonly group: SortDirection;
    readonly leaf: { readonly field: string; readonly direction: 'asc' | 'desc' } | null;
};

/**
 * Default ordering for two raw field values when sorting leaf data rows within a group by a
 * data column's field. Two numbers compare numerically; everything else falls back to a
 * numeric-aware `localeCompare` (mirrors `sortGroupEntries`'s approach for group keys).
 *
 * Known limitation: this does NOT invoke any consumer-supplied ColDef `comparator` /
 * `valueGetter` for the field — sorting always uses the row's raw property value. A column with
 * custom display formatting/derivation whose sort order should follow that custom logic will
 * not, while grouping is active. This is an explicit, documented simplification, not an
 * oversight — see `sortLeafRows`.
 */
function compareRawValues(a: unknown, b: unknown): number {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return toDisplayLabel(a).localeCompare(toDisplayLabel(b), undefined, { numeric: true, sensitivity: 'base' });
}

/** Sorts a copy of `data` by `leaf.field`'s raw value — see `compareRawValues` and its
 * documented known limitation (no consumer comparator/valueGetter support). */
function sortLeafRows(data: readonly RowData[], leaf: { field: string; direction: 'asc' | 'desc' }): RowData[] {
    const direction = leaf.direction === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => direction * compareRawValues(a[leaf.field], b[leaf.field]));
}

// eslint-disable-next-line @typescript-eslint/max-params
function makeRowGroupData(
    data: RowData[],
    groupFields: readonly string[],
    rowIdMap: RowIdMap,
    collapsedPaths: ReadonlySet<string> = new Set(),
    sort: RowGroupDataSort = { group: null, leaf: null },
    level = 0,
    ancestors: readonly string[] = [],
    pathPrefix = ''
): Row[] {
    if (groupFields.length === 0) {
        const rows = sort.leaf ? sortLeafRows(data, sort.leaf) : data;
        return rows.map((row) => ({
            ...row,
            KbqAgGridRowGroup: { isGroup: false as const, level, ancestors, id: rowIdMap.get(row) ?? '' }
        }));
    }

    const [currentField, ...remainingFields] = groupFields;
    const groups = new Map<string, RowData[]>();

    for (const row of data) {
        const key = toKey(row[currentField]);
        const existing = groups.get(key);
        if (existing) {
            existing.push(row);
        } else {
            groups.set(key, [row]);
        }
    }

    const result: Row[] = [];
    // `sort.group` only ever reorders group-header siblings at each level; `sort.leaf` (handled
    // in the base case above) independently reorders leaf data rows within the deepest group —
    // the two never apply to the same rows and are never both set at once.
    const entries = sort.group ? sortGroupEntries(groups, sort.group) : groups;

    for (const [key, rows] of entries) {
        const path = pathPrefix ? `${pathPrefix}${PATH_SEPARATOR}${key}` : key;
        const collapsed = collapsedPaths.has(path);
        const [firstRow] = rows;

        result.push({
            KbqAgGridRowGroup: {
                isGroup: true,
                level,
                path,
                ancestors,
                key: toDisplayLabel(firstRow[currentField]),
                field: currentField,
                count: rows.length
            }
        });

        if (!collapsed) {
            result.push(
                ...makeRowGroupData(
                    rows,
                    remainingFields,
                    rowIdMap,
                    collapsedPaths,
                    sort,
                    level + 1,
                    [...ancestors, path],
                    path
                )
            );
        }
    }

    return result;
}

type KbqAgGridRowGroupCellRendererParams = ICellRendererParams<Row> & { rowGroup: KbqAgGridRowGroup };

// KbqAgGridRowGroup is typed as always-present on Row, but flat (ungrouped) rows are passed
// through as raw RowData and genuinely lack it at runtime — hence the extra `?.` below.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const isGroupHeaderRow = (row: Row | null | undefined): row is GroupHeaderRow => !!row?.KbqAgGridRowGroup?.isGroup;

@Component({
    standalone: true,
    selector: 'kbq-ag-grid-group-cell-renderer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'kbq-ag-grid-group-cell-renderer' },
    template: `
        @if (isGroup()) {
            <!-- A native <button> gets keyboard (Enter/Space) and focus handling for free —
                 no manual role/tabindex/keydown wiring needed for WCAG 2.1.1 operability. -->
            <!-- eslint-disable-next-line @angular-eslint/template/no-inline-styles -->
            <button
                type="button"
                class="kbq-ag-grid-group-cell-renderer__inner"
                [style.padding-left.px]="indent()"
                [attr.aria-expanded]="!collapsed()"
                (click)="toggle()"
            >
                <i
                    class="kbq-ag-grid-group-cell-renderer__icon kbq kbq-icon"
                    [class.kbq-chevron-down_16]="!collapsed()"
                    [class.kbq-chevron-right_16]="collapsed()"
                ></i>
                <span class="kbq-ag-grid-group-cell-renderer__key">{{ row().KbqAgGridRowGroup.key }}</span>
                <span class="kbq-ag-grid-group-cell-renderer__count">{{ row().KbqAgGridRowGroup.count }}</span>
            </button>
        }
    `
})
class KbqAgGridRowGroupCellRenderer implements ICellRendererAngularComp {
    private groupState: KbqAgGridRowGroup | null = null;
    protected readonly isGroup = signal(false);
    protected readonly row = signal<GroupHeaderRow>({
        KbqAgGridRowGroup: { isGroup: true, level: 0, path: '', ancestors: [], key: '', field: '', count: 0 }
    });
    protected readonly indent = signal(8);
    protected readonly collapsed = signal(false);

    agInit(params: KbqAgGridRowGroupCellRendererParams): void {
        this.groupState = params.rowGroup;
        const { data } = params;
        const isGroup = isGroupHeaderRow(data);
        // untracked: this method may be called from within an Angular effect context
        // (e.g. when refreshCells is triggered from the refreshCells effect). Signal
        // writes are not allowed inside effects without allowSignalWrites; untracked
        // removes the reactive context so the writes succeed.
        untracked(() => {
            this.isGroup.set(isGroup);
            if (isGroup) this.updateFromParams(data);
        });
    }

    refresh(params: KbqAgGridRowGroupCellRendererParams): boolean {
        this.groupState = params.rowGroup;
        const { data } = params;
        const isGroup = isGroupHeaderRow(data);
        untracked(() => {
            this.isGroup.set(isGroup);
            if (isGroup) this.updateFromParams(data);
        });
        return true;
    }

    protected toggle(): void {
        this.groupState?.toggleCollapse(this.row().KbqAgGridRowGroup.path);
    }

    private updateFromParams(row: GroupHeaderRow): void {
        const { level, path } = row.KbqAgGridRowGroup;
        this.row.set(row);
        this.indent.set(level * 20 + 8);
        this.collapsed.set(this.groupState?.isCollapsed(path) ?? false);
    }
}

@Component({
    standalone: true,
    selector: 'kbq-ag-grid-group-selection-cell-renderer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'kbq-ag-grid-group-selection-cell-renderer' },
    template: `
        @if (isGroup()) {
            <!-- Mirrors AG Grid's own selection-checkbox markup (.ag-selection-checkbox >
                 .ag-checkbox-input-wrapper > input) so it picks up the exact same styling from
                 theme.scss instead of rendering as a bare, unstyled native checkbox. -->
            <div class="ag-selection-checkbox" role="presentation">
                <div
                    class="ag-wrapper ag-input-wrapper ag-checkbox-input-wrapper"
                    [class.ag-checked]="selectionState() === 'checked'"
                    [class.ag-indeterminate]="selectionState() === 'indeterminate'"
                >
                    <input
                        #checkbox
                        type="checkbox"
                        class="ag-input-field-input ag-checkbox-input"
                        tabindex="-1"
                        [checked]="selectionState() === 'checked'"
                        [attr.aria-checked]="
                            selectionState() === 'indeterminate' ? 'mixed' : selectionState() === 'checked'
                        "
                        [attr.aria-label]="key()"
                        (click)="$event.stopPropagation(); onCheckboxClick()"
                    />
                </div>
            </div>
        }
    `
})
class KbqAgGridRowGroupSelectionCellRenderer implements ICellRendererAngularComp {
    private groupState: KbqAgGridRowGroup | null = null;
    private readonly checkboxRef = viewChild<ElementRef<HTMLInputElement>>('checkbox');
    protected readonly isGroup = signal(false);
    protected readonly key = signal('');
    protected readonly selectionState = signal<KbqAgGridRowGroupSelectionState>('unchecked');
    private path = '';

    constructor() {
        effect(() => {
            const el = this.checkboxRef()?.nativeElement;
            if (!el) return;
            el.indeterminate = this.selectionState() === 'indeterminate';
        });
    }

    agInit(params: KbqAgGridRowGroupCellRendererParams): void {
        this.groupState = params.rowGroup;
        const { data } = params;
        const isGroup = isGroupHeaderRow(data);
        // untracked: see KbqAgGridRowGroupCellRenderer.agInit
        untracked(() => {
            this.isGroup.set(isGroup);
            if (isGroup) this.updateFromParams(data);
        });
    }

    refresh(params: KbqAgGridRowGroupCellRendererParams): boolean {
        this.groupState = params.rowGroup;
        const { data } = params;
        const isGroup = isGroupHeaderRow(data);
        untracked(() => {
            this.isGroup.set(isGroup);
            if (isGroup) this.updateFromParams(data);
        });
        return true;
    }

    protected onCheckboxClick(): void {
        this.groupState?.onGroupCheckboxClick(this.path);
    }

    private updateFromParams(row: GroupHeaderRow): void {
        const { path, key } = row.KbqAgGridRowGroup;
        this.path = path;
        this.key.set(key);
        this.selectionState.set(this.groupState?.getGroupSelectionState(path) ?? 'unchecked');
    }
}

type KbqAgGridRowGroupHeaderCellRendererParams = IHeaderParams<Row> & { rowGroup: KbqAgGridRowGroup };

/**
 * Custom "select all" header checkbox for the selection column. AG Grid's own header checkbox
 * only knows about currently-*visible* rows, so it disables itself while any group is
 * collapsed (nothing selectable is loaded into the row model at that point) — this renders
 * instead, driven by `KbqAgGridRowGroup.overallSelectionState`, which accounts for the full,
 * uncollapsed dataset.
 */
@Component({
    standalone: true,
    selector: 'kbq-ag-grid-row-group-select-all-header-cell-renderer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'kbq-ag-grid-row-group-select-all-header-cell-renderer' },
    template: `
        <!-- Mirrors AG Grid's own header select-all checkbox markup (.ag-header-select-all >
             .ag-checkbox-input-wrapper > input) — see KbqAgGridRowGroupSelectionCellRenderer. -->
        <div class="ag-header-select-all" role="presentation">
            <div
                class="ag-wrapper ag-input-wrapper ag-checkbox-input-wrapper"
                [class.ag-checked]="selectionState() === 'checked'"
                [class.ag-indeterminate]="selectionState() === 'indeterminate'"
            >
                <input
                    #checkbox
                    type="checkbox"
                    class="ag-input-field-input ag-checkbox-input"
                    tabindex="-1"
                    aria-label="Select all rows"
                    [checked]="selectionState() === 'checked'"
                    [attr.aria-checked]="
                        selectionState() === 'indeterminate' ? 'mixed' : selectionState() === 'checked'
                    "
                    (click)="$event.stopPropagation(); onCheckboxClick()"
                />
            </div>
        </div>
    `
})
class KbqAgGridRowGroupSelectAllHeaderCellRenderer implements IHeaderAngularComp {
    private rowGroup: KbqAgGridRowGroup | null = null;
    private readonly checkboxRef = viewChild<ElementRef<HTMLInputElement>>('checkbox');

    protected readonly selectionState = signal<KbqAgGridRowGroupSelectionState>('unchecked');

    constructor() {
        effect(() => {
            const el = this.checkboxRef()?.nativeElement;
            if (!el) return;
            el.indeterminate = this.selectionState() === 'indeterminate';
        });
    }

    agInit(params: KbqAgGridRowGroupHeaderCellRendererParams): void {
        this.rowGroup = params.rowGroup;
        this.updateFromRowGroup();
    }

    refresh(params: KbqAgGridRowGroupHeaderCellRendererParams): boolean {
        this.rowGroup = params.rowGroup;
        this.updateFromRowGroup();
        return true;
    }

    protected onCheckboxClick(): void {
        this.rowGroup?.onSelectAllCheckboxClick();
    }

    private updateFromRowGroup(): void {
        // untracked: see KbqAgGridRowGroupCellRenderer.agInit — this may run inside the
        // "refresh select-all header" effect (via api.refreshHeader()).
        untracked(() => {
            this.selectionState.set(this.rowGroup?.overallSelectionState() ?? 'unchecked');
        });
    }
}

/**
 * Directive that implements client-side row grouping without AG Grid Enterprise.
 *
 * Attach to `ag-grid-angular` and supply raw data via `[kbqAgGridRowGroupRowData]`
 * instead of the usual `[rowData]`. The directive manages data transformation and
 * exposes an API for controlling grouping programmatically.
 *
 * **Recommended:**
 * - Set `[kbqAgGridRowGroupRowId]` to a function extracting a stable unique id from a row.
 *   Group selection (including a *partial* selection, shown as indeterminate) is tracked by
 *   row id so it survives collapsing and re-expanding a group. Without it, row identity
 *   falls back to array position, which only stays correct as long as
 *   `[kbqAgGridRowGroupRowData]` keeps the same order and content between a collapse and the
 *   matching expand.
 * - Read `(kbqAgGridRowGroupSelectionChanged)` instead of AG Grid's own `(selectionChanged)`
 *   whenever the full selection matters — AG's event only reports rows currently materialized
 *   as row nodes, so it misses rows hidden inside a collapsed group.
 *
 * **Data column sorting while grouped:**
 * - Clicking any data column's header while grouping is active reorders leaf rows *within each
 *   deepest group only* — group headers and nesting never move. Sorting a data column and
 *   sorting the Group column are mutually exclusive: activating one clears the other, exactly
 *   like any two native AG Grid columns.
 * - The comparison is a generic numeric/locale-aware comparison of the field's raw value — it
 *   does NOT invoke a consumer-supplied ColDef `comparator` or `valueGetter`. A column whose
 *   display value is derived/formatted will sort by its underlying raw value instead, while
 *   grouping is active.
 * - Only one column's sort is ever honored (no multi-column/shift-click sort chaining), and
 *   there is no way to sort group headers themselves by an aggregate of a data field.
 *
 * @example
 * ```html
 * <ag-grid-angular
 *   #group="kbqAgGridRowGroup"
 *   kbqAgGridTheme
 *   kbqAgGridRowGroup
 *   [kbqAgGridRowGroupRowData]="rowData()"
 *   [kbqAgGridRowGroupRowId]="rowId"
 *   [(kbqAgGridRowGroupCols)]="groupCols"
 *   [columnDefs]="columnDefs"
 *   (kbqAgGridRowGroupSelectionChanged)="onSelectionChanged($event)"
 * />
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridRowGroup]',
    exportAs: 'kbqAgGridRowGroup'
})
export class KbqAgGridRowGroup {
    private readonly grid = inject(AgGridAngular);
    private readonly destroyRef = inject(DestroyRef);
    private readonly api = signal<GridApi | null>(null);

    /** Raw row data. Provide this instead of `[rowData]` on the grid element. */
    readonly data = input<RowData[]>([], { alias: 'kbqAgGridRowGroupRowData' });

    /**
     * Extracts a stable unique id from a row, used to track selection across group
     * collapse/expand cycles. See the class-level `**Recommended**` note.
     */
    readonly rowId = input<KbqAgGridRowGroupRowId | undefined>(undefined, {
        alias: 'kbqAgGridRowGroupRowId'
    });

    /**
     * Column fields to group by, in order (first = outermost group).
     * Supports two-way binding: `[(kbqAgGridRowGroupCols)]="fields"`.
     */
    readonly groupCols = model<string[]>([], { alias: 'kbqAgGridRowGroupCols' });

    /**
     * ColDef overrides for the generated group column. Takes precedence over
     * {@link KBQ_AG_GRID_ROW_GROUP_COL_OPTIONS} when both are provided.
     */
    readonly groupColOptions = input<KbqAgGridRowGroupColOptions | undefined>(
        inject(KBQ_AG_GRID_ROW_GROUP_COL_OPTIONS),
        {
            alias: 'kbqAgGridRowGroupColOptions'
        }
    );

    private readonly _collapsedPaths = signal<ReadonlySet<string>>(new Set());
    /**
     * Set of group paths that are currently collapsed. Read-only — mutate it only through
     * `toggleCollapse`/`setExpanded`/`expandAll`/`collapseAll`/`clearGroupColumns`, which
     * enforce the "revealing a group starts its children collapsed" invariant (see
     * `computeSubGroupPaths`); writing directly here would bypass that and could reveal an
     * entire subtree at once instead of one level at a time.
     */
    readonly collapsedPaths = this._collapsedPaths.asReadonly();

    /** The one column (group or data) currently driving native AG Grid sort UI — see
     * `ActiveSort`. Structural `equal`: the `sortChanged` subscription below constructs a fresh
     * object on every AG event, including ones that don't actually change `colId`/`sort`;
     * without this, Angular's default reference equality would treat every such event as a
     * change and trigger a redundant rowData rebuild via the "update rowData" effect. */
    private readonly _activeSort = signal<ActiveSort | null>(null, {
        equal: (a, b) => a?.colId === b?.colId && a?.sort === b?.sort
    });
    /**
     * Current sort direction applied to the group column — `null` means unsorted (groups appear
     * in `kbqAgGridRowGroupRowData` order, as today). Group-header siblings are sorted by their
     * key at every nesting level; leaf data rows within a group keep their original order. This
     * only ever changes in response to the user clicking the group column's header — the same
     * native AG Grid sort UI/icon/keyboard behavior as any other sortable column (see the
     * `sortChanged` subscription and `makeGroupColDef`'s `comparator`). Derived from the more
     * general `_activeSort`, which also tracks data-column sorting — see `resolveRowGroupDataSort`.
     */
    readonly groupColSort = computed<SortDirection>(() => {
        const active = this._activeSort();
        return active?.colId === GROUP_COL_ID ? active.sort : null;
    });

    /**
     * Emits the full list of currently-selected data rows (original `RowData` objects, in
     * `kbqAgGridRowGroupRowData` order) whenever selection changes — including rows inside
     * collapsed groups. AG Grid's own `(selectionChanged)` output only reports rows currently
     * materialized as row nodes, so it misses anything hidden by a collapsed ancestor group;
     * use this output instead whenever the complete selection matters.
     */
    readonly rowSelectionChanged = output<RowData[]>({ alias: 'kbqAgGridRowGroupSelectionChanged' });

    /** Ids (see `rowId`) of every currently-selected data row — the source of truth for
     * selection, independent of which rows AG Grid currently has instantiated/visible. */
    private readonly selectedRowIds = signal<ReadonlySet<string>>(new Set());

    /** `RowData` (by reference, from the unfiltered `data()`) → resolved id. Warns (once) on
     * missing `rowId` while grouping is active, and (once per id) on duplicate ids. */
    private readonly rowIdMap = computed((): RowIdMap => {
        const rowId = this.rowId();
        if (isDevMode() && !rowId && this.groupCols().length > 0 && !this.warnedMissingRowId) {
            this.warnedMissingRowId = true;
            console.warn(
                'KbqAgGridRowGroup: no [kbqAgGridRowGroupRowId] configured — falling back to ' +
                    'array-index row identity. Selection of a partially-selected group will only ' +
                    'survive collapsing/expanding it as long as [kbqAgGridRowGroupRowData] keeps ' +
                    'the same order and content. Provide [kbqAgGridRowGroupRowId] for reliable behavior.'
            );
        }

        const { ids, duplicateIds } = resolveRowIds(this.data(), rowId);
        if (isDevMode()) {
            for (const id of duplicateIds) {
                if (this.warnedDuplicateRowIds.has(id)) continue;
                this.warnedDuplicateRowIds.add(id);
                console.warn(
                    `KbqAgGridRowGroup: duplicate row id "${id}" from [kbqAgGridRowGroupRowId] — ` +
                        'selection tracking may be incorrect for the affected rows.'
                );
            }
        }
        return ids;
    });

    /** id → ancestor group paths, for every row in the full (unfiltered) dataset — independent
     * of `collapsedPaths`, so collapsed descendants still count toward group rollup state. */
    private readonly rowIndex = computed(() => {
        const rowIdMap = this.rowIdMap();
        const fields = this.groupCols();
        const index = new Map<string, string[]>();
        for (const [row, id] of rowIdMap) {
            index.set(id, computeRowAncestorPaths(row, fields));
        }
        return index;
    });

    /** Total descendant-row count per group path — structural, doesn't change with selection. */
    private readonly pathTotals = computed(() => {
        const totals = new Map<string, number>();
        for (const ancestorPaths of this.rowIndex().values()) {
            for (const path of ancestorPaths) {
                totals.set(path, (totals.get(path) ?? 0) + 1);
            }
        }
        return totals;
    });

    /**
     * Selection state for each group path — absent means unchecked. Groups are not selectable
     * via AG Grid; this is derived purely from `selectedRowIds` + `rowIndex`, independent of
     * which rows AG Grid currently has visible/instantiated.
     */
    readonly groupSelectionState = computed(
        (): ReadonlyMap<string, Exclude<KbqAgGridRowGroupSelectionState, 'unchecked'>> => {
            const index = this.rowIndex();
            const selected = this.selectedRowIds();
            const totals = this.pathTotals();
            if (selected.size === 0) return new Map();

            const selectedCounts = new Map<string, number>();
            for (const id of selected) {
                const ancestorPaths = index.get(id);
                if (!ancestorPaths) continue;
                for (const path of ancestorPaths) {
                    selectedCounts.set(path, (selectedCounts.get(path) ?? 0) + 1);
                }
            }

            const result = new Map<string, Exclude<KbqAgGridRowGroupSelectionState, 'unchecked'>>();
            for (const [path, total] of totals) {
                const count = selectedCounts.get(path) ?? 0;
                if (count === 0) continue;
                result.set(path, count === total ? 'checked' : 'indeterminate');
            }
            return result;
        },
        { equal: mapsEqual }
    );

    /**
     * Selection state across the full dataset, regardless of grouping/collapse state — drives
     * the custom "select all" header checkbox (see `KbqAgGridRowGroupSelectAllHeaderCellRenderer`).
     */
    readonly overallSelectionState = computed((): KbqAgGridRowGroupSelectionState => {
        const index = this.rowIndex();
        const total = index.size;
        if (total === 0) return 'unchecked';

        let count = 0;
        for (const id of this.selectedRowIds()) {
            if (index.has(id)) count++;
        }
        if (count === 0) return 'unchecked';
        return count === total ? 'checked' : 'indeterminate';
    });

    /** Snapshot of the consumer's own columnDefs, without the synthetic Group column or the
     * per-column `comparator` override — kept in sync with `[columnDefs]` via the
     * `newColumnsLoaded` subscription below (see `setColumnDefsInternally`). */
    private originalColDefs: (ColDef | ColGroupDef)[] = [];
    /** `colId → field` for every data column in `originalColDefs` — see `collectDataColIdToField`.
     * Resynced alongside `originalColDefs`. */
    private dataColIdToField: ReadonlyMap<string, string> = new Map();
    private groupColShown = false;
    /** Nodes whose next `rowSelected` event was caused by our own `setSelected()` call — skip to prevent re-entrant cascades. */
    private readonly programmaticallySetNodes = new WeakSet();
    /** Deferred collapse: set on gridReady when groupCols is non-empty; cleared once data is available. */
    private needsInitialCollapse = false;
    /** Previous groupCols reference — compared by identity to detect structural changes. */
    private prevGroupCols: string[] | null = null;
    private warnedMissingRowId = false;
    private readonly warnedDuplicateRowIds = new Set<string>();
    /** Last (data, groupCols, collapsedPaths, sort) combination actually applied to the grid —
     * lets the "update rowData" effect detect and skip the redundant extra run Angular
     * schedules whenever it writes `collapsedPaths` (a signal it also reads) in the same run. */
    private lastRebuildInputs: {
        data: RowData[];
        groupCols: string[];
        collapsedPaths: ReadonlySet<string>;
        sort: ActiveSort | null;
    } | null = null;

    constructor() {
        // Reactive: update rowData whenever data, groupCols, collapsedPaths, or groupColSort change
        effect(
            () => {
                const api = this.api();
                if (!api) return;

                const groupCols = this.groupCols();

                // When the grouping structure changes, collapse all top-level groups.
                if (this.prevGroupCols !== null && this.prevGroupCols !== groupCols) {
                    this._collapsedPaths.set(this.computeTopLevelPaths());
                }
                this.prevGroupCols = groupCols;

                // Track collapsedPaths so the effect re-runs after the collapse write.
                const collapsedPaths = this.collapsedPaths();
                const data = this.data();
                const sort = this._activeSort();

                // When groupCols is bound non-empty before data arrives, collapse on first data load.
                if (this.needsInitialCollapse && data.length > 0) {
                    this.needsInitialCollapse = false;
                    this._collapsedPaths.set(this.computeTopLevelPaths());
                    return;
                }

                // Writing collapsedPaths above (when the grouping structure changed) makes this
                // same effect a dependent of its own write, so Angular schedules one more run of
                // it — skip that redundant run instead of rebuilding an identical grid twice.
                const last = this.lastRebuildInputs;
                if (
                    last !== null &&
                    last.data === data &&
                    last.groupCols === groupCols &&
                    last.collapsedPaths === collapsedPaths &&
                    last.sort === sort
                ) {
                    return;
                }
                this.lastRebuildInputs = { data, groupCols, collapsedPaths, sort };

                // Restore native AG selection for every visible data row from selectedRowIds —
                // the definitive source of truth, independent of collapse state. Read untracked:
                // this effect must only re-run on data/groupCols/collapsedPaths/groupColSort
                // changes, not on every selection change (which would rebuild rowData on every
                // checkbox click).
                const selected = untracked(() => this.selectedRowIds());

                // Mark all current nodes as programmatic so their async deselect events (fired by
                // AG Grid when rowData is replaced) are suppressed — skip when nothing is
                // selected, since no deselect event could possibly fire in that case.
                if (selected.size > 0) {
                    api.forEachNode((node: IRowNode<Partial<Row> | undefined>) => {
                        this.programmaticallySetNodes.add(node);
                    });
                }

                api.setGridOption('rowData', this.computeGroupedData());

                if (selected.size > 0) {
                    this.syncNodeSelection(
                        api,
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                        (row) => !!row.KbqAgGridRowGroup && selected.has(row.KbqAgGridRowGroup.id),
                        true
                    );
                }
            },
            { allowSignalWrites: true }
        );

        // Reactive: add/remove the "Group" column when grouping is activated/deactivated
        effect(() => {
            const api = this.api();
            if (!api) return;
            const needsGroupCol = this.groupCols().length > 0;
            if (needsGroupCol && !this.groupColShown) {
                this.groupColShown = true;
                this.setColumnDefsInternally(api, [this.makeGroupColDef(), ...this.makeDataColDefs()]);
            } else if (!needsGroupCol && this.groupColShown) {
                this.groupColShown = false;
                this.setColumnDefsInternally(api, this.originalColDefs);
            }
        });

        // Redraw group rows whenever selection state changes, so the checkbox cell and the
        // `ag-row-selected` rowClassRules class (see makeRowClassRules) both update. redrawRows
        // is used rather than refreshCells because rowClassRules are only re-evaluated on a
        // row redraw, not a cell-level refresh.
        effect(() => {
            const api = this.api();
            if (!api) return;
            this.groupSelectionState();
            const groupRowNodes: IRowNode<Row>[] = [];
            api.forEachNode((node: IRowNode<Row>) => {
                if (isGroupHeaderRow(node.data)) groupRowNodes.push(node);
            });
            if (groupRowNodes.length > 0) {
                api.redrawRows({ rowNodes: groupRowNodes });
            }
        });

        // Refresh the custom "select all" header checkbox whenever the overall selection state
        // changes (refreshHeader re-invokes the header component's refresh() method).
        effect(() => {
            const api = this.api();
            if (!api) return;
            this.overallSelectionState();
            api.refreshHeader();
        });

        this.grid.gridReady.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ api }) => {
            this.originalColDefs = api.getColumnDefs() ?? [];
            this.dataColIdToField = collectDataColIdToField(this.originalColDefs);

            // Group rows are non-selectable — their state lives in groupSelectionState.
            // Prefer the non-deprecated rowSelection object form when available; fall back
            // to the legacy setGridOption('isRowSelectable') only for string / absent config.
            const rowSelection = api.getGridOption('rowSelection');
            if (rowSelection && typeof rowSelection !== 'string') {
                // Merge into the existing rowSelection object so user-supplied options are preserved.
                // checkboxes:false for group rows suppresses AG Grid's own native selection-column
                // checkbox entirely (rather than just disabling it), so only our custom
                // group-cell-renderer checkbox is shown in that cell. headerCheckbox:false does the
                // same for the header "select all" checkbox — AG's own only knows about currently
                // visible rows and disables itself while any group is collapsed; our own custom one
                // (see makeSelectionColumnDef) accounts for the full, uncollapsed dataset instead.
                const originalCheckboxes = rowSelection.checkboxes;
                const mergedSelection = {
                    ...rowSelection,
                    isRowSelectable: ((node: IRowNode<Row>) =>
                        !isGroupHeaderRow(node.data)) as typeof rowSelection.isRowSelectable,
                    checkboxes: ((params: CheckboxSelectionCallbackParams<Row>) => {
                        if (isGroupHeaderRow(params.data)) return false;
                        return typeof originalCheckboxes === 'function'
                            ? originalCheckboxes(params)
                            : (originalCheckboxes ?? true);
                    }) as typeof rowSelection.checkboxes,
                    hideDisabledCheckboxes: true,
                    // headerCheckbox only exists on multiRow selection options.
                    ...(rowSelection.mode === 'multiRow' ? { headerCheckbox: false } : {})
                };
                api.setGridOption('rowSelection', mergedSelection);
            } else {
                api.setGridOption('isRowSelectable', (node: IRowNode<Row>) => !isGroupHeaderRow(node.data));
            }
            // Render the custom group checkbox in the shared selection column so it lines up
            // with the native row-selection checkboxes instead of sitting inside the group cell.
            api.setGridOption('selectionColumnDef', this.makeSelectionColumnDef());
            // Group rows are never truly selected via AG Grid's own API (isRowSelectable is
            // false for them), so apply AG's `ag-row-selected` row class ourselves, driven by
            // groupSelectionState, to get the same visual highlight as real selected rows.
            api.setGridOption('rowClassRules', this.makeRowClassRules());
            queueMicrotask(() => {
                if (this.groupCols().length > 0) {
                    this.needsInitialCollapse = true;
                }
                this.api.set(api);
            });
        });

        this.grid.rowSelected.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ node }) => {
            // Skip events caused by our own programmatic setSelected calls.
            if (this.programmaticallySetNodes.has(node)) {
                this.programmaticallySetNodes.delete(node);
                return;
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            const row = node.data as Row | undefined;
            // Flat mode (no metadata) or group rows — group selection is handled via onGroupCheckboxClick.
            if (!row?.KbqAgGridRowGroup || isGroupHeaderRow(row)) return;

            const { id } = row.KbqAgGridRowGroup;
            this.selectedRowIds.update((set) => {
                const next = new Set(set);
                if (node.isSelected()) next.add(id);
                else next.delete(id);
                return next;
            });
            this.emitSelectionChanged();
        });

        // Reflect whichever single column (group or data) is the current native AG Grid sort
        // into _activeSort, which computeGroupedData()/makeRowGroupData() use to reorder either
        // group-header siblings or leaf rows within each group (see resolveRowGroupDataSort).
        this.grid.sortChanged.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
            const api = this.api();
            if (!api) return;
            // Not in multi-sort mode (default — no ctrl/shift), AG Grid itself clears every
            // other column's sort state before applying a new one, so in practice at most one
            // entry here has a non-null sort. sortIndex still picks a deterministic "primary"
            // defensively. Multi-column sort chaining is out of scope — only this one primary
            // column is ever honored.
            const primary = api
                .getColumnState()
                .filter((s): s is ColumnState & { sort: 'asc' | 'desc' } => s.sort != null)
                .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
                .at(0);
            this._activeSort.set(primary ? { colId: primary.colId, sort: primary.sort } : null);
        });

        // Keep originalColDefs/dataColIdToField in sync with the consumer's own [columnDefs]
        // input, not just its value at gridReady — a column added/removed/renamed later is
        // picked up going forward (its comparator override, its colId → field resolution).
        // AG Grid tags every columnDefs write with who caused it: a direct
        // api.setGridOption('columnDefs', ...) call (this directive's own, via
        // setColumnDefsInternally) reports source 'api', while the consumer's own [columnDefs]
        // input changing is routed by AgGridAngular through gridOptionsChanged instead —
        // confirmed by reading AG Grid's _processOnChange / GridOptionsService.updateGridOptions
        // (default source 'api') and SyncService.setColumnDefs, which converts a
        // 'gridOptionsChanged'-sourced update via _convertColumnEventSourceType before it reaches
        // here. Only the latter should trigger a resync — resyncing from our own write would
        // replace the real snapshot with our synthetic Group-column/no-op-comparator variant.
        this.grid.newColumnsLoaded.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ source }) => {
            if (source === 'api') return;
            const api = this.api();
            if (!api) return;

            this.originalColDefs = api.getColumnDefs() ?? [];
            this.dataColIdToField = collectDataColIdToField(this.originalColDefs);

            // The consumer's own columnDefs write just replaced whatever this directive had
            // rendered — if the Group column was showing, put it (and the data-column
            // comparator overrides) back on top of the fresh snapshot instead of silently
            // losing it.
            if (this.groupColShown) {
                this.setColumnDefsInternally(api, [this.makeGroupColDef(), ...this.makeDataColDefs()]);
            }
        });
    }

    /** Returns `true` if the group at `path` is currently collapsed. */
    isCollapsed(path: string): boolean {
        return this.collapsedPaths().has(path);
    }

    /** Returns the selection state of the group at `path`. */
    getGroupSelectionState(path: string): KbqAgGridRowGroupSelectionState {
        return this.groupSelectionState().get(path) ?? 'unchecked';
    }

    /**
     * Toggles selection of all data descendants of the group at `path` — across the full
     * dataset, not just currently-visible rows. Called by the cell renderer checkbox;
     * checked → uncheck all, else → check all.
     */
    onGroupCheckboxClick(path: string): void {
        const api = this.api();
        if (!api) return;

        const shouldSelect = this.getGroupSelectionState(path) !== 'checked';

        const affectedIds: string[] = [];
        for (const [id, ancestorPaths] of this.rowIndex()) {
            if (ancestorPaths.includes(path)) affectedIds.push(id);
        }

        this.selectedRowIds.update((set) => {
            const next = new Set(set);
            for (const id of affectedIds) {
                if (shouldSelect) next.add(id);
                else next.delete(id);
            }
            return next;
        });
        this.emitSelectionChanged();

        // Sync AG's live node selection for any of these rows that are currently visible, so
        // the checkbox / ag-row-selected class update immediately without waiting for the
        // rowData-rebuild effect (which only reruns on data/groupCols/collapsedPaths changes).
        this.syncNodeSelection(
            api,
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            (row) => !!row.KbqAgGridRowGroup && row.KbqAgGridRowGroup.ancestors.includes(path),
            shouldSelect
        );
    }

    /**
     * Toggles selection of every data row in the full dataset, regardless of grouping/collapse
     * state. Called by the custom "select all" header checkbox; checked → uncheck all, else →
     * check all.
     */
    onSelectAllCheckboxClick(): void {
        const api = this.api();
        if (!api) return;

        const shouldSelect = this.overallSelectionState() !== 'checked';
        this.selectedRowIds.set(shouldSelect ? new Set(this.rowIndex().keys()) : new Set());
        this.emitSelectionChanged();

        // Sync AG's live node selection for every currently-visible data row. Flat (ungrouped)
        // rows carry no KbqAgGridRowGroup metadata at all — only group headers do, and those
        // stay unselectable, so matching every non-group row (no further predicate) is correct
        // in both modes.
        this.syncNodeSelection(api, () => true, shouldSelect);
    }

    /**
     * Sets the selection state of a single data row identified by `id` (see
     * `kbqAgGridRowGroupRowId`) — including a row currently hidden inside a collapsed group,
     * which AG Grid's own selection API cannot reach at all since it has no row node for it.
     * Group rows are never selectable this way; use `onGroupCheckboxClick` /
     * `onSelectAllCheckboxClick` to change a whole group's or the whole dataset's selection.
     */
    setRowSelected(id: string | number, selected: boolean): void {
        const key = String(id);
        this.selectedRowIds.update((set) => {
            const next = new Set(set);
            if (selected) next.add(key);
            else next.delete(key);
            return next;
        });
        this.emitSelectionChanged();

        // Sync AG's live node selection if this row happens to be currently visible — if it's
        // hidden inside a collapsed group, the "update rowData" effect restores it on expand.
        const api = this.api();
        if (!api) return;
        this.syncNodeSelection(
            api,
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            (row) => !!row.KbqAgGridRowGroup && row.KbqAgGridRowGroup.id === key,
            selected
        );
    }

    /**
     * Sets the group column's sort direction programmatically — `'asc'`, `'desc'`, or `null` to
     * clear it. Goes through AG Grid's own column state API (`applyColumnState`), the same
     * mechanism a real header click uses, so the header's sort arrow / `aria-sort` stay in sync
     * automatically — there's no need (and no supported way) to set `groupColSort` directly, or
     * to reach into `GridApi` yourself, since the group column's `colId` is an internal detail.
     */
    setGroupColSort(sort: SortDirection): void {
        const api = this.api();
        if (!api) {
            if (isDevMode()) {
                console.warn(
                    'KbqAgGridRowGroup: setGroupColSort() called before the grid is ready — this ' +
                        'call is not deferred or replayed, unlike groupCols/collapsedPaths. Call it ' +
                        'after gridReady (e.g. from a click handler), not from ngOnInit.'
                );
            }
            return;
        }
        api.applyColumnState({ state: [{ colId: GROUP_COL_ID, sort }] });
    }

    /** Toggles the collapsed / expanded state of the group at `path`. */
    toggleCollapse(path: string): void {
        const next = new Set(this.collapsedPaths());
        if (next.has(path)) {
            // Expanding: reveal children, but start them collapsed
            next.delete(path);
            for (const subPath of this.computeSubGroupPaths(path)) {
                next.add(subPath);
            }
        } else {
            next.add(path);
        }
        this._collapsedPaths.set(next);
    }

    /**
     * Sets the expanded / collapsed state of the group at `groupPath` — an ordered array of raw
     * field *values* (not field names), outermost group first, e.g. `['Russia', 'Diving']` to
     * address the "Diving" sub-group under "Russia". Pass `true` to expand: every ancestor along
     * the way is expanded too, so the target group becomes visible without calling this once per
     * level in the right order yourself. Pass `false` to collapse just the target group.
     *
     * @example
     * ```ts
     * group.setExpanded(['Russia', 'Diving'], true);
     * ```
     */
    setExpanded(groupPath: KbqAgGridRowGroupPath, expanded: boolean): void {
        if (groupPath.length === 0) return;

        const next = new Set(this.collapsedPaths());
        let leafPath = '';
        for (const value of groupPath) {
            const segment = toKey(value);
            leafPath = leafPath ? `${leafPath}${PATH_SEPARATOR}${segment}` : segment;
            if (expanded) {
                // Expanding: reveal children, but start them collapsed — walking the chain from
                // the root down means this also auto-expands every ancestor of the target group.
                next.delete(leafPath);
                for (const subPath of this.computeSubGroupPaths(leafPath)) {
                    next.add(subPath);
                }
            }
        }
        if (!expanded) next.add(leafPath);

        this._collapsedPaths.set(next);
    }

    /** Expands all groups. */
    expandAll(): void {
        this._collapsedPaths.set(new Set());
    }

    /** Collapses all top-level groups. */
    collapseAll(): void {
        this._collapsedPaths.set(this.computeTopLevelPaths());
    }

    /** Moves the group column at `fromIndex` to `toIndex`. Top-level groups collapse after reorder. */
    moveGroupColumn(fromIndex: number, toIndex: number): void {
        const cols = [...this.groupCols()];
        const [item] = cols.splice(fromIndex, 1);
        cols.splice(toIndex, 0, item);
        this.groupCols.set(cols);
    }

    /** Removes all group columns, returning the grid to a flat (ungrouped) view. */
    clearGroupColumns(): void {
        this.groupCols.set([]);
        this._collapsedPaths.set(new Set());
    }

    private makeGroupColDef(): ColDef {
        return {
            ...this.groupColOptions(),
            // Everything below is fixed and cannot be overridden via `groupColOptions()` /
            // `KBQ_AG_GRID_ROW_GROUP_COL_OPTIONS` — it's spread after the line above, so any
            // matching key there always loses:
            //  - filter / suppressHeaderFilterButton: this column shows a *different*
            //    underlying field's value depending on the row's nesting level (see
            //    `makeRowGroupData`), so there is no single field a per-value filter UI could
            //    filter against — enabling it would be broken, not just unstyled.
            //  - suppressHeaderMenuButton: same reason — there's no column menu (filter /
            //    columns list) that makes sense for a synthetic, level-dependent column.
            //  - colId: this exact id is how the directive finds this column elsewhere
            //    (adding/removing it from columnDefs, reading its sort state below) — letting
            //    it be overridden would silently break those lookups.
            //  - sortable / sort / comparator: sorting is handled entirely by this directive
            //    via `groupColSort`, not by AG Grid's own array sort — `comparator` always
            //    reporting "equal" makes AG's (stable) native sort a no-op, leaving the
            //    already-correctly-ordered `rowData` we build ourselves untouched. `sortable`,
            //    the header click/arrow/aria-sort behavior, and the asc → desc → none cycle are
            //    otherwise 100% native AG Grid; `sort` just keeps the header arrow in sync with
            //    `groupColSort` if this column is ever removed and re-added (see the "add/remove
            //    Group column" effect). Every DATA column gets this same `comparator` no-op
            //    treatment too, while grouping is active — see `makeDataColDefs`.
            filter: false,
            suppressHeaderMenuButton: true,
            suppressHeaderFilterButton: true,
            colId: GROUP_COL_ID,
            sortable: true,
            sort: this.groupColSort(),
            comparator: (): number => 0,
            cellRenderer: KbqAgGridRowGroupCellRenderer,
            cellRendererParams: { rowGroup: this } satisfies Pick<KbqAgGridRowGroupCellRendererParams, 'rowGroup'>
        };
    }

    /**
     * Applies the group column's `comparator: () => 0` no-op trick (see `makeGroupColDef`) to
     * every DATA column too, recursively including columns nested under `ColGroupDef.children`.
     * While grouping is active, AG Grid's own native array sort over a data column would scatter
     * our synthetic group-header rows (which carry none of the data fields) throughout
     * `rowData`, destroying the grouped tree. AG's own sort UI (header click / arrow /
     * aria-sort) stays fully native — only the actual row reordering is suppressed here; the
     * `sortChanged` subscription performs the real reorder instead, restricted to leaf rows
     * within each deepest group (see `resolveRowGroupDataSort`). `sortable` is left exactly as
     * the consumer configured it (or AG's own default) — unaffected by this override. Only
     * called while grouping is active; when ungrouped, `originalColDefs` is restored untouched
     * and data columns sort with AG's fully native behavior (no group-header rows to scatter).
     */
    private makeDataColDefs(): (ColDef | ColGroupDef)[] {
        return mapColDefTree(this.originalColDefs, (def) => ({ ...def, comparator: (): number => 0 }));
    }

    /** Every columnDefs write this directive itself makes (adding/removing the Group column,
     * restoring `originalColDefs`) goes through here rather than a bare `api.setGridOption`
     * call — purely for symmetry/documentation with the `newColumnsLoaded` resync subscription
     * in the constructor, which relies on this call's resulting event reporting
     * `source: 'api'` (AG Grid's default when no explicit source is passed) to recognize it as
     * self-caused, as opposed to `source: 'gridOptionsChanged'` for the consumer's own
     * `[columnDefs]` input changing. */
    private setColumnDefsInternally(api: GridApi, colDefs: (ColDef | ColGroupDef)[]): void {
        api.setGridOption('columnDefs', colDefs);
    }

    private makeSelectionColumnDef(): SelectionColumnDef {
        return {
            headerComponent: KbqAgGridRowGroupSelectAllHeaderCellRenderer,
            headerComponentParams: {
                rowGroup: this
            } satisfies Pick<KbqAgGridRowGroupHeaderCellRendererParams, 'rowGroup'>,
            cellRendererSelector: (params: ICellRendererParams<Row>): CellRendererSelectorResult | undefined => {
                if (!isGroupHeaderRow(params.data)) return undefined;
                return {
                    component: KbqAgGridRowGroupSelectionCellRenderer,
                    params: { rowGroup: this } satisfies Pick<KbqAgGridRowGroupCellRendererParams, 'rowGroup'>
                };
            }
        };
    }

    private makeRowClassRules(): RowClassRules<Row> {
        return {
            // untracked: this callback may run synchronously inside the "update rowData" effect
            // (AG Grid evaluates rowClassRules while processing setGridOption('rowData', ...)).
            // groupSelectionState can't be written anymore (it's a computed()), so this can't
            // self-trigger — but reading it untracked still keeps the main effect from gaining
            // a spurious dependency on selection state and rebuilding rowData on every click.
            'ag-row-selected': (params) =>
                untracked(() => {
                    const row = params.data;
                    if (!row || !isGroupHeaderRow(row)) return false;
                    return this.getGroupSelectionState(row.KbqAgGridRowGroup.path) === 'checked';
                })
        };
    }

    /**
     * Marks matching, currently-loaded data-row nodes as programmatic and applies `selected` via
     * AG's own `setSelected()`. Group rows are always skipped (never independently selectable).
     * Skips nodes already at the target value — `setSelected()` is a no-op with no event for
     * those, so marking them anyway would leave a stale `programmaticallySetNodes` entry that
     * later swallows a real user selection event for that same node.
     */
    private syncNodeSelection(api: GridApi, matches: (row: DataRow) => boolean, selected: boolean): void {
        api.forEachNode((node: IRowNode<Row>) => {
            const row = node.data;
            if (!row || isGroupHeaderRow(row)) return;
            if (!matches(row)) return;
            if (node.isSelected() === selected) return;
            this.programmaticallySetNodes.add(node);
            node.setSelected(selected, false);
        });
    }

    /** Resolves `selectedRowIds` back to full `RowData` objects and emits `rowSelectionChanged`. */
    private emitSelectionChanged(): void {
        const selected = this.selectedRowIds();
        const rows: RowData[] = [];
        for (const [row, id] of this.rowIdMap()) {
            if (selected.has(id)) rows.push(row);
        }
        this.rowSelectionChanged.emit(rows);
    }

    /**
     * Splits the single active sort (see `_activeSort`) into the group/leaf shape
     * `makeRowGroupData` expects. A data-column `colId` not found in `dataColIdToField` (e.g. a
     * `sortChanged` event racing a `newColumnsLoaded` resync still in flight) degrades to
     * "no sort applied" rather than throwing.
     */
    private resolveRowGroupDataSort(): RowGroupDataSort {
        const active = this._activeSort();
        if (!active) return { group: null, leaf: null };
        if (active.colId === GROUP_COL_ID) return { group: active.sort, leaf: null };
        const field = this.dataColIdToField.get(active.colId);
        return field ? { group: null, leaf: { field, direction: active.sort } } : { group: null, leaf: null };
    }

    private computeGroupedData(): RowData[] {
        const fields = this.groupCols();
        const data = this.data();
        if (fields.length === 0) return data;

        return makeRowGroupData(data, fields, this.rowIdMap(), this.collapsedPaths(), this.resolveRowGroupDataSort());
    }

    private computeSubGroupPaths(expandedPath: string): ReadonlySet<string> {
        const fields = this.groupCols();
        const pathParts = expandedPath.split(PATH_SEPARATOR);
        const subField = fields[pathParts.length];
        if (!subField) return new Set<string>();

        const filteredData = this.data().filter((row) => {
            for (let i = 0; i < pathParts.length; i++) {
                const field = fields[i];
                if (!field) return false;
                const fieldVal = row[field];
                const key = toKey(fieldVal);
                if (key !== pathParts[i]) return false;
            }
            return true;
        });

        const paths = new Set<string>();
        for (const row of filteredData) {
            const val = row[subField];
            paths.add(`${expandedPath}${PATH_SEPARATOR}${toKey(val)}`);
        }
        return paths;
    }

    private computeTopLevelPaths(): ReadonlySet<string> {
        const [firstField] = this.groupCols();
        if (!firstField) return new Set<string>();
        const paths = new Set<string>();
        for (const row of this.data()) {
            const val = row[firstField];
            paths.add(toKey(val));
        }
        return paths;
    }
}
