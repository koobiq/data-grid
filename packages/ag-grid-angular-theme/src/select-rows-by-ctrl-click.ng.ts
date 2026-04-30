import { booleanAttribute, Directive, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular } from 'ag-grid-angular';
import { KbqAgGridShortcuts } from './shortcuts.ng';

/**
 * Directive that enables selecting multiple rows using Ctrl+Click (or Cmd+Click on Mac).
 *
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme kbqAgGridSelectRowsByCtrlClick />
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridSelectRowsByCtrlClick]'
})
export class KbqAgGridSelectRowsByCtrlClick {
    private readonly grid = inject(AgGridAngular);
    private readonly shortcuts = inject(KbqAgGridShortcuts);

    /** Indicates whether the directive is enabled. */
    readonly enabled = input(true, { transform: booleanAttribute, alias: 'kbqAgGridSelectRowsByCtrlClick' });

    constructor() {
        this.grid.cellClicked.pipe(takeUntilDestroyed()).subscribe((event) => {
            if (this.enabled()) this.shortcuts.selectRowsByCtrlClick(event);
        });
    }
}
