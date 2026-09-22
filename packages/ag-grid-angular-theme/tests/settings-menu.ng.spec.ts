import { SharedResizeObserver } from '@angular/cdk/observers/private';
import { ApplicationRef, Component, DestroyRef, Directive, forwardRef, inject, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { fireEvent, render, waitFor } from '@testing-library/angular';
import { AgGridAngular } from 'ag-grid-angular';
import { AgEventType, Column, GridApi } from 'ag-grid-community';
import { Observable, Subject } from 'rxjs';
import {
    KBQ_AG_GRID_SETTINGS_MENU_LABELS_EN,
    KBQ_AG_GRID_SETTINGS_MENU_LABELS_RU,
    KBQ_AG_GRID_SETTINGS_MENU_PARAMS,
    KbqAgGridSettingsMenu,
    kbqAgGridSettingsMenuColumnsItem,
    KbqAgGridSettingsMenuItems,
    KbqAgGridSettingsMenuLabels,
    kbqAgGridSettingsMenuSeparator,
    kbqAgGridSettingsMenuSortItem
} from '../src/settings-menu.ng';

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
    visible = true,
    sort
}: {
    colId: string;
    headerName?: string;
    visible?: boolean;
    sort?: 'asc' | 'desc';
}): Column =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    ({
        getColId: jest.fn(() => colId),
        getColDef: jest.fn(() => ({ headerName })),
        isVisible: jest.fn(() => visible),
        isPinnedLeft: jest.fn(() => false),
        isPinnedRight: jest.fn(() => false),
        isSortable: jest.fn(() => true),
        getSort: jest.fn(() => sort),
        getSortIndex: jest.fn(() => null)
    }) as unknown as Column;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createApiMock = (columns: Column[] = []) => {
    const listeners = new Map<AgEventType, AnyEventHandler[]>();

    const api = {
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
        getColumns: jest.fn(() => columns),
        setColumnsVisible: jest.fn(),
        setColumnsPinned: jest.fn(),
        moveColumnByIndex: jest.fn(),
        resetColumnState: jest.fn(),
        applyColumnState: jest.fn(),
        getGridOption: jest.fn(() => undefined)
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
}

@Component({
    standalone: true,
    imports: [TestAgGridAngularStub, KbqAgGridSettingsMenu],
    template: `
        <ag-grid-angular
            kbqAgGridSettingsMenu
            [kbqAgGridSettingsMenuItems]="items()"
            [kbqAgGridSettingsMenuLabels]="labels()"
        />
    `
})
class TestSettingsMenuGrid {
    readonly grid = viewChild.required(TestAgGridAngularStub);
    readonly items = signal<KbqAgGridSettingsMenuItems | undefined>(undefined);
    readonly labels = signal<KbqAgGridSettingsMenuLabels | undefined>(undefined);
}

@Component({
    standalone: true,
    template: `
        <textarea class="test-screen-notes"></textarea>
    `
})
class TestNotesScreen {
    private readonly params = inject(KBQ_AG_GRID_SETTINGS_MENU_PARAMS);

    constructor() {
        inject(DestroyRef).onDestroy(this.params.setResetHandler((): void => undefined));
    }
}

const openMenu = async (container: Element): Promise<void> => {
    fireEvent.click(container.querySelector('.kbq-settings-menu-trigger')!);

    await waitFor(() => {
        expect(container.querySelector('.kbq-settings-menu-panel')).toBeTruthy();
    });
};

const renderMenu = async (
    items?: KbqAgGridSettingsMenuItems,
    columns: Column[] = []
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
    const { api, dispatch } = createApiMock(columns);
    const result = await render(TestSettingsMenuGrid, {
        providers: [{ provide: SharedResizeObserver, useClass: MockSharedResizeObserver }]
    });

    if (items) {
        result.fixture.componentInstance.items.set(items);
    }

    result.fixture.componentInstance.grid().emitGridReady(api);
    result.fixture.detectChanges();

    return { ...result, api, dispatch };
};

const itemLabels = (container: Element): string[] =>
    Array.from(container.querySelectorAll('.kbq-settings-menu-item-label')).map((el) => el.textContent?.trim() ?? '');

describe('KbqAgGridSettingsMenu', () => {
    describe('trigger', () => {
        it('renders the trigger inside an overlay after gridReady', async () => {
            const { container } = await renderMenu();

            await waitFor(() => {
                expect(container.querySelector('.kbq-ag-grid-settings-menu-overlay')).toBeTruthy();
                expect(container.querySelector('.kbq-settings-menu-trigger')).toBeTruthy();
            });
        });

        it('opens and closes the panel on trigger click', async () => {
            const { container } = await renderMenu();

            await openMenu(container);

            fireEvent.click(container.querySelector('.kbq-settings-menu-trigger')!);

            await waitFor(() => {
                expect(container.querySelector('.kbq-settings-menu-panel')).toBeNull();
            });
        });

        it('does not trigger change detection for document events while the menu is closed', async () => {
            await renderMenu();

            const tick = jest.spyOn(TestBed.inject(ApplicationRef), 'tick');

            document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            await Promise.resolve();

            expect(tick).not.toHaveBeenCalled();
        });

        it('closes the panel on click outside', async () => {
            const { container } = await renderMenu();

            await openMenu(container);

            fireEvent.click(document.body);

            await waitFor(() => {
                expect(container.querySelector('.kbq-settings-menu-panel')).toBeNull();
            });
        });
    });

    describe('root level', () => {
        it('renders the built-in columns and sorting items by default', async () => {
            const { container } = await renderMenu();

            await openMenu(container);

            expect(itemLabels(container)).toEqual([
                KBQ_AG_GRID_SETTINGS_MENU_LABELS_RU.columnsItem,
                KBQ_AG_GRID_SETTINGS_MENU_LABELS_RU.sortItem
            ]);
        });

        it('renders the menu title', async () => {
            const { container } = await renderMenu();

            await openMenu(container);

            expect(container.querySelector('.kbq-settings-menu-panel-title')?.textContent?.trim()).toBe(
                KBQ_AG_GRID_SETTINGS_MENU_LABELS_RU.title
            );
        });

        it('renders custom items, separators and values', async () => {
            const { container } = await renderMenu([
                { id: 'a', label: 'First', value: 'On' },
                kbqAgGridSettingsMenuSeparator(),
                { id: 'b', label: 'Second', counter: 3 }
            ]);

            await openMenu(container);

            expect(itemLabels(container)).toEqual(['First', 'Second']);
            expect(container.querySelectorAll('.kbq-settings-menu-separator')).toHaveLength(1);
            expect(container.querySelector('.kbq-settings-menu-item-value')?.textContent?.trim()).toBe('On');
            expect(container.querySelector('.kbq-settings-menu-item-counter')?.textContent?.trim()).toBe('+3');
        });

        it('does not render hidden items', async () => {
            const { container } = await renderMenu([
                { id: 'a', label: 'Visible' },
                { id: 'b', label: 'Hidden', hidden: true }
            ]);

            await openMenu(container);

            expect(itemLabels(container)).toEqual(['Visible']);
        });

        it('resolves item state from the grid api', async () => {
            const columns = [createColumnMock({ colId: 'a' }), createColumnMock({ colId: 'b', visible: false })];
            const { container } = await renderMenu(
                [
                    kbqAgGridSettingsMenuColumnsItem({ labels: KBQ_AG_GRID_SETTINGS_MENU_LABELS_EN }),
                    { id: 'c', label: 'Refresh' }
                ],
                columns
            );

            await openMenu(container);

            expect(container.querySelector('.kbq-settings-menu-item-value')?.textContent?.trim()).toBe('1 of 2');
        });

        it('renders the applied sorting with the direction as a text symbol after the column name', async () => {
            const columns = [
                createColumnMock({ colId: 'athlete', headerName: 'Athlete', sort: 'desc' }),
                createColumnMock({ colId: 'age', headerName: 'Age', sort: 'asc' })
            ];
            const { container } = await renderMenu(
                [kbqAgGridSettingsMenuSortItem(), { id: 'refresh', label: 'Refresh' }],
                columns
            );

            await openMenu(container);

            expect(container.querySelector('.kbq-settings-menu-item-value')?.textContent?.trim()).toBe('Athlete');
            expect(container.querySelector('.kbq-settings-menu-item-value-suffix')?.textContent?.trim()).toBe('↓');
            expect(container.querySelector('.kbq-settings-menu-item-counter')?.textContent?.trim()).toBe('+1');
        });
    });

    describe('items', () => {
        it('runs the action of a leaf item and closes the menu', async () => {
            const action = jest.fn();
            const { container } = await renderMenu([
                {
                    id: 'a',
                    label: 'Refresh',
                    action: (): void => {
                        action();
                    }
                }
            ]);

            await openMenu(container);

            fireEvent.click(container.querySelector('.kbq-settings-menu-item')!);

            await waitFor(() => {
                expect(action).toHaveBeenCalled();
                expect(container.querySelector('.kbq-settings-menu-panel')).toBeNull();
            });
        });

        it('keeps the menu open after the action of an item with keepOpen', async () => {
            const action = jest.fn();
            const { container } = await renderMenu([
                {
                    id: 'a',
                    label: 'Compact',
                    keepOpen: true,
                    action: (): void => {
                        action();
                    }
                },
                { id: 'b', label: 'Normal' }
            ]);

            await openMenu(container);

            fireEvent.click(container.querySelector('.kbq-settings-menu-item-label')!);

            expect(action).toHaveBeenCalled();
            expect(container.querySelector('.kbq-settings-menu-panel')).toBeTruthy();
            expect(itemLabels(container)).toEqual(['Compact', 'Normal']);
        });

        it('does not run the action of a disabled item', async () => {
            const action = jest.fn();
            const { container } = await renderMenu([
                {
                    id: 'a',
                    label: 'Refresh',
                    disabled: true,
                    action: (): void => {
                        action();
                    }
                }
            ]);

            await openMenu(container);

            fireEvent.click(container.querySelector('.kbq-settings-menu-item')!);

            expect(action).not.toHaveBeenCalled();
            expect(container.querySelector('.kbq-settings-menu-panel')).toBeTruthy();
        });

        it('marks checked items of a single selection level', async () => {
            const { container } = await renderMenu([
                {
                    id: 'density',
                    label: 'Density',
                    mode: 'single',
                    items: [
                        { id: 'compact', label: 'Compact' },
                        { id: 'normal', label: 'Normal', checked: true }
                    ]
                },
                { id: 'refresh', label: 'Refresh' }
            ]);

            await openMenu(container);

            fireEvent.click(container.querySelector('.kbq-settings-menu-item')!);

            await waitFor(() => {
                expect(itemLabels(container)).toEqual(['Compact', 'Normal']);
            });

            const rows = Array.from(container.querySelectorAll('.kbq-settings-menu-item'));

            expect(rows.map((row) => row.getAttribute('aria-checked'))).toEqual(['false', 'true']);
            expect(container.querySelectorAll('.kbq-settings-menu-item-check')).toHaveLength(1);
        });
    });

    describe('navigation', () => {
        it('opens a nested list level and shows the back button', async () => {
            const { container } = await renderMenu([
                { id: 'a', label: 'Parent', items: [{ id: 'b', label: 'Child' }] },
                { id: 'c', label: 'Sibling' }
            ]);

            await openMenu(container);

            expect(container.querySelector('.kbq-settings-menu-header-btn')).toBeNull();

            fireEvent.click(container.querySelector('.kbq-settings-menu-item')!);

            await waitFor(() => {
                expect(container.querySelector('.kbq-settings-menu-panel-title')?.textContent?.trim()).toBe('Parent');
                expect(itemLabels(container)).toEqual(['Child']);
                expect(container.querySelector('.kbq-settings-menu-header-btn')).toBeTruthy();
            });
        });

        it('cycles Tab between the header buttons and the active item of a list level', async () => {
            const { container } = await renderMenu([
                { id: 'a', label: 'Parent', reset: (): void => undefined, items: [{ id: 'b', label: 'Child' }] },
                { id: 'c', label: 'Sibling' }
            ]);
            const panel = (): Element => container.querySelector('.kbq-settings-menu-panel')!;

            await openMenu(container);
            fireEvent.click(container.querySelector('.kbq-settings-menu-item')!);

            await waitFor(() => {
                expect(document.activeElement?.textContent?.trim()).toBe('Child');
            });

            fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
            expect(document.activeElement).toBe(container.querySelector('.kbq-settings-menu-back-btn'));

            fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
            expect(document.activeElement).toBe(container.querySelector('.kbq-settings-menu-reset-btn'));

            fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
            expect(document.activeElement?.textContent?.trim()).toBe('Child');

            fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true });
            expect(document.activeElement).toBe(container.querySelector('.kbq-settings-menu-reset-btn'));
            expect(panel()).toBeTruthy();
        });

        it('keeps the focus on the active item on Tab at the root level', async () => {
            const { container } = await renderMenu([
                { id: 'a', label: 'First' },
                { id: 'b', label: 'Second' }
            ]);

            await openMenu(container);

            await waitFor(() => {
                expect(document.activeElement?.textContent?.trim()).toBe('First');
            });

            fireEvent.keyDown(document.activeElement!, { key: 'Tab' });

            expect(document.activeElement?.textContent?.trim()).toBe('First');
            expect(container.querySelector('.kbq-settings-menu-panel')).toBeTruthy();
        });

        it('returns to the previous level on back button click', async () => {
            const { container } = await renderMenu([
                { id: 'a', label: 'Parent', items: [{ id: 'b', label: 'Child' }] },
                { id: 'c', label: 'Sibling' }
            ]);

            await openMenu(container);

            fireEvent.click(container.querySelector('.kbq-settings-menu-item')!);

            await waitFor(() => {
                expect(container.querySelector('.kbq-settings-menu-header-btn')).toBeTruthy();
            });

            fireEvent.click(container.querySelector('.kbq-settings-menu-header-btn')!);

            await waitFor(() => {
                expect(container.querySelector('.kbq-settings-menu-panel-title')?.textContent?.trim()).toBe(
                    KBQ_AG_GRID_SETTINGS_MENU_LABELS_RU.title
                );
                expect(itemLabels(container)).toEqual(['Parent', 'Sibling']);
            });
        });

        it('uses the screen title for the nested level', async () => {
            const { container } = await renderMenu([
                { id: 'a', label: 'Parent', screenTitle: 'Nested', items: [{ id: 'b', label: 'Child' }] },
                { id: 'c', label: 'Sibling' }
            ]);

            await openMenu(container);

            fireEvent.click(container.querySelector('.kbq-settings-menu-item')!);

            await waitFor(() => {
                expect(container.querySelector('.kbq-settings-menu-panel-title')?.textContent?.trim()).toBe('Nested');
            });
        });

        it('renders the reset button of the level and calls its handler', async () => {
            const reset = jest.fn();
            const { container } = await renderMenu([
                {
                    id: 'a',
                    label: 'Parent',
                    reset: (): void => {
                        reset();
                    },
                    items: [{ id: 'b', label: 'Child' }]
                },
                { id: 'c', label: 'Sibling' }
            ]);

            await openMenu(container);

            fireEvent.click(container.querySelector('.kbq-settings-menu-item')!);

            await waitFor(() => {
                expect(container.querySelector('.kbq-settings-menu-reset-btn')).toBeTruthy();
            });

            fireEvent.click(container.querySelector('.kbq-settings-menu-reset-btn')!);

            expect(reset).toHaveBeenCalled();
        });

        it('returns to the root level when the menu is reopened', async () => {
            const { container } = await renderMenu([
                { id: 'a', label: 'Parent', items: [{ id: 'b', label: 'Child' }] },
                { id: 'c', label: 'Sibling' }
            ]);

            await openMenu(container);

            fireEvent.click(container.querySelector('.kbq-settings-menu-item')!);

            await waitFor(() => {
                expect(itemLabels(container)).toEqual(['Child']);
            });

            fireEvent.click(container.querySelector('.kbq-settings-menu-trigger')!);
            await openMenu(container);

            expect(itemLabels(container)).toEqual(['Parent', 'Sibling']);
        });

        it('opens the only section right away and keeps the back button hidden', async () => {
            const { container } = await renderMenu([
                { id: 'a', label: 'Columns', items: [{ id: 'b', label: 'Child' }] }
            ]);

            await openMenu(container);

            expect(container.querySelector('.kbq-settings-menu-panel-title')?.textContent?.trim()).toBe('Columns');
            expect(itemLabels(container)).toEqual(['Child']);
            expect(container.querySelector('.kbq-settings-menu-header-btn')).toBeNull();
            expect(container.querySelector('.kbq-settings-menu-trigger')?.getAttribute('title')).toBe('Columns');
        });

        it('goes back on Escape and closes the menu at the root level', async () => {
            const { container } = await renderMenu([
                { id: 'a', label: 'Parent', items: [{ id: 'b', label: 'Child' }] },
                { id: 'c', label: 'Sibling' }
            ]);

            await openMenu(container);

            fireEvent.click(container.querySelector('.kbq-settings-menu-item')!);

            await waitFor(() => {
                expect(itemLabels(container)).toEqual(['Child']);
            });

            fireEvent.keyDown(document, { key: 'Escape' });

            await waitFor(() => {
                expect(itemLabels(container)).toEqual(['Parent', 'Sibling']);
            });

            fireEvent.keyDown(document, { key: 'Escape' });

            await waitFor(() => {
                expect(container.querySelector('.kbq-settings-menu-panel')).toBeNull();
            });
        });
    });

    describe('columns screen', () => {
        it('moves the reset button to the header and restores the layout from the column definitions', async () => {
            const hiddenByUser = createColumnMock({ colId: 'country', visible: false });
            const pinnedByDefinition = createColumnMock({ colId: 'date' });

            jest.spyOn(pinnedByDefinition, 'getColDef').mockReturnValue({ headerName: 'date', pinned: 'right' });

            const columns = [createColumnMock({ colId: 'ag-Grid-SelectionColumn' }), hiddenByUser, pinnedByDefinition];
            const { container, api } = await renderMenu(
                [kbqAgGridSettingsMenuColumnsItem({ labels: KBQ_AG_GRID_SETTINGS_MENU_LABELS_EN })],
                columns
            );

            await openMenu(container);

            await waitFor(() => {
                expect(container.querySelector('.kbq-settings-menu-reset-btn')).toBeTruthy();
            });
            expect(container.querySelector('.kbq-column-menu-panel-footer')).toBeNull();

            fireEvent.click(container.querySelector('.kbq-settings-menu-reset-btn')!);

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(api.applyColumnState).toHaveBeenCalledWith({
                state: [
                    { colId: 'ag-Grid-SelectionColumn' },
                    { colId: 'country', hide: false, pinned: null },
                    { colId: 'date', hide: false, pinned: 'right' }
                ],
                applyOrder: true
            });
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(api.resetColumnState).not.toHaveBeenCalled();
        });

        it('refreshes the list when the column definitions change', async () => {
            const columns = [createColumnMock({ colId: 'athlete' })];
            const { container, dispatch } = await renderMenu([kbqAgGridSettingsMenuColumnsItem()], columns);

            await openMenu(container);

            columns.push(createColumnMock({ colId: 'extra' }));
            dispatch('newColumnsLoaded');

            await waitFor(() => {
                const labels = Array.from(container.querySelectorAll('.kbq-column-menu-label'));

                expect(labels.map((label) => label.textContent?.trim())).toEqual(['athlete', 'extra']);
            });
        });

        it('names icon-only columns after their header tooltip', async () => {
            const status = createColumnMock({ colId: 'status', headerName: '' });

            jest.spyOn(status, 'getColDef').mockReturnValue({ headerName: '', headerTooltip: 'Status' });

            const { container } = await renderMenu([kbqAgGridSettingsMenuColumnsItem()], [status]);

            await openMenu(container);

            await waitFor(() => {
                expect(container.querySelector('.kbq-column-menu-label')?.textContent?.trim()).toBe('Status');
                expect(container.querySelector('.kbq-column-menu-checkbox')?.getAttribute('aria-label')).toBe('Status');
            });
        });

        it('does not trap Tab on row actions without the footer', async () => {
            const { container } = await renderMenu(
                [kbqAgGridSettingsMenuColumnsItem()],
                [createColumnMock({ colId: 'athlete' }), createColumnMock({ colId: 'age' })]
            );

            await openMenu(container);

            await waitFor(() => {
                expect(container.querySelector('.kbq-column-menu-action-btn')).toBeTruthy();
            });

            const rowTab = jest.fn();
            const row = container.querySelector('kbq-column-menu-row')!;

            row.addEventListener('keydown', () => {
                rowTab();
            });

            // `fireEvent` returns `false` when a listener prevented the default action.
            const notPrevented = fireEvent.keyDown(container.querySelector('.kbq-column-menu-action-btn')!, {
                key: 'Tab'
            });

            expect(notPrevented).toBe(true);
            expect(rowTab).not.toHaveBeenCalled();
        });
    });

    describe('dismissal', () => {
        it('stays open when the click removes its own target before reaching the document', async () => {
            const { container } = await renderMenu([
                { id: 'a', label: 'Parent', items: [{ id: 'b', label: 'Child' }] },
                { id: 'c', label: 'Sibling' }
            ]);

            await openMenu(container);

            // Stands in for change detection that runs between the item listener and the document listener.
            const label = container.querySelector('.kbq-settings-menu-item-label')!;

            label.addEventListener('click', () => label.remove());
            label.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            await waitFor(() => {
                expect(container.querySelector('.kbq-settings-menu-panel')).toBeTruthy();
            });
        });

        it('stays open on a click inside a CDK overlay opened from the menu', async () => {
            const { container } = await renderMenu();
            const overlayContainer = document.createElement('div');
            const option = document.createElement('div');

            overlayContainer.classList.add('cdk-overlay-container');
            overlayContainer.appendChild(option);
            document.body.appendChild(overlayContainer);

            await openMenu(container);

            option.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(container.querySelector('.kbq-settings-menu-panel')).toBeTruthy();

            overlayContainer.remove();
        });

        it('lets the trigger click reach other menus', async () => {
            const { container } = await renderMenu();
            const documentClick = jest.fn();
            const onDocumentClick = (): void => {
                documentClick();
            };

            document.addEventListener('click', onDocumentClick);

            fireEvent.click(container.querySelector('.kbq-settings-menu-trigger')!);

            expect(documentClick).toHaveBeenCalled();

            document.removeEventListener('click', onDocumentClick);
        });

        it('ignores an Escape that has already been handled', async () => {
            const { container } = await renderMenu([
                { id: 'a', label: 'Parent', items: [{ id: 'b', label: 'Child' }] },
                { id: 'c', label: 'Sibling' }
            ]);

            await openMenu(container);
            fireEvent.click(container.querySelector('.kbq-settings-menu-item')!);

            await waitFor(() => {
                expect(itemLabels(container)).toEqual(['Child']);
            });

            const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });

            escape.preventDefault();
            document.body.dispatchEvent(escape);

            expect(itemLabels(container)).toEqual(['Child']);
        });

        it('leaves ArrowLeft to editable fields of a custom screen', async () => {
            const { container } = await renderMenu([
                { id: 'notes', label: 'Notes', screen: TestNotesScreen },
                { id: 'c', label: 'Sibling' }
            ]);

            await openMenu(container);
            fireEvent.click(container.querySelector('.kbq-settings-menu-item')!);

            await waitFor(() => {
                expect(container.querySelector('.test-screen-notes')).toBeTruthy();
            });

            fireEvent.keyDown(container.querySelector('.test-screen-notes')!, { key: 'ArrowLeft' });

            expect(container.querySelector('.test-screen-notes')).toBeTruthy();
        });
    });

    describe('focus', () => {
        it('returns the focus to the trigger after running a leaf item', async () => {
            const { container } = await renderMenu([
                { id: 'a', label: 'Refresh', action: (): void => undefined },
                { id: 'b', label: 'Other' }
            ]);

            await openMenu(container);

            const item = container.querySelector<HTMLElement>('.kbq-settings-menu-item')!;

            item.focus();
            fireEvent.keyDown(item, { key: 'Enter' });

            expect(document.activeElement).toBe(container.querySelector('.kbq-settings-menu-trigger'));
        });

        it('focuses the item that opened the level when going back', async () => {
            const { container } = await renderMenu([
                { id: 'a', label: 'First' },
                { id: 'b', label: 'Parent', items: [{ id: 'c', label: 'Child' }] }
            ]);

            await openMenu(container);
            fireEvent.click(container.querySelectorAll('.kbq-settings-menu-item')[1]);

            await waitFor(() => {
                expect(itemLabels(container)).toEqual(['Child']);
            });

            fireEvent.click(container.querySelector('.kbq-settings-menu-header-btn')!);

            await waitFor(() => {
                expect(document.activeElement?.textContent?.trim()).toBe('Parent');
            });
        });
    });

    describe('reset button', () => {
        it('stays available when a nested screen becomes the only section', async () => {
            const hidden = signal(false);
            const { container } = await renderMenu([
                { id: 'notes', label: 'Notes', screen: TestNotesScreen },
                { id: 'x', label: 'X', hidden }
            ]);

            await openMenu(container);
            fireEvent.click(container.querySelector('.kbq-settings-menu-item')!);

            await waitFor(() => {
                expect(container.querySelector('.kbq-settings-menu-reset-btn')).toBeTruthy();
            });

            hidden.set(true);
            fireEvent.keyDown(document, { key: 'Escape' });

            await waitFor(() => {
                expect(
                    container.querySelector('.kbq-settings-menu-header-btn:not(.kbq-settings-menu-reset-btn)')
                ).toBeNull();
                expect(container.querySelector('.kbq-settings-menu-reset-btn')).toBeTruthy();
            });
        });
    });

    describe('labels', () => {
        it('resolves the texts of built-in items from the configured labels', async () => {
            const { container, fixture } = await renderMenu(
                [kbqAgGridSettingsMenuColumnsItem(), kbqAgGridSettingsMenuSortItem()],
                [createColumnMock({ colId: 'a' }), createColumnMock({ colId: 'b', visible: false })]
            );

            fixture.componentInstance.labels.set(KBQ_AG_GRID_SETTINGS_MENU_LABELS_EN);
            fixture.detectChanges();

            await openMenu(container);

            expect(itemLabels(container)).toEqual(['Columns', 'Sorting']);
            expect(container.querySelector('.kbq-settings-menu-item-value')?.textContent?.trim()).toBe('1 of 2');
        });

        it('uses the labels passed through the input', async () => {
            const { container, fixture } = await renderMenu();

            fixture.componentInstance.labels.set(KBQ_AG_GRID_SETTINGS_MENU_LABELS_EN);
            fixture.detectChanges();

            await openMenu(container);

            expect(container.querySelector('.kbq-settings-menu-panel-title')?.textContent?.trim()).toBe(
                KBQ_AG_GRID_SETTINGS_MENU_LABELS_EN.title
            );
            expect(itemLabels(container)).toEqual([
                KBQ_AG_GRID_SETTINGS_MENU_LABELS_EN.columnsItem,
                KBQ_AG_GRID_SETTINGS_MENU_LABELS_EN.sortItem
            ]);
        });
    });
});
