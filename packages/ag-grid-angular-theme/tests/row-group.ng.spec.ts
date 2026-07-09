import { Component, Directive, forwardRef, signal, viewChild } from '@angular/core';
import { render, waitFor } from '@testing-library/angular';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, ColGroupDef, GridApi, IRowNode } from 'ag-grid-community';
import { Subject } from 'rxjs';
import { KbqAgGridRowGroup } from '../src/row-group.ng';

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
const createApiMock = () => {
    const _nodes: MockNode[] = [];
    let _colDefs: (ColDef | ColGroupDef)[] = [...INITIAL_COL_DEFS];

    return {
        getColumnDefs: jest.fn(() => _colDefs),
        setGridOption: jest.fn((key: string, value: unknown) => {
            if (key === 'rowData') {
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
        forEachNode: jest.fn((cb: (node: MockNode) => void) => _nodes.forEach(cb)),
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
    readonly mock = createApiMock();

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
        <ag-grid-angular kbqAgGridRowGroup [kbqAgGridRowGroupRowData]="rowData()" />
    `,
    imports: [TestAgGridAngularStub, KbqAgGridRowGroup]
})
class TestRowGroupGrid {
    readonly rowData = signal<Record<string, unknown>[]>([]);
    readonly grid = viewChild.required(TestAgGridAngularStub);
    readonly directive = viewChild.required(KbqAgGridRowGroup);
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
    { country: 'USA', sport: 'Swimming' },
    { country: 'USA', sport: 'Athletics' },
    { country: 'GBR', sport: 'Cycling' }
];

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
                { country: 'USA', sport: 'Swimming' },
                { country: 'USA', sport: 'Athletics' },
                { country: 'GBR', sport: 'Cycling' }
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
                    [kbqAgGridRowGroupCols]="['country']"
                />
            `,
            imports: [TestAgGridAngularStub, KbqAgGridRowGroup]
        })
        class TestInitialGroupCols {
            readonly data = DATA;
            readonly grid = viewChild.required(TestAgGridAngularStub);
            readonly directive = viewChild.required(KbqAgGridRowGroup);
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
                        [kbqAgGridRowGroupCols]="['country']"
                    />
                `,
                imports: [TestAgGridAngularStub, KbqAgGridRowGroup]
            })
            class TestInitialGroupColsLateData {
                readonly rowData = signal<Record<string, unknown>[]>([]);
                readonly grid = viewChild.required(TestAgGridAngularStub);
                readonly directive = viewChild.required(KbqAgGridRowGroup);
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
                { country: 'USA', sport: 'Swimming' },
                { country: 'USA', sport: 'Athletics' }
            ];
            const { directive } = await setup(nestedData);
            directive.groupCols.set(['country', 'sport']);
            directive.collapsedPaths.set(new Set(['USA']));
            directive.toggleCollapse('USA');
            // Sub-group paths should now be collapsed
            expect(directive.isCollapsed('USA::Swimming')).toBe(true);
            expect(directive.isCollapsed('USA::Athletics')).toBe(true);
        });

        it('setExpanded(path, false) collapses the group', async () => {
            const { directive } = await setup(DATA);
            directive.groupCols.set(['country']);
            directive.setExpanded('USA', false);
            expect(directive.isCollapsed('USA')).toBe(true);
        });

        it('setExpanded(path, true) expands the group', async () => {
            const { directive } = await setup(DATA);
            directive.groupCols.set(['country']);
            directive.collapsedPaths.set(new Set(['USA']));
            directive.setExpanded('USA', true);
            expect(directive.isCollapsed('USA')).toBe(false);
        });
    });

    describe('groupSelectsChildren', () => {
        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        const setupWithGroups = async () => {
            const result = await setup(DATA);
            result.directive.groupCols.set(['country']);
            await waitForNodes(result.grid, result.fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));
            result.directive.expandAll();
            await waitForNodes(result.grid, result.fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));
            return result;
        };

        it('selecting a group row propagates to all descendant rows', async () => {
            const { grid } = await setupWithGroups();

            const usaGroupNode = grid.mock.nodes.find((n) => isGroupHeader(n.data) && getMeta(n.data)!.key === 'USA')!;
            expect(usaGroupNode).toBeDefined();
            usaGroupNode.setSelected(true);
            grid.emitRowSelected(usaGroupNode);

            const usaChildren = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes('USA');
            });
            expect(usaChildren.length).toBeGreaterThan(0);
            for (const child of usaChildren) {
                expect(child.setSelected).toHaveBeenCalledWith(true, false);
            }
        });

        it('deselecting a group row propagates deselection to all descendants', async () => {
            const { grid } = await setupWithGroups();

            const usaGroupNode = grid.mock.nodes.find((n) => isGroupHeader(n.data) && getMeta(n.data)!.key === 'USA')!;
            // isSelected() returns false by default — simulates a deselect event
            grid.emitRowSelected(usaGroupNode);

            const usaChildren = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes('USA');
            });
            for (const child of usaChildren) {
                expect(child.setSelected).toHaveBeenCalledWith(false, false);
            }
        });

        it('selecting a data row does not propagate to sibling data rows', async () => {
            const { grid, directive, fixture } = await setupWithGroups();
            directive.setExpanded('USA', true);
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
            directive.setExpanded('GBR', true);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            const gbrChild = grid.mock.nodes.find((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes('GBR');
            })!;
            gbrChild.setSelected(true);
            grid.emitRowSelected(gbrChild);

            const gbrGroup = grid.mock.nodes.find((n) => isGroupHeader(n.data) && getMeta(n.data)!.key === 'GBR')!;
            expect(gbrGroup.setSelected).toHaveBeenCalledWith(true, false);
        });

        it('selecting one of multiple children keeps the group unchecked', async () => {
            const { grid, directive, fixture } = await setupWithGroups();
            directive.setExpanded('USA', true);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            const [firstDataRow] = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes('USA');
            });
            firstDataRow.setSelected(true);
            grid.emitRowSelected(firstDataRow);

            const usaGroup = grid.mock.nodes.find((n) => isGroupHeader(n.data) && getMeta(n.data)!.key === 'USA')!;
            expect(usaGroup.setSelected).not.toHaveBeenCalledWith(true, false);
        });

        it('selecting all children one by one eventually marks the group as checked', async () => {
            const { grid, directive, fixture } = await setupWithGroups();
            directive.setExpanded('USA', true);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            const usaDataRows = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes('USA');
            });
            expect(usaDataRows.length).toBeGreaterThan(1);
            const usaGroup = grid.mock.nodes.find((n) => isGroupHeader(n.data) && getMeta(n.data)!.key === 'USA')!;

            // Select all but the last — group must stay unchecked
            for (let i = 0; i < usaDataRows.length - 1; i++) {
                usaDataRows[i].setSelected(true);
                grid.emitRowSelected(usaDataRows[i]);
            }
            expect(usaGroup.setSelected).not.toHaveBeenCalledWith(true, false);

            // Select the last — group must become checked
            usaDataRows.at(-1)!.setSelected(true);
            grid.emitRowSelected(usaDataRows.at(-1)!);
            expect(usaGroup.setSelected).toHaveBeenCalledWith(true, false);
        });

        it('deselecting one child from a fully-selected group removes it from checked state', async () => {
            const { grid, directive, fixture } = await setupWithGroups();
            directive.setExpanded('USA', true);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            const usaGroup = grid.mock.nodes.find((n) => isGroupHeader(n.data) && getMeta(n.data)!.key === 'USA')!;
            const usaDataRows = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes('USA');
            });
            for (const row of usaDataRows) row.setSelected(true);
            usaGroup.setSelected(true);

            usaDataRows[0].setSelected(false);
            grid.emitRowSelected(usaDataRows[0]);

            expect(usaGroup.setSelected).toHaveBeenLastCalledWith(false, false);
        });

        it('deselecting one child keeps all sibling data rows selected', async () => {
            const { grid, directive, fixture } = await setupWithGroups();
            directive.setExpanded('USA', true);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            const usaDataRows = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes('USA');
            });
            expect(usaDataRows.length).toBeGreaterThanOrEqual(2);
            const usaGroup = grid.mock.nodes.find((n) => isGroupHeader(n.data) && getMeta(n.data)!.key === 'USA')!;

            for (const row of usaDataRows) row.setSelected(true);
            usaGroup.setSelected(true);

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

            // GBR::Cycling group has exactly one data row — selecting it propagates all the way up
            const gbrCyclingDataRow = grid.mock.nodes.find((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && n.data.country === 'GBR';
            })!;
            gbrCyclingDataRow.setSelected(true);
            grid.emitRowSelected(gbrCyclingDataRow);

            const gbrCyclingGroup = grid.mock.nodes.find(
                (n) => isGroupHeader(n.data) && getMeta(n.data)!.path === 'GBR::Cycling'
            )!;
            const gbrGroup = grid.mock.nodes.find((n) => isGroupHeader(n.data) && getMeta(n.data)!.key === 'GBR')!;

            expect(gbrCyclingGroup.setSelected).toHaveBeenCalledWith(true, false);
            expect(gbrGroup.setSelected).toHaveBeenCalledWith(true, false);
        });

        it('deselecting one child propagates up through all ancestor levels', async () => {
            const { fixture, grid, directive } = await setup(DATA);
            directive.groupCols.set(['country', 'sport']);
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));
            directive.expandAll();
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => !isGroupHeader(n.data)));

            // Select every node
            for (const node of grid.mock.nodes) node.setSelected(true);

            // GBR::Cycling has exactly one data row — deselecting it should uncheck both
            // the GBR::Cycling sub-group and the GBR top-level group
            const gbrCyclingDataRow = grid.mock.nodes.find((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && n.data.country === 'GBR';
            })!;
            gbrCyclingDataRow.setSelected(false);
            grid.emitRowSelected(gbrCyclingDataRow);

            const gbrCyclingGroup = grid.mock.nodes.find(
                (n) => isGroupHeader(n.data) && getMeta(n.data)!.path === 'GBR::Cycling'
            )!;
            const gbrGroup = grid.mock.nodes.find((n) => isGroupHeader(n.data) && getMeta(n.data)!.key === 'GBR')!;
            const usaGroup = grid.mock.nodes.find((n) => isGroupHeader(n.data) && getMeta(n.data)!.key === 'USA')!;

            expect(gbrCyclingGroup.setSelected).toHaveBeenLastCalledWith(false, false);
            expect(gbrGroup.setSelected).toHaveBeenLastCalledWith(false, false);
            // USA is unrelated — must not be touched
            expect(usaGroup.setSelected).not.toHaveBeenCalledWith(false, false);
        });

        it('each descendant is selected exactly once — propagatingSelection guard prevents re-entry', async () => {
            const { grid } = await setupWithGroups();

            const usaGroupNode = grid.mock.nodes.find((n) => isGroupHeader(n.data) && getMeta(n.data)!.key === 'USA')!;
            usaGroupNode.setSelected(true);
            grid.emitRowSelected(usaGroupNode);

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
        it('re-selects group headers after rowData is replaced on expand', async () => {
            const { fixture, grid, directive } = await setup(DATA);
            directive.groupCols.update((cols) => [...cols, 'country']);
            fixture.detectChanges();
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));

            // Mark USA group header as selected in the current (collapsed) node set
            const usaGroupNode = grid.mock.nodes.find((n) => isGroupHeader(n.data) && getMeta(n.data)!.key === 'USA')!;
            usaGroupNode.setSelected(true);

            // Expand USA — triggers a rowData refresh
            directive.toggleCollapse('USA');
            fixture.detectChanges();

            await waitFor(() => {
                // After expand the nodes are replaced; find the new USA header
                const newUsaNode = grid.mock.nodes.find((n) => isGroupHeader(n.data) && getMeta(n.data)!.key === 'USA');

                expect(newUsaNode?.setSelected).toHaveBeenCalledWith(true, false);
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

            // Select the collapsed USA group header
            const usaGroupNode = grid.mock.nodes.find((n) => isGroupHeader(n.data) && getMeta(n.data)!.key === 'USA')!;
            usaGroupNode.setSelected(true);

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

            const usaGroupNode = grid.mock.nodes.find((n) => isGroupHeader(n.data) && getMeta(n.data)!.key === 'USA')!;
            usaGroupNode.setSelected(true);

            // Expand: effect restores selection and marks new nodes in programmaticallySetNodes
            directive.toggleCollapse('USA');
            fixture.detectChanges();

            // Wait for new nodes to appear and be restored
            await waitFor(() => {
                expect(grid.mock.nodes.some((n) => !isGroupHeader(n.data) && n.isSelected())).toBe(true);
            });

            const newUsaGroupNode = grid.mock.nodes.find(
                (n) => isGroupHeader(n.data) && getMeta(n.data)!.key === 'USA'
            )!;
            const usaChildren = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes('USA');
            });

            // Simulate the async rowSelected(true) that AG Grid fires after the programmatic setSelected.
            // The handler must recognize this as its own call and suppress cascading to children again.
            grid.emitRowSelected(newUsaGroupNode);

            // Each child must have been set exactly once (during restoration) — not a second time
            // from a top-down cascade triggered by the suppressed event
            for (const child of usaChildren) {
                expect(child.setSelected).toHaveBeenCalledTimes(1);
            }
        });
    });
});
