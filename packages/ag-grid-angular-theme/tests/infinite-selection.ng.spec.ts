import { Component, Directive, forwardRef, signal, viewChild } from '@angular/core';
import { render, waitFor } from '@testing-library/angular';
import { AgGridAngular } from 'ag-grid-angular';
import { GridApi, IDatasource, IGetRowsParams, IRowNode } from 'ag-grid-community';
import { Subject } from 'rxjs';
import { KbqAgGridInfiniteSelection } from '../src/infinite-selection.ng';

type ApiMock = {
    setGridOption: jest.Mock;
    getGridOption: jest.Mock;
    forEachNode: jest.Mock;
    setNodesSelected: jest.Mock;
    deselectAll: jest.Mock;
    getDisplayedRowAtIndex: jest.Mock;
    nodes: IRowNode[];
};

const createApiMock = (): ApiMock => {
    const options: Record<string, unknown> = {};
    const nodes: IRowNode[] = [];

    return {
        setGridOption: jest.fn((key: string, value: unknown) => {
            options[key] = value;
        }),
        getGridOption: jest.fn((key: string) => options[key]),
        forEachNode: jest.fn((cb: (node: IRowNode) => void) => nodes.forEach(cb)),
        setNodesSelected: jest.fn(),
        deselectAll: jest.fn(),
        getDisplayedRowAtIndex: jest.fn(),
        nodes
    };
};

@Directive({
    selector: 'ag-grid-angular',
    standalone: true,
    providers: [{ provide: AgGridAngular, useExisting: forwardRef(() => TestAgGridAngularStub) }]
})
class TestAgGridAngularStub {
    rowModelType: string | undefined = undefined;
    datasource: IDatasource | undefined = undefined;

    readonly mock = createApiMock();

    get api(): GridApi {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        return this.mock as unknown as GridApi;
    }

    readonly gridReady = new Subject<{ api: GridApi }>();
    readonly selectionChanged = new Subject<void>();

    emitGridReady(): void {
        this.gridReady.next({ api: this.api });
    }
    emitSelectionChanged(): void {
        this.selectionChanged.next();
    }
}

// eslint-disable-next-line @typescript-eslint/strict-void-return
const createMockDatasource = (): IDatasource => ({ getRows: jest.fn(), rowCount: 100 });

const makeNode = (id: string, selected: boolean, data: object | null = {}): IRowNode =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    ({ id, data, isSelected: () => selected }) as unknown as IRowNode;

@Component({
    selector: 'test-grid',
    standalone: true,
    template: `
        <ag-grid-angular kbqAgGridInfiniteSelection [kbqAgGridInfiniteSelectionDatasource]="ds()" />
    `,
    imports: [TestAgGridAngularStub, KbqAgGridInfiniteSelection]
})
class TestGrid {
    readonly ds = signal<IDatasource>(createMockDatasource());
    readonly grid = viewChild.required(TestAgGridAngularStub);
    readonly directive = viewChild.required(KbqAgGridInfiniteSelection);
}

const getWrappedDatasource = (mock: ApiMock): IDatasource => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const [, wrapped] = mock.setGridOption.mock.calls.find(([key]: [string]) => key === 'datasource') ?? [];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return wrapped as IDatasource;
};

const makeParams = (overrides: Partial<IGetRowsParams> = {}): IGetRowsParams => ({
    startRow: 0,
    endRow: 10,
    // eslint-disable-next-line @typescript-eslint/strict-void-return
    successCallback: jest.fn(),
    // eslint-disable-next-line @typescript-eslint/strict-void-return
    failCallback: jest.fn(),
    sortModel: [],
    filterModel: {},
    context: null,
    ...overrides
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const setup = async () => {
    const { fixture } = await render(TestGrid);
    const stub = fixture.componentInstance.grid();
    stub.emitGridReady();
    await waitFor(() => expect(stub.mock.setGridOption).toHaveBeenCalledWith('datasource', expect.any(Object)));
    const wrapped = getWrappedDatasource(stub.mock);
    const directive = fixture.componentInstance.directive();
    const ds = fixture.componentInstance.ds();
    return { fixture, stub, directive, ds, wrapped };
};

describe(KbqAgGridInfiniteSelection.name, () => {
    it('sets rowModelType to "infinite" on construction', async () => {
        const { fixture } = await render(TestGrid);
        expect(fixture.componentInstance.grid().rowModelType).toBe('infinite');
    });

    it('starts with selectAll=false and empty excludedIds', async () => {
        const { fixture } = await render(TestGrid);
        expect(fixture.componentInstance.directive().state()).toEqual({ selectAll: false, excludedIds: [] });
    });

    it('configures rowSelection on gridReady', async () => {
        const { fixture } = await render(TestGrid);
        fixture.componentInstance.grid().emitGridReady();
        await waitFor(() => {
            expect(fixture.componentInstance.grid().mock.setGridOption).toHaveBeenCalledWith('rowSelection', {
                mode: 'multiRow',
                checkboxes: true,
                headerCheckbox: false
            });
        });
    });

    it('sets selectionColumnDef with state and toggle params on gridReady', async () => {
        const { fixture } = await render(TestGrid);
        fixture.componentInstance.grid().emitGridReady();
        await waitFor(() => {
            expect(fixture.componentInstance.grid().mock.setGridOption).toHaveBeenCalledWith(
                'selectionColumnDef',
                expect.objectContaining({
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    headerComponentParams: expect.objectContaining({
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        state: expect.any(Function),
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        toggle: expect.any(Function)
                    })
                })
            );
        });
    });

    it('wraps datasource — passes a different object to setGridOption', async () => {
        const { fixture } = await render(TestGrid);
        const { grid, ds } = fixture.componentInstance;
        grid().emitGridReady();
        await waitFor(() => expect(grid().mock.setGridOption).toHaveBeenCalledWith('datasource', expect.any(Object)));
        expect(getWrappedDatasource(grid().mock)).not.toBe(ds());
    });

    it('re-wraps datasource when input signal changes', async () => {
        const { fixture } = await render(TestGrid);
        const { grid, ds } = fixture.componentInstance;
        grid().emitGridReady();
        await waitFor(() => expect(grid().mock.setGridOption).toHaveBeenCalledWith('datasource', expect.any(Object)));

        grid().mock.setGridOption.mockClear();
        ds.set(createMockDatasource());
        fixture.detectChanges();

        await waitFor(() => expect(grid().mock.setGridOption).toHaveBeenCalledWith('datasource', expect.any(Object)));
    });

    describe('toggle()', () => {
        it('sets selectAll=true and selects loaded nodes that have data', async () => {
            const { stub, directive } = await setup();

            const node = makeNode('r1', false);
            stub.mock.nodes.push(node, makeNode('r2', false, null)); // r2 has no data — skipped

            directive.toggle();

            expect(directive.state()).toEqual({ selectAll: true, excludedIds: [] });
            expect(stub.mock.setNodesSelected).toHaveBeenCalledWith({ nodes: [node], newValue: true });
        });

        it('calls deselectAll and sets selectAll=false when toggling off', async () => {
            const { stub, directive } = await setup();

            directive.toggle(); // on
            stub.mock.deselectAll.mockClear();
            directive.toggle(); // off

            expect(directive.state()).toEqual({ selectAll: false, excludedIds: [] });
            expect(stub.mock.deselectAll).toHaveBeenCalledTimes(1);
        });

        it('emits stateChange on each toggle', async () => {
            const { directive } = await setup();
            const spy = jest.spyOn(directive.stateChange, 'emit');

            directive.toggle();
            expect(spy).toHaveBeenCalledWith({ selectAll: true, excludedIds: [] });

            directive.toggle();
            expect(spy).toHaveBeenCalledWith({ selectAll: false, excludedIds: [] });
        });
    });

    describe('selectionChanged', () => {
        it('adds unselected node IDs to excludedIds when selectAll=true', async () => {
            const { stub, directive } = await setup();

            directive.toggle(); // selectAll=true
            stub.mock.nodes.push(makeNode('r1', false), makeNode('r2', true));
            stub.emitSelectionChanged();

            expect(directive.state()).toEqual({ selectAll: true, excludedIds: ['r1'] });
        });

        it('is ignored when selectAll=false', async () => {
            const { stub, directive } = await setup();

            stub.mock.nodes.push(makeNode('r1', false));
            stub.emitSelectionChanged();

            expect(directive.state()).toEqual({ selectAll: false, excludedIds: [] });
        });
    });

    describe('wrapDatasource', () => {
        it('calls original getRows and passes rows to outer successCallback', async () => {
            const { wrapped, ds } = await setup();
            const outerSuccess = jest.fn();
            // eslint-disable-next-line @typescript-eslint/strict-void-return
            const params = makeParams({ successCallback: outerSuccess });

            wrapped.getRows(params);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-unsafe-member-access
            const originalParams = (ds.getRows as jest.Mock).mock.calls[0][0] as IGetRowsParams;
            originalParams.successCallback([{ name: 'A' }], 1);

            expect(outerSuccess).toHaveBeenCalledWith([{ name: 'A' }], 1);
        });

        it('auto-selects new rows in queueMicrotask when selectAll=true', async () => {
            const { stub, directive, ds, wrapped } = await setup();

            directive.toggle(); // selectAll=true
            stub.mock.setNodesSelected.mockClear();

            const node = makeNode('r5', false);
            stub.mock.getDisplayedRowAtIndex.mockImplementation((i: number) => (i === 5 ? node : null));

            const params = makeParams({ startRow: 5, endRow: 6 });
            wrapped.getRows(params);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-unsafe-member-access
            const originalParams = (ds.getRows as jest.Mock).mock.calls[0][0] as IGetRowsParams;
            originalParams.successCallback([{}], undefined);

            // eslint-disable-next-line @typescript-eslint/strict-void-return
            await new Promise<void>((resolve) => setTimeout(resolve, 0));

            expect(stub.mock.setNodesSelected).toHaveBeenCalledWith({ nodes: [node], newValue: true });
        });

        it('skips excluded rows when auto-selecting', async () => {
            const { stub, directive, ds, wrapped } = await setup();

            directive.toggle(); // selectAll=true
            stub.mock.nodes.push(makeNode('r5', false));
            stub.emitSelectionChanged(); // adds 'r5' to excludedIds
            await waitFor(() => expect(directive.state().excludedIds).toContain('r5'));
            stub.mock.setNodesSelected.mockClear();

            const node = makeNode('r5', false);
            stub.mock.getDisplayedRowAtIndex.mockReturnValue(node);

            const params = makeParams({ startRow: 5, endRow: 6 });
            wrapped.getRows(params);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-unsafe-member-access
            const originalParams = (ds.getRows as jest.Mock).mock.calls[0][0] as IGetRowsParams;
            originalParams.successCallback([{}], undefined);

            // eslint-disable-next-line @typescript-eslint/strict-void-return
            await new Promise<void>((resolve) => setTimeout(resolve, 0));

            expect(stub.mock.setNodesSelected).not.toHaveBeenCalled();
        });

        it('does not auto-select when selectAll=false', async () => {
            const { stub, ds, wrapped } = await setup();

            const node = makeNode('r5', false);
            stub.mock.getDisplayedRowAtIndex.mockReturnValue(node);

            const params = makeParams({ startRow: 5, endRow: 6 });
            wrapped.getRows(params);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-unsafe-member-access
            const originalParams = (ds.getRows as jest.Mock).mock.calls[0][0] as IGetRowsParams;
            originalParams.successCallback([{}], undefined);

            // eslint-disable-next-line @typescript-eslint/strict-void-return
            await new Promise<void>((resolve) => setTimeout(resolve, 0));

            expect(stub.mock.setNodesSelected).not.toHaveBeenCalled();
        });
    });
});
