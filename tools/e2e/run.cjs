// Runs E2E tests in Docker, injecting the Playwright version from package.json
// so the Docker image tag always matches the installed @playwright/test version.

const timeLabel = 'Runtime';

console.time(timeLabel);

const { spawnSync } = require('child_process');
const { devDependencies } = require('../../package.json');

// Read from package.json directly — node_modules may not exist on the CI runner (no yarn install step).
const version = devDependencies['@playwright/test']?.replace(/[\^~]/, '');

if (!version) {
    console.error('@playwright/test version not found in package.json');
    process.exit(1);
}

console.info(`Playwright version: ${version}`);

const result = spawnSync(
    'docker',
    ['compose', '--file', 'tools/e2e/docker-compose.yml', 'run', '--rm', '--build', 'e2e', ...process.argv.slice(2)],
    { stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_VERSION: version } }
);

if (result.error) {
    console.error(`Failed to run docker: ${result.error.message}`);
} else if (result.status !== 0) {
    console.info('To view the test report, run: `npx playwright show-report`');
}

console.timeEnd(timeLabel);

process.exit(result.status ?? 1);
