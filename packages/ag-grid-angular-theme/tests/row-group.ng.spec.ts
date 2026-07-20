import { Component, Directive, forwardRef, input, signal, Type, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { render, waitFor } from '@testing-library/angular';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, ColGroupDef, GridApi, IRowNode } from 'ag-grid-community';
import { Subject } from 'rxjs';
import {
    KBQ_AG_GRID_ROW_GROUP_COLLAPSED_STATE_STORE,
    KBQ_AG_GRID_ROW_GROUP_SELECTION_STATE_STORE,
    KbqAgGridRowGroup,
    KbqAgGridRowGroupCellContent,
    KbqAgGridRowGroupCollapsedStateLocalStorageStore,
    KbqAgGridRowGroupCollapsedStateQueryParamsStore,
    KbqAgGridRowGroupCollapsedStateStore,
    KbqAgGridRowGroupInfo,
    KbqAgGridRowGroupRowId,
    KbqAgGridRowGroupSelectionStateLocalStorageStore,
    KbqAgGridRowGroupSelectionStateQueryParamsStore,
    KbqAgGridRowGroupSelectionStateStore,
    kbqAgGridRowGroupCollapsedStateStoreProvider,
    kbqAgGridRowGroupSelectionStateStoreProvider
} from '../src/row-group.ng';

/** Shared row id extractor bound on every test host below — resolves each row's `id` field. */
const testRowId: KbqAgGridRowGroupRowId = (row) => String(row.id);

/** Mirrors the production path encoding (see `toKey`/`makeRowGroupData` in row-group.ng.ts) so
 * tests can build an expected `path`/`ancestors` value without hardcoding its internal format. */
const groupPath = (...values: unknown[]): string => JSON.stringify(values.map((value) => JSON.stringify(value)));

type MockNode = {
    data: Record<string, unknown>;
    isSelected: () => boolean;
    setSelected: jest.Mock;
};

const makeMockNode = (data: Record<string, unknown>, selected = false): MockNode => {
    let _selected = selected;
    return {
        data,
        isSelected: () => _selected,
        setSelected: jest.fn((val: boolean) => {
            _selected = val;
        })
    };
};

const INITIAL_COL_DEFS: ColDef[] = [{ field: 'country' }, { field: 'sport' }];

/** Overridable per-test initial columnDefs — reset to `INITIAL_COL_DEFS` in `afterEach` below.
 * Lets a test (e.g. one exercising `ColGroupDef` nesting) configure the columns the mock grid
 * reports from `getColumnDefs()` without threading a param through every `createApiMock` call. */
let testColDefs: (ColDef | ColGroupDef)[] = INITIAL_COL_DEFS;

type MockColumnState = {
    colId: string;
    sort: 'asc' | 'desc' | null;
    sortIndex?: number | null;
    hide?: boolean | null;
};

const createApiMock = (
    onNodeRemoved: (node: MockNode) => void,
    onSortStateApplied: () => void,
    onColumnDefsSet: (source: string) => void
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
    const _nodes: MockNode[] = [];
    let _colDefs: (ColDef | ColGroupDef)[] = [...testColDefs];
    let _columnState: MockColumnState[] = [];
    const _gridOptions: Record<string, unknown> = {};

    return {
        getColumnDefs: jest.fn(() => _colDefs),
        getColumnState: jest.fn((): MockColumnState[] => _columnState),
        setColumnState: (state: MockColumnState[]): void => {
            _columnState = state;
        },
        // Simulates real AG Grid: applyColumnState updates the column's sort state and fires
        // sortChanged, same as a real header click (see KbqAgGridRowGroup.setGroupColSort).
        applyColumnState: jest.fn(({ state }: { state: MockColumnState[] }) => {
            for (const entry of state) {
                const existing = _columnState.find((s) => s.colId === entry.colId);
                if (existing) {
                    existing.sort = entry.sort;
                } else {
                    _columnState.push(entry);
                }
            }
            onSortStateApplied();
        }),
        // Simulates real AG Grid: setColumnsVisible goes through _applyColumnState (the same
        // underlying column-state store as applyColumnState/getColumnState above) — never
        // through columnDefs, so it never fires newColumnsLoaded.
        setColumnsVisible: jest.fn((keys: string[], visible: boolean): void => {
            for (const colId of keys) {
                const existing = _columnState.find((s) => s.colId === colId);
                if (existing) {
                    existing.hide = !visible;
                } else {
                    _columnState.push({ colId, sort: null, hide: !visible });
                }
            }
        }),
        setGridOption: jest.fn((key: string, value: unknown) => {
            _gridOptions[key] = value;
            if (key === 'rowData') {
                // Simulate real AG Grid: replacing rowData destroys the old nodes, firing an
                // async deselect event for any that were selected — before the new nodes exist.
                for (const node of _nodes) {
                    if (node.isSelected()) {
                        node.setSelected(false);
                        onNodeRemoved(node);
                    }
                }
                _nodes.length = 0;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
                (value as Record<string, unknown>[]).forEach((row) => {
                    _nodes.push(makeMockNode(row));
                });
            } else if (key === 'columnDefs') {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
                _colDefs = value as (ColDef | ColGroupDef)[];
                // Simulates real AG Grid: a direct api.setGridOption('columnDefs', ...) call —
                // whether from this directive's own setColumnDefsInternally or any other direct
                // API usage — always fires newColumnsLoaded with source: 'api' (AG Grid's
                // default when no explicit source is passed). See
                // simulateExternalColumnDefsChange for the consumer's own [columnDefs] input
                // changing, which is a genuinely different code path in real AG Grid/AgGridAngular
                // and reports a different source.
                onColumnDefsSet('api');
            }
        }),
        // Simulates the consumer's own [columnDefs] Angular input changing — AgGridAngular
        // routes that through AG Grid's _processOnChange/gridOptionsChanged path, not through
        // api.setGridOption, so the resulting newColumnsLoaded event reports source:
        // 'gridOptionsChanged' rather than 'api' (confirmed by reading AG Grid's
        // GridOptionsService.updateGridOptions and SyncService.setColumnDefs). This is what
        // KbqAgGridRowGroup's newColumnsLoaded subscription uses to tell an external columnDefs
        // change apart from its own writes.
        simulateExternalColumnDefsChange: (colDefs: (ColDef | ColGroupDef)[]): void => {
            _colDefs = colDefs;
            onColumnDefsSet('gridOptionsChanged');
        },
        getGridOption: jest.fn((key: string): unknown => _gridOptions[key]),
        forEachNode: jest.fn((cb: (node: MockNode) => void) => _nodes.forEach(cb)),
        refreshCells: jest.fn(),
        redrawRows: jest.fn(),
        refreshHeader: jest.fn(),
        get nodes(): MockNode[] {
            return _nodes;
        },
        get colDefs(): (ColDef | ColGroupDef)[] {
            return _colDefs;
        }
    };
};

type ApiMock = ReturnType<typeof createApiMock>;

@Directive({
    selector: 'ag-grid-angular',
    standalone: true,
    providers: [{ provide: AgGridAngular, useExisting: forwardRef(() => TestAgGridAngularStub) }]
})
class TestAgGridAngularStub {
    readonly mock = createApiMock(
        (node) => this.emitRowSelected(node),
        () => this.emitSortChanged(),
        (source) => this.emitNewColumnsLoaded(source)
    );

    get api(): GridApi {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        return this.mock as unknown as GridApi;
    }

    readonly gridReady = new Subject<{ api: GridApi }>();
    readonly rowSelected = new Subject<{ node: IRowNode }>();
    readonly sortChanged = new Subject<void>();
    readonly newColumnsLoaded = new Subject<{ source: string }>();

    emitGridReady(): void {
        this.gridReady.next({ api: this.api });
    }

    emitNewColumnsLoaded(source: string): void {
        this.newColumnsLoaded.next({ source });
    }

    emitRowSelected(node: MockNode): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        this.rowSelected.next({ node: node as unknown as IRowNode });
    }

    emitSortChanged(): void {
        this.sortChanged.next();
    }
}

@Component({
    selector: 'test-row-group',
    standalone: true,
    template: `
        <ag-grid-angular
            kbqAgGridRowGroup
            [kbqAgGridRowGroupRowData]="rowData()"
            [kbqAgGridRowGroupRowId]="testRowId"
        />
    `,
    imports: [TestAgGridAngularStub, KbqAgGridRowGroup]
})
class TestRowGroupGrid {
    readonly rowData = signal<Record<string, unknown>[]>([]);
    readonly grid = viewChild.required(TestAgGridAngularStub);
    readonly directive = viewChild.required(KbqAgGridRowGroup);
    protected readonly testRowId = testRowId;
}

/** Dummy `kbqAgGridRowGroupCellContent` component satisfying the `KbqAgGridRowGroupCellContent`
 * contract, used to test that the directive plumbs a custom component through correctly. */
@Component({
    selector: 'test-group-cell-content',
    standalone: true,
    template: `
        {{ group().key }}
    `
})
class TestGroupCellContent implements KbqAgGridRowGroupCellContent {
    readonly group = input.required<KbqAgGridRowGroupInfo>();
}

@Component({
    selector: 'test-row-group-cell-content',
    standalone: true,
    template: `
        <ag-grid-angular
            kbqAgGridRowGroup
            [kbqAgGridRowGroupRowData]="rowData()"
            [kbqAgGridRowGroupRowId]="testRowId"
            [kbqAgGridRowGroupCellContent]="cellContent()"
        />
    `,
    imports: [TestAgGridAngularStub, KbqAgGridRowGroup]
})
class TestRowGroupCellContentHost {
    readonly rowData = signal<Record<string, unknown>[]>([]);
    readonly cellContent = signal<Type<KbqAgGridRowGroupCellContent> | undefined>(undefined);
    readonly grid = viewChild.required(TestAgGridAngularStub);
    readonly directive = viewChild.required(KbqAgGridRowGroup);
    protected readonly testRowId = testRowId;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const setup = async (data: Record<string, unknown>[] = []) => {
    const { fixture } = await render(TestRowGroupGrid);
    fixture.componentInstance.rowData.set(data);
    const grid = fixture.componentInstance.grid();
    grid.emitGridReady();
    await waitFor(() => {
        expect(grid.mock.setGridOption).toHaveBeenCalledWith('rowData', expect.any(Array));
    });
    return { fixture, grid, directive: fixture.componentInstance.directive() };
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const getMeta = (row: Record<string, unknown>) =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    row.KbqAgGridRowGroup as
        | {
              isGroup: boolean;
              path: string;
              ancestors: string[];
              key?: string;
              level?: number;
              count?: number;
          }
        | undefined;

const isGroupHeader = (row: Record<string, unknown>): boolean => getMeta(row)?.isGroup === true;

const waitForNodes = async (
    grid: { mock: ApiMock },
    fixture: { detectChanges: () => void },
    predicate: (nodes: MockNode[]) => boolean
): Promise<void> => {
    fixture.detectChanges();
    await waitFor(() => {
        expect(predicate(grid.mock.nodes)).toBe(true);
    });
};

const DATA = [
    { id: '1', country: 'USA', sport: 'Swimming' },
    { id: '2', country: 'USA', sport: 'Athletics' },
    { id: '3', country: 'GBR', sport: 'Cycling' }
];

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const setupWithGroups = async () => {
    const result = await setup(DATA);
    result.directive.groupCols.set(['country']);
    await waitForNodes(result.grid, result.fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));
    result.directive.expandAll();
    await waitForNodes(result.grid, result.fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));
    return result;
};

@Component({
    selector: 'test-row-group-state-grid',
    standalone: true,
    template: `
        <ag-grid-angular
            kbqAgGridRowGroup
            [kbqAgGridRowGroupRowData]="rowData()"
            [kbqAgGridRowGroupRowId]="testRowId"
            [kbqAgGridRowGroupCollapsedState]="collapsedStateKey"
            [kbqAgGridRowGroupCollapsedStateStore]="store"
            [kbqAgGridRowGroupSelectionState]="selectionStateKey"
            [kbqAgGridRowGroupSelectionStateStore]="selectionStore"
            [(kbqAgGridRowGroupCols)]="groupCols"
        />
    `,
    imports: [TestAgGridAngularStub, KbqAgGridRowGroup]
})
class TestRowGroupStateGrid {
    collapsedStateKey = 'row-group-state';
    store: KbqAgGridRowGroupCollapsedStateStore = {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined
    };
    selectionStateKey: string | undefined = undefined;
    selectionStore: KbqAgGridRowGroupSelectionStateStore = {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined
    };
    readonly rowData = signal<Record<string, unknown>[]>([]);
    readonly groupCols = signal<string[]>([]);
    readonly grid = viewChild.required(TestAgGridAngularStub);
    readonly directive = viewChild.required(KbqAgGridRowGroup);
    protected readonly testRowId = testRowId;
}

/** Mirrors `setup()`, but for `TestRowGroupStateGrid` — lets each test configure `collapsedStateKey`,
 * `store`, and pre-gridReady `groupCols` (simulating the consumer having already restored
 * grouping fields themselves, as the class-level `**Persisting collapsed/expanded state**`
 * note recommends) before `emitGridReady()` fires. */
const setupWithState = async (params: {
    data?: Record<string, unknown>[];
    key?: string;
    store: KbqAgGridRowGroupCollapsedStateStore;
    selectionKey?: string;
    selectionStore?: KbqAgGridRowGroupSelectionStateStore;
    groupCols?: string[];
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
}) => {
    const { fixture } = await render(TestRowGroupStateGrid, {
        componentProperties: {
            collapsedStateKey: params.key ?? 'row-group-state',
            store: params.store,
            ...(params.selectionKey !== undefined ? { selectionStateKey: params.selectionKey } : {}),
            ...(params.selectionStore ? { selectionStore: params.selectionStore } : {})
        }
    });
    fixture.componentInstance.rowData.set(params.data ?? DATA);
    if (params.groupCols) fixture.componentInstance.groupCols.set(params.groupCols);
    // Propagate the two-way `[(kbqAgGridRowGroupCols)]` binding into the directive's own model
    // signal before gridReady — the host/directive signals only sync during change detection.
    fixture.detectChanges();
    const grid = fixture.componentInstance.grid();
    grid.emitGridReady();
    return { fixture, grid, directive: fixture.componentInstance.directive() };
};

describe(KbqAgGridRowGroup.name, () => {
    afterEach(() => {
        testColDefs = INITIAL_COL_DEFS;
    });

    describe('data grouping', () => {
        it('passes raw data as-is when no group columns are active', async () => {
            const { grid } = await setup(DATA);
            expect(grid.mock.nodes).toHaveLength(DATA.length);
            expect(grid.mock.nodes.every((n) => getMeta(n.data) === undefined)).toBe(true);
        });

        it('inserts a group header row per unique value when one group column is active', async () => {
            const { fixture, grid, directive } = await setup(DATA);
            directive.groupCols.set(['country']);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));

            const headers = grid.mock.nodes.filter((n) => isGroupHeader(n.data));
            expect(headers).toHaveLength(2);
            expect(headers.map((h) => getMeta(h.data)!.key)).toEqual(['USA', 'GBR']);
        });

        it('places data rows under their group with correct ancestors', async () => {
            const { fixture, grid, directive } = await setup(DATA);
            directive.groupCols.set(['country']);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));
            directive.expandAll();
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            const usaDataRows = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes(groupPath('USA'));
            });
            expect(usaDataRows).toHaveLength(2);
        });

        it('hides children of collapsed groups', async () => {
            const { fixture, grid, directive } = await setup(DATA);
            directive.groupCols.set(['country']);
            // Groups are collapsed by default as soon as grouping activates — no need to
            // explicitly collapse USA.
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));
            await waitForNodes(grid, fixture, (nodes) =>
                nodes.every((n) => {
                    const meta = getMeta(n.data);
                    return !meta || meta.isGroup || !meta.ancestors.includes(groupPath('USA'));
                })
            );

            const usaDataRows = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes(groupPath('USA'));
            });
            expect(usaDataRows).toHaveLength(0);
        });

        it('creates nested group headers when two group columns are active', async () => {
            const nestedData = [
                { id: '1', country: 'USA', sport: 'Swimming' },
                { id: '2', country: 'USA', sport: 'Athletics' },
                { id: '3', country: 'GBR', sport: 'Cycling' }
            ];
            const { fixture, grid, directive } = await setup(nestedData);
            directive.groupCols.set(['country', 'sport']);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));
            directive.expandAll();
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            // Level-0 headers: USA, GBR
            const level0Headers = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta?.isGroup && meta.level === 0;
            });
            expect(level0Headers).toHaveLength(2);

            // Level-1 headers: Swimming, Athletics (under USA), Cycling (under GBR)
            const level1Headers = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta?.isGroup && meta.level === 1;
            });
            expect(level1Headers).toHaveLength(3);
        });

        it('does not merge a number value with its string-lookalike into the same group', async () => {
            const data = [
                { id: '1', code: 1 },
                { id: '2', code: '1' }
            ];
            const { fixture, grid, directive } = await setup(data);
            directive.groupCols.set(['code']);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));

            const headers = grid.mock.nodes.filter((n) => isGroupHeader(n.data));
            expect(headers).toHaveLength(2);
            // Distinct internal identity (not merged)...
            expect(new Set(headers.map((h) => getMeta(h.data)!.path)).size).toBe(2);
            // ...but both still display as the same human-readable label "1".
            expect(headers.every((h) => getMeta(h.data)!.key === '1')).toBe(true);
        });

        it('does not merge null and undefined values into the same group', async () => {
            const data = [
                { id: '1', code: null },
                { id: '2' } // code is absent entirely -> undefined
            ];
            const { fixture, grid, directive } = await setup(data);
            directive.groupCols.set(['code']);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));

            const headers = grid.mock.nodes.filter((n) => isGroupHeader(n.data));
            expect(headers).toHaveLength(2);
            expect(new Set(headers.map((h) => getMeta(h.data)!.path)).size).toBe(2);
        });
    });

    describe('initialGroupCols input', () => {
        @Component({
            selector: 'test-initial-group-cols',
            standalone: true,
            template: `
                <ag-grid-angular
                    kbqAgGridRowGroup
                    [kbqAgGridRowGroupRowData]="data"
                    [kbqAgGridRowGroupRowId]="testRowId"
                    [kbqAgGridRowGroupCols]="['country']"
                />
            `,
            imports: [TestAgGridAngularStub, KbqAgGridRowGroup]
        })
        class TestInitialGroupCols {
            readonly data = DATA;
            readonly grid = viewChild.required(TestAgGridAngularStub);
            readonly directive = viewChild.required(KbqAgGridRowGroup);
            protected readonly testRowId = testRowId;
        }

        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        const setupInitial = async () => {
            const { fixture } = await render(TestInitialGroupCols);
            fixture.componentInstance.grid().emitGridReady();
            await waitFor(() => {
                expect(fixture.componentInstance.grid().mock.setGridOption).toHaveBeenCalledWith(
                    'rowData',
                    expect.any(Array)
                );
            });
            return fixture.componentInstance;
        };

        it('applies groupCols on gridReady', async () => {
            const { directive, grid } = await setupInitial();
            expect(directive().groupCols()).toContain('country');
            expect(grid().mock.nodes.some((n) => isGroupHeader(n.data))).toBe(true);
        });

        it('groups are collapsed by default', async () => {
            const { directive, grid } = await setupInitial();
            // collapsedPaths must be non-empty and all visible nodes must be group headers
            expect(directive().collapsedPaths().size).toBeGreaterThan(0);
            expect(grid().mock.nodes.every((n) => isGroupHeader(n.data))).toBe(true);
        });

        it('groups are collapsed even when data arrives after gridReady', async () => {
            @Component({
                selector: 'test-initial-group-cols-late-data',
                standalone: true,
                template: `
                    <ag-grid-angular
                        kbqAgGridRowGroup
                        [kbqAgGridRowGroupRowData]="rowData()"
                        [kbqAgGridRowGroupRowId]="testRowId"
                        [kbqAgGridRowGroupCols]="['country']"
                    />
                `,
                imports: [TestAgGridAngularStub, KbqAgGridRowGroup]
            })
            class TestInitialGroupColsLateData {
                readonly rowData = signal<Record<string, unknown>[]>([]);
                readonly grid = viewChild.required(TestAgGridAngularStub);
                readonly directive = viewChild.required(KbqAgGridRowGroup);
                protected readonly testRowId = testRowId;
            }

            const { fixture } = await render(TestInitialGroupColsLateData);
            // Emit gridReady BEFORE data is available — simulates HTTP response arriving later
            fixture.componentInstance.grid().emitGridReady();

            // Flush the queueMicrotask so the gridReady handler runs with empty data.
            // This is the critical moment: needsInitialCollapse is set to true, but
            // collapseAll() is NOT called (data is empty), so groups must stay collapsed
            // when data eventually arrives.
            await Promise.resolve();

            // Data arrives after the microtask (simulates HTTP response)
            fixture.componentInstance.rowData.set(DATA);
            fixture.detectChanges();

            // Effect must auto-collapse using the now-available data
            await waitFor(() => {
                expect(fixture.componentInstance.directive().collapsedPaths().size).toBeGreaterThan(0);
                expect(fixture.componentInstance.grid().mock.nodes.every((n) => isGroupHeader(n.data))).toBe(true);
            });
        });
    });

    describe('groupCols management', () => {
        it('setting groupCols via model adds a field to grouping', async () => {
            const { directive } = await setup(DATA);
            directive.groupCols.update((cols) => [...cols, 'country']);
            expect(directive.groupCols()).toContain('country');
        });

        it('removing a field via groupCols model removes it from grouping', async () => {
            const { directive } = await setup(DATA);
            directive.groupCols.set(['country']);
            directive.groupCols.update((cols) => cols.filter((c) => c !== 'country'));
            expect(directive.groupCols()).not.toContain('country');
        });

        it('moveGroupColumn reorders the fields', async () => {
            const { directive } = await setup(DATA);
            directive.groupCols.set(['country', 'sport']);
            directive.moveGroupColumn(0, 1);
            expect(directive.groupCols()).toEqual(['sport', 'country']);
        });

        it('changing groupCols collapses all top-level groups', async () => {
            const { fixture, grid, directive } = await setup(DATA);
            directive.groupCols.set(['country']);
            fixture.detectChanges();
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));

            // Expand all groups so the state is non-collapsed before the change
            directive.expandAll();
            fixture.detectChanges();
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            // Add another group column — all new top-level groups must be collapsed
            directive.groupCols.update((cols) => [...cols, 'sport']);
            fixture.detectChanges();

            await waitFor(() => {
                expect(directive.collapsedPaths().size).toBeGreaterThan(0);
                expect(grid.mock.nodes.every((n) => isGroupHeader(n.data))).toBe(true);
            });
        });

        it('rebuilds the grid exactly once when the grouping structure changes, not twice', async () => {
            const { fixture, grid, directive } = await setup(DATA);
            directive.groupCols.set(['country']);
            fixture.detectChanges();
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));

            grid.mock.setGridOption.mockClear();

            // Structural change: 'country' -> 'sport' produces 3 top-level groups instead of 2.
            directive.groupCols.set(['sport']);
            fixture.detectChanges();
            await waitForNodes(grid, fixture, (nodes) => nodes.length === 3);

            const rowDataCalls = grid.mock.setGridOption.mock.calls.filter(([key]) => key === 'rowData');
            expect(rowDataCalls).toHaveLength(1);
        });

        it('clearGroupColumns empties groupCols and collapsedPaths', async () => {
            const { directive } = await setup(DATA);
            directive.groupCols.set(['country']);
            directive.toggleCollapse(groupPath('USA'));
            directive.clearGroupColumns();
            expect(directive.groupCols()).toHaveLength(0);
            expect(directive.collapsedPaths().size).toBe(0);
        });
    });

    describe('column definitions', () => {
        it('prepends the group column to columnDefs when groupCols becomes non-empty', async () => {
            const { fixture, grid, directive } = await setup(DATA);
            directive.groupCols.update((cols) => [...cols, 'country']);
            fixture.detectChanges();

            await waitFor(() => {
                expect(grid.mock.setGridOption).toHaveBeenCalledWith('columnDefs', expect.any(Array));
            });

            expect((grid.mock.colDefs[0] as ColDef).colId).toBe('KbqAgGridRowGroup');
        });

        it('restores original columnDefs when groupCols becomes empty', async () => {
            const { fixture, grid, directive } = await setup(DATA);
            directive.groupCols.update((cols) => [...cols, 'country']);
            fixture.detectChanges();
            await waitFor(() => {
                expect(grid.mock.setGridOption).toHaveBeenCalledWith('columnDefs', expect.any(Array));
            });

            directive.clearGroupColumns();
            fixture.detectChanges();

            await waitFor(() => {
                expect(grid.mock.colDefs.every((c) => (c as ColDef).colId !== 'KbqAgGridRowGroup')).toBe(true);
            });

            expect(grid.mock.colDefs).toHaveLength(INITIAL_COL_DEFS.length);
        });

        it('the group column is sortable with a no-op comparator — AG never reorders rowData itself', async () => {
            const { fixture, grid, directive } = await setup(DATA);
            directive.groupCols.update((cols) => [...cols, 'country']);
            fixture.detectChanges();
            await waitFor(() => {
                expect(grid.mock.setGridOption).toHaveBeenCalledWith('columnDefs', expect.any(Array));
            });

            const groupColDef = grid.mock.colDefs[0] as ColDef;
            expect(groupColDef.sortable).toBe(true);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            const dummyNode = {} as unknown as IRowNode;
            expect(groupColDef.comparator?.(null, null, dummyNode, dummyNode, false)).toBe(0);
        });

        it('merges its own selectionColumnDef onto an existing one instead of replacing it', async () => {
            const { fixture } = await render(TestRowGroupGrid);
            fixture.componentInstance.rowData.set(DATA);
            const grid = fixture.componentInstance.grid();

            // Simulates KbqAgGridTheme's default width (or a consumer's own [selectionColumnDef]
            // input) already being set before this directive's gridReady handler runs.
            grid.mock.setGridOption('selectionColumnDef', { width: 36 });

            grid.emitGridReady();
            await waitFor(() => {
                expect(grid.mock.setGridOption).toHaveBeenCalledWith('rowData', expect.any(Array));
            });

            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            const selectionColumnDef = grid.mock.getGridOption('selectionColumnDef') as {
                width?: number;
                headerComponent?: unknown;
            };
            expect(selectionColumnDef.width).toBe(36);
            expect(selectionColumnDef.headerComponent).toBeDefined();
        });
    });

    describe('custom cell content', () => {
        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        const setupCellContent = async () => {
            const { fixture } = await render(TestRowGroupCellContentHost);
            fixture.componentInstance.rowData.set(DATA);
            const grid = fixture.componentInstance.grid();
            grid.emitGridReady();
            await waitFor(() => {
                expect(grid.mock.setGridOption).toHaveBeenCalledWith('rowData', expect.any(Array));
            });
            return { fixture, grid, directive: fixture.componentInstance.directive() };
        };

        it('reflects the bound kbqAgGridRowGroupCellContent value on the directive', async () => {
            const { fixture, directive } = await setupCellContent();
            expect(directive.cellContent()).toBeUndefined();

            fixture.componentInstance.cellContent.set(TestGroupCellContent);
            fixture.detectChanges();

            expect(directive.cellContent()).toBe(TestGroupCellContent);
        });

        it('redraws only group header rows when cellContent changes while already grouped', async () => {
            const { fixture, grid, directive } = await setupCellContent();
            directive.groupCols.set(['country']);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));
            grid.mock.redrawRows.mockClear();

            fixture.componentInstance.cellContent.set(TestGroupCellContent);
            fixture.detectChanges();

            await waitFor(() => {
                expect(grid.mock.redrawRows).toHaveBeenCalled();
            });
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            const [{ rowNodes }] = grid.mock.redrawRows.mock.calls.at(-1) as [{ rowNodes: MockNode[] }];
            expect(rowNodes.length).toBeGreaterThan(0);
            expect(rowNodes.every((node) => isGroupHeader(node.data))).toBe(true);
        });

        it('does not redraw when cellContent changes while ungrouped (no group rows exist)', async () => {
            const { fixture, grid } = await setupCellContent();
            grid.mock.redrawRows.mockClear();

            fixture.componentInstance.cellContent.set(TestGroupCellContent);
            fixture.detectChanges();
            // Flush the effect scheduler's microtask so it's had a chance to run before asserting.
            await Promise.resolve();

            expect(grid.mock.redrawRows).not.toHaveBeenCalled();
        });
    });

    describe('data column visibility while grouped', () => {
        it("hides a field's data column when it becomes an active group field", async () => {
            const { fixture, directive, grid } = await setup(DATA);

            directive.groupCols.set(['country']);
            fixture.detectChanges();

            await waitFor(() => {
                expect(grid.mock.setColumnsVisible).toHaveBeenCalledWith(['country'], false);
            });
        });

        it('shows the data column again once its field is removed from groupCols', async () => {
            const { fixture, directive, grid } = await setup(DATA);
            directive.groupCols.set(['country']);
            fixture.detectChanges();
            await waitFor(() => {
                expect(grid.mock.setColumnsVisible).toHaveBeenCalledWith(['country'], false);
            });

            directive.groupCols.set([]);
            fixture.detectChanges();

            await waitFor(() => {
                expect(grid.mock.setColumnsVisible).toHaveBeenCalledWith(['country'], true);
            });
        });

        it('hides a newly added group field without re-toggling an already-hidden one', async () => {
            const { fixture, directive, grid } = await setup(DATA);
            directive.groupCols.set(['country']);
            fixture.detectChanges();
            await waitFor(() => {
                expect(grid.mock.setColumnsVisible).toHaveBeenCalledWith(['country'], false);
            });
            grid.mock.setColumnsVisible.mockClear();

            directive.groupCols.set(['country', 'sport']);
            fixture.detectChanges();

            await waitFor(() => {
                expect(grid.mock.setColumnsVisible).toHaveBeenCalledWith(['sport'], false);
            });
            expect(grid.mock.setColumnsVisible).not.toHaveBeenCalledWith(
                expect.arrayContaining(['country']),
                expect.anything()
            );
        });

        it('does not force-show a column already hidden by the consumer before it became a group field', async () => {
            const { fixture, directive, grid } = await setup(DATA);
            grid.mock.setColumnState([{ colId: 'sport', sort: null, hide: true }]);

            directive.groupCols.set(['sport']);
            fixture.detectChanges();
            await waitFor(() => {
                expect(grid.mock.setGridOption).toHaveBeenCalledWith('columnDefs', expect.any(Array));
            });
            expect(grid.mock.setColumnsVisible).not.toHaveBeenCalledWith(['sport'], false);

            directive.clearGroupColumns();
            fixture.detectChanges();

            await waitFor(() => {
                expect(grid.mock.colDefs.every((c) => (c as ColDef).colId !== 'KbqAgGridRowGroup')).toBe(true);
            });
            expect(grid.mock.setColumnsVisible).not.toHaveBeenCalledWith(['sport'], true);
        });

        it('moveGroupColumn does not toggle any column visibility', async () => {
            const { fixture, directive, grid } = await setup(DATA);
            directive.groupCols.set(['country', 'sport']);
            fixture.detectChanges();
            await waitFor(() => expect(grid.mock.setColumnsVisible).toHaveBeenCalled());
            grid.mock.setColumnsVisible.mockClear();
            grid.mock.setGridOption.mockClear();

            directive.moveGroupColumn(0, 1);
            fixture.detectChanges();

            // Reordering still rebuilds rowData (group hierarchy order changed) — wait for that
            // to confirm the same effect tick that would also call setColumnsVisible has flushed.
            await waitFor(() => {
                expect(grid.mock.setGridOption).toHaveBeenCalledWith('rowData', expect.any(Array));
            });
            expect(grid.mock.setColumnsVisible).not.toHaveBeenCalled();
        });

        it('applies visibility for a group field introduced by an external columnDefs change', async () => {
            const { fixture, directive, grid } = await setup(DATA);
            directive.groupCols.set(['athlete']);
            fixture.detectChanges();
            await waitFor(() => {
                expect(grid.mock.setGridOption).toHaveBeenCalledWith('columnDefs', expect.any(Array));
            });
            grid.mock.setColumnsVisible.mockClear();

            grid.mock.simulateExternalColumnDefsChange([
                { field: 'country' },
                { field: 'sport' },
                { field: 'athlete' }
            ]);

            await waitFor(() => {
                expect(grid.mock.setColumnsVisible).toHaveBeenCalledWith(['athlete'], false);
            });
        });
    });

    describe('external columnDefs changes', () => {
        it('reapplies the Group column on top of an external columnDefs change made while grouping is active', async () => {
            const { fixture, grid, directive } = await setup(DATA);
            directive.groupCols.update((cols) => [...cols, 'country']);
            fixture.detectChanges();
            await waitFor(() => {
                expect((grid.mock.colDefs[0] as ColDef).colId).toBe('KbqAgGridRowGroup');
            });

            // Simulates the consumer's own [columnDefs] input changing, which would otherwise
            // silently drop the synthetic Group column.
            grid.mock.simulateExternalColumnDefsChange([
                { field: 'country' },
                { field: 'sport' },
                { field: 'athlete' }
            ]);

            await waitFor(() => {
                expect((grid.mock.colDefs[0] as ColDef).colId).toBe('KbqAgGridRowGroup');
            });
            const fields = grid.mock.colDefs.slice(1).map((c) => (c as ColDef).field);
            expect(fields).toEqual(['country', 'sport', 'athlete']);
            // The newly-added data column also gets the no-op comparator, same as the others.
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            const dummyNode = {} as unknown as IRowNode;
            const athleteColDef = grid.mock.colDefs.find((c): c is ColDef => (c as ColDef).field === 'athlete')!;
            expect(athleteColDef.comparator?.(null, null, dummyNode, dummyNode, false)).toBe(0);
        });

        it('resolves sorting for a data column added via an external columnDefs change', async () => {
            const dataWithExtraField = [
                { id: '1', country: 'USA', sport: 'Swimming', athlete: 'Carol' },
                { id: '2', country: 'USA', sport: 'Athletics', athlete: 'Alice' },
                { id: '3', country: 'GBR', sport: 'Cycling', athlete: 'Dave' }
            ];
            const { fixture, grid, directive } = await setup(dataWithExtraField);
            directive.groupCols.set(['country']);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));
            directive.expandAll();
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            // 'athlete' exists on every row already, but isn't a known column yet — sorting by it
            // must be a no-op (unresolvable colId) until the consumer's own columnDefs change
            // below introduces it.
            grid.mock.simulateExternalColumnDefsChange([
                { field: 'country' },
                { field: 'sport' },
                { field: 'athlete' }
            ]);

            grid.mock.setColumnState([{ colId: 'athlete', sort: 'asc' }]);
            grid.emitSortChanged();

            await waitFor(() => {
                const usaLeaves = grid.mock.nodes.filter((n) => {
                    const meta = getMeta(n.data);
                    return meta && !meta.isGroup && meta.ancestors.includes(groupPath('USA'));
                });
                expect(usaLeaves.map((n) => n.data.athlete)).toEqual(['Alice', 'Carol']);
            });
        });

        it("does not mistake its own columnDefs writes for an external change — grouping toggles don't corrupt the snapshot", async () => {
            const { fixture, grid, directive } = await setup(DATA);

            directive.groupCols.update((cols) => [...cols, 'country']);
            fixture.detectChanges();
            await waitFor(() => {
                expect((grid.mock.colDefs[0] as ColDef).colId).toBe('KbqAgGridRowGroup');
            });

            directive.clearGroupColumns();
            fixture.detectChanges();

            // If the newColumnsLoaded resync mistook the directive's own writes above for an
            // external change, this would restore the Group-column/no-op-comparator variant
            // instead of the consumer's real original columnDefs.
            await waitFor(() => {
                expect(grid.mock.colDefs).toEqual(INITIAL_COL_DEFS);
            });
        });
    });

    describe('group column sorting', () => {
        it('sorting ascending orders top-level groups by key', async () => {
            const { grid } = await setupWithGroups();

            grid.mock.setColumnState([{ colId: 'KbqAgGridRowGroup', sort: 'asc' }]);
            grid.emitSortChanged();

            await waitFor(() => {
                const headers = grid.mock.nodes.filter((n) => isGroupHeader(n.data) && getMeta(n.data)!.level === 0);
                expect(headers.map((h) => getMeta(h.data)!.key)).toEqual(['GBR', 'USA']);
            });
        });

        it('sorting descending reverses the order', async () => {
            const { grid } = await setupWithGroups();

            grid.mock.setColumnState([{ colId: 'KbqAgGridRowGroup', sort: 'desc' }]);
            grid.emitSortChanged();

            await waitFor(() => {
                const headers = grid.mock.nodes.filter((n) => isGroupHeader(n.data) && getMeta(n.data)!.level === 0);
                expect(headers.map((h) => getMeta(h.data)!.key)).toEqual(['USA', 'GBR']);
            });
        });

        it('clearing the sort restores the original insertion order', async () => {
            const { grid } = await setupWithGroups();

            grid.mock.setColumnState([{ colId: 'KbqAgGridRowGroup', sort: 'asc' }]);
            grid.emitSortChanged();
            await waitFor(() => {
                const headers = grid.mock.nodes.filter((n) => isGroupHeader(n.data) && getMeta(n.data)!.level === 0);
                expect(headers.map((h) => getMeta(h.data)!.key)).toEqual(['GBR', 'USA']);
            });

            grid.mock.setColumnState([{ colId: 'KbqAgGridRowGroup', sort: null }]);
            grid.emitSortChanged();
            await waitFor(() => {
                const headers = grid.mock.nodes.filter((n) => isGroupHeader(n.data) && getMeta(n.data)!.level === 0);
                expect(headers.map((h) => getMeta(h.data)!.key)).toEqual(['USA', 'GBR']);
            });
        });

        it('sorts group-header siblings independently at every nesting level', async () => {
            const nestedData = [
                { id: '1', country: 'USA', sport: 'Swimming' },
                { id: '2', country: 'USA', sport: 'Athletics' },
                { id: '3', country: 'GBR', sport: 'Cycling' },
                { id: '4', country: 'GBR', sport: 'Athletics' }
            ];
            const { fixture, grid, directive } = await setup(nestedData);
            directive.groupCols.set(['country', 'sport']);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));
            directive.expandAll();
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            grid.mock.setColumnState([{ colId: 'KbqAgGridRowGroup', sort: 'asc' }]);
            grid.emitSortChanged();

            await waitFor(() => {
                const sportsUnderGbr = grid.mock.nodes.filter((n) => {
                    const meta = getMeta(n.data);
                    return meta?.isGroup && meta.level === 1 && meta.ancestors.includes(groupPath('GBR'));
                });
                expect(sportsUnderGbr.map((h) => getMeta(h.data)!.key)).toEqual(['Athletics', 'Cycling']);
            });
        });

        it('sorts numeric-looking keys numerically, not lexicographically', async () => {
            const yearData = [
                { id: '1', year: 2 },
                { id: '2', year: 10 },
                { id: '3', year: 9 }
            ];
            const { fixture, grid, directive } = await setup(yearData);
            directive.groupCols.set(['year']);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));

            grid.mock.setColumnState([{ colId: 'KbqAgGridRowGroup', sort: 'asc' }]);
            grid.emitSortChanged();

            await waitFor(() => {
                const headers = grid.mock.nodes.filter((n) => isGroupHeader(n.data));
                expect(headers.map((h) => getMeta(h.data)!.key)).toEqual(['2', '9', '10']);
            });
        });

        it("setGroupColSort applies sort via AG Grid's own column state API, not by writing a signal directly", async () => {
            const { grid, directive } = await setupWithGroups();

            directive.setGroupColSort('asc');

            expect(grid.mock.applyColumnState).toHaveBeenCalledWith({
                state: [{ colId: 'KbqAgGridRowGroup', sort: 'asc' }]
            });
            await waitFor(() => {
                const headers = grid.mock.nodes.filter((n) => isGroupHeader(n.data) && getMeta(n.data)!.level === 0);
                expect(headers.map((h) => getMeta(h.data)!.key)).toEqual(['GBR', 'USA']);
            });
            expect(directive.groupColSort()).toBe('asc');
        });

        it('setGroupColSort(null) clears the sort', async () => {
            const { grid, directive } = await setupWithGroups();
            directive.setGroupColSort('asc');
            await waitFor(() => expect(directive.groupColSort()).toBe('asc'));

            directive.setGroupColSort(null);

            await waitFor(() => {
                expect(directive.groupColSort()).toBeNull();
                const headers = grid.mock.nodes.filter((n) => isGroupHeader(n.data) && getMeta(n.data)!.level === 0);
                expect(headers.map((h) => getMeta(h.data)!.key)).toEqual(['USA', 'GBR']);
            });
        });

        it('setGroupColSort warns and is a no-op when called before the grid is ready', async () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
            try {
                const { fixture } = await render(TestRowGroupGrid);
                const directive = fixture.componentInstance.directive();

                directive.setGroupColSort('asc');

                expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('setGroupColSort'));
                expect(directive.groupColSort()).toBeNull();
            } finally {
                warnSpy.mockRestore();
            }
        });
    });

    describe('data column sorting', () => {
        const ATHLETE_COL_DEFS: ColDef[] = [{ field: 'country' }, { field: 'athlete' }, { field: 'year' }];
        const groupedAthleteData = [
            { id: '1', country: 'USA', athlete: 'Carol', year: 2016 },
            { id: '2', country: 'USA', athlete: 'Alice', year: 2008 },
            { id: '3', country: 'USA', athlete: 'Bob', year: 2012 },
            { id: '4', country: 'GBR', athlete: 'Dave', year: 2004 }
        ];

        it('gives every data column a no-op comparator while grouped, and none when ungrouped', async () => {
            const { fixture, grid, directive } = await setup(DATA);
            directive.groupCols.update((cols) => [...cols, 'country']);
            fixture.detectChanges();
            await waitFor(() => {
                expect(grid.mock.setGridOption).toHaveBeenCalledWith('columnDefs', expect.any(Array));
            });

            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            const dummyNode = {} as unknown as IRowNode;
            const dataColDefs = grid.mock.colDefs.filter(
                (c) => (c as ColDef).colId !== 'KbqAgGridRowGroup'
            ) as ColDef[];
            expect(dataColDefs).toHaveLength(INITIAL_COL_DEFS.length);
            for (const colDef of dataColDefs) {
                expect(colDef.comparator?.(null, null, dummyNode, dummyNode, false)).toBe(0);
            }

            directive.clearGroupColumns();
            fixture.detectChanges();
            await waitFor(() => {
                expect(grid.mock.colDefs.every((c) => (c as ColDef).colId !== 'KbqAgGridRowGroup')).toBe(true);
            });
            expect(grid.mock.colDefs.every((c) => (c as ColDef).comparator === undefined)).toBe(true);
        });

        it('applies the no-op comparator to a leaf ColDef nested under a ColGroupDef', async () => {
            testColDefs = [{ field: 'country' }, { headerName: 'Stats', children: [{ field: 'athlete' }] }];
            const { fixture, grid, directive } = await setup(DATA);
            directive.groupCols.update((cols) => [...cols, 'country']);
            fixture.detectChanges();
            await waitFor(() => {
                expect(grid.mock.setGridOption).toHaveBeenCalledWith('columnDefs', expect.any(Array));
            });

            const statsGroup = grid.mock.colDefs.find((c): c is ColGroupDef => 'children' in c)!;
            const nestedAthlete = statsGroup.children[0] as ColDef;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            const dummyNode = {} as unknown as IRowNode;
            expect(nestedAthlete.comparator?.(null, null, dummyNode, dummyNode, false)).toBe(0);
        });

        it('sorting a data column reorders leaf rows within a group without scattering group headers', async () => {
            testColDefs = ATHLETE_COL_DEFS;
            const { fixture, grid, directive } = await setup(groupedAthleteData);
            directive.groupCols.set(['country']);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));
            directive.expandAll();
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            const headersBefore = grid.mock.nodes.filter((n) => isGroupHeader(n.data));
            expect(headersBefore.map((h) => getMeta(h.data)!.key)).toEqual(['USA', 'GBR']);

            grid.mock.setColumnState([{ colId: 'athlete', sort: 'asc' }]);
            grid.emitSortChanged();

            await waitFor(() => {
                const headersAfter = grid.mock.nodes.filter((n) => isGroupHeader(n.data));
                expect(headersAfter.map((h) => getMeta(h.data)!.key)).toEqual(['USA', 'GBR']);

                const usaLeaves = grid.mock.nodes.filter((n) => {
                    const meta = getMeta(n.data);
                    return meta && !meta.isGroup && meta.ancestors.includes(groupPath('USA'));
                });
                expect(usaLeaves.map((n) => n.data.athlete)).toEqual(['Alice', 'Bob', 'Carol']);
            });
        });

        it('sorts a numeric leaf field numerically, not lexicographically', async () => {
            testColDefs = ATHLETE_COL_DEFS;
            const numericLeafData = [
                { id: '1', country: 'USA', athlete: 'A', year: 2 },
                { id: '2', country: 'USA', athlete: 'B', year: 10 },
                { id: '3', country: 'USA', athlete: 'C', year: 9 }
            ];
            const { fixture, grid, directive } = await setup(numericLeafData);
            directive.groupCols.set(['country']);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));
            directive.expandAll();
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            grid.mock.setColumnState([{ colId: 'year', sort: 'asc' }]);
            grid.emitSortChanged();

            await waitFor(() => {
                const leaves = grid.mock.nodes.filter((n) => !isGroupHeader(n.data) && getMeta(n.data) !== undefined);
                expect(leaves.map((n) => n.data.year)).toEqual([2, 9, 10]);
            });
        });

        it('activating a data column sort clears the active group column sort', async () => {
            const { grid, directive } = await setupWithGroups();
            directive.setGroupColSort('asc');
            await waitFor(() => expect(directive.groupColSort()).toBe('asc'));

            // Simulates what AG's own clearSortBarTheseColumns does on a plain header click: the
            // previously-active column's sort is cleared, the new one gets it instead.
            grid.mock.setColumnState([
                { colId: 'KbqAgGridRowGroup', sort: null },
                { colId: 'country', sort: 'asc' }
            ]);
            grid.emitSortChanged();

            await waitFor(() => {
                expect(directive.groupColSort()).toBeNull();
            });
        });

        it('picks the sortIndex-lowest column as primary when multiple entries carry a non-null sort', async () => {
            const { directive, grid } = await setupWithGroups();

            grid.mock.setColumnState([
                { colId: 'country', sort: 'asc', sortIndex: 1 },
                { colId: 'KbqAgGridRowGroup', sort: 'asc', sortIndex: 0 }
            ]);
            grid.emitSortChanged();

            await waitFor(() => {
                expect(directive.groupColSort()).toBe('asc');
            });
        });

        it('clearing a data column sort restores the original leaf insertion order', async () => {
            testColDefs = ATHLETE_COL_DEFS;
            const { fixture, grid, directive } = await setup(groupedAthleteData);
            directive.groupCols.set(['country']);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));
            directive.expandAll();
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            const usaAthletes = (): unknown[] =>
                grid.mock.nodes
                    .filter((n) => {
                        const meta = getMeta(n.data);
                        return meta && !meta.isGroup && meta.ancestors.includes(groupPath('USA'));
                    })
                    .map((n) => n.data.athlete);

            grid.mock.setColumnState([{ colId: 'athlete', sort: 'asc' }]);
            grid.emitSortChanged();
            await waitFor(() => {
                expect(usaAthletes()).toEqual(['Alice', 'Bob', 'Carol']);
            });

            grid.mock.setColumnState([{ colId: 'athlete', sort: null }]);
            grid.emitSortChanged();
            await waitFor(() => {
                expect(usaAthletes()).toEqual(['Carol', 'Alice', 'Bob']);
            });
        });
    });

    describe('collapse and expand', () => {
        it('isCollapsed returns true for a collapsed path', async () => {
            const { directive } = await setup(DATA);
            directive.toggleCollapse(groupPath('USA'));
            expect(directive.isCollapsed(groupPath('USA'))).toBe(true);
        });

        it('isCollapsed returns false for a path not in collapsedPaths', async () => {
            const { directive } = await setup(DATA);
            directive.toggleCollapse(groupPath('GBR'));
            expect(directive.isCollapsed(groupPath('USA'))).toBe(false);
        });

        it('expandAll clears all collapsed paths', async () => {
            const { directive } = await setup(DATA);
            directive.toggleCollapse(groupPath('USA'));
            directive.toggleCollapse(groupPath('GBR'));
            directive.expandAll();
            expect(directive.collapsedPaths().size).toBe(0);
        });

        it('collapseAll adds top-level group paths to collapsedPaths', async () => {
            const { directive } = await setup(DATA);
            directive.groupCols.set(['country']);
            directive.collapseAll();
            expect(directive.collapsedPaths().has(groupPath('USA'))).toBe(true);
            expect(directive.collapsedPaths().has(groupPath('GBR'))).toBe(true);
        });

        it('toggleCollapse collapses an expanded group', async () => {
            const { directive } = await setup(DATA);
            directive.groupCols.set(['country']);
            directive.toggleCollapse(groupPath('USA'));
            expect(directive.isCollapsed(groupPath('USA'))).toBe(true);
        });

        it('toggleCollapse expands a collapsed group', async () => {
            const { directive } = await setup(DATA);
            directive.groupCols.set(['country']);
            directive.toggleCollapse(groupPath('USA')); // start collapsed
            directive.toggleCollapse(groupPath('USA'));
            expect(directive.isCollapsed(groupPath('USA'))).toBe(false);
        });

        it('toggleCollapse on expand starts immediate sub-groups in collapsed state', async () => {
            const nestedData = [
                { id: '1', country: 'USA', sport: 'Swimming' },
                { id: '2', country: 'USA', sport: 'Athletics' }
            ];
            const { directive } = await setup(nestedData);
            directive.groupCols.set(['country', 'sport']);
            directive.toggleCollapse(groupPath('USA')); // start collapsed
            directive.toggleCollapse(groupPath('USA'));
            // Sub-group paths should now be collapsed
            expect(directive.isCollapsed(groupPath('USA', 'Swimming'))).toBe(true);
            expect(directive.isCollapsed(groupPath('USA', 'Athletics'))).toBe(true);
        });

        it('setExpanded(groupPath, false) collapses the group', async () => {
            const { directive } = await setup(DATA);
            directive.groupCols.set(['country']);
            directive.setExpanded(['USA'], false);
            expect(directive.isCollapsed(groupPath('USA'))).toBe(true);
        });

        it('setExpanded(groupPath, true) expands the group', async () => {
            const { directive } = await setup(DATA);
            directive.groupCols.set(['country']);
            directive.toggleCollapse(groupPath('USA'));
            directive.setExpanded(['USA'], true);
            expect(directive.isCollapsed(groupPath('USA'))).toBe(false);
        });

        it('setExpanded(groupPath, true) auto-expands every ancestor along a multi-level path', async () => {
            const nestedData = [
                { id: '1', country: 'USA', sport: 'Swimming', year: 2000 },
                { id: '2', country: 'USA', sport: 'Swimming', year: 2004 },
                { id: '3', country: 'USA', sport: 'Athletics', year: 2000 }
            ];
            const { directive } = await setup(nestedData);
            directive.groupCols.set(['country', 'sport', 'year']);
            directive.collapseAll();

            // One call addresses the 3rd-level group directly, without expanding each
            // ancestor level one at a time in order.
            directive.setExpanded(['USA', 'Swimming', 2000], true);

            expect(directive.isCollapsed(groupPath('USA'))).toBe(false);
            expect(directive.isCollapsed(groupPath('USA', 'Swimming'))).toBe(false);
            // `year` is a number field — its path segment is type-prefixed (see `toKey`) so it
            // can never collide with a same-looking string value from another field.
            expect(directive.isCollapsed(groupPath('USA', 'Swimming', 2000))).toBe(false);

            // Siblings at every level start collapsed, exactly like expanding one chevron
            // at a time would produce.
            expect(directive.isCollapsed(groupPath('USA', 'Athletics'))).toBe(true);
            expect(directive.isCollapsed(groupPath('USA', 'Swimming', 2004))).toBe(true);
        });

        it('setExpanded(groupPath, false) only collapses the target group, not its ancestors', async () => {
            const nestedData = [
                { id: '1', country: 'USA', sport: 'Swimming', year: 2000 },
                { id: '2', country: 'USA', sport: 'Swimming', year: 2004 }
            ];
            const { directive } = await setup(nestedData);
            directive.groupCols.set(['country', 'sport', 'year']);
            directive.setExpanded(['USA', 'Swimming', 2000], true);

            directive.setExpanded(['USA', 'Swimming'], false);

            expect(directive.isCollapsed(groupPath('USA', 'Swimming'))).toBe(true);
            expect(directive.isCollapsed(groupPath('USA'))).toBe(false);
        });

        it('does not scan grid nodes on a rebuild when nothing is selected', async () => {
            const { grid, directive, fixture } = await setupWithGroups();
            grid.mock.forEachNode.mockClear();
            grid.mock.setGridOption.mockClear();

            directive.toggleCollapse(groupPath('USA'));
            fixture.detectChanges();
            await waitFor(() => {
                expect(grid.mock.setGridOption).toHaveBeenCalledWith('rowData', expect.any(Array));
            });

            expect(grid.mock.forEachNode).not.toHaveBeenCalled();
        });
    });

    describe('groupSelectsChildren', () => {
        it('clicking group checkbox selects all descendant data rows', async () => {
            const { grid, directive } = await setupWithGroups();

            directive.onGroupCheckboxClick(groupPath('USA'));

            const usaChildren = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes(groupPath('USA'));
            });
            expect(usaChildren.length).toBeGreaterThan(0);
            for (const child of usaChildren) {
                expect(child.setSelected).toHaveBeenCalledWith(true, false);
            }
            expect(directive.groupSelectionState().get(groupPath('USA'))).toBe('checked');
        });

        it('clicking group checkbox again deselects all descendants', async () => {
            const { grid, directive } = await setupWithGroups();

            directive.onGroupCheckboxClick(groupPath('USA')); // select
            directive.onGroupCheckboxClick(groupPath('USA')); // deselect

            const usaChildren = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes(groupPath('USA'));
            });
            for (const child of usaChildren) {
                expect(child.setSelected).toHaveBeenLastCalledWith(false, false);
            }
            expect(directive.groupSelectionState().get(groupPath('USA'))).toBeUndefined();
        });

        it('does not swallow a real deselect on a child that was already selected before the group checkbox click', async () => {
            const { grid, directive } = await setupWithGroups();

            const usaChildren = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes(groupPath('USA'));
            });
            expect(usaChildren.length).toBeGreaterThanOrEqual(2);
            const [alreadySelected, ...rest] = usaChildren;

            // Select one child individually first (a real user selection).
            alreadySelected.setSelected(true);
            grid.emitRowSelected(alreadySelected);
            expect(directive.groupSelectionState().get(groupPath('USA'))).toBe('indeterminate');

            // Click the group checkbox — this re-selects every child, including the one already
            // selected above. AG Grid's real setSelected() is a no-op (no event) for a node
            // already at the target value, so the already-selected child must NOT be marked
            // "programmatic" here, or a later real deselect on it would be silently swallowed.
            directive.onGroupCheckboxClick(groupPath('USA'));
            expect(directive.groupSelectionState().get(groupPath('USA'))).toBe('checked');

            // The user now manually deselects the child that was already selected before the
            // group click (never touched by setSelected during that click).
            alreadySelected.setSelected(false);
            grid.emitRowSelected(alreadySelected);

            // This must be treated as a real, un-swallowed deselect.
            expect(directive.groupSelectionState().get(groupPath('USA'))).toBe('indeterminate');
            expect(rest.every((child) => child.isSelected())).toBe(true);
        });

        it('selecting a data row does not propagate to sibling data rows', async () => {
            const { grid, directive, fixture } = await setupWithGroups();
            directive.setExpanded(['USA'], true);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            const usaDataRows = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes(groupPath('USA'));
            });
            const [firstDataRow, ...siblingRows] = usaDataRows;
            firstDataRow.setSelected(true);
            grid.emitRowSelected(firstDataRow);

            for (const sibling of siblingRows) {
                expect(sibling.isSelected()).toBe(false);
            }
        });

        it('selecting the only child of a group marks the group as checked', async () => {
            const { grid, directive, fixture } = await setupWithGroups();
            directive.setExpanded(['GBR'], true);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            const gbrChild = grid.mock.nodes.find((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes(groupPath('GBR'));
            })!;
            gbrChild.setSelected(true);
            grid.emitRowSelected(gbrChild);

            expect(directive.groupSelectionState().get(groupPath('GBR'))).toBe('checked');
        });

        it('selecting one of multiple children marks the group as indeterminate', async () => {
            const { grid, directive, fixture } = await setupWithGroups();
            directive.setExpanded(['USA'], true);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            const [firstDataRow] = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes(groupPath('USA'));
            });
            firstDataRow.setSelected(true);
            grid.emitRowSelected(firstDataRow);

            expect(directive.groupSelectionState().get(groupPath('USA'))).toBe('indeterminate');
        });

        it('selecting all children one by one eventually marks the group as checked', async () => {
            const { grid, directive, fixture } = await setupWithGroups();
            directive.setExpanded(['USA'], true);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            const usaDataRows = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes(groupPath('USA'));
            });
            expect(usaDataRows.length).toBeGreaterThan(1);

            // Select all but the last — group must be indeterminate
            for (let i = 0; i < usaDataRows.length - 1; i++) {
                usaDataRows[i].setSelected(true);
                grid.emitRowSelected(usaDataRows[i]);
            }
            expect(directive.groupSelectionState().get(groupPath('USA'))).toBe('indeterminate');

            // Select the last — group must become checked
            usaDataRows.at(-1)!.setSelected(true);
            grid.emitRowSelected(usaDataRows.at(-1)!);
            expect(directive.groupSelectionState().get(groupPath('USA'))).toBe('checked');
        });

        it('deselecting one child from a fully-selected group makes it indeterminate', async () => {
            const { grid, directive, fixture } = await setupWithGroups();
            directive.setExpanded(['USA'], true);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            const usaDataRows = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes(groupPath('USA'));
            });
            for (const row of usaDataRows) {
                row.setSelected(true);
                grid.emitRowSelected(row);
            }
            expect(directive.groupSelectionState().get(groupPath('USA'))).toBe('checked');

            usaDataRows[0].setSelected(false);
            grid.emitRowSelected(usaDataRows[0]);

            expect(directive.groupSelectionState().get(groupPath('USA'))).toBe('indeterminate');
        });

        it('deselecting one child keeps all sibling data rows selected', async () => {
            const { grid, directive, fixture } = await setupWithGroups();
            directive.setExpanded(['USA'], true);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            const usaDataRows = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes(groupPath('USA'));
            });
            expect(usaDataRows.length).toBeGreaterThanOrEqual(2);

            for (const row of usaDataRows) {
                row.setSelected(true);
                grid.emitRowSelected(row);
            }

            // Deselect the first child only
            usaDataRows[0].setSelected(false);
            grid.emitRowSelected(usaDataRows[0]);

            // Siblings must remain selected — handler must NOT touch them
            for (const sibling of usaDataRows.slice(1)) {
                expect(sibling.isSelected()).toBe(true);
            }
        });

        it('bottom-up recalculation works recursively through N levels', async () => {
            const { fixture, grid, directive } = await setup(DATA);
            directive.groupCols.set(['country', 'sport']);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));
            directive.expandAll();
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            // GBR::Cycling has exactly one data row — selecting it propagates all the way up
            const gbrCyclingDataRow = grid.mock.nodes.find((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && n.data.country === 'GBR';
            })!;
            gbrCyclingDataRow.setSelected(true);
            grid.emitRowSelected(gbrCyclingDataRow);

            expect(directive.groupSelectionState().get(groupPath('GBR', 'Cycling'))).toBe('checked');
            expect(directive.groupSelectionState().get(groupPath('GBR'))).toBe('checked');
        });

        it('deselecting one child propagates up through all ancestor levels', async () => {
            const { fixture, grid, directive } = await setup(DATA);
            directive.groupCols.set(['country', 'sport']);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));
            directive.expandAll();
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            // Select all data rows one by one to build up group states bottom-up
            const dataRows = grid.mock.nodes.filter((n) => !isGroupHeader(n.data));
            for (const node of dataRows) {
                node.setSelected(true);
                grid.emitRowSelected(node);
            }
            expect(directive.groupSelectionState().get(groupPath('GBR'))).toBe('checked');

            // GBR::Cycling has exactly one data row — deselecting it unchecks both the
            // GBR::Cycling sub-group and the GBR top-level group
            const gbrCyclingDataRow = grid.mock.nodes.find((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && n.data.country === 'GBR';
            })!;
            gbrCyclingDataRow.setSelected(false);
            grid.emitRowSelected(gbrCyclingDataRow);

            expect(directive.groupSelectionState().get(groupPath('GBR', 'Cycling'))).toBeUndefined();
            expect(directive.groupSelectionState().get(groupPath('GBR'))).toBeUndefined();
            // USA is unrelated — must remain checked
            expect(directive.groupSelectionState().get(groupPath('USA'))).toBe('checked');
        });

        it('each descendant is selected exactly once when group checkbox is clicked', async () => {
            const { grid, directive } = await setupWithGroups();

            directive.onGroupCheckboxClick(groupPath('USA'));

            const usaChildren = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes(groupPath('USA'));
            });
            for (const child of usaChildren) {
                expect(child.setSelected).toHaveBeenCalledTimes(1);
            }
        });
    });

    describe('selection restore on rowData change', () => {
        it('preserves group selection state and re-selects children after rowData is replaced on expand', async () => {
            const { fixture, grid, directive } = await setup(DATA);
            directive.groupCols.update((cols) => [...cols, 'country']);
            fixture.detectChanges();
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));

            // Select USA's whole subtree via its group checkbox (groups are non-selectable via AG Grid)
            directive.onGroupCheckboxClick(groupPath('USA'));

            // Expand USA — triggers a rowData refresh via the collapsedPaths effect
            directive.toggleCollapse(groupPath('USA'));
            fixture.detectChanges();

            await waitFor(() => {
                const usaChildren = grid.mock.nodes.filter((n) => {
                    const meta = getMeta(n.data);
                    return meta && !meta.isGroup && meta.ancestors.includes(groupPath('USA'));
                });
                expect(usaChildren.length).toBeGreaterThan(0);
                for (const child of usaChildren) {
                    expect(child.setSelected).toHaveBeenCalledWith(true, false);
                }
                expect(directive.groupSelectionState().get(groupPath('USA'))).toBe('checked');
            });
        });

        it('auto-selects children of a restored group after expand', async () => {
            const { fixture, grid, directive } = await setup(DATA);
            directive.groupCols.update((cols) => [...cols, 'country']);
            fixture.detectChanges(); // let groupCols-change reset run (collapsedPaths → empty)
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));
            directive.collapseAll(); // collapse after the reset has settled
            fixture.detectChanges();
            await waitForNodes(grid, fixture, (nodes) => nodes.every((n) => isGroupHeader(n.data)));

            // Select USA's whole subtree while it is collapsed
            directive.onGroupCheckboxClick(groupPath('USA'));

            // Expand USA — triggers rowData refresh
            directive.toggleCollapse(groupPath('USA'));
            fixture.detectChanges();

            await waitFor(() => {
                const usaChildren = grid.mock.nodes.filter((n) => {
                    const meta = getMeta(n.data);
                    return meta && !meta.isGroup && meta.ancestors.includes(groupPath('USA'));
                });
                expect(usaChildren.length).toBeGreaterThan(0);
                for (const child of usaChildren) {
                    expect(child.setSelected).toHaveBeenCalledWith(true, false);
                }
            });
        });

        it('adding a group column while a flat row is selected does not throw', async () => {
            // Regression: row.KbqAgGridRowGroup is undefined for flat rows; accessing .isGroup
            // without optional chaining threw TypeError → Angular re-scheduled the effect → infinite loop.
            const { fixture, grid, directive } = await setup(DATA);

            // Verify the current nodes are truly flat (no KbqAgGridRowGroup metadata)
            const [flatNode] = grid.mock.nodes;
            expect(getMeta(flatNode.data)).toBeUndefined();
            flatNode.setSelected(true);

            // Must not throw; effect must complete and populate grouped rows
            directive.groupCols.update((cols) => [...cols, 'country']);
            fixture.detectChanges();

            await waitFor(() => {
                expect(grid.mock.nodes.some((n) => isGroupHeader(n.data))).toBe(true);
            });
        });

        it('rowSelected events fired after programmatic restoration are suppressed', async () => {
            const { fixture, grid, directive } = await setup(DATA);
            directive.groupCols.update((cols) => [...cols, 'country']);
            fixture.detectChanges(); // let groupCols-change reset run (collapsedPaths → empty)
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));
            directive.collapseAll(); // collapse after the reset has settled
            fixture.detectChanges();
            await waitForNodes(grid, fixture, (nodes) => nodes.every((n) => isGroupHeader(n.data)));

            // Select USA's whole subtree while collapsed
            directive.onGroupCheckboxClick(groupPath('USA'));

            // Expand: effect restores selection and adds restored data nodes to programmaticallySetNodes
            directive.toggleCollapse(groupPath('USA'));
            fixture.detectChanges();

            // Wait for restored children to appear and be selected
            await waitFor(() => {
                expect(grid.mock.nodes.some((n) => !isGroupHeader(n.data) && n.isSelected())).toBe(true);
            });

            const usaChildren = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes(groupPath('USA'));
            });

            // Simulate the async rowSelected event that AG Grid fires after a programmatic setSelected.
            // The handler must recognize this node as programmatically set and suppress it,
            // so groupSelectionState is not re-evaluated and setSelected is not called a second time.
            grid.emitRowSelected(usaChildren[0]);

            // Each child must have been set exactly once (during restoration)
            for (const child of usaChildren) {
                expect(child.setSelected).toHaveBeenCalledTimes(1);
            }
        });

        it('preserves a partial (indeterminate) selection across collapsing and re-expanding the group', async () => {
            const { fixture, grid, directive } = await setup(DATA);
            directive.groupCols.set(['country']);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));
            directive.expandAll();
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            // Select only one of USA's two children — group ends up indeterminate.
            const usaDataRows = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes(groupPath('USA'));
            });
            expect(usaDataRows.length).toBeGreaterThanOrEqual(2);
            usaDataRows[0].setSelected(true);
            grid.emitRowSelected(usaDataRows[0]);
            expect(directive.groupSelectionState().get(groupPath('USA'))).toBe('indeterminate');

            // Collapse USA — this used to silently discard the partial selection.
            directive.toggleCollapse(groupPath('USA'));
            fixture.detectChanges();
            await waitForNodes(grid, fixture, (nodes) =>
                nodes.every((n) => {
                    const meta = getMeta(n.data);
                    return !meta || meta.isGroup || !meta.ancestors.includes(groupPath('USA'));
                })
            );
            expect(directive.groupSelectionState().get(groupPath('USA'))).toBe('indeterminate');

            // Re-expand — the same single child must still be selected, group still indeterminate.
            directive.toggleCollapse(groupPath('USA'));
            fixture.detectChanges();
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            const restoredUsaDataRows = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes(groupPath('USA'));
            });
            const selectedRows = restoredUsaDataRows.filter((n) => n.isSelected());
            expect(selectedRows).toHaveLength(1);
            expect(selectedRows[0].data.id).toBe(usaDataRows[0].data.id);
            expect(directive.groupSelectionState().get(groupPath('USA'))).toBe('indeterminate');
        });
    });

    describe('select-all header checkbox', () => {
        it('overallSelectionState is unchecked when nothing is selected', async () => {
            const { directive } = await setup(DATA);
            expect(directive.overallSelectionState()).toBe('unchecked');
        });

        it('onSelectAllCheckboxClick selects every row across the whole dataset, even collapsed ones', async () => {
            const { grid, directive, fixture } = await setupWithGroups();
            // Collapse USA back down so its children are not currently loaded into the row model.
            directive.toggleCollapse(groupPath('USA'));

            directive.onSelectAllCheckboxClick();

            expect(directive.overallSelectionState()).toBe('checked');

            // Re-expand — the previously-collapsed children must come back selected too.
            directive.toggleCollapse(groupPath('USA'));
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));
            const usaDataRows = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes(groupPath('USA'));
            });
            expect(usaDataRows.length).toBeGreaterThan(0);
            for (const row of usaDataRows) {
                expect(row.isSelected()).toBe(true);
            }
        });

        it('onSelectAllCheckboxClick called again deselects every row', async () => {
            const { grid, directive } = await setupWithGroups();

            directive.onSelectAllCheckboxClick();
            expect(directive.overallSelectionState()).toBe('checked');

            directive.onSelectAllCheckboxClick();
            expect(directive.overallSelectionState()).toBe('unchecked');
            expect(grid.mock.nodes.every((n) => !n.isSelected())).toBe(true);
        });

        it('selecting one row marks overallSelectionState as indeterminate', async () => {
            const { grid, directive, fixture } = await setupWithGroups();
            directive.setExpanded(['USA'], true);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            const [firstDataRow] = grid.mock.nodes.filter((n) => !isGroupHeader(n.data));
            firstDataRow.setSelected(true);
            grid.emitRowSelected(firstDataRow);

            expect(directive.overallSelectionState()).toBe('indeterminate');
        });
    });

    describe('rowId validation', () => {
        it('warns when grouping is active without a configured rowId', async () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
            try {
                const { directive } = await setup([
                    { country: 'USA', sport: 'Swimming' },
                    { country: 'GBR', sport: 'Cycling' }
                ]);
                directive.groupCols.set(['country']);
                await waitFor(() => {
                    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('kbqAgGridRowGroupRowId'));
                });
            } finally {
                warnSpy.mockRestore();
            }
        });
    });

    describe('rowSelectionChanged output', () => {
        it('emits every selected row across the whole dataset when a group checkbox is clicked, even collapsed ones', async () => {
            const { directive } = await setupWithGroups();
            // Re-collapse USA so its children are not currently loaded into the row model —
            // AG Grid's own (selectionChanged) event could never report these.
            directive.toggleCollapse(groupPath('USA'));

            const emitSpy = jest.spyOn(directive.rowSelectionChanged, 'emit');
            directive.onGroupCheckboxClick(groupPath('USA'));

            expect(emitSpy).toHaveBeenCalledTimes(1);
            const [[emitted]] = emitSpy.mock.calls;
            expect(emitted.map((row) => String(row.id)).sort()).toEqual(['1', '2']);
        });

        it('reflects deselecting one child against the full selected set, not just visible rows', async () => {
            const { grid, directive } = await setupWithGroups();
            const usaRows = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes(groupPath('USA'));
            });
            expect(usaRows.length).toBeGreaterThanOrEqual(2);
            for (const row of usaRows) {
                row.setSelected(true);
                grid.emitRowSelected(row);
            }

            const emitSpy = jest.spyOn(directive.rowSelectionChanged, 'emit');
            const [firstUsaRow] = usaRows;
            firstUsaRow.setSelected(false);
            grid.emitRowSelected(firstUsaRow);

            expect(emitSpy).toHaveBeenCalledTimes(1);
            const [[emitted]] = emitSpy.mock.calls;
            expect(emitted).toHaveLength(usaRows.length - 1);
            expect(emitted.some((row) => row.id === firstUsaRow.data.id)).toBe(false);
        });
    });

    describe('setRowSelected', () => {
        it('selects a currently visible row and rolls up into groupSelectionState', async () => {
            const { grid, directive } = await setupWithGroups();

            directive.setRowSelected('1', true);

            const row1 = grid.mock.nodes.find((n) => n.data.id === '1')!;
            expect(row1.isSelected()).toBe(true);
            expect(directive.groupSelectionState().get(groupPath('USA'))).toBe('indeterminate');
        });

        it('selects a row hidden inside a collapsed group — rollup updates with no AG node for it', async () => {
            const { directive } = await setupWithGroups();
            directive.toggleCollapse(groupPath('USA')); // re-collapse so USA's children aren't loaded

            directive.setRowSelected('1', true);

            // No AG node exists for the hidden row, but the group's rollup state is still
            // correct — it's derived entirely from selectedRowIds, independent of visibility.
            expect(directive.groupSelectionState().get(groupPath('USA'))).toBe('indeterminate');
        });

        it('restores a selection made while hidden once the group is expanded', async () => {
            const { grid, directive, fixture } = await setupWithGroups();
            directive.toggleCollapse(groupPath('USA'));
            directive.setRowSelected('1', true);

            directive.toggleCollapse(groupPath('USA')); // expand again
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            const row1 = grid.mock.nodes.find((n) => n.data.id === '1')!;
            expect(row1.isSelected()).toBe(true);
        });

        it('setRowSelected(id, false) deselects a row', async () => {
            const { grid, directive } = await setupWithGroups();
            directive.setRowSelected('1', true);

            directive.setRowSelected('1', false);

            const row1 = grid.mock.nodes.find((n) => n.data.id === '1')!;
            expect(row1.isSelected()).toBe(false);
            expect(directive.groupSelectionState().get(groupPath('USA'))).toBeUndefined();
        });

        it('emits rowSelectionChanged with the full selected row set', async () => {
            const { directive } = await setupWithGroups();

            const emitSpy = jest.spyOn(directive.rowSelectionChanged, 'emit');
            directive.setRowSelected('1', true);

            expect(emitSpy).toHaveBeenCalledTimes(1);
            const [[emitted]] = emitSpy.mock.calls;
            expect(emitted.map((row) => String(row.id))).toEqual(['1']);
        });
    });

    describe('collapsed state persistence', () => {
        it('restores collapsed paths from the store on init when groupCols already matches', async () => {
            const storedPaths = [groupPath('USA')];
            const store: KbqAgGridRowGroupCollapsedStateStore = {
                getItem: jest.fn(() => storedPaths),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };

            const { directive } = await setupWithState({
                key: 'grid-row-group-state-1',
                store,
                groupCols: ['country']
            });

            await waitFor(() => {
                expect(store.getItem).toHaveBeenCalledWith('grid-row-group-state-1');
                expect(directive.collapsedPaths()).toEqual(new Set(storedPaths));
            });
        });

        it('falls back to the default top-level auto-collapse when the store returns null', async () => {
            const store: KbqAgGridRowGroupCollapsedStateStore = {
                getItem: jest.fn(() => null),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };

            const { directive, grid, fixture } = await setupWithState({
                key: 'grid-row-group-state-2',
                store,
                groupCols: ['country']
            });

            await waitFor(() => expect(store.getItem).toHaveBeenCalledWith('grid-row-group-state-2'));
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));

            expect(directive.collapsedPaths()).toEqual(new Set([groupPath('USA'), groupPath('GBR')]));
        });

        it('a restored path is inert once groupCols no longer matches what it was saved under', async () => {
            const storedPaths = [groupPath('USA')];
            const store: KbqAgGridRowGroupCollapsedStateStore = {
                getItem: jest.fn(() => storedPaths),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };

            // groupCols is left at its default ([]) — simulates a consumer that restores
            // collapsedPaths via the store but doesn't also restore the grouping fields
            // themselves (see the class-level "Persisting collapsed/expanded state" note).
            const { directive, grid } = await setupWithState({ key: 'grid-row-group-state-x', store });

            await waitFor(() => {
                expect(store.getItem).toHaveBeenCalled();
                expect(directive.collapsedPaths()).toEqual(new Set(storedPaths));
            });
            // With no matching grouping structure, rows pass through flat — the restored path
            // has nothing to apply to.
            expect(grid.mock.nodes.every((n) => !isGroupHeader(n.data))).toBe(true);
        });

        it('saves collapsedPaths to the store when a group is toggled', async () => {
            const store: KbqAgGridRowGroupCollapsedStateStore = {
                getItem: jest.fn(() => null),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };

            const { directive, grid, fixture } = await setupWithState({
                key: 'grid-row-group-state-3',
                store,
                groupCols: ['country']
            });
            // groupCols was already set at gridReady, so the default top-level auto-collapse
            // (no stored value to restore) starts every top-level group collapsed — expand
            // everything first so the toggle below has an unambiguous, single-path effect.
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));
            directive.expandAll();

            directive.toggleCollapse(groupPath('USA'));

            await waitFor(() => {
                expect(store.setItem).toHaveBeenCalledWith('grid-row-group-state-3', [groupPath('USA')]);
            });
        });

        it('persists an empty array when everything is expanded, rather than removing the item', async () => {
            const store: KbqAgGridRowGroupCollapsedStateStore = {
                getItem: jest.fn(() => null),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };

            const { directive, grid, fixture } = await setupWithState({
                key: 'grid-row-group-state-4',
                store,
                groupCols: ['country']
            });
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));

            directive.expandAll();

            await waitFor(() => {
                expect(store.setItem).toHaveBeenCalledWith('grid-row-group-state-4', []);
            });
            expect(store.removeItem).not.toHaveBeenCalled();
        });

        it('does not persist while ungrouped', async () => {
            const store: KbqAgGridRowGroupCollapsedStateStore = {
                getItem: jest.fn(() => null),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };

            await setupWithState({ key: 'grid-row-group-state-5', store });

            await waitFor(() => expect(store.getItem).toHaveBeenCalled());
            expect(store.setItem).not.toHaveBeenCalled();
        });

        it('clearGroupColumns removes the stored state', async () => {
            const store: KbqAgGridRowGroupCollapsedStateStore = {
                getItem: jest.fn(() => null),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };

            const { directive, grid, fixture } = await setupWithState({
                key: 'grid-row-group-state-6',
                store,
                groupCols: ['country']
            });
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));

            directive.clearGroupColumns();

            expect(store.removeItem).toHaveBeenCalledWith('grid-row-group-state-6');
        });

        it('supports async store methods', async () => {
            const storedPaths = [groupPath('USA')];
            const store: KbqAgGridRowGroupCollapsedStateStore = {
                // eslint-disable-next-line @typescript-eslint/promise-function-async
                getItem: jest.fn(() => Promise.resolve(storedPaths)),
                // eslint-disable-next-line @typescript-eslint/promise-function-async
                setItem: jest.fn(() => Promise.resolve(undefined)),
                // eslint-disable-next-line @typescript-eslint/promise-function-async
                removeItem: jest.fn(() => Promise.resolve(undefined))
            };

            const { directive } = await setupWithState({
                key: 'grid-row-group-state-7',
                store,
                groupCols: ['country']
            });

            await waitFor(() => {
                expect(directive.collapsedPaths()).toEqual(new Set(storedPaths));
            });
        });
    });

    describe('selection persistence', () => {
        const noopStateStore: KbqAgGridRowGroupCollapsedStateStore = {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined
        };

        it('restores selected row ids from the store on init, including native node selection', async () => {
            const selectionStore: KbqAgGridRowGroupSelectionStateStore = {
                getItem: jest.fn(() => ['1']),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };

            const { directive, grid, fixture } = await setupWithState({
                key: 'grid-row-group-selection-1',
                store: noopStateStore,
                selectionKey: 'grid-row-group-selection-1-sel',
                selectionStore,
                groupCols: ['country']
            });
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));

            expect(selectionStore.getItem).toHaveBeenCalledWith('grid-row-group-selection-1-sel');
            expect(directive.overallSelectionState()).toBe('indeterminate');

            // The default top-level auto-collapse (see "collapsed state persistence") hides row
            // '1' inside a collapsed "USA" group initially — expand to materialize it as an AG
            // node and confirm the restored selection was synced onto it.
            directive.expandAll();
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));
            const row1 = grid.mock.nodes.find((n) => n.data.id === '1')!;
            expect(row1.isSelected()).toBe(true);
        });

        it('saves selectedRowIds to the store when setRowSelected is called', async () => {
            const selectionStore: KbqAgGridRowGroupSelectionStateStore = {
                getItem: jest.fn(() => null),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };

            const { directive } = await setupWithState({
                key: 'grid-row-group-selection-2',
                store: noopStateStore,
                selectionKey: 'grid-row-group-selection-2-sel',
                selectionStore
            });
            await waitFor(() => expect(selectionStore.getItem).toHaveBeenCalled());

            directive.setRowSelected('1', true);

            await waitFor(() => {
                expect(selectionStore.setItem).toHaveBeenCalledWith('grid-row-group-selection-2-sel', ['1']);
            });
        });

        it('removes stored selection once everything is deselected', async () => {
            const selectionStore: KbqAgGridRowGroupSelectionStateStore = {
                getItem: jest.fn(() => null),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };

            const { directive } = await setupWithState({
                key: 'grid-row-group-selection-3',
                store: noopStateStore,
                selectionKey: 'grid-row-group-selection-3-sel',
                selectionStore
            });
            await waitFor(() => expect(selectionStore.getItem).toHaveBeenCalled());

            directive.setRowSelected('1', true);
            await waitFor(() => expect(selectionStore.setItem).toHaveBeenCalled());

            directive.setRowSelected('1', false);

            await waitFor(() => {
                expect(selectionStore.removeItem).toHaveBeenCalledWith('grid-row-group-selection-3-sel');
            });
        });

        it('does not persist selection when no [kbqAgGridRowGroupSelectionState] key is bound', async () => {
            const selectionStore: KbqAgGridRowGroupSelectionStateStore = {
                getItem: jest.fn(() => null),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };

            // selectionKey intentionally omitted — the directive's own default (undefined).
            const { directive } = await setupWithState({
                key: 'grid-row-group-selection-6',
                store: noopStateStore,
                selectionStore
            });

            directive.setRowSelected('1', true);

            expect(selectionStore.getItem).not.toHaveBeenCalled();
            expect(selectionStore.setItem).not.toHaveBeenCalled();
        });

        it('clearGroupColumns does not clear the persisted selection — selection is independent of grouping', async () => {
            const selectionStore: KbqAgGridRowGroupSelectionStateStore = {
                getItem: jest.fn(() => null),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };

            const { directive, grid, fixture } = await setupWithState({
                key: 'grid-row-group-selection-4',
                store: noopStateStore,
                selectionKey: 'grid-row-group-selection-4-sel',
                selectionStore,
                groupCols: ['country']
            });
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));

            directive.setRowSelected('1', true);
            await waitFor(() =>
                expect(selectionStore.setItem).toHaveBeenCalledWith('grid-row-group-selection-4-sel', ['1'])
            );

            // removeItem legitimately fires once already on mount (empty selection at init,
            // before setRowSelected above) — clear that baseline call so the assertion below
            // is only about what clearGroupColumns() itself does.
            jest.mocked(selectionStore.removeItem).mockClear();

            directive.clearGroupColumns();

            expect(selectionStore.removeItem).not.toHaveBeenCalled();
        });

        it('supports async selection store methods', async () => {
            const selectionStore: KbqAgGridRowGroupSelectionStateStore = {
                // eslint-disable-next-line @typescript-eslint/promise-function-async
                getItem: jest.fn(() => Promise.resolve(['1', '2'])),
                // eslint-disable-next-line @typescript-eslint/promise-function-async
                setItem: jest.fn(() => Promise.resolve(undefined)),
                // eslint-disable-next-line @typescript-eslint/promise-function-async
                removeItem: jest.fn(() => Promise.resolve(undefined))
            };

            const { directive } = await setupWithState({
                key: 'grid-row-group-selection-5',
                store: noopStateStore,
                selectionKey: 'grid-row-group-selection-5-sel',
                selectionStore,
                groupCols: ['country']
            });

            // DATA has 3 rows total; ids '1' and '2' (both 'USA') restored as selected — the
            // third ('3', 'GBR') is not, so the overall selection is partial.
            await waitFor(() => {
                expect(directive.overallSelectionState()).toBe('indeterminate');
            });
        });

        it('restores selection even when data arrives after gridReady, and notifies rowSelectionChanged once it does', async () => {
            const selectionStore: KbqAgGridRowGroupSelectionStateStore = {
                getItem: jest.fn(() => ['1']),
                setItem: jest.fn(),
                removeItem: jest.fn()
            };

            const { fixture } = await render(TestRowGroupStateGrid, {
                componentProperties: {
                    collapsedStateKey: 'grid-row-group-selection-late',
                    store: noopStateStore,
                    selectionStateKey: 'grid-row-group-selection-late-sel',
                    selectionStore
                }
            });
            const directive = fixture.componentInstance.directive();
            const emitSpy = jest.spyOn(directive.rowSelectionChanged, 'emit');

            // Emit gridReady BEFORE rowData is available — simulates an async HTTP response
            // (e.g. devInjectRowData()) arriving after the grid has already initialized.
            fixture.componentInstance.grid().emitGridReady();

            // waitFor's macrotask-based polling flushes every pending microtask in between
            // checks, so by the time this resolves onGridReady's queueMicrotask (which stages
            // pendingRestoredSelectedIds) is guaranteed to have already run too.
            await waitFor(() => expect(selectionStore.getItem).toHaveBeenCalled());
            expect(emitSpy).not.toHaveBeenCalled();

            // Data arrives after the microtask (simulates the HTTP response resolving)
            fixture.componentInstance.rowData.set(DATA);
            fixture.detectChanges();

            await waitFor(() => {
                expect(emitSpy).toHaveBeenCalledTimes(1);
                const [[emitted]] = emitSpy.mock.calls;
                expect(emitted.map((row) => String(row.id))).toEqual(['1']);
            });
        });
    });
});

describe(KbqAgGridRowGroupCollapsedStateLocalStorageStore.name, () => {
    const key = 'row-group-collapsed-local-storage-test-key';

    afterEach(() => {
        window.localStorage.removeItem(key);
    });

    it('getItem returns null when nothing is stored', () => {
        const store = new KbqAgGridRowGroupCollapsedStateLocalStorageStore();
        expect(store.getItem(key)).toBeNull();
    });

    it('setItem stores the value as JSON, and getItem parses it back', () => {
        const store = new KbqAgGridRowGroupCollapsedStateLocalStorageStore();
        const value = [groupPath('USA'), groupPath('GBR')];

        store.setItem(key, value);

        expect(window.localStorage.getItem(key)).toBe(JSON.stringify(value));
        expect(store.getItem(key)).toEqual(value);
    });

    it('removeItem deletes the stored value', () => {
        const store = new KbqAgGridRowGroupCollapsedStateLocalStorageStore();
        store.setItem(key, [groupPath('USA')]);

        store.removeItem(key);

        expect(window.localStorage.getItem(key)).toBeNull();
        expect(store.getItem(key)).toBeNull();
    });

    it('getItem returns null when the stored value is not valid JSON', () => {
        const store = new KbqAgGridRowGroupCollapsedStateLocalStorageStore();
        window.localStorage.setItem(key, 'not-json{{{');

        expect(store.getItem(key)).toBeNull();
    });
});

describe(KbqAgGridRowGroupCollapsedStateQueryParamsStore.name, () => {
    const key = 'row-group-collapsed-query-params-test-key';
    let navigate: jest.Mock;
    let store: KbqAgGridRowGroupCollapsedStateQueryParamsStore;

    beforeEach(() => {
        navigate = jest.fn(() => Promise.resolve(true));
        TestBed.configureTestingModule({
            providers: [{ provide: Router, useValue: { navigate } }]
        });
        store = TestBed.inject(KbqAgGridRowGroupCollapsedStateQueryParamsStore);
    });

    afterEach(() => {
        window.history.pushState({}, '', '/');
    });

    it('getItem returns null when the query param is absent', () => {
        window.history.pushState({}, '', '/?other=1');
        expect(store.getItem(key)).toBeNull();
    });

    it('getItem parses the value from the URL query string', () => {
        const value = [groupPath('USA')];
        window.history.pushState({}, '', `/?${key}=${encodeURIComponent(JSON.stringify(value))}`);

        expect(store.getItem(key)).toEqual(value);
    });

    it('getItem returns null when the query param is not valid JSON', () => {
        window.history.pushState({}, '', `/?${key}=not-json{{{`);

        expect(store.getItem(key)).toBeNull();
    });

    it('setItem navigates with the JSON-stringified value merged into query params', async () => {
        const value = [groupPath('USA')];

        await store.setItem(key, value);

        expect(navigate).toHaveBeenCalledWith([], {
            queryParams: { [key]: JSON.stringify(value) },
            queryParamsHandling: 'merge',
            replaceUrl: true
        });
    });

    it('removeItem navigates with the query param set to null', async () => {
        await store.removeItem(key);

        expect(navigate).toHaveBeenCalledWith([], {
            queryParams: { [key]: null },
            queryParamsHandling: 'merge',
            replaceUrl: true
        });
    });
});

describe(kbqAgGridRowGroupCollapsedStateStoreProvider.name, () => {
    it('binds the token to useClass when given a class', () => {
        const provider = kbqAgGridRowGroupCollapsedStateStoreProvider(KbqAgGridRowGroupCollapsedStateQueryParamsStore);

        expect(provider).toEqual({
            provide: KBQ_AG_GRID_ROW_GROUP_COLLAPSED_STATE_STORE,
            useClass: KbqAgGridRowGroupCollapsedStateQueryParamsStore
        });
    });

    it('binds the token to useValue when given an instance', () => {
        const instance: KbqAgGridRowGroupCollapsedStateStore = {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined
        };

        const provider = kbqAgGridRowGroupCollapsedStateStoreProvider(instance);

        expect(provider).toEqual({ provide: KBQ_AG_GRID_ROW_GROUP_COLLAPSED_STATE_STORE, useValue: instance });
    });

    it('resolves to the provided store instance through Angular DI', () => {
        const instance: KbqAgGridRowGroupCollapsedStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        TestBed.configureTestingModule({ providers: [kbqAgGridRowGroupCollapsedStateStoreProvider(instance)] });

        expect(TestBed.inject(KBQ_AG_GRID_ROW_GROUP_COLLAPSED_STATE_STORE)).toBe(instance);
    });
});

describe(KbqAgGridRowGroupSelectionStateLocalStorageStore.name, () => {
    const key = 'row-group-selection-local-storage-test-key';

    afterEach(() => {
        window.localStorage.removeItem(key);
    });

    it('getItem returns null when nothing is stored', () => {
        const store = new KbqAgGridRowGroupSelectionStateLocalStorageStore();
        expect(store.getItem(key)).toBeNull();
    });

    it('setItem stores the value as JSON, and getItem parses it back', () => {
        const store = new KbqAgGridRowGroupSelectionStateLocalStorageStore();
        const value = ['1', '2'];

        store.setItem(key, value);

        expect(window.localStorage.getItem(key)).toBe(JSON.stringify(value));
        expect(store.getItem(key)).toEqual(value);
    });

    it('removeItem deletes the stored value', () => {
        const store = new KbqAgGridRowGroupSelectionStateLocalStorageStore();
        store.setItem(key, ['1']);

        store.removeItem(key);

        expect(window.localStorage.getItem(key)).toBeNull();
        expect(store.getItem(key)).toBeNull();
    });

    it('getItem returns null when the stored value is not valid JSON', () => {
        const store = new KbqAgGridRowGroupSelectionStateLocalStorageStore();
        window.localStorage.setItem(key, 'not-json{{{');

        expect(store.getItem(key)).toBeNull();
    });
});

describe(KbqAgGridRowGroupSelectionStateQueryParamsStore.name, () => {
    const key = 'row-group-selection-query-params-test-key';
    let navigate: jest.Mock;
    let store: KbqAgGridRowGroupSelectionStateQueryParamsStore;

    beforeEach(() => {
        navigate = jest.fn(() => Promise.resolve(true));
        TestBed.configureTestingModule({
            providers: [{ provide: Router, useValue: { navigate } }]
        });
        store = TestBed.inject(KbqAgGridRowGroupSelectionStateQueryParamsStore);
    });

    afterEach(() => {
        window.history.pushState({}, '', '/');
    });

    it('getItem returns null when the query param is absent', () => {
        window.history.pushState({}, '', '/?other=1');
        expect(store.getItem(key)).toBeNull();
    });

    it('getItem parses the value from the URL query string', () => {
        const value = ['1', '2'];
        window.history.pushState({}, '', `/?${key}=${encodeURIComponent(JSON.stringify(value))}`);

        expect(store.getItem(key)).toEqual(value);
    });

    it('getItem returns null when the query param is not valid JSON', () => {
        window.history.pushState({}, '', `/?${key}=not-json{{{`);

        expect(store.getItem(key)).toBeNull();
    });

    it('setItem navigates with the JSON-stringified value merged into query params', async () => {
        const value = ['1'];

        await store.setItem(key, value);

        expect(navigate).toHaveBeenCalledWith([], {
            queryParams: { [key]: JSON.stringify(value) },
            queryParamsHandling: 'merge',
            replaceUrl: true
        });
    });

    it('removeItem navigates with the query param set to null', async () => {
        await store.removeItem(key);

        expect(navigate).toHaveBeenCalledWith([], {
            queryParams: { [key]: null },
            queryParamsHandling: 'merge',
            replaceUrl: true
        });
    });
});

describe(kbqAgGridRowGroupSelectionStateStoreProvider.name, () => {
    it('binds the token to useClass when given a class', () => {
        const provider = kbqAgGridRowGroupSelectionStateStoreProvider(KbqAgGridRowGroupSelectionStateQueryParamsStore);

        expect(provider).toEqual({
            provide: KBQ_AG_GRID_ROW_GROUP_SELECTION_STATE_STORE,
            useClass: KbqAgGridRowGroupSelectionStateQueryParamsStore
        });
    });

    it('binds the token to useValue when given an instance', () => {
        const instance: KbqAgGridRowGroupSelectionStateStore = {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined
        };

        const provider = kbqAgGridRowGroupSelectionStateStoreProvider(instance);

        expect(provider).toEqual({ provide: KBQ_AG_GRID_ROW_GROUP_SELECTION_STATE_STORE, useValue: instance });
    });

    it('resolves to the provided store instance through Angular DI', () => {
        const instance: KbqAgGridRowGroupSelectionStateStore = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        TestBed.configureTestingModule({ providers: [kbqAgGridRowGroupSelectionStateStoreProvider(instance)] });

        expect(TestBed.inject(KBQ_AG_GRID_ROW_GROUP_SELECTION_STATE_STORE)).toBe(instance);
    });
});
