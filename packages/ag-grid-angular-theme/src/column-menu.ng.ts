import { CdkTrapFocus } from '@angular/cdk/a11y';
import { SharedResizeObserver } from '@angular/cdk/observers/private';
import { DOCUMENT } from '@angular/common';
import {
    ApplicationRef,
    ChangeDetectionStrategy,
    Component,
    ComponentRef,
    createComponent,
    DestroyRef,
    Directive,
    ElementRef,
    EnvironmentInjector,
    inject,
    Injector,
    input,
    OnDestroy,
    signal,
    viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular } from 'ag-grid-angular';
import { merge } from 'rxjs';
import {
    KBQ_AG_GRID_COLUMN_MENU_LABELS,
    KbqAgGridColumnMenuLabels,
    kbqAgGridColumnMenuLabelsProvider
} from './column-menu-types';
import { KbqAgGridColumnsPanel } from './columns-panel.ng';
import { kbqListenMenuDismiss } from './menu-dismiss';
import { KBQ_AG_GRID_SETTINGS_MENU_PARAMS, KbqAgGridSettingsMenuParams } from './settings-menu-types';

export * from './column-menu-types';

let columnMenuInstanceCount = 0;

@Component({
    selector: 'kbq-ag-grid-column-menu-panel',
    imports: [CdkTrapFocus, KbqAgGridColumnsPanel],
    standalone: true,
    template: `
        <div class="kbq-column-menu">
            <button
                #columnMenuTrigger
                class="kbq-column-menu-trigger"
                type="button"
                aria-haspopup="dialog"
                [class.kbq-column-menu-trigger_active]="isOpen()"
                [attr.aria-label]="labels.title"
                [attr.aria-expanded]="isOpen()"
                (click)="toggle()"
            >
                <i class="kbq kbq-icon kbq-sliders_16"></i>
            </button>

            @if (isOpen()) {
                <div
                    class="kbq-column-menu-panel"
                    role="dialog"
                    cdkTrapFocus
                    cdkTrapFocusAutoCapture="true"
                    [attr.aria-labelledby]="panelTitleId"
                >
                    <kbq-ag-grid-columns-panel showFooter [title]="labels.title" [titleId]="panelTitleId" />
                </div>
            }
        </div>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'kbq-ag-grid-column-menu-panel'
    }
})
class KbqAgGridColumnMenuComponent {
    private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
    protected readonly labels = inject(KBQ_AG_GRID_COLUMN_MENU_LABELS);
    protected readonly panelTitleId = `kbq-column-menu-title-${++columnMenuInstanceCount}`;
    private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('columnMenuTrigger');
    protected readonly isOpen = signal(false);

    constructor() {
        kbqListenMenuDismiss({
            host: this.elementRef.nativeElement,
            isOpen: this.isOpen,
            onOutsideClick: () => this.close(),
            onEscape: () => {
                this.close();
                this.trigger().nativeElement.focus();
            }
        });
    }

    protected toggle(): void {
        this.isOpen.update((v) => !v);
    }

    /** Closes the column management panel. */
    close(): void {
        this.isOpen.set(false);
    }
}

/**
 * Directive that renders a built-in column management panel as an always-visible button
 * in the top-right corner of ag-grid-angular.
 *
 * The panel allows users to toggle column visibility, reorder columns via drag-and-drop,
 * and pin columns to the left or right.
 *
 * @deprecated Will be removed in next major release. Use `KbqAgGridSettingsMenu` instead: it renders the
 * same panel as the `Columns` item of the `Table settings` menu and additionally supports sorting and
 * custom items.
 *
 * @example
 * ```html
 * <ag-grid-angular kbqAgGridTheme kbqAgGridColumnMenu [kbqAgGridColumnMenuLabels]="labels" />
 * ```
 */
@Directive({
    selector: 'ag-grid-angular[kbqAgGridColumnMenu]',
    standalone: true
})
export class KbqAgGridColumnMenu implements OnDestroy {
    private readonly grid = inject(AgGridAngular);
    private readonly applicationRef = inject(ApplicationRef);
    private readonly environmentInjector = inject(EnvironmentInjector);
    private readonly injector = inject(Injector);
    private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly destroyRef = inject(DestroyRef);
    private readonly sharedResizeObserver = inject(SharedResizeObserver);
    private readonly document = inject(DOCUMENT);
    readonly labels = input<KbqAgGridColumnMenuLabels | undefined>(undefined, { alias: 'kbqAgGridColumnMenuLabels' });

    private activeComponentRef: ComponentRef<KbqAgGridColumnMenuComponent> | null = null;
    private activeWrapperElement: HTMLElement | null = null;

    constructor() {
        merge(this.grid.gridReady, this.grid.newColumnsLoaded)
            .pipe(takeUntilDestroyed())
            .subscribe(() => this.refreshOverlay());

        this.observePanelMaxHeight();
    }

    ngOnDestroy(): void {
        this.clearOverlay();
    }

    private observePanelMaxHeight(): void {
        const { nativeElement } = this.elementRef;
        this.sharedResizeObserver
            .observe(nativeElement)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
                const header = nativeElement.querySelector<HTMLElement>('.ag-header');
                const available = Math.max(0, nativeElement.clientHeight - (header?.offsetHeight ?? 0));
                nativeElement.style.setProperty('--kbq-column-menu-panel-max-height', `${available}px`);
            });
    }

    private refreshOverlay(): void {
        this.clearOverlay();

        const { api } = this.grid;

        const labels = this.labels();

        // The panel closes itself, so the params handed to the columns panel delegate to the component
        // that is created right below — hence the mutable reference rather than a direct call.
        let componentRef: ComponentRef<KbqAgGridColumnMenuComponent> | null = null;
        const params: KbqAgGridSettingsMenuParams = {
            api,
            back: () => componentRef?.instance.close(),
            close: () => componentRef?.instance.close(),
            // The panel keeps its own reset button in the footer, so there is no header reset button to register.
            setResetHandler: () => () => undefined
        };

        componentRef = createComponent(KbqAgGridColumnMenuComponent, {
            environmentInjector: this.environmentInjector,
            elementInjector: Injector.create({
                parent: this.injector,
                providers: [
                    { provide: KBQ_AG_GRID_SETTINGS_MENU_PARAMS, useValue: params },
                    ...(labels ? [kbqAgGridColumnMenuLabelsProvider(labels)] : [])
                ]
            })
        });

        this.applicationRef.attachView(componentRef.hostView);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const componentElement: HTMLElement = componentRef.location.nativeElement;

        const wrapperElement = this.document.createElement('div');
        wrapperElement.classList.add('kbq-ag-grid-column-menu-overlay');
        wrapperElement.appendChild(componentElement);

        this.elementRef.nativeElement.appendChild(wrapperElement);
        this.activeComponentRef = componentRef;
        this.activeWrapperElement = wrapperElement;
    }

    private clearOverlay(): void {
        if (!this.activeComponentRef || !this.activeWrapperElement) return;

        this.activeComponentRef.destroy();
        this.activeComponentRef = null;

        this.activeWrapperElement.remove();
        this.activeWrapperElement = null;
    }
}
