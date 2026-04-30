import { booleanAttribute, Directive, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular } from 'ag-grid-angular';
import { KbqAgGridShortcuts } from './shortcuts.ng';

/**
 * Directive that enables selecting all rows using Ctrl+A (or Cmd+A on Mac) keyboard shortcut.
 *
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme kbqAgGridSelectAllRowsByCtrlA />
 * ```
 *
 * @deprecated AG Grid provides built-in Ctrl+A support for multi-row selection. Use `rowSelection: { mode: 'multiRow', selectAll: 'all' }` instead. Will be removed in the next major release.
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridSelectAllRowsByCtrlA]'
})
export class KbqAgGridSelectAllRowsByCtrlA {
    private readonly grid = inject(AgGridAngular);
    private readonly shortcuts = inject(KbqAgGridShortcuts);

    /** Indicates whether the directive is enabled. */
    readonly enabled = input(true, { transform: booleanAttribute, alias: 'kbqAgGridSelectAllRowsByCtrlA' });

    constructor() {
        this.grid.cellKeyDown.pipe(takeUntilDestroyed()).subscribe((event) => {
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            if (this.enabled()) this.shortcuts.selectAllRowsByCtrlA(event);
        });
    }
}
