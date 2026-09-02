import '@testing-library/jest-dom';
import failOnConsole from 'jest-fail-on-console';
import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv();

failOnConsole();
