import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    DestroyRef,
    Directive,
    effect,
    inject,
    InjectionToken,
    input,
    model,
    Provider,
    signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular, ICellRendererAngularComp } from 'ag-grid-angular';
import { ColDef, ColGroupDef, GridApi, ICellRendererParams, IRowNode } from 'ag-grid-community';

/** A plain input data row — any object with string keys. */
type RowData = Record<string, unknown>;

const PATH_SEPARATOR = '::';

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
    };
};

/** Any row in the grouped dataset — either a group header or a data row. */
type Row = GroupHeaderRow | DataRow;

const toKey = (value: unknown): string =>
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';

// eslint-disable-next-line @typescript-eslint/max-params
function makeRowGroupData(
    data: RowData[],
    groupFields: readonly string[],
    collapsedPaths: ReadonlySet<string> = new Set(),
    level = 0,
    ancestors: readonly string[] = [],
    pathPrefix = ''
): Row[] {
    if (groupFields.length === 0) {
        return data.map((row) => ({
            ...row,
            KbqAgGridRowGroup: { isGroup: false as const, level, ancestors }
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

    for (const [key, rows] of groups) {
        const path = pathPrefix ? `${pathPrefix}${PATH_SEPARATOR}${key}` : key;
        const collapsed = collapsedPaths.has(path);

        result.push({
            KbqAgGridRowGroup: {
                isGroup: true,
                level,
                path,
                ancestors,
                key,
                field: currentField,
                count: rows.length
            }
        });

        if (!collapsed) {
            result.push(
                ...makeRowGroupData(rows, remainingFields, collapsedPaths, level + 1, [...ancestors, path], path)
            );
        }
    }

    return result;
}

type KbqAgGridRowGroupCellRendererParams = ICellRendererParams<Row> & { rowGroup: KbqAgGridRowGroup };

const isGroupHeaderRow = (row: Row | null | undefined): row is GroupHeaderRow => !!row?.KbqAgGridRowGroup.isGroup;

@Component({
    standalone: true,
    selector: 'kbq-ag-grid-group-cell-renderer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'kbq-ag-grid-group-cell-renderer' },
    template: `
        @if (isGroup) {
            <!-- eslint-disable-next-line @angular-eslint/template/no-inline-styles -->
            <div class="kbq-ag-grid-group-cell-renderer__inner" [style.padding-left.px]="indent">
                <i
                    class="kbq-ag-grid-group-cell-renderer__icon kbq kbq-icon"
                    [class.kbq-chevron-down_16]="!collapsed"
                    [class.kbq-chevron-right_16]="collapsed"
                    (click)="toggle()"
                ></i>
                <span class="kbq-ag-grid-group-cell-renderer__key">{{ row.KbqAgGridRowGroup.key }}</span>
                <span class="kbq-ag-grid-group-cell-renderer__count">({{ row.KbqAgGridRowGroup.count }})</span>
            </div>
        }
    `
})
class KbqAgGridRowGroupCellRenderer implements ICellRendererAngularComp {
    private readonly cdr = inject(ChangeDetectorRef);
    private groupState: KbqAgGridRowGroup | null = null;

    protected isGroup = false;

    protected row: GroupHeaderRow = {
        KbqAgGridRowGroup: { isGroup: true, level: 0, path: '', ancestors: [], key: '', field: '', count: 0 }
    };

    protected indent = 8;
    protected collapsed = false;

    agInit(params: KbqAgGridRowGroupCellRendererParams): void {
        const { data } = params;
        this.isGroup = isGroupHeaderRow(data);
        if (!isGroupHeaderRow(data)) return;
        this.groupState = params.rowGroup;
        this.updateFromParams(data);
    }

    refresh(params: KbqAgGridRowGroupCellRendererParams): boolean {
        const { data } = params;
        this.isGroup = isGroupHeaderRow(data);
        if (!isGroupHeaderRow(data)) {
            this.cdr.markForCheck();
            return true;
        }
        this.updateFromParams(data);
        return true;
    }

    protected toggle(): void {
        this.groupState?.toggleCollapse(this.row.KbqAgGridRowGroup.path);
    }

    private updateFromParams(row: GroupHeaderRow): void {
        this.row = row;
        const { level, path } = row.KbqAgGridRowGroup;
        this.indent = level * 20 + 8;
        this.collapsed = this.groupState?.isCollapsed(path) ?? false;
        this.cdr.markForCheck();
    }
}

/**
 * Directive that implements client-side row grouping without AG Grid Enterprise.
 *
 * Attach to `ag-grid-angular` and supply raw data via `[kbqAgGridRowGroupRowData]`
 * instead of the usual `[rowData]`. The directive manages data transformation and
 * exposes an API for controlling grouping programmatically.
 *
 * @example
 * ```html
 * <ag-grid-angular
 *   #group="kbqAgGridRowGroup"
 *   kbqAgGridTheme
 *   kbqAgGridRowGroup
 *   [kbqAgGridRowGroupRowData]="rowData()"
 *   [(kbqAgGridRowGroupCols)]="groupCols"
 *   [columnDefs]="columnDefs"
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

    /** Set of group paths that are currently collapsed. */
    readonly collapsedPaths = signal<ReadonlySet<string>>(new Set());

    private originalColDefs: (ColDef | ColGroupDef)[] = [];
    private groupColShown = false;
    /** Nodes whose next `rowSelected` event was caused by our own `setSelected()` call — skip to prevent re-entrant cascades. */
    private readonly programmaticallySetNodes = new WeakSet();
    /** Deferred collapse: set on gridReady when groupCols is non-empty; cleared once data is available. */
    private needsInitialCollapse = false;
    /** Previous groupCols reference — compared by identity to detect structural changes. */
    private prevGroupCols: string[] | null = null;

    constructor() {
        // Reactive: update rowData whenever data, groupCols, or collapsedPaths change
        effect(
            () => {
                const api = this.api();
                if (!api) return;

                const groupCols = this.groupCols();

                // When the grouping structure changes, collapse all top-level groups (matches AG Grid behavior).
                // Writing here is picked up immediately by the collapsedPaths() read below, so the render
                // uses the fresh collapsed set in the same effect run (no extra round-trip needed).
                if (this.prevGroupCols !== null && this.prevGroupCols !== groupCols) {
                    this.collapsedPaths.set(this.computeTopLevelPaths());
                }
                this.prevGroupCols = groupCols;

                // Read collapsedPaths to track it as a dep even on the early-return path below,
                // so the effect re-runs after the initial-collapse write.
                this.collapsedPaths();
                const data = this.data();

                // When groupCols is bound non-empty before data arrives, collapse on first data load.
                if (this.needsInitialCollapse && data.length > 0) {
                    this.needsInitialCollapse = false;
                    this.collapsedPaths.set(this.computeTopLevelPaths());
                    return;
                }

                // Snapshot selected group paths before rowData is replaced.
                // Also mark old selected nodes so their async deselect events (fired when
                // setGridOption replaces rowData) are ignored and don't cascade.
                const selectedGroupPaths = new Set<string>();
                api.forEachNode((node: IRowNode<Partial<Row> | undefined>) => {
                    if (!node.isSelected()) return;
                    this.programmaticallySetNodes.add(node);
                    const row = node.data;
                    if (row?.KbqAgGridRowGroup?.isGroup) selectedGroupPaths.add(row.KbqAgGridRowGroup.path);
                });

                api.setGridOption('rowData', this.computeGroupedData());

                // Restore group selection and propagate to newly visible children
                if (selectedGroupPaths.size === 0) return;
                api.forEachNode((node: IRowNode<Row>) => {
                    const row = node.data;
                    if (!row) return;
                    const meta = row.KbqAgGridRowGroup;
                    const shouldSelect =
                        (meta.isGroup && selectedGroupPaths.has(meta.path)) ||
                        meta.ancestors.some((a) => selectedGroupPaths.has(a));
                    if (shouldSelect) {
                        this.programmaticallySetNodes.add(node);
                        node.setSelected(true, false);
                    }
                });
                // allowSignalWrites: the initial-collapse branch writes collapsedPaths to trigger a
                // second run that renders the collapsed groups.
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
                api.setGridOption('columnDefs', [this.makeGroupColDef(), ...this.originalColDefs]);
            } else if (!needsGroupCol && this.groupColShown) {
                this.groupColShown = false;
                api.setGridOption('columnDefs', this.originalColDefs);
            }
        });

        this.grid.gridReady.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ api }) => {
            this.originalColDefs = api.getColumnDefs() ?? [];
            // Delay the signal write to avoid triggering effects during the gridReady
            // render cycle (which would cause AG Grid error #252).
            queueMicrotask(() => {
                if (this.groupCols().length > 0) {
                    this.needsInitialCollapse = true;
                }
                this.api.set(api);
            });
        });

        this.grid.rowSelected.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ node }) => {
            // Skip events caused by our own programmatic setSelected calls
            if (this.programmaticallySetNodes.has(node)) {
                this.programmaticallySetNodes.delete(node);
                return;
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            const row = node.data as Row | undefined;
            // In flat mode rows have no KbqAgGridRowGroup metadata — skip propagation
            if (!row?.KbqAgGridRowGroup) return;

            const api = this.api();
            if (!api) return;

            const selected = !!node.isSelected();

            // Top-down: propagate selection to all visible descendants
            if (row.KbqAgGridRowGroup.isGroup) {
                const { path } = row.KbqAgGridRowGroup;
                api.forEachNode((childNode: IRowNode<Row>) => {
                    if (childNode.data?.KbqAgGridRowGroup.ancestors.includes(path)) {
                        this.programmaticallySetNodes.add(childNode);
                        childNode.setSelected(selected, false);
                    }
                });
            }

            // Bottom-up: recalculate each ancestor group's checked state (deepest first)
            const { ancestors } = row.KbqAgGridRowGroup;
            for (let i = ancestors.length - 1; i >= 0; i--) {
                const ancestorPath = ancestors[i];
                if (!ancestorPath) continue;
                const fullySelected = this.isGroupFullySelected(ancestorPath, api);
                api.forEachNode((ancestorNode: IRowNode<Row>) => {
                    const ancestorRow = ancestorNode.data;
                    if (ancestorRow?.KbqAgGridRowGroup.isGroup && ancestorRow.KbqAgGridRowGroup.path === ancestorPath) {
                        this.programmaticallySetNodes.add(ancestorNode);
                        ancestorNode.setSelected(fullySelected, false);
                    }
                });
            }
        });
    }

    /** Returns `true` if the group at `path` is currently collapsed. */
    isCollapsed(path: string): boolean {
        return this.collapsedPaths().has(path);
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
        this.collapsedPaths.set(next);
    }

    /**
     * Sets the expanded / collapsed state of the group at `path`.
     * Pass `true` to expand, `false` to collapse.
     */
    setExpanded(path: string, expanded: boolean): void {
        const next = new Set(this.collapsedPaths());
        if (expanded) {
            next.delete(path);
            for (const subPath of this.computeSubGroupPaths(path)) {
                next.add(subPath);
            }
        } else {
            next.add(path);
        }
        this.collapsedPaths.set(next);
    }

    /** Expands all groups. */
    expandAll(): void {
        this.collapsedPaths.set(new Set());
    }

    /** Collapses all top-level groups. */
    collapseAll(): void {
        this.collapsedPaths.set(this.computeTopLevelPaths());
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
        this.collapsedPaths.set(new Set());
    }

    private makeGroupColDef(): ColDef {
        return {
            ...this.groupColOptions(),
            sortable: false,
            filter: false,
            suppressHeaderMenuButton: true,
            suppressHeaderFilterButton: true,
            colId: KbqAgGridRowGroup.name,
            cellRenderer: KbqAgGridRowGroupCellRenderer,
            cellRendererParams: { rowGroup: this } satisfies Pick<KbqAgGridRowGroupCellRendererParams, 'rowGroup'>
        };
    }

    private computeGroupedData(): RowData[] {
        const fields = this.groupCols();
        const data = this.data();
        if (fields.length === 0) return data;

        return makeRowGroupData(data, fields, this.collapsedPaths());
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

    /** Returns `true` when every direct child of `groupPath` is currently selected. */
    private isGroupFullySelected(groupPath: string, api: GridApi): boolean {
        let childCount = 0;
        let selectedCount = 0;

        api.forEachNode((node: IRowNode<Row>) => {
            const row = node.data;
            if (!row?.KbqAgGridRowGroup) return;
            if (row.KbqAgGridRowGroup.ancestors.at(-1) !== groupPath) return;
            childCount += 1;
            if (node.isSelected()) selectedCount += 1;
        });

        return childCount > 0 && childCount === selectedCount;
    }
}
