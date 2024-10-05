import { NgModule } from '@angular/core';

import { TableGridComponent } from './table-grid.component';

const COMPONENTS = [
    TableGridComponent
];

@NgModule({
    imports: [...COMPONENTS],
    exports: [...COMPONENTS]
})
export class DataGridModule {}
