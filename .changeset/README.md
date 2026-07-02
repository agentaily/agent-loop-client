# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets). It is how the version and the CHANGELOG are decided.

## Adding a changeset

When you make a change worth releasing, run:

```bash
npm run changeset
```

Pick the bump type (patch / minor / major) and write a one-line summary. This drops a markdown file in `.changeset/`. Commit it with your PR.

## How a release happens

On merge to `main`, the release workflow (`.github/workflows/release.yml`) either:

1. **Opens/updates a "Version Packages" PR** that consumes the pending changesets — bumping the version in `package.json` and writing `CHANGELOG.md`; or
2. **Publishes** `@agentaily/agent-loop-client` to npm (npm token from the vault + signed provenance) and creates the GitHub Release, once that Version PR is merged.

You never bump the version or edit the changelog by hand — add a changeset and let the bot do it.
