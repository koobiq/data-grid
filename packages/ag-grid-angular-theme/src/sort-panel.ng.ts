import { FocusableOption, FocusKeyManager } from '@angular/cdk/a11y';
import {
    CdkDrag,
    CdkDragDrop,
    CdkDragHandle,
    CdkDragPlaceholder,
    CdkDropList,
    moveItemInArray
} from '@angular/cdk/drag-drop';
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    ElementRef,
    forwardRef,
    inject,
    InjectionToken,
    Injector,
    input,
    signal,
    viewChild,
    viewChildren
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Column, ColumnState, SortDirection } from 'ag-grid-community';
import {
    kbqListenColumnStateChanges,
    kbqResolveColumnName,
    kbqSortableColumns,
    kbqSortedColumns
} from './grid-columns';
import { kbqHighlightSearchMatches } from './highlight';
import { KBQ_AG_GRID_SETTINGS_MENU_LABELS, KBQ_AG_GRID_SETTINGS_MENU_PARAMS } from './settings-menu-types';

const KBQ_SORT_MENU_CONTEXT = new InjectionToken<KbqAgGridSortPanel>('KBQ_SORT_MENU_CONTEXT');

/** Sorting applied to a single column. */
type ActiveSort = {
    colId: string;
    sort: 'asc' | 'desc';
};

@Component({
    selector: 'kbq-sort-menu-row',
    standalone: true,
    imports: [CdkDragHandle, CdkDragPlaceholder],
    hostDirectives: [{ directive: CdkDrag }],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'kbq-column-menu-row kbq-sort-menu-row',
        '[attr.tabindex]': '-1',
        '(click)': 'onRowClick()',
        '(keydown.enter)': 'onRowClick()',
        '(keydown.space)': '$event.preventDefault(); onRowClick()',
        '(keydown.arrowright)': 'onArrowRight($event)'
    },
    template: `
        @let canChangeDirection = context.canChangeDirection(col());

        <div class="kbq-column-menu-row-wrapper">
            <span
                role="checkbox"
                class="kbq-column-menu-checkbox"
                [attr.aria-checked]="active()"
                [attr.aria-label]="name()"
                [class.kbq-column-menu-checkbox--checked]="active()"
            ></span>

            <span class="kbq-column-menu-label" [innerHTML]="highlightHtml(name(), context.searchQuery())"></span>

            @if (active()) {
                <span class="kbq-column-menu-row-actions">
                    <button
                        #directionButton
                        type="button"
                        tabindex="-1"
                        class="kbq-column-menu-action-btn kbq-sort-menu-direction-btn"
                        [title]="directionLabel()"
                        [attr.aria-label]="directionLabel()"
                        [attr.aria-disabled]="canChangeDirection ? null : 'true'"
                        [class.kbq-column-menu-action-btn_disabled]="!canChangeDirection"
                        (keydown.arrowleft)="onActionArrowLeft($event)"
                        (keydown.enter)="onDirectionKeydown($event)"
                        (keydown.space)="onDirectionKeydown($event)"
                        (click)="$event.stopPropagation(); context.toggleDirection(col())"
                    >
                        <i
                            class="kbq kbq-icon"
                            [class.kbq-arrow-down_16]="direction() === 'desc'"
                            [class.kbq-arrow-up_16]="direction() !== 'desc'"
                        ></i>
                    </button>

                    <!-- Pointer-only affordance: the rows are reordered by dragging, not from the keyboard. -->
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
                </span>
            }
        </div>

        @if (active()) {
            <div *cdkDragPlaceholder class="kbq-column-menu-drag-placeholder"></div>
        }
    `
})
export class KbqAgGridSortMenuRow implements FocusableOption {
    /** Column rendered by the row. */
    readonly col = input.required<Column>();
    /** Whether sorting by the column is enabled. */
    readonly active = input.required<boolean>();
    /**
     * Sort direction of the column. Passed by the panel rather than read from the mutable `Column`, so that
     * the OnPush row re-renders when the direction changes outside of it, e.g. on reset.
     */
    readonly direction = input<SortDirection | undefined>(undefined);
    /** Keeps the row focusable by `FocusKeyManager`. */
    readonly disabled = false;

    protected readonly context = inject(KBQ_SORT_MENU_CONTEXT);
    protected readonly labels = inject(KBQ_AG_GRID_SETTINGS_MENU_LABELS).sort;
    protected readonly highlightHtml = kbqHighlightSearchMatches;
    protected readonly name = computed(() => this.context.columnName(this.col()));
    private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly drag = inject(CdkDrag);
    private readonly directionButton = viewChild<ElementRef<HTMLButtonElement>>('directionButton');

    constructor() {
        this.drag.previewContainer = 'parent';

        effect(() => {
            this.drag.data = this.col();
            this.drag.disabled = !this.active() || this.context.searchQuery().length > 0;
        });

        this.drag.started.pipe(takeUntilDestroyed()).subscribe(() => this.context.isDragging.set(true));
        this.drag.ended.pipe(takeUntilDestroyed()).subscribe(() => this.context.isDragging.set(false));
    }

    /** Moves the focus to the row. */
    focus(): void {
        this.elementRef.nativeElement.focus();
    }

    protected directionLabel(): string {
        return this.direction() === 'desc' ? this.labels.descendingButton : this.labels.ascendingButton;
    }

    /** Activates the direction button from the keyboard without the key reaching the row, which would toggle the sorting. */
    protected onDirectionKeydown(event: Event): void {
        event.preventDefault();
        event.stopPropagation();
        this.context.toggleDirection(this.col());
    }

    protected onRowClick(): void {
        this.context.toggle(this.col());
    }

    /** Moves focus from the row to the sort direction button, mirroring the nested menu navigation. */
    protected onArrowRight(event: Event): void {
        const button = this.directionButton();

        if (!button) return;

        event.preventDefault();
        event.stopPropagation();
        button.nativeElement.focus();
    }

    protected onActionArrowLeft(event: Event): void {
        event.preventDefault();
        event.stopPropagation();
        this.focus();
    }
}

/**
 * Sort screen of the settings menu: search, columns with sorting enabled in the order the sorting
 * is applied, followed by the remaining sortable columns in alphabetical order.
 */
@Component({
    selector: 'kbq-ag-grid-sort-panel',
    standalone: true,
    imports: [CdkDropList, KbqAgGridSortMenuRow],
    // eslint-disable-next-line @angular-eslint/no-forward-ref
    providers: [{ provide: KBQ_SORT_MENU_CONTEXT, useExisting: forwardRef(() => KbqAgGridSortPanel) }],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'kbq-ag-grid-sort-panel'
    },
    template: `
        <div class="kbq-column-menu-panel-header">
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

            @if (activeColumns().length > 0) {
                <div
                    class="kbq-column-menu-group"
                    cdkDropList
                    [cdkDropListDisabled]="searchQuery().length > 0"
                    [cdkDropListData]="activeColumns()"
                    (cdkDropListDropped)="dropped($event)"
                >
                    @for (col of activeColumns(); track col.getColId()) {
                        <kbq-sort-menu-row [col]="col" [active]="true" [direction]="col.getSort()" />
                    }
                </div>
            }

            @if (availableColumns().length > 0) {
                <div class="kbq-column-menu-group">
                    @for (col of availableColumns(); track col.getColId()) {
                        <kbq-sort-menu-row [col]="col" [active]="false" />
                    }
                </div>
            }
        </div>
    `
})
export class KbqAgGridSortPanel {
    private readonly params = inject(KBQ_AG_GRID_SETTINGS_MENU_PARAMS);
    private readonly api = this.params.api;
    private readonly destroyRef = inject(DestroyRef);
    private readonly rowItems = viewChildren(KbqAgGridSortMenuRow);
    private readonly keyManager = new FocusKeyManager(this.rowItems, inject(Injector))
        .withWrap()
        .withVerticalOrientation();
    protected readonly labels = inject(KBQ_AG_GRID_SETTINGS_MENU_LABELS).sort;
    /** Current search query used to filter the column list. */
    readonly searchQuery = signal('');
    /** Whether a drag-and-drop operation is in progress. */
    readonly isDragging = signal(false);
    /** Incremented on every grid event that changes the sorting or the set of columns. */
    private readonly gridStateVersion = signal(0);

    private readonly sortableColumns = computed(() => {
        this.gridStateVersion();

        return kbqSortableColumns(this.api);
    });

    /** Sorted columns in the priority the grid applies them. */
    private readonly sortedColumns = computed(() => {
        this.gridStateVersion();

        return kbqSortedColumns(this.api);
    });

    protected readonly activeColumns = computed(() => {
        const query = this.searchQuery().toLowerCase();

        return this.sortedColumns().filter((col) => !query || this.columnName(col).toLowerCase().includes(query));
    });

    protected readonly availableColumns = computed(() => {
        const query = this.searchQuery().toLowerCase();

        return this.sortableColumns()
            .filter((col) => !col.getSort())
            .filter((col) => !query || this.columnName(col).toLowerCase().includes(query))
            .sort((a, b) => this.columnName(a).localeCompare(this.columnName(b)));
    });

    protected readonly hasNoResults = computed(
        () => this.activeColumns().length === 0 && this.availableColumns().length === 0
    );

    constructor() {
        kbqListenColumnStateChanges(this.api, () => this.gridStateVersion.update((version) => version + 1));

        this.destroyRef.onDestroy(this.params.setResetHandler(() => this.reset()));
    }

    /** Title of the column as the grid header renders it. */
    columnName(col: Column): string {
        return kbqResolveColumnName(this.api, col);
    }

    /** Whether the sort direction of the given column can be changed. */
    canChangeDirection(col: Column): boolean {
        return this.sortingOrder(col).filter((direction) => direction !== null).length > 1;
    }

    /** Enables sorting by the given column, or disables it when the column is already sorted. */
    toggle(col: Column): void {
        const colId = col.getColId();
        const active = this.toActiveSorts();
        const index = active.findIndex((item) => item.colId === colId);

        if (index === -1) {
            const sort: ActiveSort = { colId, sort: this.defaultDirection(col) };

            // Without multi-column sorting a new sort replaces the applied one, the way a header click does.
            this.applyActiveSorts(this.api.getGridOption('suppressMultiSort') ? [sort] : [...active, sort]);
        } else {
            active.splice(index, 1);
            this.applyActiveSorts(active);
        }

        // The row moves between the two groups, so its element is recreated and the focus would be lost.
        this.focusColumn(colId);
    }

    /** Switches the sort direction of the given column to the opposite one. */
    toggleDirection(col: Column): void {
        if (!this.canChangeDirection(col)) return;

        const colId = col.getColId();
        const next: 'asc' | 'desc' = col.getSort() === 'asc' ? 'desc' : 'asc';

        this.applyActiveSorts(
            this.toActiveSorts().map((item) => (item.colId === colId ? { colId, sort: next } : item))
        );
    }

    /** Restores the default sorting defined by the column definitions and clears the search query. */
    reset(): void {
        const state: ColumnState[] = this.sortableColumns().map((col) => {
            const { sort, initialSort, sortIndex, initialSortIndex } = col.getColDef();

            return {
                colId: col.getColId(),
                sort: sort ?? initialSort ?? null,
                sortIndex: sortIndex ?? initialSortIndex ?? null
            };
        });

        this.api.applyColumnState({ state });
        this.searchQuery.set('');
        this.gridStateVersion.update((version) => version + 1);
    }

    protected dropped(event: CdkDragDrop<Column[]>): void {
        if (event.previousIndex === event.currentIndex) return;

        const active = this.toActiveSorts();

        moveItemInArray(active, event.previousIndex, event.currentIndex);
        this.applyActiveSorts(active);
    }

    protected onScrollKeydown(event: KeyboardEvent): void {
        this.keyManager.onKeydown(event);
    }

    protected onSearch(event: Event): void {
        if (event.target instanceof HTMLInputElement) {
            this.searchQuery.set(event.target.value);
        }
    }

    protected clearSearch(): void {
        this.searchQuery.set('');
    }

    protected onSearchArrowDown(event: Event): void {
        event.preventDefault();
        this.keyManager.setFirstItemActive();
    }

    /** Moves focus back to the row of the given column once the list has been re-rendered. */
    private focusColumn(colId: string): void {
        setTimeout(() => {
            const index = this.rowItems().findIndex((row) => row.col().getColId() === colId);

            if (index >= 0) {
                this.keyManager.setActiveItem(index);
            }
        });
    }

    private toActiveSorts(): ActiveSort[] {
        return this.sortedColumns().map((col) => ({
            colId: col.getColId(),
            sort: col.getSort() === 'desc' ? 'desc' : 'asc'
        }));
    }

    private applyActiveSorts(active: ActiveSort[]): void {
        const state: ColumnState[] = this.sortableColumns().map((col) => {
            const colId = col.getColId();
            const index = active.findIndex((item) => item.colId === colId);

            return index === -1
                ? { colId, sort: null, sortIndex: null }
                : { colId, sort: active[index].sort, sortIndex: index };
        });

        this.api.applyColumnState({ state });
        this.gridStateVersion.update((version) => version + 1);
    }

    private sortingOrder(col: Column): SortDirection[] {
        return col.getColDef().sortingOrder ?? this.api.getGridOption('sortingOrder') ?? ['asc', 'desc', null];
    }

    private defaultDirection(col: Column): 'asc' | 'desc' {
        return this.sortingOrder(col).find((direction) => direction === 'asc' || direction === 'desc') ?? 'asc';
    }
}
