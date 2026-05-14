import { Page } from '@playwright/test';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const enableDarkTheme = async (page: Page): Promise<void> =>
    page.evaluate(() => {
        document.body.classList.remove('kbq-light');
        document.body.classList.add('kbq-dark');
    });
