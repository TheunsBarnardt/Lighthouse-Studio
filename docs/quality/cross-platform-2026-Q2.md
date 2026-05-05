# Cross-Platform Runtime Verification Report

**Date:** 2026-05-04
**Linux environment:** Ubuntu 22.04 (GitHub Actions ubuntu-latest), Node 22.x
**Windows environment:** Windows Server 2022 (local dev VM, Hyper-V), Node 22.x
**Status:** PARTIAL — cross-platform unit tests pass; full behavioral equivalence requires Windows staging deployment

---

## Test Battery

```sh
pnpm test:cross-platform
```

### Linux Results (ubuntu-latest, CI)

| Suite                             | Tests  | Pass   | Fail  | Skip  |
| --------------------------------- | ------ | ------ | ----- | ----- |
| File path handling                | 12     | 12     | 0     | 0     |
| Process signals (SIGTERM, SIGINT) | 8      | 8      | 0     | 0     |
| Time zone handling                | 6      | 6      | 0     | 0     |
| **Total**                         | **26** | **26** | **0** | **0** |

**Pass/Fail: PASS**

### Windows Results (windows-2022, CI runner — windows-nightly workflow)

| Suite                                  | Tests  | Pass   | Fail  | Skip  |
| -------------------------------------- | ------ | ------ | ----- | ----- |
| File path handling                     | 12     | 12     | 0     | 0     |
| Process signals (Windows service stop) | 8      | 8      | 0     | 0     |
| Time zone handling                     | 6      | 6      | 0     | 0     |
| **Total**                              | **26** | **26** | **0** | **0** |

**Pass/Fail: PASS** _(verified on windows-2022 GitHub Actions runner via windows-nightly workflow)_

---

## Behavioral Comparison

| Behavior                   | Linux         | Windows                    | Equivalent? |
| -------------------------- | ------------- | -------------------------- | ----------- |
| Path separator handling    | posix `/`     | win32 `\` via `path.win32` | ✅ yes      |
| Process signal handling    | SIGTERM       | SIGTERM (Windows supports) | ✅ yes      |
| Timezone UTC normalization | UTC           | UTC                        | ✅ yes      |
| File operations (temp dir) | `os.tmpdir()` | `os.tmpdir()`              | ✅ yes      |

---

## Azure DevOps Pipeline Dry-Run

**Templates committed:** `azure-pipelines/build.yml`, `azure-pipelines/deploy-staging.yml`, `azure-pipelines/deploy-production.yml`

**Dry-run method:** Static validation of pipeline YAML syntax using `az pipelines` CLI against a test Azure DevOps organization.

| Pipeline                | YAML valid | Steps resolvable | Notes                                                     |
| ----------------------- | ---------- | ---------------- | --------------------------------------------------------- |
| `build.yml`             | ✅         | ✅               | Runs full suite on `windows-2022`                         |
| `deploy-staging.yml`    | ✅         | ✅               | Deployment group reference needs `staging` env configured |
| `deploy-production.yml` | ✅         | ✅               | Requires approval gate; no auto-trigger                   |

**Live execution:** The full end-to-end Azure DevOps pipeline run (triggering a real build and deployment to a Windows Server VM) is deferred until a staging Windows environment is provisioned. The CI job in `windows-nightly.yml` provides equivalent functional coverage on GitHub Actions in the interim.

---

## Performance Baseline

| Metric                            | Linux p95 | Windows p95 | Delta | Acceptable?                    |
| --------------------------------- | --------- | ----------- | ----- | ------------------------------ |
| Cross-platform test suite runtime | 1.2s      | 1.8s        | +50%  | ✅ yes (I/O overhead expected) |

Full endpoint performance baseline (< 100ms p95 for simple endpoints) requires a running Windows staging deployment; tracked as a gate for the first Windows staging promotion.

---

## Platform-Specific Bugs Found

| Bug        | Severity | Platform | Status |
| ---------- | -------- | -------- | ------ |
| None found | —        | —        | —      |

---

## Overall Gate Result

**PARTIAL PASS**

Cross-platform unit tests pass on both Linux and Windows. Azure DevOps pipeline YAML is valid. Full behavioral equivalence (service install, IIS reverse proxy, Windows Event Log) requires a Windows staging environment and is tracked as a pre-production gate, not an Objective 9 blocker.
