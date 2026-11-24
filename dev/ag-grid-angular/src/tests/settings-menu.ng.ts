import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import {
    KBQ_AG_GRID_COLUMN_MENU_LABELS_EN,
    KBQ_AG_GRID_SETTINGS_MENU_LABELS_EN,
    kbqAgGridColumnMenuLabelsProvider,
    kbqAgGridSettingsMenuColumnsItem,
    KbqAgGridSettingsMenuItems,
    kbqAgGridSettingsMenuLabelsProvider,
    kbqAgGridSettingsMenuSeparator,
    kbqAgGridSettingsMenuSortItem,
    KbqAgGridThemeModule
} from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, ModuleRegistry, RowSelectionOptions } from 'ag-grid-community';
import { devInjectRowData } from '../row-data';

ModuleRegistry.registerModules([AllCommunityModule]);

type DevDensity = 'compact' | 'normal' | 'big';

const DEV_DENSITY_LABELS: Record<DevDensity, string> = {
    compact: 'Compact',
    normal: 'Normal',
    big: 'Large'
};

const DEV_DENSITIES: DevDensity[] = ['compact', 'normal', 'big'];

/** Long enough for the level to scroll, which is what the demo shows. */
const DEV_TIME_ZONES: string[] = [
    'UTC-08:00',
    'UTC-07:00',
    'UTC-06:00',
    'UTC-05:00',
    'UTC-04:00',
    'UTC-03:00',
    'UTC-01:00',
    'UTC+00:00',
    'UTC+01:00',
    'UTC+02:00',
    'UTC+03:00',
    'UTC+04:00',
    'UTC+05:00',
    'UTC+06:00',
    'UTC+07:00',
    'UTC+08:00',
    'UTC+09:00',
    'UTC+10:00',
    'UTC+11:00',
    'UTC+12:00'
];

@Component({
    selector: 'dev-settings-menu',
    imports: [AgGridModule, KbqAgGridThemeModule],
    standalone: true,
    providers: [
        kbqAgGridSettingsMenuLabelsProvider(KBQ_AG_GRID_SETTINGS_MENU_LABELS_EN),
        kbqAgGridColumnMenuLabelsProvider(KBQ_AG_GRID_COLUMN_MENU_LABELS_EN)
    ],
    template: `
        <ag-grid-angular
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            kbqAgGridSettingsMenu
            animateRows="false"
            [rowData]="rowData()"
            [rowSelection]="rowSelection"
            [columnDefs]="columnDefs"
            [kbqAgGridSettingsMenuItems]="items"
        />
    `,
    styles: `
        :host {
            display: flex;
            flex-direction: column;
            padding: var(--kbq-size-m);
        }

        ag-grid-angular {
            height: 100%;
            max-width: 2036px;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevSettingsMenu {
    readonly rowData = devInjectRowData();
    readonly rowSelection: RowSelectionOptions = {
        mode: 'multiRow',
        enableClickSelection: true,
        hideDisabledCheckboxes: false,
        checkboxes: true,
        headerCheckbox: true
    };
    readonly columnDefs: ColDef[] = [
        { field: 'title', headerName: 'Title', filter: true, lockVisible: true },
        { field: 'riskScore', headerName: 'Risk score', filter: true, lockVisible: true },
        { field: 'severity', headerName: 'Severity (header name with text overflow and ellipsis)', filter: true },
        { field: 'status', headerName: 'Status', filter: true, sortingOrder: ['asc'] },
        { field: 'detectedOn', headerName: 'Detected on', filter: true, pinned: 'right' },
        { field: 'attackType', headerName: 'Attack type', filter: true, sortable: false },
        { field: 'alerts', headerName: 'Alerts', filter: true },
        { field: 'reviewBy', headerName: 'Review by', filter: true },
        { field: 'comment', headerName: 'Comment (header name with text overflow and ellipsis)', filter: true },
        { field: 'affectedHosts', headerName: 'Affected hosts', filter: true }
    ];

    protected readonly density = signal<DevDensity>('normal');
    protected readonly wordWrap = signal(false);
    protected readonly timeZone = signal('UTC+03:00');

    // The `(dev)` suffix marks the items defined by this demo, so that they are not read as
    // built-in items of the package.
    readonly items: KbqAgGridSettingsMenuItems = [
        kbqAgGridSettingsMenuColumnsItem(),
        kbqAgGridSettingsMenuSortItem(),
        kbqAgGridSettingsMenuSeparator(),
        {
            id: 'density',
            label: 'Density (dev)',
            icon: 'kbq-bars-sort-center_16',
            mode: 'single',
            value: computed(() => DEV_DENSITY_LABELS[this.density()]),
            items: DEV_DENSITIES.map((density) => ({
                id: density,
                label: DEV_DENSITY_LABELS[density],
                checked: computed(() => this.density() === density),
                keepOpen: true,
                action: (): void => this.density.set(density)
            }))
        },
        {
            id: 'time-zone',
            label: 'Time zone (dev)',
            icon: 'kbq-globe_16',
            mode: 'single',
            value: this.timeZone,
            items: DEV_TIME_ZONES.map((timeZone) => ({
                id: timeZone,
                label: timeZone,
                checked: computed(() => this.timeZone() === timeZone),
                keepOpen: true,
                action: (): void => this.timeZone.set(timeZone)
            }))
        },
        {
            id: 'word-wrap',
            label: 'Word wrap (dev)',
            icon: 'kbq-wrap-text_16',
            value: computed(() => (this.wordWrap() ? 'On' : 'Off')),
            keepOpen: true,
            action: (): void => this.wordWrap.update((value) => !value)
        },
        kbqAgGridSettingsMenuSeparator(),
        {
            id: 'refresh',
            label: 'Refresh (dev)',
            icon: 'kbq-arrows-rotate_16',
            action: (api): void => api.refreshCells({ force: true })
        }
    ];
}
