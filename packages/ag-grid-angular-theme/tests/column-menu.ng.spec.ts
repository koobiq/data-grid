import { Component, Directive, forwardRef, viewChild } from '@angular/core';
import { fireEvent, render, waitFor } from '@testing-library/angular';
import { AgGridAngular } from 'ag-grid-angular';
import { AgEventType, Column, GridApi } from 'ag-grid-community';
import { Subject } from 'rxjs';
import {
    KBQ_AG_GRID_COLUMN_MENU_LABELS_EN,
    KBQ_AG_GRID_COLUMN_MENU_LABELS_RU,
    KbqAgGridColumnMenu,
    KbqAgGridColumnMenuLabels,
    kbqAgGridColumnMenuLabelsProvider
} from '../src/column-menu.ng';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEventHandler = (event?: any) => void;

const createColumnMock = ({
    colId,
    headerName = colId,
    visible = true,
    pinnedLeft = false,
    pinnedRight = false,
    lockVisible = false,
    lockPinned = false
}: {
    colId: string;
    headerName?: string;
    visible?: boolean;
    pinnedLeft?: boolean;
    pinnedRight?: boolean;
    lockVisible?: boolean;
    lockPinned?: boolean;
}): Column =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    ({
        getColId: jest.fn(() => colId),
        getColDef: jest.fn(() => ({ headerName, lockVisible, lockPinned })),
        isVisible: jest.fn(() => visible),
        isPinnedLeft: jest.fn(() => pinnedLeft),
        isPinnedRight: jest.fn(() => pinnedRight)
    }) as unknown as Column;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createApiMock = (columns: Column[] = []) => {
    const listeners = new Map<AgEventType, AnyEventHandler[]>();

    const api = {
        addEventListener: jest.fn((eventName: AgEventType, handler: AnyEventHandler) => {
            const existing = listeners.get(eventName) ?? [];
            existing.push(handler);
            listeners.set(eventName, existing);
        }),
        removeEventListener: jest.fn((eventName: AgEventType, handler: AnyEventHandler) => {
            const existing = listeners.get(eventName) ?? [];
            listeners.set(
                eventName,
                existing.filter((l) => l !== handler)
            );
        }),
        getAllGridColumns: jest.fn(() => columns),
        setColumnsVisible: jest.fn(),
        setColumnsPinned: jest.fn(),
        moveColumnByIndex: jest.fn(),
        resetColumnState: jest.fn()
    };

    const dispatch = (eventName: AgEventType, event?: object): void => {
        (listeners.get(eventName) ?? []).forEach((l) => l(event));
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
    readonly newColumnsLoaded = new Subject<void>();
    api: GridApi = createApiMock().api;

    emitGridReady(api: GridApi = this.api): void {
        this.api = api;
        this.gridReady.next();
    }

    emitNewColumnsLoaded(api: GridApi = this.api): void {
        this.api = api;
        this.newColumnsLoaded.next();
    }
}

@Component({
    standalone: true,
    imports: [TestAgGridAngularStub, KbqAgGridColumnMenu],
    template: `
        <ag-grid-angular kbqAgGridColumnMenu />
    `
})
class TestColumnMenuGrid {
    readonly grid = viewChild.required(TestAgGridAngularStub);
}

@Component({
    standalone: true,
    imports: [TestAgGridAngularStub, KbqAgGridColumnMenu],
    template: `
        <ag-grid-angular kbqAgGridColumnMenu [kbqAgGridColumnMenuLabels]="labels" />
    `
})
class TestColumnMenuGridWithLabels {
    readonly grid = viewChild.required(TestAgGridAngularStub);
    labels: KbqAgGridColumnMenuLabels = KBQ_AG_GRID_COLUMN_MENU_LABELS_EN;
}

const waitForTrigger = async (container: Element): Promise<HTMLButtonElement> => {
    await waitFor(() => expect(container.querySelector('.kbq-column-menu-trigger')).toBeTruthy());

    return container.querySelector<HTMLButtonElement>('.kbq-column-menu-trigger')!;
};

const openPanel = async (container: Element): Promise<void> => {
    const trigger = await waitForTrigger(container);
    fireEvent.click(trigger);
    await waitFor(() => expect(container.querySelector('.kbq-column-menu-panel')).toBeTruthy());
};

const getHiddenSection = (container: Element): Element | undefined =>
    Array.from(container.querySelectorAll('section')).find((s) =>
        s
            .querySelector('.kbq-column-menu-section-label')
            ?.textContent?.includes(KBQ_AG_GRID_COLUMN_MENU_LABELS_RU.hiddenSection)
    );

describe(KbqAgGridColumnMenu.name, () => {
    describe('overlay lifecycle', () => {
        it('creates overlay trigger button after gridReady', async () => {
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady();
            fixture.detectChanges();

            await waitFor(() => {
                expect(container.querySelector('.kbq-column-menu-trigger')).toBeTruthy();
            });
        });

        it('re-creates overlay after newColumnsLoaded, closing any open panel', async () => {
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady();
            fixture.detectChanges();

            await openPanel(container);

            fixture.componentInstance.grid().emitNewColumnsLoaded();
            fixture.detectChanges();

            await waitFor(() => {
                // New component starts with isOpen = false — panel is gone
                expect(container.querySelector('.kbq-column-menu-panel')).toBeNull();
                // But the trigger still exists (overlay was re-created)
                expect(container.querySelector('.kbq-column-menu-trigger')).toBeTruthy();
            });
        });

        it('removes overlay on directive destroy', async () => {
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady();
            fixture.detectChanges();

            await waitForTrigger(container);

            fixture.destroy();

            expect(container.querySelector('.kbq-ag-grid-column-menu-overlay')).toBeNull();
        });
    });

    describe('panel open/close', () => {
        it('opens panel on trigger button click', async () => {
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady();
            fixture.detectChanges();

            await openPanel(container);

            expect(container.querySelector('.kbq-column-menu-panel')).toBeTruthy();
        });

        it('closes panel on second trigger click', async () => {
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady();
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.click(container.querySelector('.kbq-column-menu-trigger')!);

            await waitFor(() => {
                expect(container.querySelector('.kbq-column-menu-panel')).toBeNull();
            });
        });

        it('closes panel on Escape key', async () => {
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady();
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.keyDown(document, { key: 'Escape' });

            await waitFor(() => {
                expect(container.querySelector('.kbq-column-menu-panel')).toBeNull();
            });
        });

        it('closes panel when clicking outside the component', async () => {
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady();
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.click(document.body);

            await waitFor(() => {
                expect(container.querySelector('.kbq-column-menu-panel')).toBeNull();
            });
        });

        it('does not close panel when clicking inside the component', async () => {
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady();
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.click(container.querySelector('.kbq-column-menu-panel-header')!);

            await waitFor(() => {
                expect(container.querySelector('.kbq-column-menu-panel')).toBeTruthy();
            });
        });
    });

    describe('column sections', () => {
        it('renders visible columns in the visible section', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name' });
            const { api } = createApiMock([col]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            const sectionLabels = Array.from(container.querySelectorAll('.kbq-column-menu-section-label'));
            expect(
                sectionLabels.some((el) => el.textContent?.includes(KBQ_AG_GRID_COLUMN_MENU_LABELS_RU.visibleSection))
            ).toBe(true);
            expect(container.querySelector('.kbq-column-menu-label')?.textContent).toContain('Name');
        });

        it('renders pinned-left columns in the pinned-left section', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name', pinnedLeft: true });
            const { api } = createApiMock([col]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            const sectionLabels = Array.from(container.querySelectorAll('.kbq-column-menu-section-label'));
            expect(
                sectionLabels.some((el) =>
                    el.textContent?.includes(KBQ_AG_GRID_COLUMN_MENU_LABELS_RU.pinnedLeftSection)
                )
            ).toBe(true);
        });

        it('renders pinned-right columns in the pinned-right section', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name', pinnedRight: true });
            const { api } = createApiMock([col]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            const sectionLabels = Array.from(container.querySelectorAll('.kbq-column-menu-section-label'));
            expect(
                sectionLabels.some((el) =>
                    el.textContent?.includes(KBQ_AG_GRID_COLUMN_MENU_LABELS_RU.pinnedRightSection)
                )
            ).toBe(true);
        });

        it('renders hidden columns in the hidden section, sorted alphabetically', async () => {
            const cols = [
                createColumnMock({ colId: 'z', headerName: 'Zebra', visible: false }),
                createColumnMock({ colId: 'a', headerName: 'Apple', visible: false })
            ];
            const { api } = createApiMock(cols);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            const labels = Array.from(getHiddenSection(container)?.querySelectorAll('.kbq-column-menu-label') ?? []);
            expect(labels[0].textContent).toContain('Apple');
            expect(labels[1].textContent).toContain('Zebra');
        });

        it('does not render a section when it has no columns', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name' });
            const { api } = createApiMock([col]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            const sectionLabels = Array.from(container.querySelectorAll('.kbq-column-menu-section-label'));
            expect(
                sectionLabels.every(
                    (el) => !el.textContent?.includes(KBQ_AG_GRID_COLUMN_MENU_LABELS_RU.pinnedLeftSection)
                )
            ).toBe(true);
            expect(
                sectionLabels.every(
                    (el) => !el.textContent?.includes(KBQ_AG_GRID_COLUMN_MENU_LABELS_RU.pinnedRightSection)
                )
            ).toBe(true);
            expect(
                sectionLabels.every((el) => !el.textContent?.includes(KBQ_AG_GRID_COLUMN_MENU_LABELS_RU.hiddenSection))
            ).toBe(true);
        });

        it('excludes internal ag-Grid-* columns', async () => {
            const col = createColumnMock({ colId: 'ag-Grid-AutoColumn', headerName: 'Auto' });
            const { api } = createApiMock([col]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            expect(container.querySelector('.kbq-column-menu-label')).toBeNull();
        });
    });

    describe('search', () => {
        it('filters columns by search query (case-insensitive)', async () => {
            const cols = [
                createColumnMock({ colId: 'name', headerName: 'Name' }),
                createColumnMock({ colId: 'age', headerName: 'Age' })
            ];
            const { api } = createApiMock(cols);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.input(container.querySelector('.kbq-column-menu-search-input')!, {
                target: { value: 'na' }
            });

            await waitFor(() => {
                const visibleLabels = Array.from(container.querySelectorAll('.kbq-column-menu-label'));
                expect(visibleLabels).toHaveLength(1);
                expect(visibleLabels[0].textContent).toContain('Name');
            });
        });

        it('shows empty state when search has no matches', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name' });
            const { api } = createApiMock([col]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.input(container.querySelector('.kbq-column-menu-search-input')!, {
                target: { value: 'xyz' }
            });

            await waitFor(() => {
                expect(container.querySelector('.kbq-column-menu-empty')).toBeTruthy();
                expect(container.querySelector('.kbq-column-menu-empty')?.textContent).toContain(
                    KBQ_AG_GRID_COLUMN_MENU_LABELS_RU.emptyState
                );
            });
        });

        it('shows clear button only when search query is not empty', async () => {
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady();
            fixture.detectChanges();

            await openPanel(container);

            expect(container.querySelector('.kbq-column-menu-search-clear')).toBeNull();

            fireEvent.input(container.querySelector('.kbq-column-menu-search-input')!, {
                target: { value: 'test' }
            });

            await waitFor(() => expect(container.querySelector('.kbq-column-menu-search-clear')).toBeTruthy());
        });

        it('clears search and hides clear button on clear button click', async () => {
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady();
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.input(container.querySelector('.kbq-column-menu-search-input')!, {
                target: { value: 'test' }
            });

            await waitFor(() => expect(container.querySelector('.kbq-column-menu-search-clear')).toBeTruthy());

            fireEvent.click(container.querySelector('.kbq-column-menu-search-clear')!);

            await waitFor(() => {
                expect(container.querySelector('.kbq-column-menu-search-clear')).toBeNull();
            });
        });

        it('highlights matching text inside column labels', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Column Name' });
            const { api } = createApiMock([col]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.input(container.querySelector('.kbq-column-menu-search-input')!, {
                target: { value: 'na' }
            });

            await waitFor(() => {
                const highlights = Array.from(container.querySelectorAll('.kbq-column-menu-highlight'));
                expect(highlights.length).toBeGreaterThan(0);
                expect(highlights[0].textContent).toBe('Na');
            });
        });

        it('escapes HTML special characters in column names', async () => {
            const col = createColumnMock({ colId: 'name', headerName: '<script>alert(1)</script>' });
            const { api } = createApiMock([col]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            await waitFor(() => {
                const label = container.querySelector('.kbq-column-menu-label');
                expect(label?.innerHTML).not.toContain('<script>');
                expect(label?.textContent).toContain('<script>alert(1)</script>');
            });
        });
    });

    describe('visibility toggle', () => {
        it('calls setColumnsVisible(false) to hide a visible column', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name' });
            const col2 = createColumnMock({ colId: 'age', headerName: 'Age' });
            const { api } = createApiMock([col, col2]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.click(container.querySelector('.kbq-column-menu-checkbox')!);

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.setColumnsVisible).toHaveBeenCalledWith(['name'], false);
            });
        });

        it('calls setColumnsVisible(true) to show a hidden column', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name', visible: false });
            const { api } = createApiMock([col]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.click(getHiddenSection(container)!.querySelector('kbq-column-menu-row')!);

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.setColumnsVisible).toHaveBeenCalledWith(['name'], true);
            });
        });

        it('does not hide the last visible column', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name' });
            const { api } = createApiMock([col]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.click(container.querySelector('.kbq-column-menu-checkbox')!);

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.setColumnsVisible).not.toHaveBeenCalled();
            });
        });

        it('does not toggle a lockVisible column', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name', lockVisible: true });
            const { api } = createApiMock([col]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.click(container.querySelector('.kbq-column-menu-checkbox')!);

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.setColumnsVisible).not.toHaveBeenCalled();
            });
        });

        it('calls setColumnsVisible(false) when clicking the row div itself (not the checkbox)', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name' });
            const col2 = createColumnMock({ colId: 'age', headerName: 'Age' });
            const { api } = createApiMock([col, col2]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.click(container.querySelector('.kbq-column-menu-row')!);

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.setColumnsVisible).toHaveBeenCalledWith(['name'], false);
            });
        });

        it('calls setColumnsVisible exactly once when clicking the checkbox (stopPropagation prevents double-toggle)', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name' });
            const col2 = createColumnMock({ colId: 'age', headerName: 'Age' });
            const { api } = createApiMock([col, col2]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.click(container.querySelector('.kbq-column-menu-checkbox')!);

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.setColumnsVisible).toHaveBeenCalledTimes(1);
            });
        });

        it('calls setColumnsVisible(false) when clicking a row in the pinned-left section', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name', pinnedLeft: true });
            const col2 = createColumnMock({ colId: 'age', headerName: 'Age', pinnedLeft: true });
            const { api } = createApiMock([col, col2]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.click(container.querySelector('.kbq-column-menu-row')!);

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.setColumnsVisible).toHaveBeenCalledWith(['name'], false);
            });
        });

        it('calls setColumnsVisible(false) when clicking a row in the pinned-right section', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name', pinnedRight: true });
            const col2 = createColumnMock({ colId: 'age', headerName: 'Age', pinnedRight: true });
            const { api } = createApiMock([col, col2]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.click(container.querySelector('.kbq-column-menu-row')!);

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.setColumnsVisible).toHaveBeenCalledWith(['name'], false);
            });
        });
    });

    describe('pinning actions', () => {
        it('calls setColumnsPinned with "left" when pin-left button is clicked', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name' });
            const { api } = createApiMock([col]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.click(container.querySelector(`[title="${KBQ_AG_GRID_COLUMN_MENU_LABELS_RU.pinLeftButton}"]`)!);

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.setColumnsPinned).toHaveBeenCalledWith(['name'], 'left');
            });
        });

        it('calls setColumnsPinned with "right" when pin-right button is clicked', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name' });
            const { api } = createApiMock([col]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.click(container.querySelector(`[title="${KBQ_AG_GRID_COLUMN_MENU_LABELS_RU.pinRightButton}"]`)!);

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.setColumnsPinned).toHaveBeenCalledWith(['name'], 'right');
            });
        });

        it('calls setColumnsPinned with null when unpin button is clicked', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name', pinnedLeft: true });
            const { api } = createApiMock([col]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.click(container.querySelector(`[title="${KBQ_AG_GRID_COLUMN_MENU_LABELS_RU.unpinButton}"]`)!);

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.setColumnsPinned).toHaveBeenCalledWith(['name'], null);
            });
        });

        it('makes a hidden column visible before pinning it', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name', visible: false });
            const { api } = createApiMock([col]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.click(container.querySelector(`[title="${KBQ_AG_GRID_COLUMN_MENU_LABELS_RU.pinLeftButton}"]`)!);

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.setColumnsVisible).toHaveBeenCalledWith(['name'], true);
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.setColumnsPinned).toHaveBeenCalledWith(['name'], 'left');
            });
        });
    });

    describe('reset', () => {
        it('calls api.resetColumnState on reset button click', async () => {
            const { api } = createApiMock();
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.click(container.querySelector('.kbq-column-menu-reset-btn')!);

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.resetColumnState).toHaveBeenCalled();
            });
        });
    });

    describe('grid event listeners', () => {
        it('subscribes to columnVisible, columnMoved, and columnPinned events after gridReady', async () => {
            const { api } = createApiMock();
            const { fixture } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.addEventListener).toHaveBeenCalledWith('columnVisible', expect.any(Function));
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.addEventListener).toHaveBeenCalledWith('columnMoved', expect.any(Function));
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.addEventListener).toHaveBeenCalledWith('columnPinned', expect.any(Function));
            });
        });

        it('re-renders column list when columnVisible event fires', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name' });
            const { api, dispatch } = createApiMock([col]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            const newCol = createColumnMock({ colId: 'email', headerName: 'Email' });
            jest.spyOn(api, 'getAllGridColumns').mockReturnValue([col, newCol]);
            dispatch('columnVisible');

            await waitFor(() => {
                const labels = Array.from(container.querySelectorAll('.kbq-column-menu-label'));
                expect(labels.some((el) => el.textContent?.includes('Email'))).toBe(true);
            });
        });

        it('removes all event listeners on destroy', async () => {
            const { api } = createApiMock();
            const { fixture } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.addEventListener).toHaveBeenCalledWith('columnVisible', expect.any(Function));
            });

            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/unbound-method
            const addMock = api.addEventListener as unknown as jest.MockedFunction<typeof api.addEventListener>;
            const getHandler = (name: AgEventType): AnyEventHandler | undefined =>
                addMock.mock.calls.find(([n]) => n === name)?.[1];

            fixture.destroy();

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(api.removeEventListener).toHaveBeenCalledWith('columnVisible', getHandler('columnVisible'));
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(api.removeEventListener).toHaveBeenCalledWith('columnMoved', getHandler('columnMoved'));
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(api.removeEventListener).toHaveBeenCalledWith('columnPinned', getHandler('columnPinned'));
        });
    });

    describe('keyboard navigation', () => {
        it('row elements have tabindex="-1"', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name' });
            const { api } = createApiMock([col]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            await waitFor(() => {
                const rows = Array.from(container.querySelectorAll('.kbq-column-menu-row'));
                expect(rows.length).toBeGreaterThan(0);
                rows.forEach((row) => expect(row.getAttribute('tabindex')).toBe('-1'));
            });
        });

        it('ArrowDown on search input focuses the first row', async () => {
            const cols = [
                createColumnMock({ colId: 'a', headerName: 'Alpha' }),
                createColumnMock({ colId: 'b', headerName: 'Beta' })
            ];
            const { api } = createApiMock(cols);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.keyDown(container.querySelector('.kbq-column-menu-search-input')!, { key: 'ArrowDown' });

            await waitFor(() => {
                expect(document.activeElement).toBe(container.querySelector('.kbq-column-menu-row'));
            });
        });

        it('ArrowDown on scroll container moves focus to the next row', async () => {
            const cols = [
                createColumnMock({ colId: 'a', headerName: 'Alpha' }),
                createColumnMock({ colId: 'b', headerName: 'Beta' })
            ];
            const { api } = createApiMock(cols);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.keyDown(container.querySelector('.kbq-column-menu-search-input')!, { key: 'ArrowDown' });
            await waitFor(() => expect(document.activeElement).toBe(container.querySelector('.kbq-column-menu-row')));

            fireEvent.keyDown(container.querySelector('.kbq-column-menu-panel-scroll')!, {
                key: 'ArrowDown',
                keyCode: 40
            });

            await waitFor(() => {
                const rows = container.querySelectorAll('.kbq-column-menu-row');
                expect(document.activeElement).toBe(rows[1]);
            });
        });

        it('ArrowUp on scroll container moves focus to the previous row', async () => {
            const cols = [
                createColumnMock({ colId: 'a', headerName: 'Alpha' }),
                createColumnMock({ colId: 'b', headerName: 'Beta' })
            ];
            const { api } = createApiMock(cols);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            const scroll = container.querySelector('.kbq-column-menu-panel-scroll')!;

            fireEvent.keyDown(container.querySelector('.kbq-column-menu-search-input')!, { key: 'ArrowDown' });
            await waitFor(() => expect(document.activeElement).toBe(container.querySelector('.kbq-column-menu-row')));

            fireEvent.keyDown(scroll, { key: 'ArrowDown', keyCode: 40 });
            await waitFor(() =>
                expect(document.activeElement).toBe(container.querySelectorAll('.kbq-column-menu-row')[1])
            );

            fireEvent.keyDown(scroll, { key: 'ArrowUp', keyCode: 38 });

            await waitFor(() => {
                expect(document.activeElement).toBe(container.querySelector('.kbq-column-menu-row'));
            });
        });

        it('Enter on a row calls setColumnsVisible to toggle visibility', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name' });
            const col2 = createColumnMock({ colId: 'age', headerName: 'Age' });
            const { api } = createApiMock([col, col2]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.keyDown(container.querySelector('.kbq-column-menu-row')!, { key: 'Enter' });

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.setColumnsVisible).toHaveBeenCalledWith(['name'], false);
            });
        });

        it('Enter on a row in the pinned-left section calls setColumnsVisible', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name', pinnedLeft: true });
            const col2 = createColumnMock({ colId: 'age', headerName: 'Age', pinnedLeft: true });
            const { api } = createApiMock([col, col2]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.keyDown(container.querySelector('.kbq-column-menu-row')!, { key: 'Enter' });

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.setColumnsVisible).toHaveBeenCalledWith(['name'], false);
            });
        });

        it('Enter on a row in the pinned-right section calls setColumnsVisible', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name', pinnedRight: true });
            const col2 = createColumnMock({ colId: 'age', headerName: 'Age', pinnedRight: true });
            const { api } = createApiMock([col, col2]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.keyDown(container.querySelector('.kbq-column-menu-row')!, { key: 'Enter' });

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.setColumnsVisible).toHaveBeenCalledWith(['name'], false);
            });
        });

        it('Enter on the checkbox of a visible row calls setColumnsVisible', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name' });
            const col2 = createColumnMock({ colId: 'age', headerName: 'Age' });
            const { api } = createApiMock([col, col2]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.keyDown(container.querySelector('.kbq-column-menu-checkbox')!, { key: 'Enter' });

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.setColumnsVisible).toHaveBeenCalledWith(['name'], false);
            });
        });

        it('Enter on the checkbox of a visible row calls setColumnsVisible exactly once', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name' });
            const col2 = createColumnMock({ colId: 'age', headerName: 'Age' });
            const { api } = createApiMock([col, col2]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.keyDown(container.querySelector('.kbq-column-menu-checkbox')!, { key: 'Enter' });

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.setColumnsVisible).toHaveBeenCalledTimes(1);
            });
        });

        it('Enter on the checkbox of a hidden row calls setColumnsVisible(true)', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name', visible: false });
            const { api } = createApiMock([col]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.keyDown(getHiddenSection(container)!.querySelector('.kbq-column-menu-checkbox')!, {
                key: 'Enter'
            });

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.setColumnsVisible).toHaveBeenCalledWith(['name'], true);
            });
        });

        it('focus is preserved on a row after Enter toggles a column off', async () => {
            const col1 = createColumnMock({ colId: 'a', headerName: 'Alpha' });
            const col2 = createColumnMock({ colId: 'b', headerName: 'Beta' });
            const { api, dispatch } = createApiMock([col1, col2]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.keyDown(container.querySelector('.kbq-column-menu-search-input')!, { key: 'ArrowDown' });
            await waitFor(() => expect(document.activeElement).toBe(container.querySelector('.kbq-column-menu-row')));

            // Simulate Alpha becoming hidden after the toggle
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            (col1.isVisible as jest.Mock).mockReturnValue(false);

            fireEvent.keyDown(container.querySelector('.kbq-column-menu-row')!, { key: 'Enter' });
            dispatch('columnVisible');
            fixture.detectChanges();

            await waitFor(() => {
                expect(document.activeElement?.classList.contains('kbq-column-menu-row')).toBe(true);
            });
        });

        it('Space on a row calls setColumnsVisible to toggle visibility', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name' });
            const col2 = createColumnMock({ colId: 'age', headerName: 'Age' });
            const { api } = createApiMock([col, col2]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.keyDown(container.querySelector('.kbq-column-menu-row')!, { key: ' ' });

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.setColumnsVisible).toHaveBeenCalledWith(['name'], false);
            });
        });

        it('Space on a row prevents default scroll behavior', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name' });
            const { api } = createApiMock([col]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
            jest.spyOn(event, 'preventDefault');
            container.querySelector('.kbq-column-menu-row')!.dispatchEvent(event);

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(event.preventDefault).toHaveBeenCalled();
        });

        it('Space on the checkbox of a visible row calls setColumnsVisible', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name' });
            const col2 = createColumnMock({ colId: 'age', headerName: 'Age' });
            const { api } = createApiMock([col, col2]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.keyDown(container.querySelector('.kbq-column-menu-checkbox')!, { key: ' ' });

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.setColumnsVisible).toHaveBeenCalledWith(['name'], false);
            });
        });

        it('Space on the checkbox of a hidden row calls setColumnsVisible(true)', async () => {
            const col = createColumnMock({ colId: 'name', headerName: 'Name', visible: false });
            const { api } = createApiMock([col]);
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady(api);
            fixture.detectChanges();

            await openPanel(container);

            fireEvent.keyDown(getHiddenSection(container)!.querySelector('.kbq-column-menu-checkbox')!, {
                key: ' '
            });

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(api.setColumnsVisible).toHaveBeenCalledWith(['name'], true);
            });
        });
    });

    describe('labels', () => {
        it('uses Russian labels by default', async () => {
            const { fixture, container } = await render(TestColumnMenuGrid);
            fixture.componentInstance.grid().emitGridReady();
            fixture.detectChanges();

            await openPanel(container);

            expect(container.querySelector('.kbq-column-menu-panel-title')?.textContent?.trim()).toBe(
                KBQ_AG_GRID_COLUMN_MENU_LABELS_RU.title
            );
        });

        it('uses English labels when provided via directive input', async () => {
            const { fixture, container } = await render(TestColumnMenuGridWithLabels);
            fixture.componentInstance.grid().emitGridReady();
            fixture.detectChanges();

            await openPanel(container);

            expect(container.querySelector('.kbq-column-menu-panel-title')?.textContent?.trim()).toBe(
                KBQ_AG_GRID_COLUMN_MENU_LABELS_EN.title
            );
        });

        it('uses custom labels provided via KBQ_AG_GRID_COLUMN_MENU_LABELS token', async () => {
            const customLabels: KbqAgGridColumnMenuLabels = {
                ...KBQ_AG_GRID_COLUMN_MENU_LABELS_EN,
                title: 'My Columns'
            };

            @Component({
                standalone: true,
                imports: [TestAgGridAngularStub, KbqAgGridColumnMenu],
                template: `
                    <ag-grid-angular kbqAgGridColumnMenu />
                `,
                providers: [kbqAgGridColumnMenuLabelsProvider(customLabels)]
            })
            class TestTokenLabelsGrid {
                readonly grid = viewChild.required(TestAgGridAngularStub);
            }

            const { fixture, container } = await render(TestTokenLabelsGrid);
            fixture.componentInstance.grid().emitGridReady();
            fixture.detectChanges();

            await openPanel(container);

            expect(container.querySelector('.kbq-column-menu-panel-title')?.textContent?.trim()).toBe('My Columns');
        });
    });
});
