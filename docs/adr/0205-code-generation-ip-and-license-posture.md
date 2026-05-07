# ADR-0205: Generated Code IP and License Posture

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 27 — Code Generation

## Context

Customers export AI-generated code. The IP ownership of that code and its license must be clear.

## Decision

Generated project exports include:
- A `LICENSE` file (configurable per workspace; default: MIT; alternatives: Apache-2.0, proprietary template)
- A `NOTICE` file declaring AI-assisted authorship and any third-party content provenance from templates
- The workspace owner retains the license choice; the platform recommends MIT for open-source projects

The platform's AI models do not introduce copyrighted training data into generated output; the platform makes no warranty on this but provides the NOTICE file for transparency.

## Consequences

- Customers have a clear starting point for IP questions; legal counsel advised for production use
- The NOTICE file satisfies many open-source attribution requirements
- Enterprise workspaces can configure a proprietary license template

## Alternatives considered

- **No license shipped** — customers must add one manually; error-prone; deferred problem
- **Force-open-source** — restricts enterprise customers with proprietary requirements
