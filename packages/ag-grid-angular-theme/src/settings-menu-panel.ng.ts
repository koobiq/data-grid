import { CdkTrapFocus, FocusableOption, FocusKeyManager } from '@angular/cdk/a11y';
import { MediaMatcher } from '@angular/cdk/layout';
import { SharedResizeObserver } from '@angular/cdk/observers/private';
import { DOCUMENT, NgComponentOutlet } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    ElementRef,
    forwardRef,
    inject,
    InjectionToken,
    Injector,
    input,
    isSignal,
    Signal,
    signal,
    untracked,
    viewChild,
    viewChildren
} from '@angular/core';
import { GridApi } from 'ag-grid-community';
import { kbqListenColumnStateChanges } from './grid-columns';
import { kbqListenMenuDismiss } from './menu-dismiss';
import {
    KBQ_AG_GRID_SETTINGS_MENU_LABELS,
    KBQ_AG_GRID_SETTINGS_MENU_PARAMS,
    KbqAgGridSettingsMenuItem,
    KbqAgGridSettingsMenuItems,
    KbqAgGridSettingsMenuItemState,
    KbqAgGridSettingsMenuLabels,
    KbqAgGridSettingsMenuParams,
    KbqAgGridSettingsMenuSeparator
} from './settings-menu-types';

const KBQ_SETTINGS_MENU_CONTEXT = new InjectionToken<KbqAgGridSettingsMenuPanel>('KBQ_SETTINGS_MENU_CONTEXT');

/** Duration of the level transition, matching the animations of the level body in `theme.scss`. */
const LEVEL_TRANSITION_DURATION = 200;
const LEVEL_TRANSITION_EASING = 'cubic-bezier(0, 0, 0.2, 1)';

/** Items of the root menu level, supplied by `KbqAgGridSettingsMenu` as a signal. */
export const KBQ_AG_GRID_SETTINGS_MENU_ITEMS = new InjectionToken<Signal<KbqAgGridSettingsMenuItems>>(
    'KBQ_AG_GRID_SETTINGS_MENU_ITEMS'
);

/** A level of the drill-down menu: the root list, or the nested level of the item it was opened from. */
type MenuLevel = {
    /** Item the level was opened from, `null` for the root list. */
    item: KbqAgGridSettingsMenuItem | null;
    /** Index of the row that opened the level, focused again when the user returns to the parent level. */
    returnIndex: number;
    /** Depth and item id: changes on every navigation, so the level body is re-created and its animation replays. */
    key: string;
};

let settingsMenuInstanceCount = 0;

/** Whether the target handles arrow keys itself, e.g. to move the caret. */
const isEditableElement = (target: EventTarget | null): boolean =>
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName));

@Component({
    selector: 'kbq-settings-menu-item',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'kbq-settings-menu-item',
        '[attr.tabindex]': '-1',
        '[attr.role]': 'mode() === "single" ? "menuitemradio" : "menuitem"',
        '[attr.aria-haspopup]': 'context.hasSubmenu(item()) ? "true" : null',
        '[attr.aria-checked]': 'mode() === "single" ? context.itemChecked(item()) : null',
        '[attr.aria-disabled]': 'context.itemDisabled(item()) ? "true" : null',
        '[class.kbq-settings-menu-item_disabled]': 'context.itemDisabled(item())',
        '(click)': 'context.select(item())',
        '(focus)': 'context.onItemFocus(this)',
        // Prevented so that the key's activation doesn't land on the trigger, which gets the focus when the item closes the menu.
        '(keydown.enter)': '$event.preventDefault(); context.select(item())',
        '(keydown.space)': '$event.preventDefault(); context.select(item())',
        '(keydown.arrowright)': 'onArrowRight($event)'
    },
    template: `
        @let value = context.itemValue(item());
        @let valueSuffix = context.itemValueSuffix(item());
        @let counter = context.itemCounter(item());

        @if (item().icon; as icon) {
            <i [class]="'kbq kbq-icon kbq-settings-menu-item-icon ' + icon"></i>
        }

        <span class="kbq-settings-menu-item-label">{{ context.itemLabel(item()) }}</span>

        @if (value) {
            <span class="kbq-settings-menu-item-value">{{ value }}</span>
        }

        @if (valueSuffix) {
            <span class="kbq-settings-menu-item-value-suffix">{{ valueSuffix }}</span>
        }

        @if (counter > 0) {
            <span class="kbq-settings-menu-item-counter">+{{ counter }}</span>
        }

        @if (mode() === 'single' && context.itemChecked(item())) {
            <i class="kbq kbq-icon kbq-check_16 kbq-settings-menu-item-check"></i>
        }

        @if (context.hasSubmenu(item())) {
            <i class="kbq kbq-icon kbq-chevron-right_16 kbq-settings-menu-item-chevron"></i>
        }
    `
})
export class KbqAgGridSettingsMenuItemRow implements FocusableOption {
    /** Item rendered by the row. */
    readonly item = input.required<KbqAgGridSettingsMenuItem>();
    /** Behaviour of the level the row belongs to. */
    readonly mode = input.required<'menu' | 'single'>();
    /** Keeps the row focusable by `FocusKeyManager`; the item's own disabled state only blocks its activation. */
    readonly disabled = false;

    protected readonly context = inject(KBQ_SETTINGS_MENU_CONTEXT);
    private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

    /** Moves the focus to the row. */
    focus(): void {
        this.elementRef.nativeElement.focus();
    }

    /** Opens the nested level, mirroring a click on the item. */
    protected onArrowRight(event: Event): void {
        if (!this.context.hasSubmenu(this.item())) return;

        event.preventDefault();
        event.stopPropagation();
        this.context.select(this.item());
    }
}

/**
 * Drill-down settings menu rendered as a button in the top-right corner of the grid header.
 *
 * Internal component created by `KbqAgGridSettingsMenu`.
 */
@Component({
    selector: 'kbq-ag-grid-settings-menu-panel',
    standalone: true,
    imports: [CdkTrapFocus, NgComponentOutlet, KbqAgGridSettingsMenuItemRow],
    providers: [
        // eslint-disable-next-line @angular-eslint/no-forward-ref
        { provide: KBQ_SETTINGS_MENU_CONTEXT, useExisting: forwardRef(() => KbqAgGridSettingsMenuPanel) }
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'kbq-ag-grid-settings-menu-panel'
    },
    template: `
        <div class="kbq-settings-menu">
            <button
                #settingsMenuTrigger
                class="kbq-settings-menu-trigger"
                type="button"
                aria-haspopup="dialog"
                [title]="triggerLabel()"
                [attr.aria-label]="triggerLabel()"
                [attr.aria-expanded]="isOpen()"
                [class.kbq-settings-menu-trigger_active]="isOpen()"
                (click)="toggle()"
            >
                <i class="kbq kbq-icon kbq-sliders_16"></i>
            </button>

            @if (isOpen()) {
                <div
                    #settingsMenuPanel
                    class="kbq-settings-menu-panel"
                    role="dialog"
                    cdkTrapFocus
                    [attr.aria-labelledby]="panelTitleId"
                    (keydown.tab)="onTab($event)"
                    (keydown.shift.tab)="onTab($event)"
                    (keydown.arrowleft)="onArrowLeft($event)"
                >
                    <div class="kbq-settings-menu-panel-header">
                        @if (canGoBack()) {
                            <button
                                type="button"
                                class="kbq-settings-menu-header-btn kbq-settings-menu-back-btn"
                                [title]="labels.backButton"
                                [attr.aria-label]="labels.backButton"
                                (click)="back()"
                            >
                                <span class="kbq-settings-menu-header-btn-bounds">
                                    <i class="kbq kbq-icon kbq-arrow-left_16 kbq-settings-menu-header-btn-icon"></i>
                                </span>
                            </button>
                        }

                        <div class="kbq-settings-menu-panel-title" [id]="panelTitleId">{{ currentTitle() }}</div>

                        @if (resetHandler()) {
                            <button
                                type="button"
                                class="kbq-settings-menu-header-btn kbq-settings-menu-reset-btn"
                                [title]="labels.resetButton"
                                [attr.aria-label]="labels.resetButton"
                                (click)="reset()"
                            >
                                <span class="kbq-settings-menu-header-btn-bounds">
                                    <i class="kbq kbq-icon kbq-undo_16 kbq-settings-menu-header-btn-icon"></i>
                                </span>
                            </button>
                        }
                    </div>

                    @for (level of [currentLevel()]; track level.key) {
                        <div
                            class="kbq-settings-menu-panel-body"
                            [class.kbq-settings-menu-panel-body_forward]="levelTransition() === 'forward'"
                            [class.kbq-settings-menu-panel-body_back]="levelTransition() === 'back'"
                        >
                            @if (level.item?.screen; as screen) {
                                <ng-container *ngComponentOutlet="screen; injector: screenInjector" />
                            } @else {
                                <div class="kbq-settings-menu-list" role="menu" (keydown)="onListKeydown($event)">
                                    @for (entry of visibleEntries(); track $index) {
                                        @if (isSeparator(entry)) {
                                            <div class="kbq-settings-menu-separator"></div>
                                        } @else {
                                            <kbq-settings-menu-item [item]="entry" [mode]="currentMode()" />
                                        }
                                    }
                                </div>
                            }
                        </div>
                    }
                </div>
            }
        </div>
    `
})
export class KbqAgGridSettingsMenuPanel {
    /** Items of the root menu level. */
    protected readonly items = inject(KBQ_AG_GRID_SETTINGS_MENU_ITEMS);

    protected readonly labels = inject(KBQ_AG_GRID_SETTINGS_MENU_LABELS);
    protected readonly panelTitleId = `kbq-settings-menu-title-${++settingsMenuInstanceCount}`;
    private readonly api = inject(KBQ_AG_GRID_SETTINGS_MENU_PARAMS).api;
    private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly injector = inject(Injector);
    private readonly document = inject(DOCUMENT);
    private readonly mediaMatcher = inject(MediaMatcher);
    private readonly sharedResizeObserver = inject(SharedResizeObserver);
    private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('settingsMenuTrigger');
    private readonly panel = viewChild<ElementRef<HTMLElement>>('settingsMenuPanel');
    private readonly rowItems = viewChildren(KbqAgGridSettingsMenuItemRow);
    private readonly keyManager = new FocusKeyManager(this.rowItems, this.injector)
        .withWrap()
        .withVerticalOrientation();

    protected readonly isOpen = signal(false);
    /** Incremented whenever values derived from the grid api may have changed. */
    private readonly gridStateVersion = signal(0);
    private readonly stack = signal<MenuLevel[]>([]);
    private readonly screenResetHandler = signal<(() => void) | null>(null);
    /** Direction the current level was entered in; the level rendered when the menu opens is not animated. */
    protected readonly levelTransition = signal<'forward' | 'back' | null>(null);
    /** Row to focus once the next level renders: the one that opened the level the user returns from. */
    private pendingFocusIndex = 0;
    /** Height the panel was last measured at, the one a resize animates from. */
    private panelHeight: number | null = null;
    private levelResizeAnimation: Animation | null = null;

    /** Root level items that are not hidden. */
    private readonly rootEntries = computed(() =>
        this.items().filter((entry) => this.isSeparator(entry) || !this.itemHidden(entry))
    );

    /**
     * The only root item, when the menu consists of a single section — the trigger then opens that
     * section right away, the way a menu of columns alone is expected to behave.
     */
    private readonly singleRootItem = computed(() => {
        const entries = this.rootEntries();
        const [entry] = entries;

        if (entries.length !== 1 || this.isSeparator(entry) || !this.hasSubmenu(entry)) return null;

        return entry;
    });

    private readonly rootLevel = computed<MenuLevel>(() => {
        const item = this.singleRootItem();

        return { item, returnIndex: 0, key: `0:${item?.id ?? ''}` };
    });

    protected readonly currentLevel = computed<MenuLevel>(() => {
        const stack = this.stack();

        return stack.length > 0 ? stack[stack.length - 1] : this.rootLevel();
    });
    protected readonly canGoBack = computed(() => this.stack().length > 0);
    protected readonly currentMode = computed(() => this.currentLevel().item?.mode ?? 'menu');
    protected readonly currentTitle = computed(() => {
        const { item } = this.currentLevel();

        return item ? this.itemTitle(item) : this.labels.title;
    });
    protected readonly resetHandler = computed(() => {
        const reset = this.currentLevel().item?.reset;

        return this.screenResetHandler() ?? (reset ? (): void => reset(this.api) : null);
    });
    // A menu of a single section is named after that section, as the trigger opens it directly.
    protected readonly triggerLabel = computed(() => {
        const item = this.singleRootItem();

        return item ? this.itemLabel(item) : this.labels.title;
    });

    protected readonly visibleEntries = computed(() => {
        const { item } = this.currentLevel();

        return (item ? (item.items ?? []) : this.items()).filter(
            (entry) => this.isSeparator(entry) || !this.itemHidden(entry)
        );
    });

    /** Injector handed to screen components, providing them {@link KbqAgGridSettingsMenuParams}. */
    protected readonly screenInjector: Injector;

    constructor() {
        const params: KbqAgGridSettingsMenuParams = {
            api: this.api,
            back: () => this.back(),
            close: () => this.close(),
            setResetHandler: (handler) => {
                this.screenResetHandler.set(handler);

                // Only the screen that registered the handler removes it: a level re-created in place
                // registers the new screen's handler before the previous screen is destroyed.
                return () => {
                    if (untracked(this.screenResetHandler) === handler) {
                        this.screenResetHandler.set(null);
                    }
                };
            }
        };

        this.screenInjector = Injector.create({
            parent: this.injector,
            providers: [{ provide: KBQ_AG_GRID_SETTINGS_MENU_PARAMS, useValue: params }]
        });

        kbqListenColumnStateChanges(this.api, () => this.refreshItemStates());

        kbqListenMenuDismiss({
            host: this.elementRef.nativeElement,
            isOpen: this.isOpen,
            onOutsideClick: () => this.close(),
            onEscape: () => this.onEscape()
        });

        effect((onCleanup) => {
            const isOpen = this.isOpen();

            // Reading the level makes the focus move on every navigation, not only on opening.
            this.currentLevel();

            if (!isOpen) return;

            const focusIndex = this.pendingFocusIndex;
            // Focus once the level has rendered; a navigation in the meantime supersedes the pending focus.
            const timer = setTimeout(() => this.focusCurrentLevel(focusIndex));

            onCleanup(() => clearTimeout(timer));
        });

        this.observePanelResize();
    }

    /** Whether the given entry is a separator rather than an item. */
    isSeparator(entry: KbqAgGridSettingsMenuItems[number]): entry is KbqAgGridSettingsMenuSeparator {
        return 'kind' in entry;
    }

    /** Whether the given item opens a nested level. */
    hasSubmenu(item: KbqAgGridSettingsMenuItem): boolean {
        return !!item.screen || !!item.items;
    }

    /** Title of the item. */
    itemLabel(item: KbqAgGridSettingsMenuItem): string {
        return this.resolveState(item.label, '');
    }

    /** Title of the level the item opens. */
    itemTitle(item: KbqAgGridSettingsMenuItem): string {
        return this.resolveState(item.screenTitle ?? item.label, '');
    }

    /** Value rendered to the right of the item title. */
    itemValue(item: KbqAgGridSettingsMenuItem): string | undefined {
        return this.resolveState(item.value, undefined);
    }

    /** Text rendered after the item value. */
    itemValueSuffix(item: KbqAgGridSettingsMenuItem): string | undefined {
        return this.resolveState(item.valueSuffix, undefined);
    }

    /** Counter rendered after the item value. */
    itemCounter(item: KbqAgGridSettingsMenuItem): number {
        return this.resolveState(item.counter, 0);
    }

    /** Whether the item is marked with a check mark. */
    itemChecked(item: KbqAgGridSettingsMenuItem): boolean {
        return this.resolveState(item.checked, false);
    }

    /** Whether the item is disabled. */
    itemDisabled(item: KbqAgGridSettingsMenuItem): boolean {
        return this.resolveState(item.disabled, false);
    }

    /** Whether the item is hidden. */
    itemHidden(item: KbqAgGridSettingsMenuItem): boolean {
        return this.resolveState(item.hidden, false);
    }

    /** Keeps the keyboard navigation in sync with rows focused by the mouse. */
    onItemFocus(row: KbqAgGridSettingsMenuItemRow): void {
        this.keyManager.updateActiveItem(row);
    }

    /** Opens the nested level of the given item, or runs its action and closes the menu unless the item keeps it open. */
    select(item: KbqAgGridSettingsMenuItem): void {
        if (this.itemDisabled(item)) return;

        if (this.hasSubmenu(item)) {
            const returnIndex = Math.max(
                0,
                this.rowItems().findIndex((row) => row.item() === item)
            );

            this.levelTransition.set('forward');
            this.pendingFocusIndex = 0;
            this.stack.update((levels) => [...levels, { item, returnIndex, key: `${levels.length + 1}:${item.id}` }]);

            return;
        }

        item.action?.(this.api);

        if (item.keepOpen) {
            // The action may change grid state that the rows of the level derive their state from.
            this.refreshItemStates();
        } else {
            this.close();
        }
    }

    /** Returns to the previous menu level. */
    back(): void {
        const stack = this.stack();

        if (stack.length === 0) return;

        this.pendingFocusIndex = stack[stack.length - 1].returnIndex;
        this.levelTransition.set('back');
        this.stack.set(stack.slice(0, -1));
    }

    /** Closes the menu, resets it back to the root level and returns the focus to the trigger if the menu had it. */
    close(): void {
        const hadFocus = this.elementRef.nativeElement.contains(this.document.activeElement);

        this.isOpen.set(false);
        this.stack.set([]);
        this.pendingFocusIndex = 0;

        // Removing the focused panel would otherwise drop the focus to the document body.
        if (hadFocus) {
            this.trigger().nativeElement.focus();
        }
    }

    protected toggle(): void {
        if (this.isOpen()) {
            this.close();

            return;
        }

        this.levelTransition.set(null);
        // Values derived from the grid api may be outdated after the menu has been closed.
        this.refreshItemStates();
        this.isOpen.set(true);
    }

    protected reset(): void {
        this.resetHandler()?.();
    }

    protected onListKeydown(event: KeyboardEvent): void {
        this.keyManager.onKeydown(event);
    }

    protected onTab(event: Event): void {
        // Screens run their own tab sequence within the focus trap.
        if (this.currentLevel().item?.screen || !(event instanceof KeyboardEvent)) return;

        // The rows of a list level are not tabbable, so the level cycles the focus through the header
        // buttons and the active row itself. Read from the DOM and the key manager rather than from
        // bindings, which may not have been refreshed yet after a quick arrow key press.
        const buttons = Array.from(
            this.elementRef.nativeElement.querySelectorAll<HTMLElement>('.kbq-settings-menu-header-btn')
        );
        const { activeItem } = this.keyManager;
        const count = buttons.length + (activeItem ? 1 : 0);

        event.preventDefault();

        if (count === 0) return;

        const focusedButtonIndex = buttons.findIndex((button) => button === this.document.activeElement);
        const currentIndex = focusedButtonIndex === -1 ? buttons.length : focusedButtonIndex;
        const nextIndex = (currentIndex + (event.shiftKey ? -1 : 1) + count) % count;

        if (nextIndex < buttons.length) {
            buttons[nextIndex].focus();
        } else {
            activeItem?.focus();
        }
    }

    protected onArrowLeft(event: Event): void {
        // Editable fields own the arrow keys, and a prevented event has already been handled by the level.
        if (event.defaultPrevented || isEditableElement(event.target) || !this.canGoBack()) return;

        event.preventDefault();
        event.stopPropagation();
        this.back();
    }

    private onEscape(): void {
        if (this.canGoBack()) {
            this.back();

            return;
        }

        this.close();
        this.trigger().nativeElement.focus();
    }

    /**
     * Grows and shrinks the panel along with its content instead of letting it jump: the observer
     * reports the new size before the browser paints it, so the animation starts from the size the
     * panel still has. Levels that render their content asynchronously, like the screens, are
     * covered too, which a single measurement after the navigation would miss.
     */
    private observePanelResize(): void {
        effect((onCleanup) => {
            const element = this.panel()?.nativeElement;

            this.panelHeight = null;

            if (!element) return;

            const subscription = this.sharedResizeObserver
                .observe(element)
                .subscribe(() => this.animatePanelResize(element));

            onCleanup(() => subscription.unsubscribe());
        });
    }

    private animatePanelResize(element: HTMLElement): void {
        const from = this.panelHeight;
        const to = element.getBoundingClientRect().height;

        this.panelHeight = to;

        // The first measurement of an opened menu has nothing to grow from, and the animation of the
        // panel resizes it on its own.
        if (from === null || Math.round(from) === Math.round(to)) return;
        if (this.levelResizeAnimation?.playState === 'running') return;

        // The Web Animations API is missing outside a browser, e.g. in unit tests.
        if (typeof element.animate !== 'function') return;

        if (this.mediaMatcher.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        this.levelResizeAnimation = element.animate([{ height: `${from}px` }, { height: `${to}px` }], {
            duration: LEVEL_TRANSITION_DURATION,
            easing: LEVEL_TRANSITION_EASING
        });
    }

    private refreshItemStates(): void {
        this.gridStateVersion.update((version) => version + 1);
    }

    private focusCurrentLevel(rowIndex: number): void {
        if (!this.isOpen()) return;

        if (this.currentLevel().item?.screen) {
            const body = this.elementRef.nativeElement.querySelector('.kbq-settings-menu-panel-body');

            body?.querySelector<HTMLElement>('input, button, [tabindex]:not([tabindex="-1"])')?.focus();

            return;
        }

        const items = this.rowItems();

        if (items.length === 0) return;

        this.keyManager.setActiveItem(Math.min(rowIndex, items.length - 1));
    }

    private resolveState<T>(state: KbqAgGridSettingsMenuItemState<T> | undefined, fallback: T): T {
        // Keeps values derived from the grid api up to date: templates reading this method
        // re-render whenever the grid reports a change.
        this.gridStateVersion();

        if (state === undefined) return fallback;

        if (isSignal(state)) return state();

        if (typeof state === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            return (state as (api: GridApi, labels: KbqAgGridSettingsMenuLabels) => T)(this.api, this.labels);
        }

        return state;
    }
}
