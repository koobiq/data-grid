import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, isDevMode, provideZoneChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Route, Routes } from '@angular/router';
import { DevApp } from './app.ng';

const routes: Routes = [
    {
        path: '',
        loadComponent: async () => import('./overview.ng').then((m) => m.DevOverview)
    }
];

if (isDevMode()) {
    const e2eRoute: Route = {
        path: 'e2e',
        children: [
            {
                path: 'column-state',
                loadComponent: async () => import('./tests/column-state.ng').then((m) => m.DevColumnState)
            },
            {
                path: 'column-state-query-params',
                loadComponent: async () => import('./tests/column-state.ng').then((m) => m.DevColumnStateQueryParams)
            },
            {
                path: 'filter-state',
                loadComponent: async () => import('./tests/filter-state.ng').then((m) => m.DevFilterState)
            },
            {
                path: 'filter-state-query-params',
                loadComponent: async () => import('./tests/filter-state.ng').then((m) => m.DevFilterStateQueryParams)
            },
            {
                path: 'quick-filter-state',
                loadComponent: async () => import('./tests/quick-filter-state.ng').then((m) => m.DevQuickFilterState)
            },
            {
                path: 'quick-filter-state-query-params',
                loadComponent: async () =>
                    import('./tests/quick-filter-state.ng').then((m) => m.DevQuickFilterStateQueryParams)
            },
            {
                path: 'external-filter-state',
                loadComponent: async () =>
                    import('./tests/external-filter-state.ng').then((m) => m.DevExternalFilterState)
            },
            {
                path: 'external-filter-state-query-params',
                loadComponent: async () =>
                    import('./tests/external-filter-state.ng').then((m) => m.DevExternalFilterStateQueryParams)
            },
            {
                path: 'copy-by-ctrl-c',
                loadComponent: async () => import('./tests/copy-by-ctrl-c.ng').then((m) => m.DevCopyByCtrlC)
            },
            {
                path: 'to-next-row-by-tab',
                loadComponent: async () => import('./tests/to-next-row-by-tab.ng').then((m) => m.DevToNextRowByTab)
            },
            {
                path: 'select-rows-by-shift-arrow',
                loadComponent: async () =>
                    import('./tests/select-rows-by-shift-arrow.ng').then((m) => m.DevSelectRowsByShiftArrow)
            },
            {
                path: 'select-rows-by-ctrl-click',
                loadComponent: async () =>
                    import('./tests/select-rows-by-ctrl-click.ng').then((m) => m.DevSelectRowsByCtrlClick)
            },
            {
                path: 'select-rows-by-shift-click',
                loadComponent: async () =>
                    import('./tests/select-rows-by-shift-click.ng').then((m) => m.DevSelectRowsByShiftClick)
            },
            {
                path: 'row-actions',
                loadComponent: async () => import('./tests/row-actions.ng').then((m) => m.DevRowActions)
            },
            {
                path: 'column-menu',
                loadComponent: async () => import('./tests/column-menu.ng').then((m) => m.DevColumnMenu)
            },
            {
                path: 'status-bar',
                loadComponent: async () => import('./tests/status-bar.ng').then((m) => m.DevStatusBar)
            },
            {
                path: 'theme',
                loadComponent: async () => import('./tests/theme.ng').then((m) => m.DevTheme)
            },
            {
                path: 'loading-overlay',
                loadComponent: async () => import('./tests/loading-overlay.ng').then((m) => m.DevLoadingOverlay)
            },
            {
                path: 'lazy-loading',
                loadComponent: async () => import('./tests/lazy-loading.ng').then((m) => m.DevLazyLoading)
            },
            {
                path: 'infinite-selection',
                loadComponent: async () => import('./tests/infinite-selection.ng').then((m) => m.DevInfiniteSelection)
            }
        ]
    };

    routes.push(e2eRoute);
}

const appConfig: ApplicationConfig = {
    providers: [
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideHttpClient(),
        provideRouter(routes),
        provideAnimations()
    ]
};

bootstrapApplication(DevApp, appConfig).catch((error: unknown) => console.error(error));
