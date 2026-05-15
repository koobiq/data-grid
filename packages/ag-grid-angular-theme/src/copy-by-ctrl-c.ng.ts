import { Clipboard } from '@angular/cdk/clipboard';
import { C } from '@angular/cdk/keycodes';
import { DOCUMENT } from '@angular/common';
import { booleanAttribute, Directive, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular } from 'ag-grid-angular';
import { CellKeyDownEvent, FullWidthCellKeyDownEvent, GridApi } from 'ag-grid-community';

/**
 * Custom formatter function for {@link KbqAgGridCopyByCtrlC}.
 *
 * Receives selected nodes and the grid API.
 * Returns a string that will be written to the clipboard.
 */
export type KbqAgGridCopyFormatter = (api: GridApi) => string;

/** Result of a clipboard copy operation performed by {@link KbqAgGridCopyByCtrlC}. */
export type KbqAgGridCopyEvent = {
    /** Whether the text was successfully written to the clipboard. */
    success: boolean;
    /** The text that was attempted to be copied. */
    text: string;
};

/** Formats selected rows as tab-separated values (TSV). */
export const kbqAgGridCopyFormatterTsv: KbqAgGridCopyFormatter = (api) =>
    api
        .getSelectedNodes()
        .sort((r1, r2) => (r1.rowIndex ?? 0) - (r2.rowIndex ?? 0))
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .map((row) => Object.values(row.data).join('\t'))
        .join('\n');

/** Formats selected rows as comma-separated values (CSV). */
export const kbqAgGridCopyFormatterCsv: KbqAgGridCopyFormatter = (api) =>
    api
        .getSelectedNodes()
        .sort((r1, r2) => (r1.rowIndex ?? 0) - (r2.rowIndex ?? 0))
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .map((row) => Object.values(row.data).join(','))
        .join('\n');

/** Formats selected rows as a JSON array. */
export const kbqAgGridCopyFormatterJson: KbqAgGridCopyFormatter = (api) =>
    JSON.stringify(
        api
            .getSelectedNodes()
            .sort((r1, r2) => (r1.rowIndex ?? 0) - (r2.rowIndex ?? 0))
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            .map((row) => row.data),
        null,
        2
    );

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
    private readonly clipboard = inject(Clipboard);
    private readonly document = inject(DOCUMENT);

    /** Indicates whether the directive is enabled. */
    readonly enabled = input(true, { transform: booleanAttribute, alias: 'kbqAgGridCopyByCtrlC' });

    /** Custom formatter for clipboard content. When not provided, the default TSV format is used. */
    readonly formatter = input<KbqAgGridCopyFormatter | undefined>(undefined, { alias: 'kbqAgGridCopyFormatter' });

    /** Emits the result of the clipboard copy operation. */
    readonly copied = output<KbqAgGridCopyEvent>({ alias: 'kbqAgGridCopyDone' });

    constructor() {
        this.grid.cellKeyDown.pipe(takeUntilDestroyed()).subscribe((event) => {
            if (this.enabled()) {
                void this.copySelectedByCtrlC(event, this.formatter()).then((result) =>
                    result === null ? undefined : this.copied.emit(result)
                );
            }
        });
    }

    private async copySelectedByCtrlC(
        { event, api }: CellKeyDownEvent | FullWidthCellKeyDownEvent,
        formatter: KbqAgGridCopyFormatter = kbqAgGridCopyFormatterTsv
    ): Promise<KbqAgGridCopyEvent | null> {
        if (!(event instanceof KeyboardEvent)) return null;

        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const { keyCode, metaKey, ctrlKey } = event;

        if (!(ctrlKey || metaKey) || keyCode !== C) return null;

        const selection = this.document.getSelection();

        if (selection && selection.toString().length > 0) return null;

        if (api.getSelectedNodes().length === 0) return null;

        event.preventDefault();

        const text = formatter(api);

        return new Promise((resolve) => {
            // Deferring clipboard.copy to the next tick prevents AG Grid's internal
            // keyboard handling from interfering with the clipboard operation.
            setTimeout(() => resolve({ success: this.clipboard.copy(text), text }));
        });
    }
}
