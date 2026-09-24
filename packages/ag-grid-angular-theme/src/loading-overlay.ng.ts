import { booleanAttribute, Directive, effect, inject, input } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { KbqAgGridLoadingOverlayComponent } from './loading-overlay-skeleton.ng';

/**
 * Directive that manages the skeleton loading overlay state for ag-grid-angular.
 * Automatically sets the {@link KbqAgGridLoadingOverlayComponent} as the loading overlay
 * and synchronizes the grid `loading` option with the provided boolean value.
 *
 * The overlay component itself lives in `loading-overlay-skeleton.ng.ts`, which has no runtime
 * dependency on AG Grid — see the comment there before moving anything between the two files.
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
