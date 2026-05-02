# Branch Protection Configuration

Branch protection for `main` is configured in the GitHub repository settings UI. It cannot be committed to the repo, so the required configuration is documented here.

## Required Settings for `main`

Navigate to: **Settings → Branches → Add rule** (branch name: `main`)

| Setting                               | Value                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| Require a pull request before merging | ✓ Enabled                                                                             |
| Require approvals                     | 1 (increase when team grows)                                                          |
| Dismiss stale reviews on new commits  | ✓ Enabled                                                                             |
| Require status checks to pass         | ✓ Enabled                                                                             |
| Require branches to be up to date     | ✓ Enabled                                                                             |
| Required status checks                | `format-check`, `lint`, `typecheck`, `boundaries`, `test`, `build`, `gitleaks`, `CLA` |
| Require conversation resolution       | ✓ Enabled                                                                             |
| Require linear history                | ✓ Enabled (squash or rebase only)                                                     |
| Restrict force-pushes                 | ✓ Enabled                                                                             |
| Restrict deletions                    | ✓ Enabled                                                                             |

## CLA Status Check

The `CLA` status check is added by CLA Assistant. To configure CLA Assistant:

1. Visit [cla-assistant.io](https://cla-assistant.io)
2. Sign in with the GitHub account that owns the repo
3. Point at the CLA document: `https://raw.githubusercontent.com/<org>/<repo>/main/.github/CLA.md`
4. Enable "auto-sign" for the repo owner
5. CLA Assistant will add the `CLA` status check to all PRs

Once configured, add `CLA` to the required status checks list above.
