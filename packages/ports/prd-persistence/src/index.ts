/**
 * @platform/ports-prd-persistence
 *
 * Re-exports the PRD persistence repository interfaces from @platform/core and
 * exposes the conformance suites that adapter packages use to verify their
 * implementations.
 *
 * Repository interfaces are defined alongside the service in @platform/core
 * until a dedicated move is warranted. This package provides a stable import
 * surface and the conformance infrastructure.
 */

export type {
  PrdArtifactRepository,
  PrdSectionRepository,
  PrdTemplateRepository,
} from '@platform/core';

// Conformance suites are published under the ./conformance sub-path export and
// are not re-exported here to avoid pulling vitest into production bundles.
