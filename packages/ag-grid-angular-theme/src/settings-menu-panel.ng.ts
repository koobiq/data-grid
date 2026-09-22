import { CdkTrapFocus, FocusableOption, FocusKeyManager } from '@angular/cdk/a11y';
import { SharedResizeObserver } from '@angular/cdk/observers/private';
import { DOCUMENT, NgComponentOutlet } from '@angular/common';
import {
    afterNextRender,
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
    NgZone,
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
    /** Depth and item id: identifies the screen of the level, so that reopening a level that is still leaving reuses it. */
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
    /** Depth of the level the row belongs to; only the rows of the active level take part in the keyboard navigation. */
    readonly levelIndex = input.required<number>();
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

            @if (isPanelRendered()) {
                <div
                    #settingsMenuPanel
                    class="kbq-settings-menu-panel"
                    role="dialog"
                    cdkTrapFocus
                    [class.kbq-settings-menu-panel_closing]="!isOpen()"
                    [attr.inert]="isOpen() ? null : ''"
                    [attr.aria-labelledby]="screenTitleId(depth())"
                    (keydown.tab)="onTab($event)"
                    (keydown.shift.tab)="onTab($event)"
                    (keydown.arrowleft)="onArrowLeft($event)"
                >
                    <div class="kbq-settings-menu-track">
                        @for (level of screens(); track level.key; let index = $index) {
                            @let isActive = index === depth();
                            @let levelReset = levelResetHandler(level);

                            <div
                                #settingsMenuScreen
                                class="kbq-settings-menu-screen"
                                [class.kbq-settings-menu-screen_active]="isActive"
                                [class.kbq-settings-menu-screen_pushed]="index > 0"
                                [class.kbq-settings-menu-screen_behind]="index === depth() - 1"
                                [class.kbq-settings-menu-screen_hidden]="index < depth() - 1"
                                [class.kbq-settings-menu-screen_ahead]="index > depth()"
                                [attr.inert]="isActive ? null : ''"
                                [attr.aria-hidden]="isActive ? null : 'true'"
                            >
                                <div class="kbq-settings-menu-panel-header">
                                    @if (index > 0) {
                                        <button
                                            type="button"
                                            class="kbq-settings-menu-header-btn kbq-settings-menu-back-btn"
                                            [title]="labels.backButton"
                                            [attr.aria-label]="labels.backButton"
                                            (click)="back()"
                                        >
                                            <span class="kbq-settings-menu-header-btn-bounds">
                                                <i
                                                    class="kbq kbq-icon kbq-arrow-left_16 kbq-settings-menu-header-btn-icon"
                                                ></i>
                                            </span>
                                        </button>
                                    }

                                    <div class="kbq-settings-menu-panel-title" [id]="screenTitleId(index)">
                                        {{ levelTitle(level) }}
                                    </div>

                                    @if (levelReset) {
                                        <button
                                            type="button"
                                            class="kbq-settings-menu-header-btn kbq-settings-menu-reset-btn"
                                            [title]="labels.resetButton"
                                            [attr.aria-label]="labels.resetButton"
                                            (click)="levelReset()"
                                        >
                                            <span class="kbq-settings-menu-header-btn-bounds">
                                                <i
                                                    class="kbq kbq-icon kbq-undo_16 kbq-settings-menu-header-btn-icon"
                                                ></i>
                                            </span>
                                        </button>
                                    }
                                </div>

                                <div class="kbq-settings-menu-panel-body">
                                    @if (level.item?.screen; as screen) {
                                        <ng-container *ngComponentOutlet="screen; injector: screenInjector(level)" />
                                    } @else {
                                        <div
                                            class="kbq-settings-menu-list"
                                            role="menu"
                                            (keydown)="onListKeydown($event)"
                                        >
                                            @for (entry of levelEntries(level); track $index) {
                                                @if (isSeparator(entry)) {
                                                    <div class="kbq-settings-menu-separator"></div>
                                                } @else {
                                                    <kbq-settings-menu-item
                                                        [item]="entry"
                                                        [mode]="levelMode(level)"
                                                        [levelIndex]="index"
                                                    />
                                                }
                                            }
                                        </div>
                                    }
                                </div>
                            </div>
                        }
                    </div>
                </div>
            }
        </div>
    `
})
export class KbqAgGridSettingsMenuPanel {
    /** Items of the root menu level. */
    protected readonly items = inject(KBQ_AG_GRID_SETTINGS_MENU_ITEMS);

    protected readonly labels = inject(KBQ_AG_GRID_SETTINGS_MENU_LABELS);
    private readonly panelTitleId = `kbq-settings-menu-title-${++settingsMenuInstanceCount}`;
    private readonly api = inject(KBQ_AG_GRID_SETTINGS_MENU_PARAMS).api;
    private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly injector = inject(Injector);
    private readonly document = inject(DOCUMENT);
    private readonly ngZone = inject(NgZone);
    private readonly sharedResizeObserver = inject(SharedResizeObserver);
    private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('settingsMenuTrigger');
    private readonly panel = viewChild<ElementRef<HTMLElement>>('settingsMenuPanel');
    private readonly screenElements = viewChildren<ElementRef<HTMLElement>>('settingsMenuScreen');
    private readonly rowItems = viewChildren(KbqAgGridSettingsMenuItemRow);

    /** Whether the menu is open. The panel stays rendered a little longer, while it fades out. */
    protected readonly isOpen = signal(false);
    protected readonly isPanelRendered = signal(false);
    /** Incremented whenever values derived from the grid api may have changed. */
    private readonly gridStateVersion = signal(0);
    /** Levels opened on top of the root one, the last of them is the active level. */
    private readonly stack = signal<MenuLevel[]>([]);
    /** Level the user has just returned from, rendered until it has slid out of the panel. */
    private readonly leavingLevel = signal<MenuLevel | null>(null);
    /** Reset handlers registered by the screens, by the key of their level. */
    private readonly screenResetHandlers = signal<Readonly<Record<string, () => void>>>({});
    private readonly screenInjectors = new Map<string, Injector>();
    /** Row to focus once the next level renders: the one that opened the level the user returns from. */
    private pendingFocusIndex = 0;

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
    /** Index of the active level among the rendered screens. */
    protected readonly depth = computed(() => this.stack().length);
    protected readonly canGoBack = computed(() => this.stack().length > 0);
    /**
     * Screens rendered on top of each other: every level on the way to the active one, which the
     * active level slides over, and the level being left, which slides out of it.
     */
    protected readonly screens = computed<MenuLevel[]>(() => {
        const leaving = this.leavingLevel();
        const path = [this.rootLevel(), ...this.stack()];

        return leaving ? [...path, leaving] : path;
    });
    // A menu of a single section is named after that section, as the trigger opens it directly.
    protected readonly triggerLabel = computed(() => {
        const item = this.singleRootItem();

        return item ? this.itemLabel(item) : this.labels.title;
    });

    private readonly activeScreen = computed(() => this.screenElementAt(this.depth()));
    /** Rows of the active level; the rows of the levels behind or leaving it are not navigable. */
    private readonly activeRows = computed(() => this.rowItems().filter((row) => row.levelIndex() === this.depth()));
    private readonly keyManager = new FocusKeyManager(this.activeRows, inject(Injector))
        .withWrap()
        .withVerticalOrientation();

    constructor() {
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

        this.observePanelHeight();
        this.observeViewportSpace();
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
                this.activeRows().findIndex((row) => row.item() === item)
            );

            this.pendingFocusIndex = 0;
            // A level still leaving the panel makes way. When it is the one being opened again, its
            // screen is kept and slides back from where it is.
            this.leavingLevel.set(null);
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

        const leaving = stack[stack.length - 1];

        this.pendingFocusIndex = leaving.returnIndex;
        this.leavingLevel.set(leaving);
        this.stack.set(stack.slice(0, -1));

        this.afterTransitions(
            () => this.screenElementAt(this.depth() + 1),
            () => {
                if (this.leavingLevel() === leaving) this.leavingLevel.set(null);
            }
        );
    }

    /** Closes the menu, resets it back to the root level and returns the focus to the trigger if the menu had it. */
    close(): void {
        const hadFocus = this.elementRef.nativeElement.contains(this.document.activeElement);

        this.isOpen.set(false);

        // Removing the focused panel would otherwise drop the focus to the document body.
        if (hadFocus) {
            this.trigger().nativeElement.focus();
        }

        this.afterTransitions(
            () => this.panel()?.nativeElement ?? null,
            () => {
                if (!this.isOpen()) this.unmountPanel();
            }
        );
    }

    protected toggle(): void {
        if (this.isOpen()) {
            this.close();

            return;
        }

        // A panel still fading out opens again from the root level.
        this.resetLevels();
        // Values derived from the grid api may be outdated after the menu has been closed.
        this.refreshItemStates();
        this.isPanelRendered.set(true);
        this.isOpen.set(true);
    }

    /** Id of the title of the screen at the given depth, which labels the panel while that screen is active. */
    protected screenTitleId(index: number): string {
        return `${this.panelTitleId}-${index}`;
    }

    protected levelTitle(level: MenuLevel): string {
        return level.item ? this.itemTitle(level.item) : this.labels.title;
    }

    protected levelMode(level: MenuLevel): 'menu' | 'single' {
        return level.item?.mode ?? 'menu';
    }

    protected levelEntries(level: MenuLevel): KbqAgGridSettingsMenuItems {
        return (level.item ? (level.item.items ?? []) : this.items()).filter(
            (entry) => this.isSeparator(entry) || !this.itemHidden(entry)
        );
    }

    /** Handler of the reset button of the level: the one its screen registered, or the reset of its item. */
    protected levelResetHandler(level: MenuLevel): (() => void) | null {
        const reset = level.item?.reset;

        return this.screenResetHandlers()[level.key] ?? (reset ? (): void => reset(this.api) : null);
    }

    /**
     * Injector of the screen component of the level, providing it {@link KbqAgGridSettingsMenuParams}.
     * Each level has its own, so that the reset handler a screen registers belongs to its level and
     * does not show up on another level while the screen is still sliding out.
     */
    protected screenInjector(level: MenuLevel): Injector {
        const cached = this.screenInjectors.get(level.key);

        if (cached) return cached;

        const params: KbqAgGridSettingsMenuParams = {
            api: this.api,
            back: () => this.back(),
            close: () => this.close(),
            setResetHandler: (handler) => {
                this.screenResetHandlers.update((handlers) => ({ ...handlers, [level.key]: handler }));

                // Only the screen that registered the handler removes it: a level re-created in place
                // registers the new screen's handler before the previous screen is destroyed.
                return () => {
                    if (untracked(this.screenResetHandlers)[level.key] !== handler) return;

                    this.screenResetHandlers.update(({ [level.key]: _removed, ...handlers }) => handlers);
                };
            }
        };
        const injector = Injector.create({
            parent: this.injector,
            providers: [{ provide: KBQ_AG_GRID_SETTINGS_MENU_PARAMS, useValue: params }]
        });

        this.screenInjectors.set(level.key, injector);

        return injector;
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
            this.activeScreen()?.querySelectorAll<HTMLElement>('.kbq-settings-menu-header-btn') ?? []
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

    /** Element of the screen rendered at the given depth, `null` while it is not rendered. */
    private screenElementAt(index: number): HTMLElement | null {
        const screens = this.screenElements();

        return index < screens.length ? screens[index].nativeElement : null;
    }

    private resetLevels(): void {
        this.stack.set([]);
        this.leavingLevel.set(null);
        this.pendingFocusIndex = 0;
    }

    private unmountPanel(): void {
        this.isPanelRendered.set(false);
        this.resetLevels();
        this.screenResetHandlers.set({});
        this.screenInjectors.clear();
    }

    /**
     * Runs `done` once the CSS transitions the last change started on the element have finished, so
     * that a screen or the panel is removed only after it has moved out. Outside a browser, e.g. in
     * unit tests, nothing is animated and `done` runs right away. A transition interrupted by a newer
     * navigation also ends the wait, so `done` checks that its change is still current.
     */
    private afterTransitions(element: () => HTMLElement | null, done: () => void): void {
        const target = this.panel()?.nativeElement;

        if (!target || typeof target.getAnimations !== 'function') {
            done();

            return;
        }

        afterNextRender(
            () => {
                const animations = element()?.getAnimations() ?? [];

                void Promise.allSettled(animations.map(async (animation) => animation.finished)).then(() =>
                    this.ngZone.run(done)
                );
            },
            { injector: this.injector }
        );
    }

    /**
     * Keeps the space between the top of the open panel and the bottom of the viewport in a CSS
     * variable, which limits the panel together with the height of the grid: a grid that runs below
     * the viewport would otherwise let a long level end off screen. Scrolling or resizing the page
     * changes the space; the listeners stay outside the Angular zone, as they only update a style.
     */
    private observeViewportSpace(): void {
        effect((onCleanup) => {
            const panel = this.panel()?.nativeElement;
            const view = this.document.defaultView;

            if (!panel || !view) return;

            const update = (): void => {
                const space = Math.max(0, view.innerHeight - panel.getBoundingClientRect().top);

                panel.style.setProperty('--kbq-settings-menu-panel-viewport-space', `${space}px`);
            };

            update();

            this.ngZone.runOutsideAngular(() => {
                view.addEventListener('scroll', update, { capture: true, passive: true });
                view.addEventListener('resize', update, { passive: true });
            });

            onCleanup(() => {
                view.removeEventListener('scroll', update, { capture: true });
                view.removeEventListener('resize', update);
            });
        });
    }

    /**
     * Sizes the panel to its active screen. The screens lie on top of each other, so the panel would
     * otherwise take the height of the tallest one. The height is set explicitly, which lets the
     * panel transition it together with the screens sliding: the first size of an opened panel
     * replaces `auto` and is not animated, every later one is, from wherever a running transition
     * has got to. The observer reports a screen that renders its content in steps as it grows.
     */
    private observePanelHeight(): void {
        effect((onCleanup) => {
            const panel = this.panel()?.nativeElement;
            const screen = this.activeScreen();

            if (!panel || !screen) return;

            const subscription = this.sharedResizeObserver.observe(screen).subscribe(() => {
                const borders = panel.offsetHeight - panel.clientHeight;

                panel.style.height = `${screen.getBoundingClientRect().height + borders}px`;
            });

            onCleanup(() => subscription.unsubscribe());
        });
    }

    private refreshItemStates(): void {
        this.gridStateVersion.update((version) => version + 1);
    }

    private focusCurrentLevel(rowIndex: number): void {
        if (!this.isOpen()) return;

        if (this.currentLevel().item?.screen) {
            const body = this.activeScreen()?.querySelector('.kbq-settings-menu-panel-body');

            body?.querySelector<HTMLElement>('input, button, [tabindex]:not([tabindex="-1"])')?.focus();

            return;
        }

        const rows = this.activeRows();

        if (rows.length === 0) return;

        this.keyManager.setActiveItem(Math.min(rowIndex, rows.length - 1));
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
