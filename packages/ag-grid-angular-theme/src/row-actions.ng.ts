import { DOCUMENT } from '@angular/common';
import {
    ApplicationRef,
    ComponentRef,
    createComponent,
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
import { CellMouseOverEvent, GridApi, IRowNode } from 'ag-grid-community';

/** Parameters provided to an actions column component via {@link KBQ_AG_GRID_ACTIONS_COLUMN_PARAMS}. */
export type KbqAgGridRowActionsParams = {
    api: GridApi;
    node: IRowNode;
    data: unknown;
    rowIndex: number | null;
};

/**
 * Injection token that provides {@link KbqAgGridRowActionsParams} to the actions column component.
 *
 * @example
 * ```typescript
 * @Component({ ... })
 * export class MyActionsComponent {
 *     private readonly params = inject(KBQ_AG_GRID_ACTIONS_COLUMN_PARAMS);
 * }
 * ```
 */
export const KBQ_AG_GRID_ROW_ACTIONS_PARAMS = new InjectionToken<KbqAgGridRowActionsParams>(
    'KBQ_AG_GRID_ROW_ACTIONS_PARAMS'
);

/**
 * Directive that renders a custom component as an overlay on the hovered row inside ag-grid-angular.
 *
 * The component is created on `cellMouseOver` and destroyed when the mouse leaves the row or the grid.
 * It receives {@link KbqAgGridRowActionsParams} via the {@link KBQ_AG_GRID_ROW_ACTIONS_PARAMS}
 * injection token.
 *
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme [kbqAgGridRowActions]="myRowActionsComponent" />
 * ```
 */
@Directive({
    standalone: true,
    selector: 'ag-grid-angular[kbqAgGridRowActions]',
    host: {
        '(mouseleave)': 'clearOverlay()'
    }
})
export class KbqAgGridRowActions {
    private readonly grid = inject(AgGridAngular);
    private readonly applicationRef = inject(ApplicationRef);
    private readonly environmentInjector = inject(EnvironmentInjector);
    private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly document = inject(DOCUMENT);

    readonly component = input.required<Type<unknown>>({ alias: 'kbqAgGridRowActions' });

    private activeComponentRef: ComponentRef<unknown> | null = null;
    private activeWrapperElement: HTMLElement | null = null;
    private hoveredRowId: string | null = null;

    constructor() {
        this.grid.cellMouseOver
            .pipe(takeUntilDestroyed())
            .subscribe((event: CellMouseOverEvent) => this.onCellMouseOver(event));
    }

    protected clearOverlay(): void {
        if (!this.activeComponentRef || !this.activeWrapperElement) return;

        this.activeComponentRef.destroy();
        this.activeComponentRef = null;

        this.activeWrapperElement.remove();
        this.activeWrapperElement = null;
        this.hoveredRowId = null;
    }

    private onCellMouseOver(event: CellMouseOverEvent): void {
        const rowId = event.node.id ?? null;

        if (rowId === this.hoveredRowId) return;

        this.clearOverlay();

        if (event.node.rowPinned) return;

        const rowElement = this.elementRef.nativeElement.querySelector(
            `.ag-center-cols-viewport .ag-row[row-id="${rowId}"]`
        );

        if (!rowElement) return;

        this.hoveredRowId = rowId;

        const componentRef = createComponent(this.component(), {
            environmentInjector: this.environmentInjector,
            elementInjector: Injector.create({
                providers: [
                    {
                        provide: KBQ_AG_GRID_ROW_ACTIONS_PARAMS,
                        useValue: {
                            api: event.api,
                            node: event.node,
                            data: event.data,
                            rowIndex: event.rowIndex
                        } satisfies KbqAgGridRowActionsParams
                    }
                ]
            })
        });

        this.applicationRef.attachView(componentRef.hostView);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const componentElement: HTMLElement = componentRef.location.nativeElement;

        // Create wrapper element with the overlay class
        const wrapperElement = this.document.createElement('div');
        wrapperElement.classList.add('kbq-ag-grid-row-actions-overlay');
        wrapperElement.appendChild(componentElement);

        rowElement.appendChild(wrapperElement);
        this.activeComponentRef = componentRef;
        this.activeWrapperElement = wrapperElement;
    }
}
