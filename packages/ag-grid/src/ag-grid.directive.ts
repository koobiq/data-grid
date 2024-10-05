import { AgGridEvent, createGrid, GridApi, GridOptions, GridParams, GridReadyEvent } from '@ag-grid-community/core';
import {
    AfterViewInit,
    Directive,
    ElementRef,
    EventEmitter,
    inject,
    Input,
    NgZone,
    OnDestroy,
    Output,
    ViewContainerRef
} from '@angular/core';
import {
    defer,
    filter,
    firstValueFrom,
    map,
    Observable,
    ReplaySubject,
    shareReplay,
    skipWhile,
    switchMap,
    take,
    takeUntil
} from 'rxjs';
import { fromGridEvent } from './from-grid-event';
import { injectIsBrowser } from './utils/platform';
import { runOutsideZone } from './utils/run-in-zone';
import { AngularFrameworkComponentWrapper } from './wrapper/angular-framework-component-wrapper';
import { AngularFrameworkOverrides } from './wrapper/angular-framework-overrides';

@Directive({
    standalone: true,
    selector: '[kbqAgGrid]',
    host: {
        '[class.ag-grid]': 'true',
        '[class.ag-theme-alpine-light]': 'true'
    },
    providers: [AngularFrameworkOverrides, AngularFrameworkComponentWrapper]
})
export class AgGridDirective<T = any> implements AfterViewInit, OnDestroy {
    private readonly isBrowser = injectIsBrowser();
    private readonly zone = inject(NgZone);
    private readonly angularFrameworkOverrides = inject(AngularFrameworkOverrides);
    private readonly frameworkComponentWrapper = inject(AngularFrameworkComponentWrapper);
    private readonly viewContainerRef = inject(ViewContainerRef);
    private readonly elementRef = inject(ElementRef);

    /**
     * Sets the grid data input.
     * @param value Array of data to be used in the grid.
     */
    @Input()
    set gridData(value: T[]) {
        this.data$.next(value);
    }

    /**
     * Sets the grid options input.
     * @param value Grid options configuration object.
     */
    @Input()
    set gridOptions(value: GridOptions<T>) {
        this.options$.next(value);
    }

    @Output()
    readonly onDestroy = new ReplaySubject<void>(1);

    @Output()
    readonly onReady = defer(() => this.events.gridReady).pipe(shareReplay(1));

    /** Subject that notifies when initialization is complete */
    private readonly initialized$ = new ReplaySubject<void>(1);

    /** Subject that holds the grid data */
    protected readonly data$ = new ReplaySubject<T[]>(1);

    /** Subject that holds the grid options */
    protected readonly options$ = new ReplaySubject<GridOptions<T>>(1);

    private events = {
        gridReady: new EventEmitter<GridReadyEvent<T>>()
    };

    ngAfterViewInit() {
        if (!this.isBrowser) {
            return;
        }

        // Runs the provided function outside Angular's zone to avoid triggering change detection
        this.angularFrameworkOverrides.runOutsideAngular(() => {
            this.frameworkComponentWrapper.setViewContainerRef(this.viewContainerRef, this.angularFrameworkOverrides);
        });

        let grid: GridApi;

        this.options$
            .pipe(
                runOutsideZone(this.zone),
                map((options: any) => {
                    return {
                        animateRows: false,
                        ...(options || {}),
                        context: this
                    };
                }),
                takeUntil(this.onDestroy)
            )
            .subscribe((options) => {
                if (!grid) {
                    grid = this.createGrid(options);
                } else {
                    grid.updateGridOptions(options);
                }
            });

        this.setRawData(grid);
        this.handleOnDestroy(grid);

        this.initialized$.next();
    }

    /**
     * Creates an observable for a specific grid event.
     * @param event The event name to listen for.
     * @returns Observable that emits grid events.
     */
    onEvent(event: any): Observable<AgGridEvent<T>> {
        return fromGridEvent(this.onReady, event);
    }

    /**
     * Lifecycle hook called when the directive is destroyed.
     * Cleans up resources and completes observables.
     */
    ngOnDestroy() {
        this.onDestroy.next();
        this.onDestroy.complete();
    }

    /**
     * Subscribes to the grid's raw data stream and sets the data in the grid when available.
     * @param grid The grid API object.
     */
    private setRawData(grid: GridApi) {
        this.onReady
            .pipe(
                take(1),
                switchMap(() => this.data$),
                skipWhile((it) => it == null),
                filter((it) => it != null),
                takeUntil(this.onDestroy)
            )
            .subscribe((data: any[] | null | undefined) => {
                if (grid) {
                    grid.setGridOption('rowData', data);
                }
            });
    }

    private handleOnDestroy(grid: GridApi) {
        this.onDestroy.pipe(take(1)).subscribe(() => {
            grid?.destroy();
        });
    }

    /**
     * Creates the grid with the provided options.
     * @param options The grid options.
     * @returns The created Grid API instance.
     */
    private createGrid(options: GridOptions) {
        const params: GridParams = {
            globalEventListener: this.eventEmitter.bind(this),
            frameworkOverrides: this.angularFrameworkOverrides,
            providedBeanInstances: {
                frameworkComponentWrapper: this.frameworkComponentWrapper
            }
        };

        return createGrid(this.elementRef.nativeElement, options, params);
    }

    /**
     * Event emitter for grid events.
     * Emits grid events like 'gridReady' and others when triggered by the grid.
     * @param eventType The type of the event being emitted.
     * @param event The event object.
     */
    private eventEmitter = (eventType: string, event: any) => {
        const emitter = <EventEmitter<any>>this.events[eventType];

        if (!emitter) {
            return;
        }

        this.angularFrameworkOverrides.runInsideAngular(() => {
            if (eventType === 'gridReady') {
                firstValueFrom(this.initialized$).then(() => emitter.emit(event));
            } else {
                emitter.emit(event);
            }
        });
    };
}
