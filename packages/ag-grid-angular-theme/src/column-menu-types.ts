import { InjectionToken, Provider } from '@angular/core';

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
