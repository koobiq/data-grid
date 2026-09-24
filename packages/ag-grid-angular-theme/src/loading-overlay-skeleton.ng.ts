import { ChangeDetectionStrategy, Component, inject, InjectionToken, Provider } from '@angular/core';
import type { ILoadingOverlayAngularComp } from 'ag-grid-angular';
import type { ILoadingOverlayParams } from 'ag-grid-community';
import { KbqAgGridSkeletonCellRenderer } from './skeleton-cell-renderer.ng';

/**
 * This file is deliberately kept apart from `loading-overlay.ng.ts`, which holds the directive.
 *
 * The directive injects `AgGridAngular`, a runtime import of `ag-grid-angular`; the component does
 * not need AG Grid at all — its two AG Grid imports are types, erased at compile time. Keeping them
 * in one file would drag the whole of AG Grid into any bundle that only wants to render the
 * skeleton, which the documentation site does while an AG Grid example is still loading. Do not
 * merge the two files back together, and do not import `ag-grid-angular` here for a value.
 */

/** Configuration for {@link KbqAgGridLoadingOverlayComponent}. */
export type KbqAgGridLoadingOverlayConfig = Partial<{
    /** Number of skeleton data rows (excluding the header row). @default 3 */
    rows: number;
    /** Number of skeleton columns. @default 3 */
    cols: number;
    /** Width of the first column, which stays fixed while the rest share the remaining space. @default '120px' */
    firstColWidth: string;
}>;

const DEFAULT_ROWS_COUNT = 3;
const DEFAULT_COLS_COUNT = 3;
const DEFAULT_FIRST_COL_WIDTH = '120px';

/**
 * Injection token that provides {@link KbqAgGridLoadingOverlayConfig} to {@link KbqAgGridLoadingOverlayComponent}.
 * Use {@link kbqAgGridLoadingOverlayConfigProvider} to configure it.
 */
export const KBQ_AG_GRID_LOADING_OVERLAY_CONFIG = new InjectionToken<KbqAgGridLoadingOverlayConfig>(
    'KBQ_AG_GRID_LOADING_OVERLAY_CONFIG',
    {
        factory: (): KbqAgGridLoadingOverlayConfig => ({
            rows: DEFAULT_ROWS_COUNT,
            cols: DEFAULT_COLS_COUNT,
            firstColWidth: DEFAULT_FIRST_COL_WIDTH
        })
    }
);

/**
 * Provides configuration for {@link KbqAgGridLoadingOverlayComponent}.
 *
 * @example
 * ```typescript
 * providers: [kbqAgGridLoadingOverlayConfigProvider({ rows: 5, cols: 4, firstColWidth: '160px' })]
 * ```
 */
export function kbqAgGridLoadingOverlayConfigProvider(config: KbqAgGridLoadingOverlayConfig): Provider {
    return {
        provide: KBQ_AG_GRID_LOADING_OVERLAY_CONFIG,
        useValue: config
    };
}

/**
 * Skeleton placeholder shaped like a grid: a header row plus `rows` data rows of `cols` columns.
 * Used by the {@link KbqAgGridLoadingOverlay} directive as AG Grid's loading overlay, and renderable
 * on its own wherever a grid-shaped placeholder is needed. Configure via
 * {@link kbqAgGridLoadingOverlayConfigProvider}.
 */
@Component({
    standalone: true,
    imports: [KbqAgGridSkeletonCellRenderer],
    selector: 'kbq-ag-grid-loading-overlay',
    host: {
        class: 'kbq-ag-grid-loading-overlay',
        '[style.--kbq-ag-grid-skeleton-first-col-width]': 'firstColWidth'
    },
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="kbq-ag-grid-skeleton-overlay">
            <div class="kbq-ag-grid-skeleton-row kbq-ag-grid-skeleton-row_header">
                @for (col of cols; track col) {
                    <kbq-ag-grid-skeleton-cell-renderer [seed]="col" />
                }
            </div>
            @for (row of rows; track row) {
                <div class="kbq-ag-grid-skeleton-row">
                    @for (col of cols; track col) {
                        <kbq-ag-grid-skeleton-cell-renderer [seed]="row * cols.length + col" />
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
    protected readonly firstColWidth = this.config.firstColWidth ?? DEFAULT_FIRST_COL_WIDTH;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    agInit(_params: ILoadingOverlayParams): void {}
}
