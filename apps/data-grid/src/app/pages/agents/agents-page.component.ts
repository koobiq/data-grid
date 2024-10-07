import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DataViewService, provideDataView } from '@koobiq/data-view';
import { DataGridModule } from '@koobiq/table-grid';
import { AgentsTableAdapter } from './agents-table-adapter';

@Component({
    selector: 'app-agents-page',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        DataGridModule
    ],
    providers: [
        provideDataView({
            adapter: AgentsTableAdapter
        })

    ],
    styles: `
        .agents-page {
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
        <div class="agents-page">
            <kbq-table-grid
                [data]="service.items$ | async"
                [options]="service.tableGridOptions"
                [persistKey]="persistKey"
                (ready$)="service.onTableReady($event)"
            />
        </div>
    `
})
export class AgentsPageComponent {
    protected readonly service = inject(DataViewService<ItemTableRecord>);

    protected persistKey = 'agents-table';

    constructor() {
        this.service.patchState({});
    }
}

export type ItemTableRecord = {
    $source?: string;
};
