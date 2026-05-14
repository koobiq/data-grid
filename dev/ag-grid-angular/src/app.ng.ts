import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
    standalone: true,
    imports: [RouterOutlet],
    selector: 'dev-root',
    template: `
        <router-outlet />
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevApp {}
