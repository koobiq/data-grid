import * as assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

// The extraction logic itself (isVersionLine/extractReleaseNotes/parseTag/resolveChangelogPath)
// is tested in @koobiq/cli. This only smoke-tests that the wrapper script is wired to it
// correctly against this repo's real CHANGELOG.md.
const SCRIPT_PATH = fileURLToPath(new URL('./release-notify.ts', import.meta.url));

const run = (tag: string): string =>
    execFileSync('npx', ['ts-node', '--esm', SCRIPT_PATH, tag], { encoding: 'utf8', cwd: process.cwd() });

void describe('release-notify.ts', () => {
    void it('prints the release title and notes for a known tag', () => {
        const output = run('ag-grid-angular-theme@34.3.1');

        assert.match(output, /^## 34\.3\.1 \(2026-05-15\)/);
        assert.match(output, /path to theme\.scss/);
    });

    void it('falls back to a plain message for a tag with no changelog entry', () => {
        const output = run('ag-grid-angular-theme@99.0.0');

        assert.equal(output.trim(), 'Released ag-grid-angular-theme@99.0.0');
    });

    void it('falls back to a plain message for a scoped tag with no project changelog', () => {
        const output = run('no-such-project@1.0.0');

        assert.equal(output.trim(), 'Released no-such-project@1.0.0');
    });
});
