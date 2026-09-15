import { SharedResizeObserver } from '@angular/cdk/observers/private';
import { Component, Directive, forwardRef, viewChild } from '@angular/core';
import { fireEvent, render, RenderResult, waitFor } from '@testing-library/angular';
import { AgGridAngular } from 'ag-grid-angular';
import { AgEventType, ColDef, Column, GridApi, SortDirection } from 'ag-grid-community';
import { Observable, Subject } from 'rxjs';
import { KbqAgGridSettingsMenu, kbqAgGridSettingsMenuSortItem } from '../src/settings-menu.ng';

class MockSharedResizeObserver {
    readonly resize$ = new Subject<ResizeObserverEntry[]>();

    observe(_target: Element): Observable<ResizeObserverEntry[]> {
        return this.resize$.asObservable();
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEventHandler = (event?: any) => void;

const createColumnMock = ({
    colId,
    headerName = colId,
    sortable = true,
    sort = null,
    sortIndex = null,
    colDef = {}
}: {
    colId: string;
    headerName?: string;
    sortable?: boolean;
    sort?: SortDirection;
    sortIndex?: number | null;
    colDef?: ColDef;
}): Column =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    ({
        getColId: jest.fn(() => colId),
        getColDef: jest.fn(() => ({ headerName, ...colDef })),
        isVisible: jest.fn(() => true),
        isPinnedLeft: jest.fn(() => false),
        isPinnedRight: jest.fn(() => false),
        isSortable: jest.fn(() => sortable),
        getSort: jest.fn(() => sort ?? undefined),
        getSortIndex: jest.fn(() => sortIndex)
    }) as unknown as Column;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createApiMock = (columns: Column[] = [], gridOptions: Record<string, unknown> = {}) => {
    const listeners = new Map<AgEventType, AnyEventHandler[]>();

    const api = {
        getColumns: jest.fn(() => columns),
        getDisplayNameForColumn: jest.fn((col: Column) => col.getColDef().headerName ?? ''),
        isDestroyed: jest.fn(() => false),
        addEventListener: jest.fn((eventName: AgEventType, handler: AnyEventHandler) => {
            listeners.set(eventName, [...(listeners.get(eventName) ?? []), handler]);
        }),
        removeEventListener: jest.fn((eventName: AgEventType, handler: AnyEventHandler) => {
            listeners.set(
                eventName,
                (listeners.get(eventName) ?? []).filter((l) => l !== handler)
            );
        }),
        getAllGridColumns: jest.fn(() => columns),
        applyColumnState: jest.fn(),
        getGridOption: jest.fn((option: string): unknown => gridOptions[option])
    };

    const dispatch = (eventName: AgEventType): void => {
        (listeners.get(eventName) ?? []).forEach((l) => l());
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return { api: api as unknown as GridApi, dispatch };
};

@Directive({
    selector: 'ag-grid-angular',
    standalone: true,
    providers: [{ provide: AgGridAngular, useExisting: forwardRef(() => TestAgGridAngularStub) }]
})
class TestAgGridAngularStub {
    readonly gridReady = new Subject<void>();
    api: GridApi = createApiMock().api;

    emitGridReady(api: GridApi = this.api): void {
        this.api = api;
        this.gridReady.next();
    }
}

@Component({
    standalone: true,
    imports: [TestAgGridAngularStub, KbqAgGridSettingsMenu],
    template: `
        <ag-grid-angular kbqAgGridSettingsMenu [kbqAgGridSettingsMenuItems]="items" />
    `
})
class TestSortMenuGrid {
    readonly grid = viewChild.required(TestAgGridAngularStub);
    readonly items = [kbqAgGridSettingsMenuSortItem()];
}

type SortScreen = RenderResult<TestSortMenuGrid> & ReturnType<typeof createApiMock>;

const openSortScreen = async (
    columns: Column[],
    {
        gridOptions = {},
        displayColumns = columns
    }: { gridOptions?: Record<string, unknown>; displayColumns?: Column[] } = {}
): Promise<SortScreen> => {
    const { api, dispatch } = createApiMock(columns, gridOptions);

    jest.spyOn(api, 'getAllGridColumns').mockReturnValue(displayColumns);
    const result = await render(TestSortMenuGrid, {
        providers: [{ provide: SharedResizeObserver, useClass: MockSharedResizeObserver }]
    });

    result.fixture.componentInstance.grid().emitGridReady(api);
    result.fixture.detectChanges();

    // The menu holds a single section, so the trigger opens the sort screen right away.
    fireEvent.click(result.container.querySelector('.kbq-settings-menu-trigger')!);

    await waitFor(() => {
        expect(result.container.querySelector('.kbq-ag-grid-sort-panel')).toBeTruthy();
    });

    return { ...result, api, dispatch };
};

const rowLabels = (container: Element): string[] =>
    Array.from(container.querySelectorAll('kbq-sort-menu-row .kbq-column-menu-label')).map(
        (el) => el.textContent?.trim() ?? ''
    );

const rowByLabel = (container: Element, label: string): Element => {
    const row = Array.from(container.querySelectorAll('kbq-sort-menu-row')).find(
        (el) => el.querySelector('.kbq-column-menu-label')?.textContent?.trim() === label
    );

    if (!row) throw new Error(`Row "${label}" not found`);

    return row;
};

describe('sort screen of KbqAgGridSettingsMenu', () => {
    describe('column list', () => {
        it('lists sortable columns only', async () => {
            const { container } = await openSortScreen([
                createColumnMock({ colId: 'athlete', headerName: 'Athlete' }),
                createColumnMock({ colId: 'sport', headerName: 'Sport', sortable: false }),
                createColumnMock({ colId: 'ag-Grid-SelectionColumn', headerName: 'Selection' })
            ]);

            expect(rowLabels(container)).toEqual(['Athlete']);
        });

        it('puts sorted columns first in the order the sorting is applied', async () => {
            const { container } = await openSortScreen([
                createColumnMock({ colId: 'athlete', headerName: 'Athlete' }),
                createColumnMock({ colId: 'age', headerName: 'Age', sort: 'asc', sortIndex: 1 }),
                createColumnMock({ colId: 'year', headerName: 'Year', sort: 'desc', sortIndex: 0 })
            ]);

            expect(rowLabels(container)).toEqual(['Year', 'Age', 'Athlete']);
        });

        it('sorts the remaining columns alphabetically', async () => {
            const { container } = await openSortScreen([
                createColumnMock({ colId: 'c', headerName: 'Country' }),
                createColumnMock({ colId: 'a', headerName: 'Athlete' }),
                createColumnMock({ colId: 'b', headerName: 'Bronze' })
            ]);

            expect(rowLabels(container)).toEqual(['Athlete', 'Bronze', 'Country']);
        });

        it('falls back to headerTooltip for icon-only headers', async () => {
            const { container } = await openSortScreen([
                createColumnMock({ colId: 'status', headerName: '', colDef: { headerTooltip: 'Status' } })
            ]);

            expect(rowLabels(container)).toEqual(['Status']);
        });

        it('filters the list by the search query', async () => {
            const { container } = await openSortScreen([
                createColumnMock({ colId: 'a', headerName: 'Athlete' }),
                createColumnMock({ colId: 'c', headerName: 'Country' })
            ]);

            fireEvent.input(container.querySelector('.kbq-column-menu-search-input')!, {
                target: { value: 'coun' }
            });

            await waitFor(() => {
                expect(rowLabels(container)).toEqual(['Country']);
            });
        });

        it('shows the empty state when nothing matches the search query', async () => {
            const { container } = await openSortScreen([createColumnMock({ colId: 'a', headerName: 'Athlete' })]);

            fireEvent.input(container.querySelector('.kbq-column-menu-search-input')!, {
                target: { value: 'zzz' }
            });

            await waitFor(() => {
                expect(container.querySelector('.kbq-column-menu-empty')).toBeTruthy();
            });
        });
    });

    describe('toggling sorting', () => {
        it('appends the column to the end of the applied sorting', async () => {
            const { container, api } = await openSortScreen([
                createColumnMock({ colId: 'year', headerName: 'Year', sort: 'asc', sortIndex: 0 }),
                createColumnMock({ colId: 'athlete', headerName: 'Athlete' })
            ]);

            fireEvent.click(rowByLabel(container, 'Athlete'));

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(api.applyColumnState).toHaveBeenCalledWith({
                state: [
                    { colId: 'year', sort: 'asc', sortIndex: 0 },
                    { colId: 'athlete', sort: 'asc', sortIndex: 1 }
                ]
            });
        });

        it('uses the first direction of sortingOrder as the default one', async () => {
            const { container, api } = await openSortScreen([
                createColumnMock({ colId: 'age', headerName: 'Age', colDef: { sortingOrder: ['desc', 'asc', null] } })
            ]);

            fireEvent.click(rowByLabel(container, 'Age'));

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(api.applyColumnState).toHaveBeenCalledWith({
                state: [{ colId: 'age', sort: 'desc', sortIndex: 0 }]
            });
        });

        it('removes the sorting and reindexes the remaining columns', async () => {
            const { container, api } = await openSortScreen([
                createColumnMock({ colId: 'year', headerName: 'Year', sort: 'asc', sortIndex: 0 }),
                createColumnMock({ colId: 'age', headerName: 'Age', sort: 'desc', sortIndex: 1 })
            ]);

            fireEvent.click(rowByLabel(container, 'Year'));

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(api.applyColumnState).toHaveBeenCalledWith({
                state: [
                    { colId: 'year', sort: null, sortIndex: null },
                    { colId: 'age', sort: 'desc', sortIndex: 0 }
                ]
            });
        });
    });

    describe('sort priority', () => {
        it('lists indexed sorts first and keeps column definition order for sorts without an index', async () => {
            const athlete = createColumnMock({ colId: 'athlete', headerName: 'Athlete', sort: 'asc' });
            const year = createColumnMock({ colId: 'year', headerName: 'Year', sort: 'desc', sortIndex: 0 });
            const country = createColumnMock({ colId: 'country', headerName: 'Country', sort: 'asc' });
            const { container } = await openSortScreen([athlete, year, country], {
                // The user moved the columns, so the display order differs from the definition order.
                displayColumns: [country, year, athlete]
            });

            expect(rowLabels(container)).toEqual(['Year', 'Athlete', 'Country']);
        });

        it('replaces the applied sort when multi-column sorting is suppressed', async () => {
            const { container, api } = await openSortScreen(
                [
                    createColumnMock({ colId: 'year', headerName: 'Year', sort: 'asc', sortIndex: 0 }),
                    createColumnMock({ colId: 'athlete', headerName: 'Athlete' })
                ],
                { gridOptions: { suppressMultiSort: true } }
            );

            fireEvent.click(rowByLabel(container, 'Athlete'));

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(api.applyColumnState).toHaveBeenCalledWith({
                state: [
                    { colId: 'year', sort: null, sortIndex: null },
                    { colId: 'athlete', sort: 'asc', sortIndex: 0 }
                ]
            });
        });
    });

    describe('sort direction', () => {
        it('switches the direction with Enter and Space instead of removing the sort', async () => {
            const { container, api } = await openSortScreen([
                createColumnMock({ colId: 'year', headerName: 'Year', sort: 'asc', sortIndex: 0 })
            ]);
            const button = rowByLabel(container, 'Year').querySelector('.kbq-sort-menu-direction-btn')!;

            fireEvent.keyDown(button, { key: 'Enter' });
            fireEvent.keyDown(button, { key: ' ' });

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(api.applyColumnState).toHaveBeenCalledTimes(2);
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(api.applyColumnState).toHaveBeenCalledWith({
                state: [{ colId: 'year', sort: 'desc', sortIndex: 0 }]
            });
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(api.applyColumnState).not.toHaveBeenCalledWith({
                state: [{ colId: 'year', sort: null, sortIndex: null }]
            });
        });

        it('updates the direction icon when the sort changes outside of the row', async () => {
            const year = createColumnMock({ colId: 'year', headerName: 'Year', sort: 'asc', sortIndex: 0 });
            const { container, dispatch } = await openSortScreen([year]);
            const icon = (): Element => rowByLabel(container, 'Year').querySelector('.kbq-sort-menu-direction-btn i')!;

            expect(icon().classList).toContain('kbq-arrow-up_16');

            jest.spyOn(year, 'getSort').mockReturnValue('desc');
            dispatch('sortChanged');

            await waitFor(() => {
                expect(icon().classList).toContain('kbq-arrow-down_16');
            });
        });

        it('hides the pointer-only drag handle from assistive technologies', async () => {
            const { container } = await openSortScreen([
                createColumnMock({ colId: 'year', headerName: 'Year', sort: 'asc', sortIndex: 0 })
            ]);

            expect(
                rowByLabel(container, 'Year').querySelector('.kbq-column-menu-drag-handle')?.getAttribute('aria-hidden')
            ).toBe('true');
        });

        it('renders the direction button for sorted columns only', async () => {
            const { container } = await openSortScreen([
                createColumnMock({ colId: 'year', headerName: 'Year', sort: 'asc', sortIndex: 0 }),
                createColumnMock({ colId: 'athlete', headerName: 'Athlete' })
            ]);

            expect(rowByLabel(container, 'Year').querySelector('.kbq-sort-menu-direction-btn')).toBeTruthy();
            expect(rowByLabel(container, 'Athlete').querySelector('.kbq-sort-menu-direction-btn')).toBeNull();
        });

        it('switches the direction to the opposite one', async () => {
            const { container, api } = await openSortScreen([
                createColumnMock({ colId: 'year', headerName: 'Year', sort: 'asc', sortIndex: 0 })
            ]);

            fireEvent.click(rowByLabel(container, 'Year').querySelector('.kbq-sort-menu-direction-btn')!);

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(api.applyColumnState).toHaveBeenCalledWith({
                state: [{ colId: 'year', sort: 'desc', sortIndex: 0 }]
            });
        });

        it('keeps the tooltip but disables the button when the direction is locked', async () => {
            const { container, api } = await openSortScreen([
                createColumnMock({
                    colId: 'year',
                    headerName: 'Year',
                    sort: 'asc',
                    sortIndex: 0,
                    colDef: { sortingOrder: ['asc'] }
                })
            ]);

            const button = rowByLabel(container, 'Year').querySelector('.kbq-sort-menu-direction-btn')!;

            expect(button.getAttribute('aria-disabled')).toBe('true');
            expect(button.getAttribute('title')).toBeTruthy();

            fireEvent.click(button);

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(api.applyColumnState).not.toHaveBeenCalled();
        });
    });

    describe('reset', () => {
        it('restores the sorting defined by the column definitions and clears the search query', async () => {
            const { container, api } = await openSortScreen([
                createColumnMock({ colId: 'year', headerName: 'Year', sort: 'desc', sortIndex: 0 }),
                createColumnMock({ colId: 'age', headerName: 'Age', colDef: { initialSort: 'asc' } })
            ]);

            fireEvent.input(container.querySelector('.kbq-column-menu-search-input')!, {
                target: { value: 'year' }
            });

            await waitFor(() => {
                expect(rowLabels(container)).toEqual(['Year']);
            });

            fireEvent.click(container.querySelector('.kbq-settings-menu-reset-btn')!);

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(api.applyColumnState).toHaveBeenCalledWith({
                state: [
                    { colId: 'year', sort: null, sortIndex: null },
                    { colId: 'age', sort: 'asc', sortIndex: null }
                ]
            });

            await waitFor(() => {
                expect(container.querySelector<HTMLInputElement>('.kbq-column-menu-search-input')!.value).toBe('');
            });
        });
    });
});
