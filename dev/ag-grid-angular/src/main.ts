import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { DevApp } from './app.ng';

const appConfig: ApplicationConfig = {
    providers: [
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideHttpClient(),
        provideRouter([
            { path: '', loadComponent: async () => import('./overview.ng').then((m) => m.DevOverview) },
            {
                path: 'e2e',
                children: [
                    {
                        path: 'column-state',
                        loadComponent: async () => import('./tests/column-state.ng').then((m) => m.DevColumnState)
                    },
                    {
                        path: 'column-state-query-params',
                        loadComponent: async () =>
                            import('./tests/column-state-query-params.ng').then((m) => m.DevColumnStateQueryParams)
                    },
                    {
                        path: 'filter-state',
                        loadComponent: async () => import('./tests/filter-state.ng').then((m) => m.DevFilterState)
                    },
                    {
                        path: 'filter-state-query-params',
                        loadComponent: async () =>
                            import('./tests/filter-state-query-params.ng').then((m) => m.DevFilterStateQueryParams)
                    },
                    {
                        path: 'quick-filter-state',
                        loadComponent: async () =>
                            import('./tests/quick-filter-state.ng').then((m) => m.DevQuickFilterState)
                    },
                    {
                        path: 'quick-filter-state-query-params',
                        loadComponent: async () =>
                            import('./tests/quick-filter-state-query-params.ng').then(
                                (m) => m.DevQuickFilterStateQueryParams
                            )
                    }
                ]
            }
        ])
    ]
};

bootstrapApplication(DevApp, appConfig).catch((error: unknown) => console.error(error));
