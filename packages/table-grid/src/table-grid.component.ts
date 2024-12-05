import { AgGridEvent, GridApi, GridOptions, RowClickedEvent } from '@ag-grid-community/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    inject,
    Input,
    NgZone,
    OnInit,
    Output,
    ViewChild
} from '@angular/core';
import { AgGrid, AgGridDirective, gridGetPinnedTopData, runInZone } from '@koobiq/ag-grid';
import { RowSelectionOptions } from 'ag-grid-community';
import { isEqual } from 'lodash';
import { combineLatest, debounceTime, filter, map, merge, ReplaySubject, skip, switchMap, takeUntil, tap } from 'rxjs';
import { TableGridPersistenceService } from './table-grid-persistence.service';
import { TableGridStore } from './table-grid.store';

export interface SelectionChangeEvent<T> {
    rows: T[];
    ids: Array<string | number>;
}

@Component({
    standalone: true,
    selector: 'kbq-table-grid',
    exportAs: 'tableGrid',
    templateUrl: './table-grid.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, AgGridDirective],
    providers: [TableGridStore, TableGridPersistenceService],
    host: {
        class: 'flex-1 h-full w-full relative'
    },
    animations: [
        trigger('fade', [
            transition(':leave', [style({ opacity: 1 }), animate('0.150s 0.3s ease-out', style({ opacity: 0 }))])
        ])

    ]
})
export class TableGridComponent<T> implements OnInit {
    private readonly zone = inject(NgZone);
    private readonly persistence = inject(TableGridPersistenceService);

    protected readonly store = inject(TableGridStore<T>);

    @Input({ transform: (value: unknown): T[] => value as T[] })
    set data(value: T[]) {
        this.store.patchState({ gridData: value });
    }

    @Input()
    set options(value: GridOptions<T>) {
        this.store.patchState({ gridOptions: value });
    }

    @Input()
    set rawSelection(value: RowSelectionOptions | 'single' | 'multiple') {
        this.store.patchState({ rawSelection: value });
    }

    @Input()
    set selection(value: Array<string | number>) {
        this.store.patchState({ selection: value });
    }

    @Input()
    set identifyBy(value: (item: T) => string | number) {
        this.store.patchState({ identifyBy: value });
    }

    @Input()
    persistKey: string;

    @Output()
    readonly rowDoubleClicked$ = new EventEmitter<T>();

    @Output()
    readonly ready$ = new ReplaySubject<AgGrid<T>>(1);

    @Output()
    readonly selectionChanged$ = new EventEmitter<SelectionChangeEvent<T>>();

    @ViewChild(AgGridDirective, { static: true })
    readonly grid: AgGridDirective<T>;

    protected gridData$ = this.store.gridData$;

    protected rawSelection$ = this.store.rawSelection$;
    protected gridOptions$ = this.store.gridOptions$.pipe(map(selectGridOptions));

    async ngOnInit() {
        this.attachBootloader();
        this.attachPersistence();
        this.attachPinBinding();
        this.attachAutoRefresh();
        this.attachSelectionBinding();
    }

    private attachBootloader() {
        this.ready$.pipe(takeUntil(this.store.destroy$)).subscribe((grid) => {
            this.store.patchState({ grid: grid, hasLoaded: true });
        });
    }

    private attachAutoRefresh() {
        this.ready$
            .pipe(skip(1)) // skip initial value
            .pipe(takeUntil(this.store.destroy$))
            .subscribe(({ api }) => {
                // force quick filter cache reset
                api.resetQuickFilter();
                // force column filter cache reset
                api.getColumns().forEach((it) => {
                    api.destroyFilter(it.getColId());
                });
            });
    }

    private attachPersistence() {
        const persistenceStreams = merge(
            this.grid.onReady.pipe(
                switchMap(async (e) => {
                    await this.persistence.restoreState(e.api, this.persistKey).catch(console.error);
                    this.ready$.next(e);
                })
            ),
            merge(this.grid.onEvent('firstDataRendered'), this.grid.onEvent('rowDataChanged')).pipe(
                tap(({ api }) => {
                    this.persistence.loadPinnedState(api, this.persistKey, this.store.identifyBy$());
                })
            ),
            this.grid.onEvent('pinnedRowDataChanged').pipe(
                debounceTime(500),
                tap(({ api }) => this.persistence.savePinnedState(api, this.persistKey, this.store.identifyBy$()))
            ),
            merge(
                this.grid.onEvent('columnMoved'),
                this.grid.onEvent('columnPinned'),
                this.grid.onEvent('columnVisible'),
                this.grid.onEvent('columnResized'),
                this.grid.onEvent('sortChanged')
            )
                .pipe(debounceTime(500))
                .pipe(tap(({ api }: AgGridEvent) => this.persistence.saveColumnState(api, this.persistKey))),
            this.grid.onEvent('filterChanged').pipe(
                debounceTime(500),
                tap(({ api }: AgGridEvent) => this.persistence.saveFilterState(api, this.persistKey))
            )
        );

        persistenceStreams.pipe(takeUntil(this.store.destroy$)).subscribe();
    }

    private attachPinBinding() {
        this.grid
            .onEvent('pinnedRowDataChanged')
            .pipe(
                runInZone(this.zone),
                tap(({ api }) => {
                    const identifyBy = this.store.identifyBy$();
                    const rows = gridGetPinnedTopData(api);
                    const ids = identifyBy ? rows.map(identifyBy) : null;
                    this.store.patchState({ pinned: ids });
                }),
                takeUntil(this.store.destroy$)
            )
            .subscribe();

        this.grid
            .onEvent('rowClicked')
            .pipe(
                filter((item: RowClickedEvent) => !!item.rowPinned),
                takeUntil(this.store.destroy$)
            )
            .subscribe((e: RowClickedEvent) => {
                e.api.forEachNode((it) => {
                    if (it.data === e.data) {
                        it.setSelected(true, true, 'api');
                        e.api.ensureNodeVisible(it, 'middle');
                    }
                });
            });
    }

    private attachSelectionBinding() {
        this.grid
            .onEvent('rowDoubleClicked')
            .pipe(
                filter((item: RowClickedEvent) => !item.rowPinned),
                takeUntil(this.store.destroy$)
            )
            .subscribe((e: RowClickedEvent) => {
                this.rowDoubleClicked$.emit(e.data);
            });

        // pull selection from grid -> store
        this.grid
            .onEvent('selectionChanged')
            .pipe(
                filter((event) => !!(event as any).source),
                runInZone(this.zone),
                tap(({ api }) => {
                    const identifyBy = this.store.identifyBy$();
                    const rows = api.getSelectedRows();
                    const ids = identifyBy ? rows.map(identifyBy) : null;

                    this.store.patchState({ selection: ids });
                    this.selectionChanged$.emit({ rows, ids });
                }),
                takeUntil(this.store.destroy$)
            )
            .subscribe();

        // sync selection from store -> grid
        combineLatest({
            selection: this.store.selection$,
            change: merge(this.grid.onEvent('firstDataRendered'), this.grid.onEvent('rowDataUpdated')),
            grid: this.ready$
        })
            .pipe(runInZone(this.zone), debounceTime(0), takeUntil(this.store.destroy$))
            .subscribe(({ selection, grid }) => {
                this.syncSelection({
                    toSelect: selection,
                    ensureVisible: true,
                    api: grid.api
                });
            });
    }

    private syncSelection({
        toSelect,
        api,
        ensureVisible
    }: {
        toSelect: Array<string | number>;
        api: GridApi;
        ensureVisible?: boolean;
    }) {
        const identifyBy = this.store.identifyBy$();
        if (!api || !identifyBy) {
            return;
        }

        const selectedRowIds = api.getSelectedRows().map(identifyBy);
        if (isEqual(toSelect, selectedRowIds)) return;

        api.forEachNode((it) => {
            if (toSelect && toSelect.includes(identifyBy(it.data))) {
                it.setSelected(true, false, null);
            } else if (it.isSelected()) {
                it.setSelected(false, false, null);
            }
        });

        if (ensureVisible) {
            const selectedNode = api.getSelectedNodes()?.[0];
            if (selectedNode) api.ensureNodeVisible(selectedNode, 'middle');
        }
    }
}

const OVERLAY_NO_ROWS = `
  <div class="alert shadow-lg max-w-[300px]">
    <div>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-info flex-shrink-0 w-6 h-6">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      <span>No rows to show</span>
    </div>
  </div>
`;

function selectGridOptions(options: GridOptions) {
    options = options || {};
    return {
        ...options,
        suppressColumnMoveAnimation: true,
        rowBuffer: options.rowBuffer ?? 0,
        rowHeight: options.rowHeight ?? 40,
        headerHeight: options.headerHeight ?? 40,
        rowSelection: options.rowSelection ?? 'single',
        suppressCellFocus: options.suppressCellFocus ?? false,
        enableCellTextSelection: options.enableCellTextSelection ?? true,
        suppressMenuHide: options.suppressMenuHide ?? true,
        overlayLoadingTemplate: options.overlayLoadingTemplate,
        overlayNoRowsTemplate: options.overlayNoRowsTemplate ?? OVERLAY_NO_ROWS,
        defaultColDef: options.defaultColDef ?? {
            resizable: true,
            sortable: true,
            filter: false
        },
        includeHiddenColumnsInQuickFilter: options.includeHiddenColumnsInQuickFilter ?? true,
        cacheQuickFilter: true
    } satisfies GridOptions;
}
