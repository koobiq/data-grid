import { Directive, Input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, combineLatest, debounceTime, filter, tap } from 'rxjs';

import { selectStream } from '@koobiq/ag-grid';
import { TableGridComponent } from '@koobiq/table-grid';
import { QuickSearchService } from './quicksearch/quicksearch.service';

@Directive({
    standalone: true,
    selector: 'kbq-table-grid[enableQuickFilter]'
})
export class DataGridQuickFilterDirective {
    @Input()
    set enableQuickFilter(value: boolean) {
        this.enabled$.next(value);
    }

    private enabled$ = new BehaviorSubject<boolean>(false);

    constructor(search: QuickSearchService, grid: TableGridComponent<any>) {
        combineLatest({
            query: selectStream(search.query$).pipe(debounceTime(500)),
            grid: grid.ready$.pipe(filter((it) => !!it)),
            enabled: this.enabled$
        })
            .pipe(
                tap(({ query, grid, enabled }) => {
                    query = enabled ? query : '';
                    grid.api.setGridOption('quickFilterText', query || '');
                })
            )
            .pipe(takeUntilDestroyed())
            .subscribe();
    }
}
