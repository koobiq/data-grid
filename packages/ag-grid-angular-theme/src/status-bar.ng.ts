import {
    ApplicationRef,
    createComponent,
    DestroyRef,
    Directive,
    ElementRef,
    EnvironmentInjector,
    inject,
    InjectionToken,
    Injector,
    input,
    Type
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular } from 'ag-grid-angular';
import { GridApi, GridReadyEvent } from 'ag-grid-community';

/** Parameters provided to a status bar component via {@link KBQ_AG_GRID_STATUS_BAR_PARAMS}. */
export type KbqAgGridStatusBarParams = {
    api: GridApi;
};

/**
 * Injection token that provides {@link KbqAgGridStatusBarParams} to the status bar component.
 *
 * @example
 * ```typescript
 * @Component({ ... })
 * export class MyStatusBarComponent {
 *     private readonly params = inject(KBQ_AG_GRID_STATUS_BAR_PARAMS);
 * }
 * ```
 */
export const KBQ_AG_GRID_STATUS_BAR_PARAMS = new InjectionToken<KbqAgGridStatusBarParams>(
    'KBQ_AG_GRID_STATUS_BAR_PARAMS'
);

/**
 * Directive that renders a custom component as a status bar inside ag-grid-angular.
 *
 * The component is injected into the grid DOM below the grid body and above the pagination panel.
 * It receives {@link KbqAgGridStatusBarParams} via the {@link KBQ_AG_GRID_STATUS_BAR_PARAMS} injection token.
 *
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme [kbqAgGridStatusBar]="myStatusBarComponent" />
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridStatusBar]'
})
export class KbqAgGridStatusBar {
    private readonly grid = inject(AgGridAngular);
    private readonly applicationRef = inject(ApplicationRef);
    private readonly environmentInjector = inject(EnvironmentInjector);
    private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly destroyRef = inject(DestroyRef);

    readonly component = input.required<Type<unknown>>({ alias: 'kbqAgGridStatusBar' });

    constructor() {
        this.grid.gridReady.pipe(takeUntilDestroyed()).subscribe((event: GridReadyEvent) => this.init(event.api));
    }

    private init(api: GridApi): void {
        const componentRef = createComponent(this.component(), {
            environmentInjector: this.environmentInjector,
            elementInjector: Injector.create({
                providers: [{ provide: KBQ_AG_GRID_STATUS_BAR_PARAMS, useValue: { api } }]
            })
        });

        this.applicationRef.attachView(componentRef.hostView);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const componentElement: HTMLElement = componentRef.location.nativeElement;
        const { nativeElement } = this.elementRef;
        const rootWrapper = nativeElement.querySelector('.ag-root-wrapper');
        const pagingPanel = nativeElement.querySelector('.ag-paging-panel');

        if (pagingPanel) {
            rootWrapper?.insertBefore(componentElement, pagingPanel);
        } else {
            rootWrapper?.appendChild(componentElement);
        }

        this.destroyRef.onDestroy(() => {
            componentRef.destroy();
            componentElement.remove();
        });
    }
}
