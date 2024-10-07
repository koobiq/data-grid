import { Route } from '@angular/router';

export const appRoutes: Route[] = [
    { path: 'heroes', loadChildren: () => import('./pages/heroes').then((m) => m.ROUTES) },
    { path: 'agents', loadChildren: () => import('./pages/agents').then((m) => m.ROUTES) }
];
