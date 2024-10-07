import { Routes } from '@angular/router';
import { HeroesPageComponent } from './heroes-page.component';

export const ROUTES: Routes = [
    {
        path: 'table',
        pathMatch: 'full',
        redirectTo: ''
    },
    {
        path: '',
        component: HeroesPageComponent
    }
];
