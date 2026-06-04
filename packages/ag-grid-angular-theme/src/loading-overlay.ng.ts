import {
    booleanAttribute,
    ChangeDetectionStrategy,
    Component,
    Directive,
    effect,
    inject,
    InjectionToken,
    input,
    Provider
} from '@angular/core';
import { AgGridAngular, ILoadingOverlayAngularComp } from 'ag-grid-angular';
import { ILoadingOverlayParams } from 'ag-grid-community';
import { KbqAgGridSkeletonCellRenderer } from './skeleton-cell-renderer.ng';

/** Configuration for {@link KbqAgGridLoadingOverlayComponent}. */
export type KbqAgGridLoadingOverlayConfig = Partial<{
    /** Number of skeleton data rows (excluding the header row). @default 3 */
    rows: number;
    /** Number of skeleton columns. @default 3 */
    cols: number;
}>;

const DEFAULT_ROWS_COUNT = 3;
const DEFAULT_COLS_COUNT = 3;

/**
 * Injection token that provides {@link KbqAgGridLoadingOverlayConfig} to {@link KbqAgGridLoadingOverlayComponent}.
 * Use {@link kbqAgGridLoadingOverlayConfigProvider} to configure it.
 */
export const KBQ_AG_GRID_LOADING_OVERLAY_CONFIG = new InjectionToken<KbqAgGridLoadingOverlayConfig>(
    'KBQ_AG_GRID_LOADING_OVERLAY_CONFIG',
    { factory: (): KbqAgGridLoadingOverlayConfig => ({ rows: DEFAULT_ROWS_COUNT, cols: DEFAULT_COLS_COUNT }) }
);

/**
 * Provides configuration for {@link KbqAgGridLoadingOverlayComponent}.
 *
 * @example
 * ```typescript
 * providers: [kbqAgGridLoadingOverlayConfigProvider({ rows: 5, cols: 4 })]
 * ```
 */
export function kbqAgGridLoadingOverlayConfigProvider(config: KbqAgGridLoadingOverlayConfig): Provider {
    return {
        provide: KBQ_AG_GRID_LOADING_OVERLAY_CONFIG,
        useValue: config
    };
}

/**
 * Skeleton loading overlay component for ag-grid-angular.
 * Used internally by {@link KbqAgGridLoadingOverlay} directive.
 * Configure via {@link kbqAgGridLoadingOverlayConfigProvider}.
 */
@Component({
    standalone: true,
    imports: [KbqAgGridSkeletonCellRenderer],
    selector: 'kbq-ag-grid-loading-overlay',
    host: {
        class: 'kbq-ag-grid-loading-overlay'
    },
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="kbq-ag-grid-skeleton-overlay">
            <div class="kbq-ag-grid-skeleton-row kbq-ag-grid-skeleton-row_header">
                @for (col of cols; track col) {
                    <kbq-ag-grid-skeleton-cell-renderer />
                }
            </div>
            @for (row of rows; track row) {
                <div class="kbq-ag-grid-skeleton-row">
                    @for (col of cols; track col) {
                        <kbq-ag-grid-skeleton-cell-renderer />
                    }
                </div>
            }
        </div>
    `
})
export class KbqAgGridLoadingOverlayComponent implements ILoadingOverlayAngularComp {
    private readonly config = inject(KBQ_AG_GRID_LOADING_OVERLAY_CONFIG);

    protected readonly rows = Array.from({ length: this.config.rows ?? DEFAULT_ROWS_COUNT }, (_, i) => i + 1);
    protected readonly cols = Array.from({ length: this.config.cols ?? DEFAULT_COLS_COUNT }, (_, i) => i + 1);

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    agInit(_params: ILoadingOverlayParams): void {}
}

/**
 * Directive that manages the skeleton loading overlay state for ag-grid-angular.
 * Automatically sets the {@link KbqAgGridLoadingOverlayComponent} as the loading overlay
 * and synchronizes the grid `loading` option with the provided boolean value.
 *
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme [kbqAgGridLoadingOverlay]="isLoading" />
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridLoadingOverlay]'
})
export class KbqAgGridLoadingOverlay {
    private readonly grid = inject(AgGridAngular);

    /**
     * Controls the grid loading state. When `true`, shows the skeleton overlay; when `false`, hides it.
     * Accepts any truthy/falsy value (transformed via `booleanAttribute`).
     */
    readonly loading = input.required<boolean, unknown>({
        alias: 'kbqAgGridLoadingOverlay',
        transform: booleanAttribute
    });

    constructor() {
        this.grid.loadingOverlayComponent = KbqAgGridLoadingOverlayComponent;

        effect(() => {
            const loading = this.loading();

            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (this.grid.api) {
                this.grid.api.setGridOption('loading', loading);
            } else {
                this.grid.loading = loading;
            }
        });
    }
}
