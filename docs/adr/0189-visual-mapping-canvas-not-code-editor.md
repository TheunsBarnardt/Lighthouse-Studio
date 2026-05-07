# ADR-0189: Visual Mapping Canvas, Not Code Editor

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 25 — Stage 5: Data Migration

## Context

The mapping editor is the user's primary interface. The question is whether to expose it as a code/YAML editor (power-user oriented) or as a visual canvas showing source → target connections.

## Decision

The primary interface is a visual canvas showing source columns on the left, target columns on the right, and connection lines between them. Transformations appear as badges on the connection lines. A detail panel for each connection allows editing the transformation chain.

The underlying migration plan artifact is YAML and accessible for power users who want to inspect or export it, but the visual canvas is the default and the recommended interface.

## Consequences

- Non-engineers (business analysts, data owners) can review and approve mappings without reading YAML.
- The visual representation makes unmapped required columns immediately obvious.
- Complex multi-table mappings may be harder to visualize than a flat YAML diff.
- The YAML fallback ensures power users aren't blocked.

## Alternatives Considered

- **YAML editor only**: rejected because it requires technical knowledge to use correctly; most stakeholders reviewing a migration plan should not need to read YAML.
- **SQL-based transformation language**: rejected because it's database-specific and excludes file sources.
