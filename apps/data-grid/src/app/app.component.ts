import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
    standalone: true,
    imports: [RouterModule],
    selector: 'app-root',
    template: `
        <div class="relative flex min-h-screen flex-col">
            <main class="flex-1">
                <section class="grid items-center pb-8 pt-6 md:py-8 container gap-2">
                    <router-outlet></router-outlet>
                </section>
            </main>
        </div>
    `,
    styleUrl: './app.component.scss'
})
export class AppComponent {}
