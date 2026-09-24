import { InjectionToken, Provider, Signal, Type } from '@angular/core';
import { GridApi } from 'ag-grid-community';

/**
 * Value of a settings menu item property that may be static, reactive (signal) or derived from the grid
 * api and the menu labels resolved from `KBQ_AG_GRID_SETTINGS_MENU_LABELS`.
 */
export type KbqAgGridSettingsMenuItemState<T> =
    T | Signal<T> | ((api: GridApi, labels: KbqAgGridSettingsMenuLabels) => T);

/** Separator between groups of items in the settings menu. */
export type KbqAgGridSettingsMenuSeparator = {
    kind: 'separator';
};

/**
 * Creates a separator between groups of items in the settings menu.
 *
 * @example
 * ```ts
 * readonly items = [kbqAgGridSettingsMenuColumnsItem(), kbqAgGridSettingsMenuSeparator(), refreshItem];
 * ```
 */
export const kbqAgGridSettingsMenuSeparator = (): KbqAgGridSettingsMenuSeparator => ({ kind: 'separator' });

/** Item of the settings menu. */
export type KbqAgGridSettingsMenuItem = {
    /** Unique item identifier. */
    id: string;
    /** Item title. */
    label: KbqAgGridSettingsMenuItemState<string>;
    /** CSS class of a `@koobiq/icons` icon, e.g. `kbq-3-columns_16`. */
    icon?: string;
    /** Value rendered to the right of the title, e.g. `21 of 34`. */
    value?: KbqAgGridSettingsMenuItemState<string | undefined>;
    /** Text rendered after the value that stays visible when the value is truncated, e.g. the `↑` sort direction. */
    valueSuffix?: KbqAgGridSettingsMenuItemState<string | undefined>;
    /** Counter rendered after the value as `+N`. Hidden when the value is less than 1. */
    counter?: KbqAgGridSettingsMenuItemState<number>;
    /** Marks the item with a check mark. Used by nested menus with `mode: 'single'`. */
    checked?: KbqAgGridSettingsMenuItemState<boolean>;
    /** Disables the item. */
    disabled?: KbqAgGridSettingsMenuItemState<boolean>;
    /** Hides the item. */
    hidden?: KbqAgGridSettingsMenuItemState<boolean>;
    /** Nested menu defined as a list of items. */
    items?: KbqAgGridSettingsMenuItems;
    /** Behaviour of the nested list: a plain menu or a single value selector. */
    mode?: 'menu' | 'single';
    /**
     * Nested screen with its own interface. The component receives
     * {@link KbqAgGridSettingsMenuParams} through {@link KBQ_AG_GRID_SETTINGS_MENU_PARAMS}.
     */
    screen?: Type<unknown>;
    /** Title of the nested level, when it differs from {@link KbqAgGridSettingsMenuItem.label}. */
    screenTitle?: KbqAgGridSettingsMenuItemState<string>;
    /** Handler of the `Reset to default` button in the nested level header. The button is hidden without it. */
    reset?: (api: GridApi) => void;
    /** Action of a leaf item: runs on click and closes the menu, unless {@link KbqAgGridSettingsMenuItem.keepOpen} is set. */
    action?: (api: GridApi) => void;
    /**
     * Keeps the menu open after the action of a leaf item runs, e.g. to switch between the values of a
     * single selection level and see the check mark move.
     */
    keepOpen?: boolean;
};

/** Content of a settings menu level. */
export type KbqAgGridSettingsMenuItems = (KbqAgGridSettingsMenuItem | KbqAgGridSettingsMenuSeparator)[];

/** Parameters provided to a settings menu screen component via {@link KBQ_AG_GRID_SETTINGS_MENU_PARAMS}. */
export type KbqAgGridSettingsMenuParams = {
    /** Grid api of the grid the menu belongs to. */
    api: GridApi;
    /** Returns to the previous menu level. */
    back: () => void;
    /** Closes the menu. */
    close: () => void;
    /**
     * Registers the handler of the `Reset to default` button in the level header and returns a function
     * that removes it; call that function when the screen is destroyed. The button is rendered only while
     * a handler is registered, and the handler takes precedence over {@link KbqAgGridSettingsMenuItem.reset}
     * of the item the screen was opened from.
     */
    setResetHandler: (handler: () => void) => () => void;
};

/**
 * Injection token that provides {@link KbqAgGridSettingsMenuParams} to a settings menu screen component.
 *
 * @example
 * ```typescript
 * @Component({ ... })
 * export class MyScreenComponent {
 *     private readonly params = inject(KBQ_AG_GRID_SETTINGS_MENU_PARAMS);
 * }
 * ```
 */
export const KBQ_AG_GRID_SETTINGS_MENU_PARAMS = new InjectionToken<KbqAgGridSettingsMenuParams>(
    'KBQ_AG_GRID_SETTINGS_MENU_PARAMS'
);

/** Localization strings used by the sort screen of the settings menu. */
export type KbqAgGridSortMenuLabels = {
    title: string;
    searchPlaceholder: string;
    clearSearchButton: string;
    emptyState: string;
    ascendingButton: string;
    descendingButton: string;
};

/** Localization strings used by the settings menu. */
export type KbqAgGridSettingsMenuLabels = {
    title: string;
    backButton: string;
    resetButton: string;
    columnsItem: string;
    /** Value of the `Columns` item. `{visible}` and `{total}` are replaced with the column counts. */
    columnsItemValue: string;
    sortItem: string;
    sort: KbqAgGridSortMenuLabels;
};

/** Preset English labels for the settings menu. */
export const KBQ_AG_GRID_SETTINGS_MENU_LABELS_EN: KbqAgGridSettingsMenuLabels = {
    title: 'Table settings',
    backButton: 'Back',
    resetButton: 'Reset to default',
    columnsItem: 'Columns',
    columnsItemValue: '{visible} of {total}',
    sortItem: 'Sorting',
    sort: {
        title: 'Sorting',
        searchPlaceholder: 'Column',
        clearSearchButton: 'Clear search',
        emptyState: 'Nothing found',
        ascendingButton: 'Ascending',
        descendingButton: 'Descending'
    }
};

/** Preset Russian labels for the settings menu. */
export const KBQ_AG_GRID_SETTINGS_MENU_LABELS_RU: KbqAgGridSettingsMenuLabels = {
    title: 'Параметры таблицы',
    backButton: 'Назад',
    resetButton: 'Сбросить по умолчанию',
    columnsItem: 'Столбцы',
    columnsItemValue: '{visible} из {total}',
    sortItem: 'Сортировка',
    sort: {
        title: 'Сортировка',
        searchPlaceholder: 'Столбец',
        clearSearchButton: 'Очистить поиск',
        emptyState: 'Ничего не найдено',
        ascendingButton: 'По возрастанию',
        descendingButton: 'По убыванию'
    }
};

/**
 * Injection token for supplying custom labels to the settings menu.
 * Defaults to {@link KBQ_AG_GRID_SETTINGS_MENU_LABELS_RU}.
 *
 * @see kbqAgGridSettingsMenuLabelsProvider
 */
export const KBQ_AG_GRID_SETTINGS_MENU_LABELS = new InjectionToken<KbqAgGridSettingsMenuLabels>(
    'KBQ_AG_GRID_SETTINGS_MENU_LABELS',
    { factory: (): KbqAgGridSettingsMenuLabels => KBQ_AG_GRID_SETTINGS_MENU_LABELS_RU }
);

/**
 * Creates a provider that overrides the default settings menu labels.
 *
 * @example
 * ```ts
 * providers: [kbqAgGridSettingsMenuLabelsProvider(KBQ_AG_GRID_SETTINGS_MENU_LABELS_EN)]
 * ```
 */
export const kbqAgGridSettingsMenuLabelsProvider = (labels: KbqAgGridSettingsMenuLabels): Provider => ({
    provide: KBQ_AG_GRID_SETTINGS_MENU_LABELS,
    useValue: labels
});
