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

            const usaDataRows = grid.mock.nodes.filter((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup && meta.ancestors.includes('USA');
            });
            expect(usaDataRows).toHaveLength(2);
        });

        it('hides children of collapsed groups', async () => {
            const { fixture, grid, directive } = await setup(DATA);
            directive.groupCols.set(['country']);
            directive.collapsedPaths.set(new Set(['USA']));
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));

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

    describe('groupCols management', () => {
        it('addGroupColumn appends the field to groupCols', async () => {
            const { directive } = await setup(DATA);
            directive.addGroupColumn('country');
            expect(directive.groupCols()).toContain('country');
        });

        it('addGroupColumn is a no-op when the field is already present', async () => {
            const { directive } = await setup(DATA);
            directive.addGroupColumn('country');
            directive.addGroupColumn('country');
            expect(directive.groupCols().filter((c) => c === 'country')).toHaveLength(1);
        });

        it('removeGroupColumn removes the field from groupCols', async () => {
            const { directive } = await setup(DATA);
            directive.addGroupColumn('country');
            directive.removeGroupColumn('country');
            expect(directive.groupCols()).not.toContain('country');
        });

        it('moveGroupColumn reorders the fields', async () => {
            const { directive } = await setup(DATA);
            directive.groupCols.set(['country', 'sport']);
            directive.moveGroupColumn(0, 1);
            expect(directive.groupCols()).toEqual(['sport', 'country']);
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
            directive.addGroupColumn('country');
            fixture.detectChanges();

            await waitFor(() => {
                expect(grid.mock.setGridOption).toHaveBeenCalledWith('columnDefs', expect.any(Array));
            });

            expect((grid.mock.colDefs[0] as ColDef).colId).toBe('KbqAgGridRowGroup');
        });

        it('restores original columnDefs when groupCols becomes empty', async () => {
            const { fixture, grid, directive } = await setup(DATA);
            directive.addGroupColumn('country');
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

        it('selecting a data row does not propagate to any other row', async () => {
            const { grid } = await setupWithGroups();

            const dataNode = grid.mock.nodes.find((n) => {
                const meta = getMeta(n.data);
                return meta && !meta.isGroup;
            })!;
            grid.emitRowSelected(dataNode);

            for (const node of grid.mock.nodes) {
                if (node === dataNode) continue;

                expect(node.setSelected).not.toHaveBeenCalled();
            }
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
            directive.addGroupColumn('country');
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
            directive.addGroupColumn('country');
            fixture.detectChanges();
            await waitForNodes(grid, fixture, (nodes) => nodes.some((n) => isGroupHeader(n.data)));

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
    });
});
