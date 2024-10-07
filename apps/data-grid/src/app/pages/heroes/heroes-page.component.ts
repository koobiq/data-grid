import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DataViewService, provideDataView } from '@koobiq/data-view';
import { DataGridModule } from '@koobiq/table-grid';
import { HeroesTableAdapter } from './heroes-table-adapter';

@Component({
    selector: 'app-heroes-page',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        DataGridModule
    ],
    providers: [
        provideDataView({
            adapter: HeroesTableAdapter
        })

    ],
    styles: `
        .heroes-page {
            left: 100px;
            right: 100px;
            top: 60px;
            bottom: 100px;
            display: flex;
            position: absolute;
            flex-direction: column;
            justify-content: space-between;
            contain: layout size style;
            z-index: 0;
        }
    `,
    template: `
        <div class="heroes-page">
            <kbq-table-grid
                [data]="service.items$ | async"
                [options]="service.tableGridOptions"
                [persistKey]="persistKey"
                (ready$)="service.onTableReady($event)"
            />
        </div>
    `
})
export class HeroesPageComponent {
    protected readonly service = inject(DataViewService<ItemTableRecord>);

    protected persistKey = 'heroes-table';

    constructor() {
        this.service.patchState({});
    }
}

export type ItemTableRecord = {
    $source?: string;
};
