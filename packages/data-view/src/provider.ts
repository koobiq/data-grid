import { ClassProvider, FactoryProvider, inject, InjectOptions, StaticProvider, Type } from '@angular/core';
import {
    DATA_VIEW_ADAPTER_OPTIONS,
    DataViewAdapter,
    DataViewAdapterOptions,
    DataViewDefaultAdapter
} from './data-view.adapter';
import { DataViewService } from './data-view.service';

export type DataViewProvideOptions<T> =
    | {
          adapter: Type<DataViewAdapter<T>>;
      }
    | {
          adapter: Type<DataViewAdapter<T>>;
          factory: () => DataViewAdapterOptions<T>;
      }
    | (DataViewAdapterOptions<T> & { adapter?: Type<DataViewAdapter<T>> });

/**
 * Injects the DataViewAdapterOptions using Angular's inject method.
 *
 * @param injectOptions - Optional inject options.
 * @typeparam T - The type of data managed by the data view.
 * @returns The injected DataViewAdapterOptions.
 */
export function injectDataViewAdapterOptions<T>(injectOptions?: InjectOptions) {
    return inject<DataViewAdapterOptions<T>>(DATA_VIEW_ADAPTER_OPTIONS, injectOptions);
}

/**
 * Provides the necessary static providers for the DataView service, adapter, and options.
 *
 * @param options - Options to configure the data view provider, including adapter and factory.
 * @typeparam T - The type of data managed by the data view.
 * @returns An array of providers to be used in Angular's dependency injection system.
 */
export function provideDataView<T>(
    options: DataViewProvideOptions<T>
): Array<StaticProvider | ClassProvider | FactoryProvider> {
    const adapter = options.adapter || DataViewDefaultAdapter;

    const providers: Array<StaticProvider | ClassProvider | FactoryProvider> = [
        {
            provide: adapter
        },
        {
            provide: DataViewAdapter,
            useExisting: adapter
        },
        {
            provide: DataViewService,
            useClass: DataViewService
        }
    ];

    if ('factory' in options) {
        providers.push({
            provide: DATA_VIEW_ADAPTER_OPTIONS,
            useFactory: options.factory
        });
    } else {
        providers.push({
            provide: DATA_VIEW_ADAPTER_OPTIONS,
            useValue: options
        });
    }

    return providers;
}
