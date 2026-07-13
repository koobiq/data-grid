import { Component, Directive, forwardRef, signal, viewChild } from '@angular/core';
import { render, waitFor } from '@testing-library/angular';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, ColGroupDef, GridApi, IRowNode } from 'ag-grid-community';
import { Subject } from 'rxjs';
import { KbqAgGridRowGroup, KbqAgGridRowGroupRowId } from '../src/row-group.ng';

/** Shared row id extractor bound on every test host below — resolves each row's `id` field. */
const testRowId: KbqAgGridRowGroupRowId = (row) => String(row.id);

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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createApiMock = (onNodeRemoved: (node: MockNode) => void) => {
    const _nodes: MockNode[] = [];
    let _colDefs: (ColDef | ColGroupDef)[] = [...INITIAL_COL_DEFS];

    return {
        getColumnDefs: jest.fn(() => _colDefs),
        setGridOption: jest.fn((key: string, value: unknown) => {
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
            }
        }),
        getGridOption: jest.fn(() => undefined),
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
    readonly mock = createApiMock((node) => this.emitRowSelected(node));

    get api(): GridApi {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        return this.mock as unknown as GridApi;
    }

    readonly gridReady = new Subject<{ api: GridApi }>();
    readonly rowSelected = new Subject<{ node: IRowNode }>();

    emitGridReady(): void {
        this.gridReady.next({ api: this.api });
    }

    emitRowSelected(node: MockNode): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        this.rowSelected.next({ node: node as unknown as IRowNode });
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

describe(KbqAgGridRowGroup.name, () => {
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
                return meta && !meta.isGroup && meta.ancestors.includes('USA');
            });
            expect(usaDataRows).toHaveLength(2);
        });

        it('hides children of collapsed groups', async () => {
            const { fixture, grid, directive } = await setup(DATA);
            directive.groupCols.set(['country']);
            // Wait for the groupCols-change reset to run before setting collapsed paths,
            // otherwise the reset would clear the explicitly set paths.
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));
            directive.collapsedPaths.set(new Set(['USA']));
            await waitForNodes(grid, fixture, (nodes) =>
                nodes.every((n) => {
                    const meta = getMeta(n.data);
                    return !meta || meta.isGroup || !meta.ancestors.includes('USA');
                })
            );

            const usaDataRows = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes('USA');
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

        it('clearGroupColumns empties groupCols and collapsedPaths', async () => {
            const { directive } = await setup(DATA);
            directive.groupCols.set(['country']);
            directive.collapsedPaths.set(new Set(['USA']));
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
    });

    describe('collapse and expand', () => {
        it('isCollapsed returns true for a collapsed path', async () => {
            const { directive } = await setup(DATA);
            directive.collapsedPaths.set(new Set(['USA']));
            expect(directive.isCollapsed('USA')).toBe(true);
        });

        it('isCollapsed returns false for a path not in collapsedPaths', async () => {
            const { directive } = await setup(DATA);
            directive.collapsedPaths.set(new Set(['GBR']));
            expect(directive.isCollapsed('USA')).toBe(false);
        });

        it('expandAll clears all collapsed paths', async () => {
            const { directive } = await setup(DATA);
            directive.collapsedPaths.set(new Set(['USA', 'GBR']));
            directive.expandAll();
            expect(directive.collapsedPaths().size).toBe(0);
        });

        it('collapseAll adds top-level group paths to collapsedPaths', async () => {
            const { directive } = await setup(DATA);
            directive.groupCols.set(['country']);
            directive.collapseAll();
            expect(directive.collapsedPaths().has('USA')).toBe(true);
            expect(directive.collapsedPaths().has('GBR')).toBe(true);
        });

        it('toggleCollapse collapses an expanded group', async () => {
            const { directive } = await setup(DATA);
            directive.groupCols.set(['country']);
            directive.toggleCollapse('USA');
            expect(directive.isCollapsed('USA')).toBe(true);
        });

        it('toggleCollapse expands a collapsed group', async () => {
            const { directive } = await setup(DATA);
            directive.groupCols.set(['country']);
            directive.collapsedPaths.set(new Set(['USA']));
            directive.toggleCollapse('USA');
            expect(directive.isCollapsed('USA')).toBe(false);
        });

        it('toggleCollapse on expand starts immediate sub-groups in collapsed state', async () => {
            const nestedData = [
                { id: '1', country: 'USA', sport: 'Swimming' },
                { id: '2', country: 'USA', sport: 'Athletics' }
            ];
            const { directive } = await setup(nestedData);
            directive.groupCols.set(['country', 'sport']);
            directive.collapsedPaths.set(new Set(['USA']));
            directive.toggleCollapse('USA');
            // Sub-group paths should now be collapsed
            expect(directive.isCollapsed('USA::Swimming')).toBe(true);
            expect(directive.isCollapsed('USA::Athletics')).toBe(true);
        });

        it('setExpanded(groupPath, false) collapses the group', async () => {
            const { directive } = await setup(DATA);
            directive.groupCols.set(['country']);
            directive.setExpanded(['USA'], false);
            expect(directive.isCollapsed('USA')).toBe(true);
        });

        it('setExpanded(groupPath, true) expands the group', async () => {
            const { directive } = await setup(DATA);
            directive.groupCols.set(['country']);
            directive.collapsedPaths.set(new Set(['USA']));
            directive.setExpanded(['USA'], true);
            expect(directive.isCollapsed('USA')).toBe(false);
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

            expect(directive.isCollapsed('USA')).toBe(false);
            expect(directive.isCollapsed('USA::Swimming')).toBe(false);
            expect(directive.isCollapsed('USA::Swimming::2000')).toBe(false);

            // Siblings at every level start collapsed, exactly like expanding one chevron
            // at a time would produce.
            expect(directive.isCollapsed('USA::Athletics')).toBe(true);
            expect(directive.isCollapsed('USA::Swimming::2004')).toBe(true);
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

            expect(directive.isCollapsed('USA::Swimming')).toBe(true);
            expect(directive.isCollapsed('USA')).toBe(false);
        });
    });

    describe('groupSelectsChildren', () => {
        it('clicking group checkbox selects all descendant data rows', async () => {
            const { grid, directive } = await setupWithGroups();

            directive.onGroupCheckboxClick('USA');

            const usaChildren = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes('USA');
            });
            expect(usaChildren.length).toBeGreaterThan(0);
            for (const child of usaChildren) {
                expect(child.setSelected).toHaveBeenCalledWith(true, false);
            }
            expect(directive.groupSelectionState().get('USA')).toBe('checked');
        });

        it('clicking group checkbox again deselects all descendants', async () => {
            const { grid, directive } = await setupWithGroups();

            directive.onGroupCheckboxClick('USA'); // select
            directive.onGroupCheckboxClick('USA'); // deselect

            const usaChildren = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes('USA');
            });
            for (const child of usaChildren) {
                expect(child.setSelected).toHaveBeenLastCalledWith(false, false);
            }
            expect(directive.groupSelectionState().get('USA')).toBeUndefined();
        });

        it('selecting a data row does not propagate to sibling data rows', async () => {
            const { grid, directive, fixture } = await setupWithGroups();
            directive.setExpanded(['USA'], true);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            const usaDataRows = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes('USA');
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
                return meta && !meta.isGroup && meta.ancestors.includes('GBR');
            })!;
            gbrChild.setSelected(true);
            grid.emitRowSelected(gbrChild);

            expect(directive.groupSelectionState().get('GBR')).toBe('checked');
        });

        it('selecting one of multiple children marks the group as indeterminate', async () => {
            const { grid, directive, fixture } = await setupWithGroups();
            directive.setExpanded(['USA'], true);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            const [firstDataRow] = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes('USA');
            });
            firstDataRow.setSelected(true);
            grid.emitRowSelected(firstDataRow);

            expect(directive.groupSelectionState().get('USA')).toBe('indeterminate');
        });

        it('selecting all children one by one eventually marks the group as checked', async () => {
            const { grid, directive, fixture } = await setupWithGroups();
            directive.setExpanded(['USA'], true);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            const usaDataRows = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes('USA');
            });
            expect(usaDataRows.length).toBeGreaterThan(1);

            // Select all but the last — group must be indeterminate
            for (let i = 0; i < usaDataRows.length - 1; i++) {
                usaDataRows[i].setSelected(true);
                grid.emitRowSelected(usaDataRows[i]);
            }
            expect(directive.groupSelectionState().get('USA')).toBe('indeterminate');

            // Select the last — group must become checked
            usaDataRows.at(-1)!.setSelected(true);
            grid.emitRowSelected(usaDataRows.at(-1)!);
            expect(directive.groupSelectionState().get('USA')).toBe('checked');
        });

        it('deselecting one child from a fully-selected group makes it indeterminate', async () => {
            const { grid, directive, fixture } = await setupWithGroups();
            directive.setExpanded(['USA'], true);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            const usaDataRows = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes('USA');
            });
            for (const row of usaDataRows) {
                row.setSelected(true);
                grid.emitRowSelected(row);
            }
            expect(directive.groupSelectionState().get('USA')).toBe('checked');

            usaDataRows[0].setSelected(false);
            grid.emitRowSelected(usaDataRows[0]);

            expect(directive.groupSelectionState().get('USA')).toBe('indeterminate');
        });

        it('deselecting one child keeps all sibling data rows selected', async () => {
            const { grid, directive, fixture } = await setupWithGroups();
            directive.setExpanded(['USA'], true);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            const usaDataRows = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes('USA');
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

            expect(directive.groupSelectionState().get('GBR::Cycling')).toBe('checked');
            expect(directive.groupSelectionState().get('GBR')).toBe('checked');
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
            expect(directive.groupSelectionState().get('GBR')).toBe('checked');

            // GBR::Cycling has exactly one data row — deselecting it unchecks both the
            // GBR::Cycling sub-group and the GBR top-level group
            const gbrCyclingDataRow = grid.mock.nodes.find((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && n.data.country === 'GBR';
            })!;
            gbrCyclingDataRow.setSelected(false);
            grid.emitRowSelected(gbrCyclingDataRow);

            expect(directive.groupSelectionState().get('GBR::Cycling')).toBeUndefined();
            expect(directive.groupSelectionState().get('GBR')).toBeUndefined();
            // USA is unrelated — must remain checked
            expect(directive.groupSelectionState().get('USA')).toBe('checked');
        });

        it('each descendant is selected exactly once when group checkbox is clicked', async () => {
            const { grid, directive } = await setupWithGroups();

            directive.onGroupCheckboxClick('USA');

            const usaChildren = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes('USA');
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
            directive.onGroupCheckboxClick('USA');

            // Expand USA — triggers a rowData refresh via the collapsedPaths effect
            directive.toggleCollapse('USA');
            fixture.detectChanges();

            await waitFor(() => {
                const usaChildren = grid.mock.nodes.filter((n) => {
                    const meta = getMeta(n.data);
                    return meta && !meta.isGroup && meta.ancestors.includes('USA');
                });
                expect(usaChildren.length).toBeGreaterThan(0);
                for (const child of usaChildren) {
                    expect(child.setSelected).toHaveBeenCalledWith(true, false);
                }
                expect(directive.groupSelectionState().get('USA')).toBe('checked');
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
            directive.onGroupCheckboxClick('USA');

            // Expand USA — triggers rowData refresh
            directive.toggleCollapse('USA');
            fixture.detectChanges();

            await waitFor(() => {
                const usaChildren = grid.mock.nodes.filter((n) => {
                    const meta = getMeta(n.data);
                    return meta && !meta.isGroup && meta.ancestors.includes('USA');
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
            directive.onGroupCheckboxClick('USA');

            // Expand: effect restores selection and adds restored data nodes to programmaticallySetNodes
            directive.toggleCollapse('USA');
            fixture.detectChanges();

            // Wait for restored children to appear and be selected
            await waitFor(() => {
                expect(grid.mock.nodes.some((n) => !isGroupHeader(n.data) && n.isSelected())).toBe(true);
            });

            const usaChildren = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes('USA');
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
                return meta && !meta.isGroup && meta.ancestors.includes('USA');
            });
            expect(usaDataRows.length).toBeGreaterThanOrEqual(2);
            usaDataRows[0].setSelected(true);
            grid.emitRowSelected(usaDataRows[0]);
            expect(directive.groupSelectionState().get('USA')).toBe('indeterminate');

            // Collapse USA — this used to silently discard the partial selection.
            directive.toggleCollapse('USA');
            fixture.detectChanges();
            await waitForNodes(grid, fixture, (nodes) =>
                nodes.every((n) => {
                    const meta = getMeta(n.data);
                    return !meta || meta.isGroup || !meta.ancestors.includes('USA');
                })
            );
            expect(directive.groupSelectionState().get('USA')).toBe('indeterminate');

            // Re-expand — the same single child must still be selected, group still indeterminate.
            directive.toggleCollapse('USA');
            fixture.detectChanges();
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            const restoredUsaDataRows = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes('USA');
            });
            const selectedRows = restoredUsaDataRows.filter((n) => n.isSelected());
            expect(selectedRows).toHaveLength(1);
            expect(selectedRows[0].data.id).toBe(usaDataRows[0].data.id);
            expect(directive.groupSelectionState().get('USA')).toBe('indeterminate');
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
            directive.toggleCollapse('USA');

            directive.onSelectAllCheckboxClick();

            expect(directive.overallSelectionState()).toBe('checked');

            // Re-expand — the previously-collapsed children must come back selected too.
            directive.toggleCollapse('USA');
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));
            const usaDataRows = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes('USA');
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
            directive.toggleCollapse('USA');

            const emitSpy = jest.spyOn(directive.rowSelectionChanged, 'emit');
            directive.onGroupCheckboxClick('USA');

            expect(emitSpy).toHaveBeenCalledTimes(1);
            const [[emitted]] = emitSpy.mock.calls;
            expect(emitted.map((row) => String(row.id)).sort()).toEqual(['1', '2']);
        });

        it('reflects deselecting one child against the full selected set, not just visible rows', async () => {
            const { grid, directive } = await setupWithGroups();
            const usaRows = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes('USA');
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
            expect(directive.groupSelectionState().get('USA')).toBe('indeterminate');
        });

        it('selects a row hidden inside a collapsed group — rollup updates with no AG node for it', async () => {
            const { directive } = await setupWithGroups();
            directive.toggleCollapse('USA'); // re-collapse so USA's children aren't loaded

            directive.setRowSelected('1', true);

            // No AG node exists for the hidden row, but the group's rollup state is still
            // correct — it's derived entirely from selectedRowIds, independent of visibility.
            expect(directive.groupSelectionState().get('USA')).toBe('indeterminate');
        });

        it('restores a selection made while hidden once the group is expanded', async () => {
            const { grid, directive, fixture } = await setupWithGroups();
            directive.toggleCollapse('USA');
            directive.setRowSelected('1', true);

            directive.toggleCollapse('USA'); // expand again
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
            expect(directive.groupSelectionState().get('USA')).toBeUndefined();
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
});
