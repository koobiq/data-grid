import { Inject, Injectable, InjectionToken, Optional, Self, StaticProvider } from '@angular/core';
import { Router } from '@angular/router';
import { shareReplayRefCount } from '@koobiq/ag-grid';
import { ComponentStore } from '@ngrx/component-store';
import { tap } from 'rxjs';

export const QUICK_SEARCH_OPTIONS = new InjectionToken<QuickSearchOptions>('QUICK_SEARCH_OPTIONS', {
    providedIn: 'root',
    factory: () => ({})
});

export interface QuickSearchOptions {
    queryParam?: string;
}

export interface QuickSearchState {
    value: string;
    active: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class QuickSearchService extends ComponentStore<QuickSearchState> {
    static provider(options: QuickSearchOptions): StaticProvider[] {
        return [
            {
                provide: QUICK_SEARCH_OPTIONS,
                useValue: options
            },
            {
                provide: QuickSearchService
            }
        ];
    }

    readonly active$ = this.select((it) => it.active);
    readonly query$ = this.select((it) => it.value)
        .pipe(
            tap({
                subscribe: () => setTimeout(() => this.patchState({ active: true, value: this.getQueryParam() })),
                next: (value) => this.setQueryParam(value),
                unsubscribe: () => this.patchState({ active: false, value: '' })
            })
        )
        .pipe(shareReplayRefCount(1));

    constructor(
        @Inject(QUICK_SEARCH_OPTIONS)
        @Optional()
        @Self()
        private options: QuickSearchOptions,
        private router: Router
    ) {
        super({ value: getQueryParam(router, options), active: false });
    }

    private getQueryParam() {
        return getQueryParam(this.router, this.options);
    }

    private setQueryParam(value: string) {
        if (!this.options?.queryParam) {
            return;
        }
        const params = this.router.parseUrl(this.router.url).queryParams || {};
        if (!value) {
            delete params[this.options.queryParam];
        } else {
            params[this.options.queryParam] = encodeURIComponent(value);
        }
        this.router.navigate([], {
            queryParams: params,
            replaceUrl: true
        });
    }
}

function getQueryParam(router: Router, options: QuickSearchOptions) {
    if (!options?.queryParam) {
        return '';
    }
    const value = router.parseUrl(router.url).queryParamMap.get(options.queryParam);
    return value ? decodeURIComponent(value) : '';
}
