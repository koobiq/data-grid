import { NgModule } from '@angular/core';
import { KbqAgGridColumnState } from '../column-state.ng';
import { KbqAgGridCopyByCtrlC } from './copy-by-ctrl-c.ng';
import { KbqAgGridRowActions } from './row-actions.ng';
import { KbqAgGridSelectAllRowsByCtrlA } from './select-all-rows-by-ctrl-a.ng';
import { KbqAgGridSelectRowsByCtrlClick } from './select-rows-by-ctrl-click.ng';
import { KbqAgGridSelectRowsByShiftArrow } from './select-rows-by-shift-arrow.ng';
import { KbqAgGridSelectRowsByShiftClick } from './select-rows-by-shift-click.ng';
import { KbqAgGridShortcuts } from './shortcuts.ng';
import { KbqAgGridStatusBar } from './status-bar.ng';
import { KbqAgGridTheme } from './theme.ng';
import { KbqAgGridToNextRowByTab } from './to-next-row-by-tab.ng';

const COMPONENTS = [
    KbqAgGridTheme,
    KbqAgGridToNextRowByTab,
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    KbqAgGridSelectAllRowsByCtrlA,
    KbqAgGridSelectRowsByShiftArrow,
    KbqAgGridSelectRowsByShiftClick,
    KbqAgGridSelectRowsByCtrlClick,
    KbqAgGridCopyByCtrlC,
    KbqAgGridStatusBar,
    KbqAgGridRowActions,
    KbqAgGridColumnState
];

@NgModule({
    imports: COMPONENTS,
    exports: COMPONENTS,
    providers: [KbqAgGridShortcuts]
})
export class KbqAgGridThemeModule {}
