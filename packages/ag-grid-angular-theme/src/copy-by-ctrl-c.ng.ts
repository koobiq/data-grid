import { booleanAttribute, Directive, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular } from 'ag-grid-angular';
import { KbqAgGridCopyEvent, KbqAgGridCopyFormatter, KbqAgGridShortcuts } from './shortcuts.ng';

/**
 * Directive that enables copying selected content using Ctrl+C (or Cmd+C on Mac).
 *
 * If text is selected in the browser or grid (`enableCellTextSelection`), the native copy behavior is preserved.
 * Otherwise, the selected row(s) data is copied using the provided {@link KbqAgGridCopyFormatter}
 * or the default TSV format (with column headers).
 *
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme kbqAgGridCopyByCtrlC />
 *
 * <ag-grid-angular kbqAgGridTheme kbqAgGridCopyByCtrlC [kbqAgGridCopyFormatter]="myFormatter" />
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridCopyByCtrlC]'
})
export class KbqAgGridCopyByCtrlC {
    private readonly grid = inject(AgGridAngular);
    private readonly shortcuts = inject(KbqAgGridShortcuts);

    /** Indicates whether the directive is enabled. */
    readonly enabled = input(true, { transform: booleanAttribute, alias: 'kbqAgGridCopyByCtrlC' });

    /** Custom formatter for clipboard content. When not provided, the default TSV format is used. */
    readonly formatter = input<KbqAgGridCopyFormatter | undefined>(undefined, {
        // eslint-disable-next-line @angular-eslint/no-input-rename
        alias: 'kbqAgGridCopyFormatter'
    });

    /** Emits the result of the clipboard copy operation. */
    readonly copied = output<KbqAgGridCopyEvent>({
        // eslint-disable-next-line @angular-eslint/no-output-rename
        alias: 'kbqAgGridCopyDone'
    });

    constructor() {
        this.grid.cellKeyDown.pipe(takeUntilDestroyed()).subscribe((event) => {
            if (this.enabled()) {
                void this.shortcuts
                    .copySelectedByCtrlC(event, this.formatter())
                    .then((result) => (result === null ? undefined : this.copied.emit(result)));
            }
        });
    }
}
