import { Directive } from '@angular/core';

@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridTheme]',
    host: {
        class: 'ag-theme-koobiq'
    }
})
export class KbqAgGridTheme {}
