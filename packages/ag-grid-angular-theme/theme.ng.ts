import { booleanAttribute, Directive, input } from '@angular/core';

@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridTheme]',
    host: {
        class: 'ag-theme-koobiq',
        '[class.ag-theme-koobiq_disable-cell-focus-styles]': 'disableCellFocusStyles()'
    }
})
export class KbqAgGridTheme {
    /**
     * Disables ag-grid cell focus styles (e.g. border-color).
     */
    readonly disableCellFocusStyles = input(false, { transform: booleanAttribute });
}
