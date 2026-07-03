import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    DestroyRef,
    Directive,
    effect,
    inject,
    input,
    signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular, ICellRendererAngularComp } from 'ag-grid-angular';
import { ColDef, ColGroupDef, GridApi, ICellRendererParams } from 'ag-grid-community';

type KbqAgGridRowGroupData = Record<string, unknown>;

/** A group (header) row in the flattened grouped data. */
type KbqAgGridGroupRow = {
    readonly _kbqIsGroup: true;
    readonly _kbqLevel: number;
    readonly _kbqPath: string;
    readonly _kbqAncestors: readonly string[];
    readonly _kbqKey: string;
    readonly _kbqField: string;
    readonly _kbqCount: number;
};

type KbqAgGridLeafRow = KbqAgGridRowGroupData & {
    readonly _kbqIsGroup: false;
    readonly _kbqLevel: number;
    readonly _kbqAncestors: readonly string[];
};

type KbqAgGridFlatRow = KbqAgGridGroupRow | KbqAgGridLeafRow;

// eslint-disable-next-line @typescript-eslint/max-params
function makeRowGroupData(
    data: KbqAgGridRowGroupData[],
    groupFields: readonly string[],
    collapsedPaths: ReadonlySet<string> = new Set(),
    level = 0,
    ancestors: readonly string[] = [],
    pathPrefix = ''
): KbqAgGridFlatRow[] {
    if (groupFields.length === 0) {
        return data.map((row) => ({
            ...row,
            _kbqIsGroup: false as const,
            _kbqLevel: level,
            _kbqAncestors: ancestors
        }));
    }

    const [currentField, ...remainingFields] = groupFields;
    const groups = new Map<string, KbqAgGridRowGroupData[]>();

    for (const row of data) {
        const key = String(row[currentField] ?? '');
        const existing = groups.get(key);
        if (existing) {
            existing.push(row);
        } else {
            groups.set(key, [row]);
        }
    }

    const result: KbqAgGridFlatRow[] = [];

    for (const [key, rows] of groups) {
        const path = pathPrefix ? `${pathPrefix}::${key}` : key;
        const collapsed = collapsedPaths.has(path);

        result.push({
            _kbqIsGroup: true,
            _kbqLevel: level,
            _kbqPath: path,
            _kbqAncestors: ancestors,
            _kbqKey: key,
            _kbqField: currentField,
            _kbqCount: rows.length
        });

        if (!collapsed) {
            result.push(
                ...makeRowGroupData(rows, remainingFields, collapsedPaths, level + 1, [...ancestors, path], path)
            );
        }
    }

    return result;
}

type KbqAgGridRowGroupCellRendererParams = ICellRendererParams<KbqAgGridFlatRow> & { rowGroup: KbqAgGridRowGroup };

@Component({
    standalone: true,
    selector: 'kbq-ag-grid-group-cell-renderer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'kbq-ag-grid-group-cell-renderer' },
    styles: `
        :host {
            display: block;
            width: 100%;
            height: 100%;
            user-select: none;
        }

        .kbq-ag-grid-group-cell-renderer__inner {
            display: flex;
            align-items: center;
            gap: 6px;
            height: 100%;
            padding-right: 8px;
            font-weight: 600;
            cursor: pointer;
        }

        .kbq-ag-grid-group-cell-renderer__icon {
            font-size: 10px;
            flex-shrink: 0;
        }

        .kbq-ag-grid-group-cell-renderer__count {
            color: var(--kbq-foreground-secondary, #888);
            font-weight: 400;
        }
    `,
    template: `
        @if (isGroup) {
            <!-- eslint-disable-next-line @angular-eslint/template/no-inline-styles -->
            <div class="kbq-ag-grid-group-cell-renderer__inner" [style.padding-left.px]="indent" (click)="toggle()">
                <span class="kbq-ag-grid-group-cell-renderer__icon">{{ collapsed ? '▶' : '▼' }}</span>
                <span class="kbq-ag-grid-group-cell-renderer__key">{{ row._kbqKey }}</span>
                <span class="kbq-ag-grid-group-cell-renderer__count">({{ row._kbqCount }})</span>
            </div>
        }
    `
})
class KbqAgGridRowGroupCellRenderer implements ICellRendererAngularComp {
    private readonly cdr = inject(ChangeDetectorRef);
    private groupState: KbqAgGridRowGroup | null = null;

    protected isGroup = false;

    protected row: KbqAgGridGroupRow = {
        _kbqIsGroup: true,
        _kbqLevel: 0,
        _kbqPath: '',
        _kbqAncestors: [],
        _kbqKey: '',
        _kbqField: '',
        _kbqCount: 0
    };

    protected indent = 8;
    protected collapsed = false;

    agInit(params: KbqAgGridRowGroupCellRendererParams): void {
        const { data } = params;
        this.isGroup = !!data?._kbqIsGroup;
        if (!data?._kbqIsGroup) return;
        this.groupState = params.rowGroup;
        this.updateFromParams(data);
    }

    refresh(params: KbqAgGridRowGroupCellRendererParams): boolean {
        const { data } = params;
        this.isGroup = !!data?._kbqIsGroup;
        if (!data?._kbqIsGroup) {
            this.cdr.markForCheck();
            return true;
        }
        this.updateFromParams(data);
        return true;
    }

    protected toggle(): void {
        this.groupState?.toggleCollapse(this.row._kbqPath);
    }

    private updateFromParams(row: KbqAgGridGroupRow): void {
        this.row = row;
        this.indent = row._kbqLevel * 20 + 8;
        this.collapsed = this.groupState?.isCollapsed(row._kbqPath) ?? false;
        this.cdr.markForCheck();
    }
}

/**
 * Directive that implements client-side row grouping without AG Grid Enterprise.
 *
 * Attach to `ag-grid-angular` and supply raw data via `[kbqAgGridRowGroupRowData]`
 * instead of the usual `[rowData]`. The directive manages data transformation and
 * exposes an API consumed by {@link KbqAgGridGroupPanel}.
 *
 * @example
 * ```html
 * <ag-grid-angular
 *   #group="kbqAgGridRowGroup"
 *   kbqAgGridTheme
 *   kbqAgGridRowGroup
 *   [kbqAgGridRowGroupRowData]="rowData()"
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
    readonly data = input<KbqAgGridRowGroupData[]>([], { alias: 'kbqAgGridRowGroupRowData' });

    /** Column fields currently used for grouping, in order (first = outermost group). */
    readonly groupCols = signal<string[]>([]);

    /** Set of group paths that are currently collapsed. */
    readonly collapsedPaths = signal<ReadonlySet<string>>(new Set());

    private originalColDefs: (ColDef | ColGroupDef)[] = [];
    private groupColShown = false;
    private propagatingSelection = false;

    constructor() {
        // Reactive: update rowData whenever data, groupCols, or collapsedPaths change
        effect(() => {
            const api = this.api();
            if (!api) return;

            // Snapshot selected group paths before rowData is replaced
            const selectedGroupPaths = new Set<string>();
            api.forEachNode((node) => {
                if (!node.isSelected()) return;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
                const data = node.data as KbqAgGridFlatRow | undefined;
                if (data?._kbqIsGroup) selectedGroupPaths.add(data._kbqPath);
            });

            api.setGridOption('rowData', this.computeGroupedData());

            // Restore group selection and propagate to newly visible children
            if (selectedGroupPaths.size === 0) return;
            this.propagatingSelection = true;
            api.forEachNode((node) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
                const data = node.data as KbqAgGridFlatRow | undefined;
                if (!data) return;
                const shouldSelect =
                    (data._kbqIsGroup && selectedGroupPaths.has(data._kbqPath)) ||
                    data._kbqAncestors.some((a) => selectedGroupPaths.has(a));
                if (shouldSelect) node.setSelected(true, false);
            });
            this.propagatingSelection = false;
        });

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
            queueMicrotask(() => this.api.set(api));
        });

        this.grid.rowSelected.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ node }) => {
            if (this.propagatingSelection) return;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            const data = node.data as KbqAgGridFlatRow | undefined;
            if (!data?._kbqIsGroup) return;

            const api = this.api();
            if (!api) return;

            const selected = !!node.isSelected();
            const { _kbqPath } = data;

            this.propagatingSelection = true;
            api.forEachNode((childNode) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
                const childData = childNode.data as KbqAgGridFlatRow | undefined;
                if (childData?._kbqAncestors.includes(_kbqPath)) {
                    childNode.setSelected(selected, false);
                }
            });
            this.propagatingSelection = false;
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

    /** Appends `field` to the list of group columns. No-op if already present. */
    addGroupColumn(field: string): void {
        if (this.groupCols().includes(field)) return;
        this.groupCols.update((cols) => [...cols, field]);
        this.collapseAll();
    }

    /** Removes `field` from the list of group columns. */
    removeGroupColumn(field: string): void {
        this.groupCols.update((cols) => cols.filter((c) => c !== field));
        this.collapseAll();
    }

    /** Moves the group column at `fromIndex` to `toIndex`. */
    moveGroupColumn(fromIndex: number, toIndex: number): void {
        const cols = [...this.groupCols()];
        const [item] = cols.splice(fromIndex, 1);
        cols.splice(toIndex, 0, item);
        this.groupCols.set(cols);
        this.collapseAll();
    }

    /** Removes all group columns, returning the grid to a flat (ungrouped) view. */
    clearGroupColumns(): void {
        this.groupCols.set([]);
        this.collapsedPaths.set(new Set());
    }

    private makeGroupColDef(): ColDef {
        return {
            colId: '_kbq_group',
            headerName: 'Group',
            cellRenderer: KbqAgGridRowGroupCellRenderer,
            cellRendererParams: { rowGroup: this } satisfies Pick<KbqAgGridRowGroupCellRendererParams, 'rowGroup'>
        };
    }

    private computeGroupedData(): KbqAgGridRowGroupData[] {
        const fields = this.groupCols(); // tracked
        const data = this.data(); // tracked
        if (fields.length === 0) return data;

        return makeRowGroupData(data, fields, this.collapsedPaths());
    }

    private computeSubGroupPaths(expandedPath: string): ReadonlySet<string> {
        const fields = this.groupCols();
        const pathParts = expandedPath.split('::');
        const subField = fields[pathParts.length];
        if (!subField) return new Set<string>();

        const filteredData = this.data().filter((row) => {
            for (let i = 0; i < pathParts.length; i++) {
                const field = fields[i];
                if (!field) return false;
                const fieldVal = row[field];
                const key =
                    typeof fieldVal === 'string' || typeof fieldVal === 'number' || typeof fieldVal === 'boolean'
                        ? String(fieldVal)
                        : '';
                if (key !== pathParts[i]) return false;
            }
            return true;
        });

        const paths = new Set<string>();
        for (const row of filteredData) {
            const val = row[subField];
            paths.add(
                `${expandedPath}::${typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' ? String(val) : ''}`
            );
        }
        return paths;
    }

    private computeTopLevelPaths(): ReadonlySet<string> {
        const [firstField] = this.groupCols();
        if (!firstField) return new Set<string>();
        const paths = new Set<string>();
        for (const row of this.data()) {
            const val = row[firstField];
            paths.add(
                typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' ? String(val) : ''
            );
        }
        return paths;
    }
}
