import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { DevApp } from './app.ng';

const appConfig: ApplicationConfig = {
    providers: [provideZoneChangeDetection({ eventCoalescing: true }), provideHttpClient()]
};

bootstrapApplication(DevApp, appConfig).catch((error: unknown) => console.error(error));
