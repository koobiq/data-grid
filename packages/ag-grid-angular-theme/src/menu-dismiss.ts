import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, NgZone } from '@angular/core';

/** Options of {@link kbqListenMenuDismiss}. */
export type KbqMenuDismissOptions = {
    /** Element of the menu. Clicks inside it do not dismiss the menu. */
    host: HTMLElement;
    /** Whether the menu is open. Events are ignored without entering the Angular zone while it is closed. */
    isOpen: () => boolean;
    /** Runs in the Angular zone on a click outside of the menu. */
    onOutsideClick: () => void;
    /** Runs in the Angular zone on an Escape key press that nothing else has handled. */
    onEscape: () => void;
};

/**
 * Dismisses a menu on a click outside of it or on Escape. The listeners live on the document outside the
 * Angular zone, so that clicks and key presses anywhere on the page do not trigger change detection; only
 * the events that dismiss an open menu enter the zone. Must be called in an injection context.
 */
export const kbqListenMenuDismiss = ({ host, isOpen, onOutsideClick, onEscape }: KbqMenuDismissOptions): void => {
    const ngZone = inject(NgZone);
    const document = inject(DOCUMENT);

    const onClick = (event: MouseEvent): void => {
        if (!isOpen()) return;

        // The event path is fixed at dispatch, so unlike `host.contains(event.target)` it still holds the
        // menu when the click's own change detection has already removed the target (e.g. an item replaced
        // by the level it opens). Overlays opened from inside the menu, such as a select dropdown in a
        // custom screen, render into the CDK overlay container and count as inside as well.
        const isInside = event
            .composedPath()
            .some(
                (target) =>
                    target === host || (target instanceof Element && target.classList.contains('cdk-overlay-container'))
            );

        if (!isInside) {
            ngZone.run(onOutsideClick);
        }
    };

    const onKeydown = (event: KeyboardEvent): void => {
        // A prevented Escape has already been handled, e.g. by a dropdown opened from a custom screen.
        if (event.key !== 'Escape' || event.defaultPrevented || !isOpen()) return;

        ngZone.run(onEscape);
    };

    ngZone.runOutsideAngular(() => {
        document.addEventListener('click', onClick);
        document.addEventListener('keydown', onKeydown);
    });

    inject(DestroyRef).onDestroy(() => {
        document.removeEventListener('click', onClick);
        document.removeEventListener('keydown', onKeydown);
    });
};
