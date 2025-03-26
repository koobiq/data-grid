import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
    standalone: true,
    imports: [RouterModule],
    selector: 'demo-root',
    template: `
        <h1>Welcome demo</h1>
        <router-outlet></router-outlet>
    `,
    styles: ``,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {}
