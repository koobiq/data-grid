import { CdkTrapFocus, FocusableOption, FocusKeyManager } from '@angular/cdk/a11y';
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
    ApplicationRef,
    ChangeDetectionStrategy,
    Component,
    ComponentRef,
    computed,
    createComponent,
    DestroyRef,
    Directive,
    effect,
    ElementRef,
    EnvironmentInjector,
    inject,
    InjectionToken,
    Injector,
    input,
    OnDestroy,
    Provider,
    signal,
    viewChild,
    viewChildren
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular } from 'ag-grid-angular';
import { Column, GridApi } from 'ag-grid-community';
import { merge } from 'rxjs';

/** Localization strings used by the column management panel. */
export type KbqAgGridColumnMenuLabels = {
    title: string;
    searchPlaceholder: string;
    clearSearchButton: string;
    emptyState: string;
    pinnedLeftSection: string;
    visibleSection: string;
    pinnedRightSection: string;
    hiddenSection: string;
    unpinButton: string;
    pinRightButton: string;
    pinLeftButton: string;
    resetButton: string;
};

/** Preset English labels for the column management panel. */
export const KBQ_AG_GRID_COLUMN_MENU_LABELS_EN: KbqAgGridColumnMenuLabels = {
    title: 'Columns',
    searchPlaceholder: 'Search',
    clearSearchButton: 'Clear search',
    emptyState: 'Nothing found',
    pinnedLeftSection: 'Pinned Left',
    visibleSection: 'Visible',
    pinnedRightSection: 'Pinned Right',
    hiddenSection: 'Hidden',
    unpinButton: 'Unpin',
    pinRightButton: 'Pin Right',
    pinLeftButton: 'Pin Left',
    resetButton: 'Reset'
};

/** Preset Russian labels for the column management panel. */
export const KBQ_AG_GRID_COLUMN_MENU_LABELS_RU: KbqAgGridColumnMenuLabels = {
    title: 'Колонки',
    searchPlaceholder: 'Поиск',
    clearSearchButton: 'Очистить поиск',
    emptyState: 'Ничего не найдено',
    pinnedLeftSection: 'Закреплено слева',
    visibleSection: 'Видимые',
    pinnedRightSection: 'Закреплено справа',
    hiddenSection: 'Скрытые',
    unpinButton: 'Открепить',
    pinRightButton: 'Закрепить справа',
    pinLeftButton: 'Закрепить слева',
    resetButton: 'Сбросить'
};

/**
 * Injection token for supplying custom labels to the column management panel.
 * Defaults to {@link KBQ_AG_GRID_COLUMN_MENU_LABELS_RU}.
 *
 * @see kbqAgGridColumnMenuLabelsProvider
 */
export const KBQ_AG_GRID_COLUMN_MENU_LABELS = new InjectionToken<KbqAgGridColumnMenuLabels>(
    'KBQ_AG_GRID_COLUMN_MENU_LABELS',
    { factory: (): KbqAgGridColumnMenuLabels => KBQ_AG_GRID_COLUMN_MENU_LABELS_RU }
);

/**
 * Creates a provider that overrides the default column menu labels.
 *
 * @example
 * ```ts
 * providers: [kbqAgGridColumnMenuLabelsProvider(KBQ_AG_GRID_COLUMN_MENU_LABELS_EN)]
 * ```
 */
export const kbqAgGridColumnMenuLabelsProvider = (labels: KbqAgGridColumnMenuLabels): Provider => ({
    provide: KBQ_AG_GRID_COLUMN_MENU_LABELS,
    useValue: labels
});

const KBQ_AG_GRID_COLUMN_MENU_API = new InjectionToken<GridApi>('KBQ_AG_GRID_COLUMN_MENU_API');

let columnMenuInstanceCount = 0;

@Directive({
    selector: '[kbqColumnMenuRow]',
    standalone: true,
    host: {
        class: 'kbq-column-menu-row',
        '[attr.tabindex]': '-1'
    }
})
class KbqAgGridColumnMenuRow implements FocusableOption {
    private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
    readonly disabled = false;

    focus(): void {
        this.elementRef.nativeElement.focus();
    }
}

@Component({
    selector: 'kbq-ag-grid-column-menu-panel',
    imports: [
        CdkDrag,
        CdkDragHandle,
        CdkDragPlaceholder,
        CdkDropList,
        CdkDropListGroup,
        CdkTrapFocus,
        KbqAgGridColumnMenuRow
    ],
    standalone: true,
    template: `
        <div class="kbq-column-menu">
            <button
                #columnMenuTrigger
                class="kbq-column-menu-trigger"
                type="button"
                aria-haspopup="dialog"
                [attr.aria-label]="labels.title"
                [attr.aria-expanded]="isOpen()"
                (click)="toggle($event)"
            >
                <i class="kbq kbq-icon kbq-sliders_16"></i>
            </button>

            @if (isOpen()) {
                <div
                    class="kbq-column-menu-panel"
                    role="dialog"
                    cdkTrapFocus
                    cdkTrapFocusAutoCapture="true"
                    [attr.aria-labelledby]="panelTitleId"
                >
                    <div class="kbq-column-menu-panel-header">
                        <div class="kbq-column-menu-panel-title" [id]="panelTitleId" (click)="scrollToTop()">
                            {{ labels.title }}
                        </div>
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
                                            <div
                                                cdkDrag
                                                kbqColumnMenuRow
                                                [cdkDragData]="col"
                                                (click)="toggleVisibilityFromRow(col)"
                                                (cdkDragStarted)="isDragging.set(true)"
                                                (cdkDragEnded)="isDragging.set(false)"
                                                (keydown.space)="$event.preventDefault(); toggleVisibilityFromRow(col)"
                                            >
                                                @let disabled = col.getColDef().lockVisible || visibleCount() === 1;
                                                <span
                                                    role="checkbox"
                                                    aria-checked="true"
                                                    class="kbq-column-menu-checkbox kbq-column-menu-checkbox--checked"
                                                    [attr.aria-label]="col.getColDef().headerName ?? col.getColId()"
                                                    [attr.aria-disabled]="disabled ? 'true' : null"
                                                    [class.kbq-column-menu-checkbox--disabled]="disabled"
                                                ></span>
                                                <span
                                                    class="kbq-column-menu-label"
                                                    [innerHTML]="
                                                        highlightHtml(col.getColDef().headerName ?? '', searchQuery())
                                                    "
                                                ></span>
                                                <span class="kbq-column-menu-row-actions">
                                                    <button
                                                        type="button"
                                                        class="kbq-column-menu-action-btn kbq-column-menu-action-btn--active"
                                                        tabindex="-1"
                                                        [title]="labels.unpinButton"
                                                        [disabled]="!!col.getColDef().lockPinned"
                                                        (click)="$event.stopPropagation(); unpin(col)"
                                                    >
                                                        <i class="kbq kbq-icon kbq-pin-slash_16"></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        class="kbq-column-menu-action-btn kbq-column-menu-action-btn--mirrored"
                                                        tabindex="-1"
                                                        [title]="labels.pinRightButton"
                                                        [disabled]="!!col.getColDef().lockPinned"
                                                        (click)="$event.stopPropagation(); pinRight(col)"
                                                    >
                                                        <i class="kbq kbq-icon kbq-pin_16"></i>
                                                    </button>
                                                    <span
                                                        cdkDragHandle
                                                        class="kbq-column-menu-action-btn kbq-column-menu-drag-handle"
                                                    >
                                                        <i class="kbq kbq-icon kbq-grip-vertical-s_16"></i>
                                                    </span>
                                                </span>
                                                <div *cdkDragPlaceholder class="kbq-column-menu-drag-placeholder"></div>
                                            </div>
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
                                            <div
                                                cdkDrag
                                                kbqColumnMenuRow
                                                [cdkDragData]="col"
                                                (click)="toggleVisibilityFromRow(col)"
                                                (cdkDragStarted)="isDragging.set(true)"
                                                (cdkDragEnded)="isDragging.set(false)"
                                                (keydown.space)="$event.preventDefault(); toggleVisibilityFromRow(col)"
                                            >
                                                @let disabled = col.getColDef().lockVisible || visibleCount() === 1;
                                                <span
                                                    role="checkbox"
                                                    aria-checked="true"
                                                    class="kbq-column-menu-checkbox kbq-column-menu-checkbox--checked"
                                                    [attr.aria-label]="col.getColDef().headerName ?? col.getColId()"
                                                    [attr.aria-disabled]="disabled ? 'true' : null"
                                                    [class.kbq-column-menu-checkbox--disabled]="disabled"
                                                ></span>
                                                <span
                                                    class="kbq-column-menu-label"
                                                    [innerHTML]="
                                                        highlightHtml(col.getColDef().headerName ?? '', searchQuery())
                                                    "
                                                ></span>
                                                <span class="kbq-column-menu-row-actions">
                                                    <button
                                                        type="button"
                                                        tabindex="-1"
                                                        class="kbq-column-menu-action-btn"
                                                        [title]="labels.pinLeftButton"
                                                        [disabled]="!!col.getColDef().lockPinned"
                                                        (click)="$event.stopPropagation(); pinLeft(col)"
                                                    >
                                                        <i class="kbq kbq-icon kbq-pin_16"></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        tabindex="-1"
                                                        class="kbq-column-menu-action-btn kbq-column-menu-action-btn--mirrored"
                                                        [title]="labels.pinRightButton"
                                                        [disabled]="!!col.getColDef().lockPinned"
                                                        (click)="$event.stopPropagation(); pinRight(col)"
                                                    >
                                                        <i class="kbq kbq-icon kbq-pin_16"></i>
                                                    </button>
                                                    <span
                                                        cdkDragHandle
                                                        class="kbq-column-menu-action-btn kbq-column-menu-drag-handle"
                                                    >
                                                        <i class="kbq kbq-icon kbq-grip-vertical-s_16"></i>
                                                    </span>
                                                </span>
                                                <div *cdkDragPlaceholder class="kbq-column-menu-drag-placeholder"></div>
                                            </div>
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
                                            <div
                                                cdkDrag
                                                kbqColumnMenuRow
                                                [cdkDragData]="col"
                                                (click)="toggleVisibilityFromRow(col)"
                                                (cdkDragStarted)="isDragging.set(true)"
                                                (cdkDragEnded)="isDragging.set(false)"
                                                (keydown.space)="$event.preventDefault(); toggleVisibilityFromRow(col)"
                                            >
                                                @let disabled = col.getColDef().lockVisible || visibleCount() === 1;
                                                <span
                                                    role="checkbox"
                                                    aria-checked="true"
                                                    class="kbq-column-menu-checkbox kbq-column-menu-checkbox--checked"
                                                    [attr.aria-label]="col.getColDef().headerName ?? col.getColId()"
                                                    [attr.aria-disabled]="disabled ? 'true' : null"
                                                    [class.kbq-column-menu-checkbox--disabled]="disabled"
                                                ></span>
                                                <span
                                                    class="kbq-column-menu-label"
                                                    [innerHTML]="
                                                        highlightHtml(col.getColDef().headerName ?? '', searchQuery())
                                                    "
                                                ></span>
                                                <span class="kbq-column-menu-row-actions">
                                                    <button
                                                        type="button"
                                                        tabindex="-1"
                                                        class="kbq-column-menu-action-btn"
                                                        [title]="labels.pinLeftButton"
                                                        [disabled]="!!col.getColDef().lockPinned"
                                                        (click)="$event.stopPropagation(); pinLeft(col)"
                                                    >
                                                        <i class="kbq kbq-icon kbq-pin_16"></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        tabindex="-1"
                                                        class="kbq-column-menu-action-btn kbq-column-menu-action-btn--active kbq-column-menu-action-btn--mirrored"
                                                        [title]="labels.unpinButton"
                                                        [disabled]="!!col.getColDef().lockPinned"
                                                        (click)="$event.stopPropagation(); unpin(col)"
                                                    >
                                                        <i class="kbq kbq-icon kbq-pin-slash_16"></i>
                                                    </button>
                                                    <span
                                                        cdkDragHandle
                                                        class="kbq-column-menu-action-btn kbq-column-menu-drag-handle"
                                                    >
                                                        <i class="kbq kbq-icon kbq-grip-vertical-s_16"></i>
                                                    </span>
                                                </span>
                                                <div *cdkDragPlaceholder class="kbq-column-menu-drag-placeholder"></div>
                                            </div>
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
                                        <div
                                            kbqColumnMenuRow
                                            class="kbq-column-menu-row--hidden"
                                            (click)="toggleVisibilityFromRow(col)"
                                            (keydown.space)="$event.preventDefault(); toggleVisibilityFromRow(col)"
                                        >
                                            <span
                                                role="checkbox"
                                                aria-checked="false"
                                                class="kbq-column-menu-checkbox"
                                                [attr.aria-label]="col.getColDef().headerName ?? col.getColId()"
                                            ></span>
                                            <span
                                                class="kbq-column-menu-label"
                                                [innerHTML]="
                                                    highlightHtml(col.getColDef().headerName ?? '', searchQuery())
                                                "
                                            ></span>
                                            <span class="kbq-column-menu-row-actions">
                                                <button
                                                    type="button"
                                                    tabindex="-1"
                                                    class="kbq-column-menu-action-btn"
                                                    [title]="labels.pinLeftButton"
                                                    [disabled]="!!col.getColDef().lockPinned"
                                                    (click)="$event.stopPropagation(); pinLeft(col)"
                                                >
                                                    <i class="kbq kbq-icon kbq-pin_16"></i>
                                                </button>
                                                <button
                                                    type="button"
                                                    tabindex="-1"
                                                    class="kbq-column-menu-action-btn kbq-column-menu-action-btn--mirrored"
                                                    [title]="labels.pinRightButton"
                                                    [disabled]="!!col.getColDef().lockPinned"
                                                    (click)="$event.stopPropagation(); pinRight(col)"
                                                >
                                                    <i class="kbq kbq-icon kbq-pin_16"></i>
                                                </button>
                                            </span>
                                        </div>
                                    }
                                </div>
                            </section>
                        }
                    </div>

                    <div class="kbq-column-menu-panel-footer">
                        <button type="button" class="kbq-column-menu-reset-btn" (click)="reset()">
                            <i class="kbq kbq-icon kbq-circle-xmark_16"></i>
                            <span>{{ labels.resetButton }}</span>
                        </button>
                    </div>
                </div>
            }
        </div>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'kbq-ag-grid-column-menu-panel',
        '(document:click)': 'onDocumentClick($event)',
        '(document:keydown.escape)': 'onEscape()'
    }
})
class KbqAgGridColumnMenuComponent {
    private readonly api = inject(KBQ_AG_GRID_COLUMN_MENU_API);
    private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly destroyRef = inject(DestroyRef);
    protected readonly labels = inject(KBQ_AG_GRID_COLUMN_MENU_LABELS);
    protected readonly panelTitleId = `kbq-column-menu-title-${++columnMenuInstanceCount}`;
    private readonly rowItems = viewChildren(KbqAgGridColumnMenuRow);
    private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('columnMenuTrigger');
    private keyManager: FocusKeyManager<KbqAgGridColumnMenuRow> | null = null;
    protected readonly isOpen = signal(false);
    protected readonly searchQuery = signal('');
    protected readonly isDragging = signal(false);
    private readonly allColumns = signal<Column[]>([]);
    protected readonly pinnedLeftColumns = computed(() => {
        const q = this.searchQuery().toLowerCase();
        return this.allColumns().filter(
            (c) =>
                c.isPinnedLeft() && c.isVisible() && (!q || (c.getColDef().headerName?.toLowerCase() ?? '').includes(q))
        );
    });
    protected readonly visibleColumns = computed(() => {
        const q = this.searchQuery().toLowerCase();
        return this.allColumns().filter(
            (c) =>
                !c.isPinnedLeft() &&
                !c.isPinnedRight() &&
                c.isVisible() &&
                (!q || (c.getColDef().headerName?.toLowerCase() ?? '').includes(q))
        );
    });
    protected readonly pinnedRightColumns = computed(() => {
        const q = this.searchQuery().toLowerCase();
        return this.allColumns().filter(
            (c) =>
                c.isPinnedRight() &&
                c.isVisible() &&
                (!q || (c.getColDef().headerName?.toLowerCase() ?? '').includes(q))
        );
    });
    protected readonly hiddenColumns = computed(() => {
        const q = this.searchQuery().toLowerCase();
        return this.allColumns()
            .filter((c) => !c.isVisible() && (!q || (c.getColDef().headerName?.toLowerCase() ?? '').includes(q)))
            .sort((a, b) => (a.getColDef().headerName ?? '').localeCompare(b.getColDef().headerName ?? ''));
    });
    protected readonly visibleCount = computed(() => this.allColumns().filter((c) => c.isVisible()).length);
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

        const refresh = (): void => this.refreshColumns();
        const events = ['columnVisible', 'columnMoved', 'columnPinned'] as const;

        events.forEach((event) => this.api.addEventListener(event, refresh));
        this.destroyRef.onDestroy(() => {
            events.forEach((event) => this.api.removeEventListener(event, refresh));
        });

        effect(() => {
            const items = this.rowItems();
            this.keyManager = items.length > 0 ? new FocusKeyManager(items).withWrap().withVerticalOrientation() : null;
        });
    }

    protected toggle(event: Event): void {
        event.stopPropagation();
        this.isOpen.update((v) => !v);
    }

    protected onScrollKeydown(event: KeyboardEvent): void {
        this.keyManager?.onKeydown(event);
    }

    protected onSearchArrowDown(event: Event): void {
        event.preventDefault();
        this.keyManager?.setFirstItemActive();
    }

    protected toggleVisibilityFromRow(col: Column): void {
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
        const focused = document.activeElement;
        if (focused) {
            const rowEl = focused.hasAttribute('kbqcolumnmenurow') ? focused : focused.closest('[kbqcolumnmenurow]');
            if (rowEl) {
                const idx = Array.from(this.elementRef.nativeElement.querySelectorAll('[kbqcolumnmenurow]')).indexOf(
                    rowEl
                );
                if (idx >= 0) return idx;
            }
        }
        return this.keyManager?.activeItemIndex ?? -1;
    }

    protected close(): void {
        this.isOpen.set(false);
    }

    protected onEscape(): void {
        if (!this.isOpen()) return;
        this.close();
        this.trigger().nativeElement.focus();
    }

    protected onDocumentClick(event: MouseEvent): void {
        if (event.target instanceof Node && !this.elementRef.nativeElement.contains(event.target)) {
            this.close();
        }
    }

    protected onSearch(event: Event): void {
        if (event.target instanceof HTMLInputElement) {
            this.searchQuery.set(event.target.value);
        }
    }

    protected clearSearch(): void {
        this.searchQuery.set('');
    }

    protected scrollToTop(): void {
        const scroll = this.elementRef.nativeElement.querySelector<HTMLElement>('.kbq-column-menu-panel-scroll');
        if (!scroll) return;
        scroll.scrollTo({ top: 0, behavior: 'smooth' });
        this.keyManager?.setFirstItemActive();
    }

    protected toggleVisibility(col: Column): void {
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

    protected pinLeft(col: Column): void {
        this.withFocusRestore(() => {
            if (!col.isVisible()) {
                this.api.setColumnsVisible([col.getColId()], true);
            }
            this.api.setColumnsPinned([col.getColId()], 'left');
            this.refreshColumns();
        });
    }

    protected pinRight(col: Column): void {
        this.withFocusRestore(() => {
            if (!col.isVisible()) {
                this.api.setColumnsVisible([col.getColId()], true);
            }
            this.api.setColumnsPinned([col.getColId()], 'right');
            this.refreshColumns();
        });
    }

    protected unpin(col: Column): void {
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

    protected reset(): void {
        this.api.resetColumnState();
        this.refreshColumns();
    }

    protected highlightHtml(text: string, query: string): string {
        const escape = (s: string): string =>
            s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        if (!query) return escape(text);

        const parts: string[] = [];
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        let lastIndex = 0;
        let idx = lowerText.indexOf(lowerQuery);

        while (idx !== -1) {
            parts.push(escape(text.slice(lastIndex, idx)));
            parts.push(`<mark class="kbq-column-menu-highlight">${escape(text.slice(idx, idx + query.length))}</mark>`);
            lastIndex = idx + query.length;
            idx = lowerText.indexOf(lowerQuery, lastIndex);
        }

        parts.push(escape(text.slice(lastIndex)));

        return parts.join('');
    }

    private refreshColumns(): void {
        this.allColumns.set(this.api.getAllGridColumns().filter((c) => !c.getColId().startsWith('ag-Grid-')));
    }
}

/**
 * Directive that renders a built-in column management panel as an always-visible button
 * in the top-right corner of ag-grid-angular.
 *
 * The panel allows users to toggle column visibility, reorder columns via drag-and-drop,
 * and pin columns to the left or right.
 *
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme kbqAgGridColumnMenu [kbqAgGridColumnMenuLabels]="labels" />
 * ```
 */
@Directive({
    selector: 'ag-grid-angular[kbqAgGridColumnMenu]',
    standalone: true
})
export class KbqAgGridColumnMenu implements OnDestroy {
    private readonly grid = inject(AgGridAngular);
    private readonly applicationRef = inject(ApplicationRef);
    private readonly environmentInjector = inject(EnvironmentInjector);
    private readonly injector = inject(Injector);
    private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly document = inject(DOCUMENT);
    readonly labels = input<KbqAgGridColumnMenuLabels | undefined>(undefined, { alias: 'kbqAgGridColumnMenuLabels' });

    private activeComponentRef: ComponentRef<KbqAgGridColumnMenuComponent> | null = null;
    private activeWrapperElement: HTMLElement | null = null;

    constructor() {
        merge(this.grid.gridReady, this.grid.newColumnsLoaded)
            .pipe(takeUntilDestroyed())
            .subscribe(() => this.refreshOverlay());
    }

    ngOnDestroy(): void {
        this.clearOverlay();
    }

    private refreshOverlay(): void {
        this.clearOverlay();

        const { api } = this.grid;

        const labels = this.labels();

        const componentRef = createComponent(KbqAgGridColumnMenuComponent, {
            environmentInjector: this.environmentInjector,
            elementInjector: Injector.create({
                parent: this.injector,
                providers: [
                    { provide: KBQ_AG_GRID_COLUMN_MENU_API, useValue: api },
                    ...(labels ? [kbqAgGridColumnMenuLabelsProvider(labels)] : [])
                ]
            })
        });

        this.applicationRef.attachView(componentRef.hostView);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const componentElement: HTMLElement = componentRef.location.nativeElement;

        const wrapperElement = this.document.createElement('div');
        wrapperElement.classList.add('kbq-ag-grid-column-menu-overlay');
        wrapperElement.appendChild(componentElement);

        this.elementRef.nativeElement.appendChild(wrapperElement);
        this.activeComponentRef = componentRef;
        this.activeWrapperElement = wrapperElement;
    }

    private clearOverlay(): void {
        if (!this.activeComponentRef || !this.activeWrapperElement) return;

        this.activeComponentRef.destroy();
        this.activeComponentRef = null;

        this.activeWrapperElement.remove();
        this.activeWrapperElement = null;
    }
}
