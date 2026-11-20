import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { fireEvent, render, waitFor } from '@testing-library/angular';
import { AgGridAngular, AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, GetRowIdFunc, ModuleRegistry } from 'ag-grid-community';
import {
    KBQ_AG_GRID_ROW_DETAIL_LABELS_EN,
    KBQ_AG_GRID_ROW_DETAIL_LABELS_RU,
    KBQ_AG_GRID_ROW_DETAIL_PARAMS,
    KBQ_AG_GRID_ROW_DETAIL_STATE_STORE,
    KbqAgGridRowDetail,
    KbqAgGridRowDetailComponent,
    KbqAgGridRowDetailStateLocalStorageStore,
    KbqAgGridRowDetailStateQueryParamsStore,
    KbqAgGridRowDetailStateStore,
    kbqAgGridRowDetailLabelsProvider,
    kbqAgGridRowDetailStateStoreProvider
} from '../src/row-detail.ng';

ModuleRegistry.registerModules([AllCommunityModule]);

type TestRow = { id: string; name: string; kind: string };

const ROW_DATA: TestRow[] = [
    { id: 'a', name: 'Alpha', kind: 'first' },
    { id: 'b', name: 'Beta', kind: 'second' },
    { id: 'c', name: 'Gamma', kind: 'none' }
];

const COLUMN_DEFS: ColDef[] = [{ field: 'name' }, { field: 'kind' }];

const GET_ROW_ID: GetRowIdFunc<TestRow> = (params) => params.data.id;

/** Fixed detail height, so the tests do not depend on layout (jsdom measures nothing). */
const DETAIL_HEIGHT = 120;

const TOGGLE_SELECTOR = '.kbq-ag-grid-row-detail-cell-renderer__toggle';
const PANEL_SELECTOR = '.kbq-ag-grid-row-detail';

const STATE_KEY = 'row-detail-state-key';

@Component({
    standalone: true,
    selector: 'test-detail',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="test-detail">{{ name }}</div>
    `
})
class TestDetail {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    protected readonly name = (inject(KBQ_AG_GRID_ROW_DETAIL_PARAMS).data as TestRow).name;
}

/** Detail component closing its own row, the way a close button inside the panel would. */
@Component({
    standalone: true,
    selector: 'test-closable-detail',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <button type="button" class="test-close" (click)="params.collapse()">Close</button>
    `
})
class TestClosableDetail {
    protected readonly params = inject(KBQ_AG_GRID_ROW_DETAIL_PARAMS);
}

@Component({
    standalone: true,
    selector: 'test-other-detail',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="test-other-detail"></div>
    `
})
class TestOtherDetail {}

@Component({
    standalone: true,
    selector: 'test-grid',
    imports: [AgGridModule, KbqAgGridRowDetail],
    template: `
        <ag-grid-angular
            kbqAgGridRowDetail
            [getRowId]="getRowId"
            [rowData]="rowData"
            [columnDefs]="columnDefs"
            [kbqAgGridRowDetailComponent]="component()"
            [kbqAgGridRowDetailHeight]="detailHeight()"
            [kbqAgGridRowDetailSingleExpand]="singleExpand()"
            [kbqAgGridRowDetailFilled]="filled()"
            [kbqAgGridRowDetailSticky]="sticky()"
            [kbqAgGridRowDetailState]="stateKey()"
            [kbqAgGridRowDetailStateStore]="store()"
        />
    `
})
class TestGrid {
    readonly grid = viewChild.required(AgGridAngular);
    readonly rowDetail = viewChild.required(KbqAgGridRowDetail);
    readonly component = signal<KbqAgGridRowDetailComponent>(TestDetail);
    readonly singleExpand = signal(false);
    readonly filled = signal(false);
    readonly sticky = signal(false);
    readonly stateKey = signal<string | undefined>(undefined);
    readonly store = signal<KbqAgGridRowDetailStateStore | undefined>(undefined);

    readonly rowData = ROW_DATA;
    readonly columnDefs = COLUMN_DEFS;
    readonly getRowId = GET_ROW_ID;
    readonly detailHeight = signal(DETAIL_HEIGHT);
}

/** Host binding nothing but the component, so the directive's own defaults are in play. */
@Component({
    standalone: true,
    selector: 'test-grid-defaults',
    imports: [AgGridModule, KbqAgGridRowDetail],
    template: `
        <ag-grid-angular
            kbqAgGridRowDetail
            [getRowId]="getRowId"
            [rowData]="rowData"
            [columnDefs]="columnDefs"
            [kbqAgGridRowDetailComponent]="component"
            [kbqAgGridRowDetailHeight]="detailHeight"
        />
    `
})
class TestGridDefaults {
    readonly rowDetail = viewChild.required(KbqAgGridRowDetail);
    readonly component = TestDetail;
    readonly rowData = ROW_DATA;
    readonly columnDefs = COLUMN_DEFS;
    readonly getRowId = GET_ROW_ID;
    readonly detailHeight = DETAIL_HEIGHT;
}

/** Host without a `kbqAgGridRowDetailStateStore` binding, so the injected default store is used. */
@Component({
    standalone: true,
    selector: 'test-grid-default-store',
    imports: [AgGridModule, KbqAgGridRowDetail],
    template: `
        <ag-grid-angular
            kbqAgGridRowDetail
            [kbqAgGridRowDetailState]="stateKey"
            [getRowId]="getRowId"
            [rowData]="rowData"
            [columnDefs]="columnDefs"
            [kbqAgGridRowDetailComponent]="component"
            [kbqAgGridRowDetailHeight]="detailHeight"
        />
    `
})
class TestGridDefaultStore {
    readonly component = TestDetail;
    readonly rowData = ROW_DATA;
    readonly columnDefs = COLUMN_DEFS;
    readonly getRowId = GET_ROW_ID;
    readonly detailHeight = DETAIL_HEIGHT;
    readonly stateKey = STATE_KEY;
}

/** Same host with the query params store bound through the provider helper. */
@Component({
    standalone: true,
    selector: 'test-grid-query-params-store',
    imports: [AgGridModule, KbqAgGridRowDetail],
    providers: [kbqAgGridRowDetailStateStoreProvider(KbqAgGridRowDetailStateQueryParamsStore)],
    template: `
        <ag-grid-angular
            kbqAgGridRowDetail
            [kbqAgGridRowDetailState]="stateKey"
            [getRowId]="getRowId"
            [rowData]="rowData"
            [columnDefs]="columnDefs"
            [kbqAgGridRowDetailComponent]="component"
            [kbqAgGridRowDetailHeight]="detailHeight"
        />
    `
})
class TestGridQueryParamsStore extends TestGridDefaultStore {}

const rowElement = (container: Element, id: string): HTMLElement =>
    container.querySelector<HTMLElement>(`.ag-center-cols-container .ag-row[row-id="${id}"]`)!;

const toggleOf = (container: Element, id: string): HTMLElement =>
    rowElement(container, id).querySelector<HTMLElement>(TOGGLE_SELECTOR)!;

const renderGrid = async (): Promise<Awaited<ReturnType<typeof render<TestGrid>>>> => {
    const result = await render(TestGrid);

    await waitFor(() => {
        expect(rowElement(result.container, 'a')).toBeTruthy();
        expect(toggleOf(result.container, 'a')).toBeTruthy();
    });

    return result;
};

describe('KbqAgGridRowDetail', () => {
    it('renders an expand toggle in the first column of every expandable row', async () => {
        const { container } = await renderGrid();

        expect(toggleOf(container, 'a')).toHaveAttribute('aria-expanded', 'false');
        expect(toggleOf(container, 'b')).toBeTruthy();
    });

    it('names the toggle for screen readers, in russian by default', async () => {
        const { container } = await renderGrid();

        expect(toggleOf(container, 'a')).toHaveAttribute('aria-label', KBQ_AG_GRID_ROW_DETAIL_LABELS_RU.expandRow);

        fireEvent.click(toggleOf(container, 'a'));

        await waitFor(() => {
            expect(toggleOf(container, 'a')).toHaveAttribute(
                'aria-label',
                KBQ_AG_GRID_ROW_DETAIL_LABELS_RU.collapseRow
            );
        });
    });

    it('takes the toggle labels from kbqAgGridRowDetailLabelsProvider', async () => {
        const { container } = await render(TestGrid, {
            providers: [kbqAgGridRowDetailLabelsProvider(KBQ_AG_GRID_ROW_DETAIL_LABELS_EN)]
        });

        await waitFor(() => {
            expect(toggleOf(container, 'a')).toBeTruthy();
        });

        expect(toggleOf(container, 'a')).toHaveAttribute('aria-label', KBQ_AG_GRID_ROW_DETAIL_LABELS_EN.expandRow);
    });

    it('keeps the column value rendered next to the toggle', async () => {
        const { container } = await renderGrid();

        expect(rowElement(container, 'a').textContent).toContain('Alpha');
    });

    it('renders no toggle for a row the component selector rejects', async () => {
        const { container, fixture } = await renderGrid();

        fixture.componentInstance.component.set(({ data }) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            return (data as TestRow).kind === 'none' ? null : TestDetail;
        });
        fixture.detectChanges();

        await waitFor(() => {
            expect(rowElement(container, 'c').querySelector(TOGGLE_SELECTOR)).toBeNull();
        });

        expect(toggleOf(container, 'a')).toBeTruthy();
    });

    it('expands a row on toggle click, rendering the component inside the row', async () => {
        const { container, fixture } = await renderGrid();

        fireEvent.click(toggleOf(container, 'a'));

        await waitFor(() => {
            expect(rowElement(container, 'a').querySelector(`${PANEL_SELECTOR} .test-detail`)).toBeTruthy();
        });

        expect(rowElement(container, 'a').querySelector('.test-detail')).toHaveTextContent('Alpha');
        expect(fixture.componentInstance.rowDetail().expanded()).toEqual(['a']);
        expect(toggleOf(container, 'a')).toHaveAttribute('aria-expanded', 'true');
    });

    it('grows the row by the detail height and restores it on collapse', async () => {
        const { container, fixture } = await renderGrid();

        const { api } = fixture.componentInstance.grid();
        const collapsedHeight = api.getRowNode('a')!.rowHeight!;

        fireEvent.click(toggleOf(container, 'a'));

        await waitFor(() => {
            expect(api.getRowNode('a')!.rowHeight).toBe(collapsedHeight + DETAIL_HEIGHT);
        });

        fireEvent.click(toggleOf(container, 'a'));

        await waitFor(() => {
            expect(api.getRowNode('a')!.rowHeight).toBe(collapsedHeight);
        });
    });

    it('removes the component on collapse', async () => {
        const { container } = await renderGrid();

        fireEvent.click(toggleOf(container, 'a'));

        await waitFor(() => {
            expect(container.querySelector('.test-detail')).toBeTruthy();
        });

        fireEvent.click(toggleOf(container, 'a'));

        await waitFor(() => {
            expect(container.querySelector('.test-detail')).toBeNull();
        });
    });

    describe('while the grid animates rows', () => {
        /** Height transition of a row, finished by the test instead of the clock. */
        class TestHeightTransition {
            readonly transitionProperty = 'height';
            playState: AnimationPlayState = 'running';
            readonly finished: Promise<void>;
            private resolveFinished: () => void = () => undefined;

            constructor() {
                this.finished = new Promise((resolve) => {
                    this.resolveFinished = resolve;
                });
            }

            finish(): void {
                this.playState = 'finished';
                this.resolveFinished();
            }
        }

        const transitions = new Map<Element, TestHeightTransition>();
        // The finished transitions stay in the map, so the rows report them as over instead of handing out new ones.
        const finishTransitions = (): void => {
            for (const transition of transitions.values()) transition.finish();
        };

        const restores: (() => void)[] = [];

        /** Puts a value in place of a property for one test, and whatever was there back after it. */
        const replaceProperty = (target: object, key: string, value: unknown): void => {
            const original = Object.getOwnPropertyDescriptor(target, key);

            Object.defineProperty(target, key, { configurable: true, writable: true, value });
            restores.push(() => {
                if (original) {
                    Object.defineProperty(target, key, original);
                } else {
                    Reflect.deleteProperty(target, key);
                }
            });
        };

        // jsdom runs no CSS transitions: an expanded row reports the height transition the theme gives it while rows
        // animate, and every row resized in that state hands out a transition the test finishes.
        beforeEach(() => {
            const getComputedStyle = window.getComputedStyle.bind(window);
            const getComputedStyleSpy = jest
                .spyOn(window, 'getComputedStyle')
                .mockImplementation((element, pseudoElement) => {
                    const style = getComputedStyle(element, pseudoElement);

                    if (!element.classList.contains('kbq-ag-grid-row-detail-row')) return style;

                    return new Proxy(style, {
                        get: (target, property): unknown => {
                            if (property === 'transitionProperty') return 'height';
                            if (property === 'transitionDuration') return '0.4s';

                            const value: unknown = Reflect.get(target, property, target);

                            // Methods run against the real declaration, the only `this` jsdom accepts for them.
                            return typeof value === 'function'
                                ? (...args: unknown[]): unknown => Reflect.apply(value, target, args)
                                : value;
                        }
                    });
                });

            restores.push(() => getComputedStyleSpy.mockRestore());
            replaceProperty(globalThis, 'CSSTransition', TestHeightTransition);
            replaceProperty(Element.prototype, 'getAnimations', function getAnimations(this: Element) {
                if (!this.classList.contains('kbq-ag-grid-row-detail-row')) return [];

                const transition = transitions.get(this) ?? new TestHeightTransition();

                transitions.set(this, transition);

                return transition.playState === 'finished' ? [] : [transition];
            });
        });

        afterEach(() => {
            for (const restore of restores.splice(0).reverse()) restore();

            transitions.clear();
        });

        const expandRow = async (
            container: Element,
            fixture: Awaited<ReturnType<typeof renderGrid>>['fixture']
        ): Promise<number> => {
            const collapsedHeight = fixture.componentInstance.grid().api.getRowNode('a')!.rowHeight!;

            fireEvent.click(toggleOf(container, 'a'));

            await waitFor(() => {
                expect(fixture.componentInstance.grid().api.getRowNode('a')!.rowHeight).toBe(
                    collapsedHeight + DETAIL_HEIGHT
                );
            });

            return collapsedHeight;
        };

        it('keeps the component in the collapsing row until the row has closed', async () => {
            const { container, fixture } = await renderGrid();
            const collapsedHeight = await expandRow(container, fixture);

            fireEvent.click(toggleOf(container, 'a'));

            await waitFor(() => {
                expect(fixture.componentInstance.grid().api.getRowNode('a')!.rowHeight).toBe(collapsedHeight);
            });

            expect(toggleOf(container, 'a')).toHaveAttribute('aria-expanded', 'false');
            expect(rowElement(container, 'a').querySelector('.test-detail')).toBeTruthy();
            expect(rowElement(container, 'a').querySelector<HTMLElement>(PANEL_SELECTOR)!.inert).toBe(true);

            finishTransitions();

            await waitFor(() => {
                expect(container.querySelector('.test-detail')).toBeNull();
            });
        });

        it('keeps the same component when the row is expanded again before it has closed', async () => {
            const { container, fixture } = await renderGrid();
            const collapsedHeight = await expandRow(container, fixture);
            const detail = rowElement(container, 'a').querySelector('.test-detail');

            fireEvent.click(toggleOf(container, 'a'));

            await waitFor(() => {
                expect(fixture.componentInstance.grid().api.getRowNode('a')!.rowHeight).toBe(collapsedHeight);
            });

            fireEvent.click(toggleOf(container, 'a'));

            await waitFor(() => {
                expect(fixture.componentInstance.grid().api.getRowNode('a')!.rowHeight).toBe(
                    collapsedHeight + DETAIL_HEIGHT
                );
            });

            // The transition of the abandoned collapse settles without taking the panel along.
            finishTransitions();
            await fixture.whenStable();

            expect(rowElement(container, 'a').querySelector('.test-detail')).toBe(detail);
            expect(rowElement(container, 'a').querySelector<HTMLElement>(PANEL_SELECTOR)!.inert).toBe(false);
        });

        it('takes a detail height changed while the row was closing once it is expanded again', async () => {
            const { container, fixture } = await renderGrid();
            const collapsedHeight = await expandRow(container, fixture);

            fireEvent.click(toggleOf(container, 'a'));

            await waitFor(() => {
                expect(fixture.componentInstance.grid().api.getRowNode('a')!.rowHeight).toBe(collapsedHeight);
            });

            fixture.componentInstance.detailHeight.set(DETAIL_HEIGHT * 2);
            fixture.detectChanges();
            fireEvent.click(toggleOf(container, 'a'));

            await waitFor(() => {
                expect(fixture.componentInstance.grid().api.getRowNode('a')!.rowHeight).toBe(
                    collapsedHeight + DETAIL_HEIGHT * 2
                );
            });
        });

        it('leaves a row resized while it was closing at its new height', async () => {
            const { container, fixture } = await renderGrid();
            const collapsedHeight = await expandRow(container, fixture);
            const { api } = fixture.componentInstance.grid();
            const node = api.getRowNode('a')!;

            fireEvent.click(toggleOf(container, 'a'));

            await waitFor(() => {
                expect(node.rowHeight).toBe(collapsedHeight);
            });

            node.setRowHeight(collapsedHeight * 2);
            api.onRowHeightChanged();
            finishTransitions();

            await waitFor(() => {
                expect(container.querySelector('.test-detail')).toBeNull();
            });
            // The row heights are applied in the next task after the panel is gone.
            await new Promise((resolve) => {
                setTimeout(resolve);
            });

            expect(node.rowHeight).toBe(collapsedHeight * 2);
        });

        it('hands focus back to the toggle as soon as the row starts closing', async () => {
            const { container, fixture } = await renderGrid();

            fixture.componentInstance.component.set(TestClosableDetail);
            fixture.detectChanges();
            await expandRow(container, fixture);

            const closeButton = rowElement(container, 'a').querySelector<HTMLElement>('.test-close')!;

            closeButton.focus();
            fireEvent.click(closeButton);

            await waitFor(() => {
                expect(toggleOf(container, 'a')).toHaveFocus();
            });

            expect(rowElement(container, 'a').querySelector('.test-close')).toBeTruthy();
        });
    });

    it('keeps several rows expanded with kbqAgGridRowDetailSingleExpand disabled', async () => {
        const { container, fixture } = await renderGrid();

        fireEvent.click(toggleOf(container, 'a'));
        fireEvent.click(toggleOf(container, 'b'));

        await waitFor(() => {
            expect(fixture.componentInstance.rowDetail().expanded()).toEqual(['a', 'b']);
        });

        expect(container.querySelectorAll(PANEL_SELECTOR)).toHaveLength(2);
    });

    it('collapses the previously expanded row with kbqAgGridRowDetailSingleExpand', async () => {
        const { container, fixture } = await renderGrid();

        fixture.componentInstance.singleExpand.set(true);
        fixture.detectChanges();

        fireEvent.click(toggleOf(container, 'a'));
        fireEvent.click(toggleOf(container, 'b'));

        await waitFor(() => {
            expect(fixture.componentInstance.rowDetail().expanded()).toEqual(['b']);
        });

        expect(container.querySelectorAll(PANEL_SELECTOR)).toHaveLength(1);
    });

    describe('defaults', () => {
        const renderDefaults = async (): Promise<Awaited<ReturnType<typeof render<TestGridDefaults>>>> => {
            const result = await render(TestGridDefaults);

            await waitFor(() => {
                expect(toggleOf(result.container, 'a')).toBeTruthy();
            });

            return result;
        };

        it('expands one row at a time', async () => {
            const { container, fixture } = await renderDefaults();

            fireEvent.click(toggleOf(container, 'a'));
            fireEvent.click(toggleOf(container, 'b'));

            await waitFor(() => {
                expect(fixture.componentInstance.rowDetail().expanded()).toEqual(['b']);
            });

            expect(container.querySelectorAll(PANEL_SELECTOR)).toHaveLength(1);
        });

        it('keeps the expanded part within the visible width', async () => {
            const { container } = await renderDefaults();

            fireEvent.click(toggleOf(container, 'a'));

            await waitFor(() => {
                expect(container.querySelector(PANEL_SELECTOR)).toHaveClass('kbq-ag-grid-row-detail_sticky');
            });

            // A measured width only reaches the host in a real browser, see the e2e tests.
            expect(
                container
                    .querySelector<HTMLElement>('ag-grid-angular')!
                    .style.getPropertyValue('--kbq-ag-grid-row-detail-viewport-width')
            ).toBe('');
        });

        it('leaves the expanded row with its usual states', async () => {
            const { container } = await renderDefaults();

            fireEvent.click(toggleOf(container, 'a'));

            await waitFor(() => {
                expect(rowElement(container, 'a')).toHaveClass('kbq-ag-grid-row-detail-row');
            });

            expect(rowElement(container, 'a')).not.toHaveClass('kbq-ag-grid-row-detail-row_filled');
        });
    });

    describe('kbqAgGridRowDetailFilled', () => {
        const FILLED_ROW_CLASS = 'kbq-ag-grid-row-detail-row_filled';

        it('leaves the expanded row unfilled when disabled', async () => {
            const { container } = await renderGrid();

            fireEvent.click(toggleOf(container, 'a'));

            await waitFor(() => {
                expect(rowElement(container, 'a')).toHaveClass('kbq-ag-grid-row-detail-row');
            });

            expect(rowElement(container, 'a')).not.toHaveClass(FILLED_ROW_CLASS);
        });

        it('fills only the expanded rows', async () => {
            const { container, fixture } = await renderGrid();

            fixture.componentInstance.filled.set(true);
            fixture.detectChanges();
            fireEvent.click(toggleOf(container, 'a'));

            await waitFor(() => {
                expect(rowElement(container, 'a')).toHaveClass(FILLED_ROW_CLASS);
            });

            expect(rowElement(container, 'b')).not.toHaveClass(FILLED_ROW_CLASS);
        });

        it('drops the fill when the row is collapsed', async () => {
            const { container, fixture } = await renderGrid();

            fixture.componentInstance.filled.set(true);
            fixture.detectChanges();
            fireEvent.click(toggleOf(container, 'a'));

            await waitFor(() => {
                expect(rowElement(container, 'a')).toHaveClass(FILLED_ROW_CLASS);
            });

            fireEvent.click(toggleOf(container, 'a'));

            await waitFor(() => {
                expect(rowElement(container, 'a')).not.toHaveClass(FILLED_ROW_CLASS);
            });
        });

        it('follows the input on rows that are already expanded', async () => {
            const { container, fixture } = await renderGrid();

            fireEvent.click(toggleOf(container, 'a'));

            await waitFor(() => {
                expect(rowElement(container, 'a')).toHaveClass('kbq-ag-grid-row-detail-row');
            });

            fixture.componentInstance.filled.set(true);
            fixture.detectChanges();

            await waitFor(() => {
                expect(rowElement(container, 'a')).toHaveClass(FILLED_ROW_CLASS);
            });

            fixture.componentInstance.filled.set(false);
            fixture.detectChanges();

            await waitFor(() => {
                expect(rowElement(container, 'a')).not.toHaveClass(FILLED_ROW_CLASS);
            });
        });
    });

    describe('params.collapse()', () => {
        const renderClosable = async (): Promise<Awaited<ReturnType<typeof render<TestGrid>>>> => {
            const result = await renderGrid();

            result.fixture.componentInstance.component.set(TestClosableDetail);
            result.fixture.detectChanges();
            fireEvent.click(toggleOf(result.container, 'a'));

            await waitFor(() => {
                expect(rowElement(result.container, 'a').querySelector('.test-close')).toBeTruthy();
            });

            return result;
        };

        it('collapses the row from inside the detail component', async () => {
            const { container, fixture } = await renderClosable();

            fireEvent.click(rowElement(container, 'a').querySelector('.test-close')!);

            await waitFor(() => {
                expect(container.querySelector(PANEL_SELECTOR)).toBeNull();
            });

            expect(fixture.componentInstance.rowDetail().expanded()).toEqual([]);
            expect(toggleOf(container, 'a')).toHaveAttribute('aria-expanded', 'false');
        });

        it('hands focus back to the toggle once the focused detail content is gone', async () => {
            const { container } = await renderClosable();

            const closeButton = rowElement(container, 'a').querySelector<HTMLElement>('.test-close')!;

            closeButton.focus();
            fireEvent.click(closeButton);

            await waitFor(() => {
                expect(toggleOf(container, 'a')).toHaveFocus();
            });
        });
    });

    describe('kbqAgGridRowDetailSticky', () => {
        const STICKY_PANEL_CLASS = 'kbq-ag-grid-row-detail_sticky';
        const VIEWPORT_WIDTH_PROPERTY = '--kbq-ag-grid-row-detail-viewport-width';

        const gridElement = (container: Element): HTMLElement => container.querySelector('ag-grid-angular')!;

        it('stretches the panel across the columns when disabled', async () => {
            const { container } = await renderGrid();

            fireEvent.click(toggleOf(container, 'a'));

            await waitFor(() => {
                expect(container.querySelector(PANEL_SELECTOR)).toBeTruthy();
            });

            expect(container.querySelector(PANEL_SELECTOR)).not.toHaveClass(STICKY_PANEL_CLASS);
            expect(gridElement(container).style.getPropertyValue(VIEWPORT_WIDTH_PROPERTY)).toBe('');
        });

        it('keeps the panel to the visible width of the grid', async () => {
            const { container, fixture } = await renderGrid();

            fixture.componentInstance.sticky.set(true);
            fixture.detectChanges();
            fireEvent.click(toggleOf(container, 'a'));

            await waitFor(() => {
                expect(container.querySelector(PANEL_SELECTOR)).toHaveClass(STICKY_PANEL_CLASS);
            });

            // jsdom measures nothing, and a zero width is never published: the theme's own `100%`
            // fallback stays in charge instead of collapsing the panel. The layout is covered by e2e.
            expect(gridElement(container).style.getPropertyValue(VIEWPORT_WIDTH_PROPERTY)).toBe('');
        });

        it('follows the input on rows that are already expanded', async () => {
            const { container, fixture } = await renderGrid();

            fireEvent.click(toggleOf(container, 'a'));

            await waitFor(() => {
                expect(container.querySelector(PANEL_SELECTOR)).toBeTruthy();
            });

            fixture.componentInstance.sticky.set(true);
            fixture.detectChanges();

            await waitFor(() => {
                expect(container.querySelector(PANEL_SELECTOR)).toHaveClass(STICKY_PANEL_CLASS);
            });

            fixture.componentInstance.sticky.set(false);
            fixture.detectChanges();

            await waitFor(() => {
                expect(container.querySelector(PANEL_SELECTOR)).not.toHaveClass(STICKY_PANEL_CLASS);
            });

            expect(gridElement(container).style.getPropertyValue(VIEWPORT_WIDTH_PROPERTY)).toBe('');
        });
    });

    it('picks a component per row', async () => {
        const { container, fixture } = await renderGrid();

        fixture.componentInstance.component.set(({ data }) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            return (data as TestRow).kind === 'first' ? TestDetail : TestOtherDetail;
        });
        fixture.detectChanges();

        fireEvent.click(toggleOf(container, 'a'));
        fireEvent.click(toggleOf(container, 'b'));

        await waitFor(() => {
            expect(rowElement(container, 'a').querySelector('.test-detail')).toBeTruthy();
            expect(rowElement(container, 'b').querySelector('.test-other-detail')).toBeTruthy();
        });
    });

    it('collapses every row with collapseAll()', async () => {
        const { container, fixture } = await renderGrid();

        fireEvent.click(toggleOf(container, 'a'));
        fireEvent.click(toggleOf(container, 'b'));

        await waitFor(() => {
            expect(container.querySelectorAll(PANEL_SELECTOR)).toHaveLength(2);
        });

        fixture.componentInstance.rowDetail().collapseAll();
        fixture.detectChanges();

        await waitFor(() => {
            expect(container.querySelectorAll(PANEL_SELECTOR)).toHaveLength(0);
        });
    });

    it('expands a row through the public api', async () => {
        const { container, fixture } = await renderGrid();

        fixture.componentInstance.rowDetail().expand('b');
        fixture.detectChanges();

        await waitFor(() => {
            expect(rowElement(container, 'b').querySelector('.test-detail')).toBeTruthy();
        });
    });

    describe('state persistence', () => {
        // `value` is intentionally `unknown`: a store hands back whatever `JSON.parse` produced.
        const makeStore = (value: unknown): KbqAgGridRowDetailStateStore & { setItem: jest.Mock } => ({
            getItem: jest.fn().mockReturnValue(value),
            setItem: jest.fn(),
            removeItem: jest.fn()
        });

        it('restores the expanded rows from the store', async () => {
            const store = makeStore(['b']);
            const { container } = await render(TestGrid, {
                componentProperties: { stateKey: signal('key'), store: signal(store) }
            });

            await waitFor(() => {
                expect(rowElement(container, 'b').querySelector('.test-detail')).toBeTruthy();
            });

            expect(store.getItem).toHaveBeenCalledWith('key');
        });

        it('saves the expanded rows to the store', async () => {
            const store = makeStore(null);
            const { container } = await render(TestGrid, {
                componentProperties: { stateKey: signal('key'), store: signal(store) }
            });

            await waitFor(() => {
                expect(toggleOf(container, 'a')).toBeTruthy();
            });

            fireEvent.click(toggleOf(container, 'a'));

            await waitFor(() => {
                expect(store.setItem).toHaveBeenCalledWith('key', ['a']);
            });
        });

        it('restores every stored row with single expand on, instead of trimming the store', async () => {
            const store = makeStore(['a', 'b']);
            const { container, fixture } = await render(TestGrid, {
                componentProperties: { stateKey: signal('key'), store: signal(store), singleExpand: signal(true) }
            });

            await waitFor(() => {
                expect(container.querySelectorAll(PANEL_SELECTOR)).toHaveLength(2);
            });

            expect(fixture.componentInstance.rowDetail().expanded()).toEqual(['a', 'b']);
            expect(store.setItem).not.toHaveBeenCalledWith('key', ['a']);
        });

        it('ignores a stored value that is not an array of ids', async () => {
            const store = makeStore('a');
            const { container, fixture } = await render(TestGrid, {
                componentProperties: { stateKey: signal('key'), store: signal(store) }
            });

            await waitFor(() => {
                expect(toggleOf(container, 'a')).toBeTruthy();
            });

            expect(container.querySelector(PANEL_SELECTOR)).toBeNull();
            expect(fixture.componentInstance.rowDetail().expanded()).toEqual([]);
        });

        it('clears the stored state on reset()', async () => {
            const store = makeStore(['a']);
            const { container, fixture } = await render(TestGrid, {
                componentProperties: { stateKey: signal('key'), store: signal(store) }
            });

            await waitFor(() => {
                expect(container.querySelector(PANEL_SELECTOR)).toBeTruthy();
            });

            fixture.componentInstance.rowDetail().reset();
            fixture.detectChanges();

            await waitFor(() => {
                expect(container.querySelector(PANEL_SELECTOR)).toBeNull();
            });

            expect(store.removeItem).toHaveBeenCalledWith('key');
        });
    });

    describe('built-in stores', () => {
        const navigate = jest.fn();

        beforeEach(() => {
            navigate.mockClear();
            localStorage.clear();
            window.history.replaceState({}, '', '/');
        });

        afterEach(() => {
            localStorage.clear();
            window.history.replaceState({}, '', '/');
        });

        describe('KbqAgGridRowDetailStateLocalStorageStore', () => {
            const makeStore = (): KbqAgGridRowDetailStateLocalStorageStore =>
                TestBed.inject(KbqAgGridRowDetailStateLocalStorageStore);

            it('writes the expanded row ids as json', () => {
                makeStore().setItem(STATE_KEY, ['a', 'b']);

                expect(localStorage.getItem(STATE_KEY)).toBe('["a","b"]');
            });

            it('reads the expanded row ids back', () => {
                localStorage.setItem(STATE_KEY, '["a","b"]');

                expect(makeStore().getItem(STATE_KEY)).toEqual(['a', 'b']);
            });

            it('returns null when nothing is stored', () => {
                expect(makeStore().getItem(STATE_KEY)).toBeNull();
            });

            it('returns null for a malformed stored value', () => {
                localStorage.setItem(STATE_KEY, 'not json');

                expect(makeStore().getItem(STATE_KEY)).toBeNull();
            });

            it('removes the stored value', () => {
                localStorage.setItem(STATE_KEY, '["a"]');
                makeStore().removeItem(STATE_KEY);

                expect(localStorage.getItem(STATE_KEY)).toBeNull();
            });
        });

        describe('KbqAgGridRowDetailStateQueryParamsStore', () => {
            const makeStore = (): KbqAgGridRowDetailStateQueryParamsStore => {
                TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: { navigate } }] });

                return TestBed.inject(KbqAgGridRowDetailStateQueryParamsStore);
            };

            it('reads the expanded row ids from the query string', () => {
                window.history.replaceState({}, '', `/?${STATE_KEY}=${encodeURIComponent('["a","b"]')}`);

                expect(makeStore().getItem(STATE_KEY)).toEqual(['a', 'b']);
            });

            it('returns null when the query param is absent', () => {
                expect(makeStore().getItem(STATE_KEY)).toBeNull();
            });

            it('returns null for a malformed query param', () => {
                window.history.replaceState({}, '', `/?${STATE_KEY}=not-json`);

                expect(makeStore().getItem(STATE_KEY)).toBeNull();
            });

            it('writes the expanded row ids into the query string', async () => {
                await makeStore().setItem(STATE_KEY, ['a']);

                expect(navigate).toHaveBeenCalledWith([], {
                    queryParams: { [STATE_KEY]: '["a"]' },
                    queryParamsHandling: 'merge',
                    replaceUrl: true
                });
            });

            it('drops the query param on remove', async () => {
                await makeStore().removeItem(STATE_KEY);

                expect(navigate).toHaveBeenCalledWith([], {
                    queryParams: { [STATE_KEY]: null },
                    queryParamsHandling: 'merge',
                    replaceUrl: true
                });
            });
        });

        describe('store injection', () => {
            it('defaults to the localStorage store', () => {
                expect(TestBed.inject(KBQ_AG_GRID_ROW_DETAIL_STATE_STORE)).toBeInstanceOf(
                    KbqAgGridRowDetailStateLocalStorageStore
                );
            });

            it('binds the store class passed to kbqAgGridRowDetailStateStoreProvider', () => {
                TestBed.configureTestingModule({
                    providers: [
                        { provide: Router, useValue: { navigate } },
                        kbqAgGridRowDetailStateStoreProvider(KbqAgGridRowDetailStateQueryParamsStore)
                    ]
                });

                expect(TestBed.inject(KBQ_AG_GRID_ROW_DETAIL_STATE_STORE)).toBeInstanceOf(
                    KbqAgGridRowDetailStateQueryParamsStore
                );
            });

            it('binds the store instance passed to kbqAgGridRowDetailStateStoreProvider', () => {
                const store: KbqAgGridRowDetailStateStore = {
                    getItem: () => null,
                    setItem: () => undefined,
                    removeItem: () => undefined
                };

                TestBed.configureTestingModule({ providers: [kbqAgGridRowDetailStateStoreProvider(store)] });

                expect(TestBed.inject(KBQ_AG_GRID_ROW_DETAIL_STATE_STORE)).toBe(store);
            });
        });

        describe('through the directive', () => {
            it('saves the expanded rows to localStorage with the default store', async () => {
                const { container } = await render(TestGridDefaultStore);

                await waitFor(() => {
                    expect(toggleOf(container, 'a')).toBeTruthy();
                });

                fireEvent.click(toggleOf(container, 'a'));

                await waitFor(() => {
                    expect(localStorage.getItem(STATE_KEY)).toBe('["a"]');
                });
            });

            it('restores the expanded rows from localStorage with the default store', async () => {
                localStorage.setItem(STATE_KEY, '["b"]');

                const { container } = await render(TestGridDefaultStore);

                await waitFor(() => {
                    expect(rowElement(container, 'b').querySelector('.test-detail')).toBeTruthy();
                });
            });

            it('removes the stored value once every row is collapsed', async () => {
                localStorage.setItem(STATE_KEY, '["b"]');

                const { container } = await render(TestGridDefaultStore);

                await waitFor(() => {
                    expect(container.querySelector(PANEL_SELECTOR)).toBeTruthy();
                });

                fireEvent.click(toggleOf(container, 'b'));

                await waitFor(() => {
                    expect(localStorage.getItem(STATE_KEY)).toBeNull();
                });
            });

            it('saves the expanded rows through the query params store', async () => {
                const { container } = await render(TestGridQueryParamsStore, {
                    providers: [{ provide: Router, useValue: { navigate } }]
                });

                await waitFor(() => {
                    expect(toggleOf(container, 'a')).toBeTruthy();
                });

                fireEvent.click(toggleOf(container, 'a'));

                await waitFor(() => {
                    expect(navigate).toHaveBeenCalledWith([], {
                        queryParams: { [STATE_KEY]: '["a"]' },
                        queryParamsHandling: 'merge',
                        replaceUrl: true
                    });
                });
            });

            it('restores the expanded rows from the query params store', async () => {
                window.history.replaceState({}, '', `/?${STATE_KEY}=${encodeURIComponent('["c"]')}`);

                const { container } = await render(TestGridQueryParamsStore, {
                    providers: [{ provide: Router, useValue: { navigate } }]
                });

                await waitFor(() => {
                    expect(rowElement(container, 'c').querySelector('.test-detail')).toBeTruthy();
                });
            });
        });
    });
});
