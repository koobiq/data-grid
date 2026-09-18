import { SharedResizeObserver } from '@angular/cdk/observers/private';
import { DOCUMENT } from '@angular/common';
import {
    ApplicationRef,
    ComponentRef,
    computed,
    createComponent,
    DestroyRef,
    Directive,
    effect,
    ElementRef,
    EnvironmentInjector,
    inject,
    Injector,
    input,
    OnDestroy
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular } from 'ag-grid-angular';
import { GridApi } from 'ag-grid-community';
import { KbqAgGridColumnsPanel } from './columns-panel.ng';
import { kbqResolveColumnName, kbqSortedColumns, kbqUserColumns } from './grid-columns';
import { KBQ_AG_GRID_SETTINGS_MENU_ITEMS, KbqAgGridSettingsMenuPanel } from './settings-menu-panel.ng';
import {
    KBQ_AG_GRID_SETTINGS_MENU_PARAMS,
    KbqAgGridSettingsMenuItem,
    KbqAgGridSettingsMenuItems,
    KbqAgGridSettingsMenuLabels,
    kbqAgGridSettingsMenuLabelsProvider,
    KbqAgGridSettingsMenuParams
} from './settings-menu-types';
import { KbqAgGridSortPanel } from './sort-panel.ng';

export * from './settings-menu-types';

/** Options of a built-in settings menu item. */
export type KbqAgGridSettingsMenuBuiltInItemOptions = Partial<Omit<KbqAgGridSettingsMenuItem, 'id'>> & {
    /**
     * Labels the item texts are taken from. By default they are resolved when the menu renders, from the
     * `kbqAgGridSettingsMenuLabels` input or `KBQ_AG_GRID_SETTINGS_MENU_LABELS`.
     */
    labels?: KbqAgGridSettingsMenuLabels;
};

/**
 * Creates the built-in `Columns` item that opens the column management panel:
 * visibility, order and pinning of the grid columns.
 *
 * @example
 * ```ts
 * readonly items = [kbqAgGridSettingsMenuColumnsItem(), kbqAgGridSettingsMenuSortItem()];
 * ```
 */
export const kbqAgGridSettingsMenuColumnsItem = (
    options: KbqAgGridSettingsMenuBuiltInItemOptions = {}
): KbqAgGridSettingsMenuItem => {
    const { labels, ...overrides } = options;

    return {
        id: 'columns',
        label: (_api, menuLabels) => (labels ?? menuLabels).columnsItem,
        icon: 'kbq-3-columns_16',
        value: (api, menuLabels): string => {
            const columns = kbqUserColumns(api);
            const visible = columns.filter((col) => col.isVisible()).length;

            return (labels ?? menuLabels).columnsItemValue
                .replace('{visible}', `${visible}`)
                .replace('{total}', `${columns.length}`);
        },
        screen: KbqAgGridColumnsPanel,
        ...overrides
    };
};

/**
 * Creates the built-in `Sorting` item that opens the sort screen: enabling sorting per column,
 * switching the sort direction and reordering multi-column sorting.
 *
 * @example
 * ```ts
 * readonly items = [kbqAgGridSettingsMenuColumnsItem(), kbqAgGridSettingsMenuSortItem()];
 * ```
 */
export const kbqAgGridSettingsMenuSortItem = (
    options: KbqAgGridSettingsMenuBuiltInItemOptions = {}
): KbqAgGridSettingsMenuItem => {
    const { labels, ...overrides } = options;

    return {
        id: 'sort',
        label: (_api, menuLabels) => (labels ?? menuLabels).sortItem,
        icon: 'kbq-arrow-up-arrow-down_16',
        screenTitle: (_api, menuLabels) => (labels ?? menuLabels).sort.title,
        value: (api: GridApi): string | undefined => {
            const sorted = kbqSortedColumns(api);

            return sorted.length > 0 ? kbqResolveColumnName(api, sorted[0]) : undefined;
        },
        valueSuffix: (api: GridApi): string | undefined => {
            const sorted = kbqSortedColumns(api);

            if (sorted.length === 0) return undefined;

            return sorted[0].getSort() === 'desc' ? '↓' : '↑';
        },
        counter: (api: GridApi): number => Math.max(0, kbqSortedColumns(api).length - 1),
        screen: KbqAgGridSortPanel,
        ...overrides
    };
};

/** Root level items used when the consumer passes none. */
const DEFAULT_ITEMS: KbqAgGridSettingsMenuItems = [kbqAgGridSettingsMenuColumnsItem(), kbqAgGridSettingsMenuSortItem()];

/**
 * Directive that renders the table settings menu as an always-visible button in the top-right
 * corner of ag-grid-angular.
 *
 * The menu opens as a drill-down list: selecting an item replaces the content of the panel with the
 * nested level and adds a back button to the header. Out of the box it contains the `Columns` and
 * `Sorting` items; pass `kbqAgGridSettingsMenuItems` to reorder them, drop one of them or add items
 * of your own, including separators and nested levels.
 *
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme kbqAgGridSettingsMenu [kbqAgGridSettingsMenuItems]="items" />
 * ```
 *
 * @example
 * ```ts
 * readonly items: KbqAgGridSettingsMenuItems = [
 *     kbqAgGridSettingsMenuColumnsItem(),
 *     kbqAgGridSettingsMenuSortItem(),
 *     kbqAgGridSettingsMenuSeparator(),
 *     {
 *         id: 'density',
 *         label: 'Density',
 *         icon: 'kbq-bars-sort-center_16',
 *         mode: 'single',
 *         value: this.densityLabel,
 *         items: [
 *             { id: 'compact', label: 'Compact', checked: this.isCompact, keepOpen: true, action: () => this.density.set('compact') },
 *             { id: 'normal', label: 'Normal', checked: this.isNormal, keepOpen: true, action: () => this.density.set('normal') }
 *         ]
 *     }
 * ];
 * ```
 */
@Directive({
    selector: 'ag-grid-angular[kbqAgGridSettingsMenu]',
    standalone: true
})
export class KbqAgGridSettingsMenu implements OnDestroy {
    /**
     * Items of the root menu level.
     *
     * @default [kbqAgGridSettingsMenuColumnsItem(), kbqAgGridSettingsMenuSortItem()]
     */
    readonly items = input<KbqAgGridSettingsMenuItems | undefined>(undefined, {
        alias: 'kbqAgGridSettingsMenuItems'
    });
    /** Labels of the menu, overriding {@link KBQ_AG_GRID_SETTINGS_MENU_LABELS}. */
    readonly labels = input<KbqAgGridSettingsMenuLabels | undefined>(undefined, {
        alias: 'kbqAgGridSettingsMenuLabels'
    });

    private readonly grid = inject(AgGridAngular);
    private readonly applicationRef = inject(ApplicationRef);
    private readonly environmentInjector = inject(EnvironmentInjector);
    private readonly injector = inject(Injector);
    private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly destroyRef = inject(DestroyRef);
    private readonly sharedResizeObserver = inject(SharedResizeObserver);
    private readonly document = inject(DOCUMENT);

    private activeComponentRef: ComponentRef<KbqAgGridSettingsMenuPanel> | null = null;
    private activeWrapperElement: HTMLElement | null = null;

    constructor() {
        this.grid.gridReady.pipe(takeUntilDestroyed()).subscribe(() => this.refreshOverlay());

        effect(() => {
            // Labels are captured by the panel injector when the overlay is created, so changing
            // them re-creates it. Items are read from a signal and need no re-creation.
            this.labels();

            if (this.activeComponentRef) {
                this.refreshOverlay();
            }
        });

        this.observePanelMaxHeight();
    }

    ngOnDestroy(): void {
        this.clearOverlay();
    }

    /** Root level items, falling back to the built-in ones. */
    private readonly resolvedItems = computed<KbqAgGridSettingsMenuItems>(() => this.items() ?? DEFAULT_ITEMS);

    private observePanelMaxHeight(): void {
        const { nativeElement } = this.elementRef;

        this.sharedResizeObserver
            .observe(nativeElement)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
                const header = nativeElement.querySelector<HTMLElement>('.ag-header');
                const available = Math.max(0, nativeElement.clientHeight - (header?.offsetHeight ?? 0));

                nativeElement.style.setProperty('--kbq-settings-menu-panel-max-height', `${available}px`);
            });
    }

    private refreshOverlay(): void {
        this.clearOverlay();

        const { api } = this.grid;
        const labels = this.labels();

        // The panel closes itself, so the params handed to screens delegate to the component created
        // right below — hence the mutable reference rather than a direct call.
        let componentRef: ComponentRef<KbqAgGridSettingsMenuPanel> | null = null;
        const params: KbqAgGridSettingsMenuParams = {
            api,
            back: () => componentRef?.instance.back(),
            close: () => componentRef?.instance.close(),
            // Screens rendered by the panel receive their own params, this one is only used by the panel itself.
            setResetHandler: () => () => undefined
        };

        componentRef = createComponent(KbqAgGridSettingsMenuPanel, {
            environmentInjector: this.environmentInjector,
            elementInjector: Injector.create({
                parent: this.injector,
                providers: [
                    { provide: KBQ_AG_GRID_SETTINGS_MENU_PARAMS, useValue: params },
                    { provide: KBQ_AG_GRID_SETTINGS_MENU_ITEMS, useValue: this.resolvedItems },
                    ...(labels ? [kbqAgGridSettingsMenuLabelsProvider(labels)] : [])
                ]
            })
        });

        this.applicationRef.attachView(componentRef.hostView);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const componentElement: HTMLElement = componentRef.location.nativeElement;

        const wrapperElement = this.document.createElement('div');

        wrapperElement.classList.add('kbq-ag-grid-settings-menu-overlay');
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
