import { Routes } from '@angular/router';
import { AgentsPageComponent } from './agents-page.component';

export const ROUTES: Routes = [
    {
        path: 'table',
        pathMatch: 'full',
        redirectTo: ''
    },
    {
        path: '',
        component: AgentsPageComponent
    }
];
