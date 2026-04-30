import { booleanAttribute, Directive, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular } from 'ag-grid-angular';
import { KbqAgGridShortcuts } from './shortcuts.ng';

/**
 * Directive that enables selecting multiple rows using Shift+Arrow keys.
 *
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme kbqAgGridSelectRowsByShiftArrow />
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridSelectRowsByShiftArrow]'
})
export class KbqAgGridSelectRowsByShiftArrow {
    private readonly grid = inject(AgGridAngular);
    private readonly shortcuts = inject(KbqAgGridShortcuts);

    /** Indicates whether the directive is enabled. */
    readonly enabled = input(true, { transform: booleanAttribute, alias: 'kbqAgGridSelectRowsByShiftArrow' });

    constructor() {
        this.grid.cellKeyDown.pipe(takeUntilDestroyed()).subscribe((event) => {
            if (this.enabled()) this.shortcuts.selectRowsByShiftArrow(event);
        });
    }
}
