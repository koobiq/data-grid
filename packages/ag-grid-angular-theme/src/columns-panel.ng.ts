import { FocusableOption, FocusKeyManager } from '@angular/cdk/a11y';
import {
    CdkDrag,
    CdkDragDrop,
    CdkDragHandle,
    CdkDragPlaceholder,
    CdkDropList,
    CdkDropListGroup
} from '@angular/cdk/drag-drop';
import { DOCUMENT } from '@angular/common';
import {
    booleanAttribute,
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    ElementRef,
    forwardRef,
    inject,
    InjectionToken,
    input,
    signal,
    viewChild,
    viewChildren
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Column, ColumnState } from 'ag-grid-community';
import { KBQ_AG_GRID_COLUMN_MENU_LABELS } from './column-menu-types';
import { kbqListenColumnStateChanges, kbqResolveColumnName } from './grid-columns';
import { kbqHighlightSearchMatches } from './highlight';
import { KBQ_AG_GRID_SETTINGS_MENU_PARAMS } from './settings-menu-types';

const KBQ_COLUMN_MENU_CONTEXT = new InjectionToken<KbqAgGridColumnsPanel>('KBQ_COLUMN_MENU_CONTEXT');

type ColumnSection = 'pinnedLeft' | 'visible' | 'pinnedRight' | 'hidden';

@Component({
    selector: 'kbq-column-menu-row',
    standalone: true,
    imports: [CdkDragHandle, CdkDragPlaceholder],
    hostDirectives: [{ directive: CdkDrag }],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'kbq-column-menu-row',
        '[attr.tabindex]': '-1',
        '(focus)': 'focus()',
        '(click)': 'onRowClick()',
        '(keydown.enter)': 'onRowClick()',
        '(keydown.space)': '$event.preventDefault(); onRowClick()',
        '(keydown.tab)': 'onRowTab($event)'
    },
    template: `
        @let isChecked = section() !== 'hidden';
        @let isPinLocked = !!col().getColDef().lockPinned;
        @let isCheckboxDisabled = col().getColDef().lockVisible || (isChecked && context.visibleCount() === 1);
        @let name = context.columnName(col());

        <div class="kbq-column-menu-row-wrapper">
            <span
                #checkbox
                role="checkbox"
                tabindex="-1"
                class="kbq-column-menu-checkbox"
                [attr.aria-checked]="isChecked"
                [class.kbq-column-menu-checkbox--checked]="isChecked"
                [attr.aria-label]="name"
                [attr.aria-disabled]="isCheckboxDisabled ? 'true' : null"
                [class.kbq-column-menu-checkbox--disabled]="isCheckboxDisabled"
            ></span>

            <span class="kbq-column-menu-label" [innerHTML]="highlightHtml(name, context.searchQuery())"></span>

            <span class="kbq-column-menu-row-actions">
                @if (section() === 'pinnedLeft') {
                    <button
                        type="button"
                        tabindex="-1"
                        class="kbq-column-menu-action-btn kbq-column-menu-action-btn--active"
                        [title]="labels.unpinButton"
                        [attr.aria-label]="labels.unpinButton"
                        [disabled]="isPinLocked"
                        (keydown)="onActionKeydown($event)"
                        (keydown.tab)="onActionButtonTab($event)"
                        (keydown.enter)="onActionButtonActivate($event)"
                        (keydown.space)="onActionButtonActivate($event)"
                        (click)="$event.stopPropagation(); context.unpin(col())"
                    >
                        <i class="kbq kbq-icon kbq-pin-slash_16"></i>
                    </button>
                } @else {
                    <button
                        type="button"
                        tabindex="-1"
                        class="kbq-column-menu-action-btn"
                        [title]="labels.pinLeftButton"
                        [attr.aria-label]="labels.pinLeftButton"
                        [disabled]="isPinLocked"
                        (keydown)="onActionKeydown($event)"
                        (keydown.tab)="onActionButtonTab($event)"
                        (keydown.enter)="onActionButtonActivate($event)"
                        (keydown.space)="onActionButtonActivate($event)"
                        (click)="$event.stopPropagation(); context.pinLeft(col())"
                    >
                        <i class="kbq kbq-icon kbq-pin_16"></i>
                    </button>
                }
                @if (section() === 'pinnedRight') {
                    <button
                        type="button"
                        tabindex="-1"
                        class="kbq-column-menu-action-btn kbq-column-menu-action-btn--active kbq-column-menu-action-btn--mirrored"
                        [title]="labels.unpinButton"
                        [attr.aria-label]="labels.unpinButton"
                        [disabled]="isPinLocked"
                        (keydown)="onActionKeydown($event)"
                        (keydown.tab)="onActionButtonTab($event)"
                        (keydown.enter)="onActionButtonActivate($event)"
                        (keydown.space)="onActionButtonActivate($event)"
                        (click)="$event.stopPropagation(); context.unpin(col())"
                    >
                        <i class="kbq kbq-icon kbq-pin-slash_16"></i>
                    </button>
                } @else {
                    <button
                        type="button"
                        tabindex="-1"
                        class="kbq-column-menu-action-btn kbq-column-menu-action-btn--mirrored"
                        [title]="labels.pinRightButton"
                        [attr.aria-label]="labels.pinRightButton"
                        [disabled]="isPinLocked"
                        (keydown)="onActionKeydown($event)"
                        (keydown.tab)="onActionButtonTab($event)"
                        (keydown.enter)="onActionButtonActivate($event)"
                        (keydown.space)="onActionButtonActivate($event)"
                        (click)="$event.stopPropagation(); context.pinRight(col())"
                    >
                        <i class="kbq kbq-icon kbq-pin_16"></i>
                    </button>
                }
                @if (section() !== 'hidden') {
                    <!-- Pointer-only affordance: the columns are reordered by dragging, not from the keyboard. -->
                    <button
                        type="button"
                        tabindex="-1"
                        aria-hidden="true"
                        cdkDragHandle
                        class="kbq-column-menu-action-btn kbq-column-menu-drag-handle"
                        (click)="$event.stopPropagation()"
                    >
                        <i class="kbq kbq-icon kbq-grip-vertical_16"></i>
                    </button>
                }
            </span>
        </div>

        @if (section() !== 'hidden') {
            <div *cdkDragPlaceholder class="kbq-column-menu-drag-placeholder"></div>
        }
    `
})
export class KbqAgGridColumnMenuRow implements FocusableOption {
    readonly col = input.required<Column>();
    readonly section = input.required<ColumnSection>();
    readonly disabled = false;

    protected readonly context = inject(KBQ_COLUMN_MENU_CONTEXT);
    private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly drag = inject(CdkDrag);
    private readonly destroyRef = inject(DestroyRef);
    protected readonly labels = inject(KBQ_AG_GRID_COLUMN_MENU_LABELS);
    private readonly checkbox = viewChild.required<ElementRef<HTMLElement>>('checkbox');

    constructor() {
        this.drag.previewContainer = 'parent';

        effect(() => {
            this.drag.data = this.col();
            this.drag.disabled = this.section() === 'hidden';
        });

        this.drag.started.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.context.isDragging.set(true));
        this.drag.ended.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.context.isDragging.set(false));
    }

    /**
     * Moves the focus to the row checkbox, which carries the role, name and checked state for assistive
     * technology. The row itself redirects the focus it receives from a pointer.
     */
    focus(): void {
        this.checkbox().nativeElement.focus();
    }

    protected readonly highlightHtml = kbqHighlightSearchMatches;

    protected onRowClick(): void {
        this.context.toggleVisibilityFromRow(this.col());
    }

    protected onRowTab(event: KeyboardEvent): void {
        if (event.shiftKey) return;
        if (this.context.focusFirstActionForRow(this.elementRef.nativeElement)) {
            event.preventDefault();
        }
    }

    protected onActionKeydown(event: KeyboardEvent): void {
        this.context.handleRowActionKeydown(event, this.elementRef.nativeElement);
    }

    /** Activates the action button from the keyboard without the key reaching the row, which would toggle the column visibility. */
    protected onActionButtonActivate(event: Event): void {
        event.preventDefault();
        event.stopPropagation();
        if (event.target instanceof HTMLButtonElement) event.target.click();
    }

    protected onActionButtonTab(event: Event): void {
        // Keep the key away from the row, whose own Tab handler would move the focus back to its first action.
        // Without the footer reset button the native tab sequence takes over.
        event.stopPropagation();

        if (this.context.focusResetButton()) {
            event.preventDefault();
        }
    }
}

/**
 * Column management panel: search, column list grouped by pinning and visibility,
 * drag-and-drop reordering and reset to the default column state.
 *
 * Internal building block shared by `KbqAgGridColumnMenu` and the `Columns` screen
 * of `KbqAgGridSettingsMenu`. Renders no header title unless `title` is set.
 */
@Component({
    selector: 'kbq-ag-grid-columns-panel',
    standalone: true,
    imports: [CdkDropList, CdkDropListGroup, KbqAgGridColumnMenuRow],
    // eslint-disable-next-line @angular-eslint/no-forward-ref
    providers: [{ provide: KBQ_COLUMN_MENU_CONTEXT, useExisting: forwardRef(() => KbqAgGridColumnsPanel) }],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'kbq-ag-grid-columns-panel'
    },
    template: `
        <div class="kbq-column-menu-panel-header">
            @if (title()) {
                <div class="kbq-column-menu-panel-title" [id]="titleId()" (click)="scrollToTop()">
                    {{ title() }}
                </div>
            }
            <div class="kbq-column-menu-panel-search">
                <i class="kbq kbq-icon kbq-magnifying-glass_16 kbq-column-menu-search-icon"></i>
                <input
                    class="kbq-column-menu-search-input"
                    type="text"
                    [placeholder]="labels.searchPlaceholder"
                    [value]="searchQuery()"
                    (input)="onSearch($event)"
                    (keydown.arrowdown)="onSearchArrowDown($event)"
                />
                @if (searchQuery()) {
                    <button
                        type="button"
                        class="kbq-column-menu-search-clear"
                        [title]="labels.clearSearchButton"
                        [attr.aria-label]="labels.clearSearchButton"
                        (click)="clearSearch()"
                    >
                        <i class="kbq kbq-icon kbq-circle-xmark_16"></i>
                    </button>
                }
            </div>
        </div>

        <div
            class="kbq-column-menu-panel-scroll"
            [class.kbq-column-menu-panel-scroll--dragging]="isDragging()"
            (keydown)="onScrollKeydown($event)"
        >
            @if (hasNoResults()) {
                <div class="kbq-column-menu-empty">{{ labels.emptyState }}</div>
            }

            <div cdkDropListGroup>
                @if (pinnedLeftColumns().length > 0) {
                    <section>
                        <div class="kbq-column-menu-section-label">{{ labels.pinnedLeftSection }}</div>
                        <div
                            class="kbq-column-menu-group"
                            cdkDropList
                            [cdkDropListData]="pinnedLeftColumns()"
                            (cdkDropListDropped)="dropped($event, 'pinnedLeft')"
                        >
                            @for (col of pinnedLeftColumns(); track col.getColId()) {
                                <kbq-column-menu-row section="pinnedLeft" [col]="col" />
                            }
                        </div>
                    </section>
                }

                @if (visibleColumns().length > 0) {
                    <section>
                        <div class="kbq-column-menu-section-label">{{ labels.visibleSection }}</div>
                        <div
                            class="kbq-column-menu-group"
                            cdkDropList
                            [cdkDropListData]="visibleColumns()"
                            (cdkDropListDropped)="dropped($event, 'visible')"
                        >
                            @for (col of visibleColumns(); track col.getColId()) {
                                <kbq-column-menu-row section="visible" [col]="col" />
                            }
                        </div>
                    </section>
                }

                @if (pinnedRightColumns().length > 0) {
                    <section>
                        <div class="kbq-column-menu-section-label">{{ labels.pinnedRightSection }}</div>
                        <div
                            class="kbq-column-menu-group"
                            cdkDropList
                            [cdkDropListData]="pinnedRightColumns()"
                            (cdkDropListDropped)="dropped($event, 'pinnedRight')"
                        >
                            @for (col of pinnedRightColumns(); track col.getColId()) {
                                <kbq-column-menu-row section="pinnedRight" [col]="col" />
                            }
                        </div>
                    </section>
                }
            </div>

            @if (hiddenColumns().length > 0) {
                <section>
                    <div class="kbq-column-menu-section-label">{{ labels.hiddenSection }}</div>
                    <div class="kbq-column-menu-group">
                        @for (col of hiddenColumns(); track col.getColId()) {
                            <kbq-column-menu-row section="hidden" [col]="col" />
                        }
                    </div>
                </section>
            }
        </div>

        @if (showFooter()) {
            <div class="kbq-column-menu-panel-footer">
                <button type="button" class="kbq-column-menu-reset-btn" (click)="reset()">
                    <i class="kbq kbq-icon kbq-circle-xmark_16"></i>
                    <span>{{ labels.resetButton }}</span>
                </button>
            </div>
        }
    `
})
export class KbqAgGridColumnsPanel {
    /** Panel title. The title row is not rendered when the title is empty. */
    readonly title = input<string>('');
    /** DOM id of the title element, used by the panel host for `aria-labelledby`. */
    readonly titleId = input<string | null>(null);
    /**
     * Renders the footer reset button, which restores the whole column state. Used by the standalone
     * `KbqAgGridColumnMenu`; inside `KbqAgGridSettingsMenu` the reset button lives in the level header.
     */
    readonly showFooter = input(false, { transform: booleanAttribute });

    private readonly params = inject(KBQ_AG_GRID_SETTINGS_MENU_PARAMS);
    private readonly api = this.params.api;
    private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly destroyRef = inject(DestroyRef);
    private readonly document = inject(DOCUMENT);
    protected readonly labels = inject(KBQ_AG_GRID_COLUMN_MENU_LABELS);
    private readonly rowItems = viewChildren(KbqAgGridColumnMenuRow);
    private keyManager: FocusKeyManager<KbqAgGridColumnMenuRow> | null = null;
    /** Current search query used to filter the column list. */
    readonly searchQuery = signal('');
    /** Whether a drag-and-drop operation is in progress. */
    readonly isDragging = signal(false);
    private readonly allColumns = signal<Column[]>([]);
    /** Columns whose title matches the search query. */
    private readonly searchResults = computed(() => {
        const query = this.searchQuery().toLowerCase();

        return this.allColumns().filter((c) => !query || this.columnName(c).toLowerCase().includes(query));
    });
    protected readonly pinnedLeftColumns = computed(() =>
        this.searchResults().filter((c) => c.isPinnedLeft() && c.isVisible())
    );
    protected readonly visibleColumns = computed(() =>
        this.searchResults().filter((c) => !c.isPinnedLeft() && !c.isPinnedRight() && c.isVisible())
    );
    protected readonly pinnedRightColumns = computed(() =>
        this.searchResults().filter((c) => c.isPinnedRight() && c.isVisible())
    );
    protected readonly hiddenColumns = computed(() =>
        this.searchResults()
            .filter((c) => !c.isVisible())
            .sort((a, b) => this.columnName(a).localeCompare(this.columnName(b)))
    );
    /** Number of currently visible (non-hidden) columns. */
    readonly visibleCount = computed(() => this.allColumns().filter((c) => c.isVisible()).length);
    protected readonly hasNoResults = computed(
        () =>
            this.searchQuery().length > 0 &&
            this.pinnedLeftColumns().length === 0 &&
            this.visibleColumns().length === 0 &&
            this.pinnedRightColumns().length === 0 &&
            this.hiddenColumns().length === 0
    );

    constructor() {
        this.refreshColumns();

        // Includes `newColumnsLoaded` and `gridColumnsChanged`: added or removed column definitions don't
        // dispatch visibility, pinning or move events for the columns they add.
        kbqListenColumnStateChanges(this.api, () => this.refreshColumns());
        this.destroyRef.onDestroy(this.params.setResetHandler(() => this.resetToDefault()));

        effect(() => {
            const items = this.rowItems();
            this.keyManager = items.length > 0 ? new FocusKeyManager(items).withWrap().withVerticalOrientation() : null;
        });
    }

    /** Title of the column as the grid header renders it. */
    columnName(col: Column): string {
        return kbqResolveColumnName(this.api, col);
    }

    protected onScrollKeydown(event: KeyboardEvent): void {
        this.keyManager?.onKeydown(event);
    }

    /** Focuses the first enabled action button inside the given row element. Returns `true` if an action was focused. */
    focusFirstActionForRow(rowElement: HTMLElement): boolean {
        const actions = this.getRowActions(rowElement);
        if (actions.length === 0) return false;
        const [firstAction] = actions;
        firstAction.focus();
        return true;
    }

    /** Handles keyboard navigation within row action buttons: Shift+Tab returns focus to the row, Tab moves to the reset button, ArrowLeft/Right cycles between actions. */
    handleRowActionKeydown(event: KeyboardEvent, rowElement: HTMLElement): void {
        if (event.key === 'Tab' && event.shiftKey) {
            event.preventDefault();
            rowElement.focus();
            return;
        }

        if (event.key === 'Tab' && !event.shiftKey) {
            // Without the footer the native tab sequence takes over and wraps to the level header.
            if (this.focusResetButton()) event.preventDefault();
            return;
        }

        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
            return;
        }

        const actions = this.getRowActions(rowElement);
        if (actions.length === 0) return;

        const { activeElement } = this.document;
        if (!(activeElement instanceof HTMLButtonElement)) return;

        const currentIndex = actions.indexOf(activeElement);
        if (currentIndex === -1) return;

        event.preventDefault();
        event.stopPropagation();

        const delta = event.key === 'ArrowRight' ? 1 : -1;
        const nextIndex = (currentIndex + delta + actions.length) % actions.length;
        actions[nextIndex]?.focus();
    }

    /** Moves focus to the reset button in the panel footer. Returns `false` when the footer is not rendered. */
    focusResetButton(): boolean {
        const button = this.elementRef.nativeElement.querySelector<HTMLButtonElement>('.kbq-column-menu-reset-btn');

        button?.focus();

        return !!button;
    }

    protected onSearchArrowDown(event: Event): void {
        event.preventDefault();
        this.keyManager?.setFirstItemActive();
    }

    /** Toggles the visibility of the given column and restores focus to the active row afterwards. */
    toggleVisibilityFromRow(col: Column): void {
        this.withFocusRestore(() => this.toggleVisibility(col));
    }

    private withFocusRestore(action: () => void): void {
        const index = this.resolveActiveRowIndex();
        action();
        if (index >= 0) {
            setTimeout(() => {
                const items = this.rowItems();
                if (items.length > 0) {
                    this.keyManager?.setActiveItem(Math.min(index, items.length - 1));
                }
            });
        }
    }

    private resolveActiveRowIndex(): number {
        // DOM is always authoritative: covers both mouse click (browser focuses on mousedown)
        // and keyboard Space (focused row or checkbox span → closest row).
        const focused = this.document.activeElement;
        if (focused) {
            const rowEl = focused.closest('kbq-column-menu-row');
            if (rowEl) {
                const idx = Array.from(this.elementRef.nativeElement.querySelectorAll('kbq-column-menu-row')).indexOf(
                    rowEl
                );
                if (idx >= 0) return idx;
            }
        }
        return this.keyManager?.activeItemIndex ?? -1;
    }

    private getRowActions(rowElement: HTMLElement): HTMLButtonElement[] {
        return Array.from(rowElement.querySelectorAll<HTMLButtonElement>('.kbq-column-menu-action-btn')).filter(
            (el) => !el.disabled && !el.classList.contains('kbq-column-menu-drag-handle')
        );
    }

    protected onSearch(event: Event): void {
        if (event.target instanceof HTMLInputElement) {
            this.searchQuery.set(event.target.value);
        }
    }

    protected clearSearch(): void {
        this.searchQuery.set('');
    }

    /** Scrolls the column list back to the top and moves focus to the first row. */
    scrollToTop(): void {
        const scroll = this.elementRef.nativeElement.querySelector<HTMLElement>('.kbq-column-menu-panel-scroll');
        if (!scroll) return;
        scroll.scrollTo({ top: 0, behavior: 'smooth' });
        this.keyManager?.setFirstItemActive();
    }

    private toggleVisibility(col: Column): void {
        if (col.getColDef().lockVisible) return;
        if (col.isVisible() && this.visibleCount() === 1) return;

        const colId = col.getColId();
        const wasHidden = !col.isVisible();

        this.api.setColumnsVisible([colId], !col.isVisible());

        if (wasHidden) {
            const allCols = this.api.getAllGridColumns();
            const colIdx = allCols.indexOf(col);
            const lastVisibleIdx = allCols.reduce(
                (acc, c, i) => (c.isVisible() && !c.isPinnedLeft() && !c.isPinnedRight() ? i : acc),
                -1
            );
            if (colIdx !== -1 && lastVisibleIdx !== -1 && colIdx !== lastVisibleIdx) {
                this.api.moveColumnByIndex(colIdx, lastVisibleIdx);
            }
        }

        this.refreshColumns();
    }

    /** Pins the given column to the left side, making it visible if currently hidden. */
    pinLeft(col: Column): void {
        this.withFocusRestore(() => {
            if (!col.isVisible()) {
                this.api.setColumnsVisible([col.getColId()], true);
            }
            this.api.setColumnsPinned([col.getColId()], 'left');
            this.refreshColumns();
        });
    }

    /** Pins the given column to the right side, making it visible if currently hidden. */
    pinRight(col: Column): void {
        this.withFocusRestore(() => {
            if (!col.isVisible()) {
                this.api.setColumnsVisible([col.getColId()], true);
            }
            this.api.setColumnsPinned([col.getColId()], 'right');
            this.refreshColumns();
        });
    }

    /** Removes pinning from the given column. */
    unpin(col: Column): void {
        this.withFocusRestore(() => {
            this.api.setColumnsPinned([col.getColId()], null);
            this.refreshColumns();
        });
    }

    protected dropped(event: CdkDragDrop<Column[]>, targetSection: 'pinnedLeft' | 'visible' | 'pinnedRight'): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        const col = event.item.data as Column;
        const colId = col.getColId();

        if (event.previousContainer === event.container) {
            if (event.previousIndex === event.currentIndex) return;

            const allGridCols = this.api.getAllGridColumns();
            const fromIdx = allGridCols.indexOf(col);
            const targetCol = event.container.data[event.currentIndex];
            const toIdx = allGridCols.indexOf(targetCol);

            if (fromIdx !== -1 && toIdx !== -1) {
                this.api.moveColumnByIndex(fromIdx, toIdx);
            }
        } else {
            if (targetSection === 'pinnedLeft') {
                this.api.setColumnsPinned([colId], 'left');
            } else if (targetSection === 'pinnedRight') {
                this.api.setColumnsPinned([colId], 'right');
            } else {
                this.api.setColumnsPinned([colId], null);
            }
        }

        this.refreshColumns();
    }

    /** Resets the whole column state to the default one. */
    reset(): void {
        this.api.resetColumnState();
        this.refreshColumns();
    }

    /**
     * Restores the visibility, pinning and order defined by the column definitions and clears the search
     * query. Unlike {@link reset}, keeps the rest of the column state, so sorting and widths survive.
     */
    resetToDefault(): void {
        const state = (this.api.getColumns() ?? []).map((col): ColumnState => {
            const colId = col.getColId();

            // The grid's own columns only take part in the order.
            if (colId.startsWith('ag-Grid-')) return { colId };

            const { hide, initialHide, pinned, initialPinned } = col.getColDef();

            return { colId, hide: hide ?? initialHide ?? false, pinned: pinned ?? initialPinned ?? null };
        });

        this.api.applyColumnState({ state, applyOrder: true });
        this.searchQuery.set('');
        this.refreshColumns();
    }

    private refreshColumns(): void {
        this.allColumns.set(this.api.getAllGridColumns().filter((c) => !c.getColId().startsWith('ag-Grid-')));
    }
}
