import { BaseComponentWrapper, FrameworkComponentWrapper, WrappableInterface } from '@ag-grid-community/core';
import { ComponentRef, Injectable, ViewContainerRef } from '@angular/core';
import { AngularFrameworkOverrides } from './angular-framework-overrides';
import { AgFrameworkComponent } from './interfaces';

@Injectable()
export class AngularFrameworkComponentWrapper
    extends BaseComponentWrapper<WrappableInterface>
    implements FrameworkComponentWrapper
{
    private viewContainerRef: ViewContainerRef | undefined;
    private angularFrameworkOverrides: AngularFrameworkOverrides | undefined;

    setViewContainerRef(viewContainerRef: ViewContainerRef, angularFrameworkOverrides: AngularFrameworkOverrides) {
        this.viewContainerRef = viewContainerRef;
        this.angularFrameworkOverrides = angularFrameworkOverrides;
    }

    createWrapper(OriginalConstructor: { new (): any }, compType: any): WrappableInterface {
        let angularFrameworkOverrides = this.angularFrameworkOverrides;
        let that = this;

        class DynamicAgNg2Component
            extends BaseGuiComponent<any, AgFrameworkComponent<any>>
            implements WrappableInterface
        {
            override init(params: any): void {
                angularFrameworkOverrides?.runInsideAngular(() => {
                    super.init(params);
                    this._componentRef?.changeDetectorRef.detectChanges();
                });
            }

            protected createComponent(): ComponentRef<AgFrameworkComponent<any>> | undefined {
                return angularFrameworkOverrides?.runInsideAngular(() => that.createComponent(OriginalConstructor));
            }

            hasMethod(name: string): boolean {
                return wrapper.getFrameworkComponentInstance()[name] != null;
            }

            callMethod(name: string, args: IArguments): void {
                const componentRef = this.getFrameworkComponentInstance();
                return angularFrameworkOverrides?.runInsideAngular(() =>
                    wrapper.getFrameworkComponentInstance()[name].apply(componentRef, args)
                );
            }

            addMethod(name: string, callback: Function): void {
                (wrapper as any)[name] = callback;
            }
        }

        let wrapper = new DynamicAgNg2Component();
        return wrapper;
    }

    createComponent<T>(componentType: { new (...args: any[]): T }): ComponentRef<T> | undefined {
        return this.viewContainerRef?.createComponent(componentType);
    }
}

abstract class BaseGuiComponent<P, T extends AgFrameworkComponent<P>> {
    protected _params: P | undefined;
    protected _eGui: HTMLElement | null = null;
    protected _componentRef: ComponentRef<T> | undefined;
    protected _agAwareComponent: T | undefined;
    protected _frameworkComponentInstance: any; // the users component - for accessing methods they create

    protected abstract createComponent(): ComponentRef<T> | undefined;

    protected init(params: P): void {
        this._params = params;

        this._componentRef = this.createComponent();
        this._agAwareComponent = this._componentRef?.instance;
        this._frameworkComponentInstance = this._componentRef?.instance;
        this._eGui = this._componentRef?.location.nativeElement;

        this._agAwareComponent?.agInit(this._params);
    }

    getGui(): HTMLElement | null {
        return this._eGui;
    }

    /** `getGui()` returns the `ng-component` element. This returns the actual root element. */
    getRootElement(): HTMLElement {
        const firstChild = this._eGui?.firstChild;
        return firstChild as HTMLElement;
    }

    destroy(): void {
        if (this._frameworkComponentInstance && typeof this._frameworkComponentInstance.destroy === 'function') {
            this._frameworkComponentInstance.destroy();
        }
        if (this._componentRef) {
            this._componentRef.destroy();
        }
    }

    getFrameworkComponentInstance(): any {
        return this._frameworkComponentInstance;
    }
}
