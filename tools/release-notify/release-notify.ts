#!/usr/bin/env -S npx ts-node --esm
/**
 * Prints a Mattermost-ready release announcement for a git tag, reading only the
 * already-committed CHANGELOG.md — no GitHub API involved, so the notification isn't
 * gated on GitHub being reachable.
 *
 * Delegates the actual extraction to @koobiq/cli/release (isVersionLine/extractReleaseNotes,
 * parseTag, resolveChangelogPath), which understands project-scoped tags
 * ({projectName}@{version}).
 *
 * Usage: npx tsx release-notify.ts <tag>
 */
import { extractReleaseNotes, parseTag, resolveChangelogPath } from '@koobiq/cli/release';

function main(): void {
    const [, , tag] = process.argv;

    if (!tag) {
        console.error('usage: release-notify.ts <tag>');
        process.exit(1);
    }

    const parsedTag = parseTag(tag);

    // resolveChangelogPath throws for a scoped tag with no matching project changelog —
    // that shouldn't stop the release notification, just fall back to a plain message.
    let notes = null;
    try {
        notes = extractReleaseNotes(resolveChangelogPath(process.cwd(), parsedTag), parsedTag.version);
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
    }

    if (!notes) {
        console.log(`Released ${tag}`);

        return;
    }

    console.log(`${notes.releaseTitle}\n${notes.releaseNotes}`.trimEnd());
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
