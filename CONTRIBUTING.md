# Contributing to Koobiq Data Grid

Thank you for helping improve Koobiq Data Grid. This guide explains how to report a problem, set up the repository and get a pull request merged.

Contributions are accepted under the [MIT License](LICENSE).

## Questions, bugs and ideas

- Ask questions in the [Telegram chat](https://t.me/koobiq_io) or in [GitHub Discussions](https://github.com/koobiq/angular-components/discussions) of the Koobiq components, not in issues.
- Report a bug in [GitHub Issues](https://github.com/koobiq/data-grid/issues). Search the existing issues first, and include the versions of `@koobiq/ag-grid-angular-theme`, `ag-grid-community` and Angular along with the steps to reproduce.
- Send a small change straight as a pull request: a bug fix, a visual or accessibility defect, or a correction in the docs.
- Discuss a large change in an issue before writing code: a new feature or directive, or a breaking change such as a new AG Grid major or a higher minimum version of a peer dependency.
- Report vulnerabilities privately as described in the [security policy](SECURITY.md), never in a public issue.

## Setup

- Use the Node.js version from [`.nvmrc`](.nvmrc) and the Yarn version pinned in `package.json` (`packageManager`).
- Install the dependencies: `yarn install`.
- Enable the git hooks: `yarn husky`. Before each commit they format and lint the staged files and validate the commit message.
- Install Docker to run the E2E tests: they run in the same `linux/arm64` image as in CI.
- Start the dev app: `yarn run dev:theme`, then open http://localhost:4200.

The repository layout, the architecture of the package and the full list of commands are described in [AGENTS.md](AGENTS.md).

## Making a change

1. Fork the repository, or push a branch to it if you have write access.
2. Create a branch from `main`. When pushing to this repository, do not name it `test/<name>` or `legacy/<name>`: branches `test` and `legacy` already exist, so git rejects the push.
3. Make the change along with its tests and documentation, as [Adding a Feature](AGENTS.md#adding-a-feature) lists. Do not edit `CHANGELOG.md`: it is generated at release. Yarn installs a dependency version only once it is a day old, except `@koobiq/*` (see [`.yarnrc.yml`](.yarnrc.yml)).
4. Run the checks with the same flags as CI:

    ```bash
    yarn run unit                                    # Unit tests (Jest)
    npx jest <path to spec>                          # A single spec
    yarn run build                                   # Build all projects
    yarn run prettier && yarn run stylelint --max-warnings=0 && yarn run eslint --max-warnings=0
    WORKERS=4 yarn run e2e:docker                    # E2E and screenshot tests in Docker, as CI runs them
    yarn run e2e:docker yarn playwright test <path>  # A single E2E spec in Docker
    ```

    `yarn run lint:fix` fixes what it can. Screenshots differ between operating systems: update them only with `WORKERS=4 yarn run e2e:docker:update-snapshots`, never with a run on your host. See [Testing](AGENTS.md#testing) for details.

5. Open a pull request against `main`. If the problem exists only in an older major, target its maintenance branch instead, such as `ag-grid-angular-theme-34.x`.

## Commit messages and pull request titles

commitlint checks the commit message in the `commit-msg` hook and the pull request title in CI. The rules are in the [commitlint config](.commitlintrc.js), based on `@commitlint/config-conventional`.

```
<type>(<scope>): <subject>
```

- **type**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore` or `revert`.
- **scope** (optional): `ag-grid-angular-theme`, the package directory under `packages/`, for a change to the package. Leave it out for a change to the whole repository, such as CI or tooling. `deps`, `deps-dev` and `release` are used by Dependabot and `nx release`.
- **subject**: starts with a lowercase letter and has no period at the end.
- The header is at most 120 characters. Lines of the body and footer are at most 100 characters.
- Maintainers end the subject with the tracker ticket: `(#DS-1234)`. Link a GitHub issue in the pull request description with `Closes #123`.

Examples:

```
feat(ag-grid-angular-theme): migrate theme to @koobiq/design-tokens v4 (#DS-5837)
fix(ag-grid-angular-theme): keep the bottom corners of the load error row rounded (#DS-4087)
feat(ag-grid-angular-theme)!: updated ag-grid to 35 version (#DS-5094)
chore: added npm dist-tag for patches to older majors (#DS-5094)
```

Pull requests are squash-merged, and the pull request title becomes the commit message in `main`. The release version is derived from it: `feat` releases a minor version, `fix` a patch, and the other types release nothing on their own.

- Mark a change that breaks consumers with `!` after the scope: it releases a major version. Only the title counts: the pull request description does not go into the commit, so a `BREAKING CHANGE:` paragraph there has no effect. What counts as breaking is listed in [Commit Naming](AGENTS.md#commit-naming).
- The title check runs when the pull request is opened, reopened or gets new commits, not when the title is edited. After fixing the title, push a commit or close and reopen the pull request: re-running the failed check tests the old title.

## Pull requests

- Describe what changed and why, and how to check it.
- Keep one change per pull request: it becomes one commit in `main`.
- Open unfinished work as a [draft](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests#draft-pull-requests) and mark it **Ready for review** when it is done.
- Reviewers are requested automatically from [CODEOWNERS](.github/CODEOWNERS), but not while the pull request is a draft.
- CI runs the build, linters, unit and E2E tests, the title check and CodeQL. On your first pull request from a fork, the workflows may wait until a maintainer approves them.
- When the E2E tests fail, the Playwright report is in the `playwright-report` artifact of the workflow run.
- Keep the branch up to date with the target branch by merging or rebasing it locally: a pull request with conflicts gets no CI runs at all.
- Pull requests from branches of this repository get a preview of the dev app, and a maintainer can comment `/approve-snapshots` to have CI update the screenshots. Pull requests from forks get neither.

## Ready to merge

A maintainer squash-merges the pull request after a review, when:

- CI is green, including the commitlint check of the title;
- the review comments are addressed;
- it has no conflicts with the target branch.

A branch of this repository is deleted automatically after the merge; a branch in a fork is not.
