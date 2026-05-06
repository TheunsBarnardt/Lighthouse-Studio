-- Rollback Migration 0013: ai_pipeline

DROP TABLE IF EXISTS ai_workspace_config;
DROP TABLE IF EXISTS ai_artifact_quality_records;
DROP TABLE IF EXISTS ai_response_cache;
DROP TABLE IF EXISTS ai_usage_records;
DROP TABLE IF EXISTS ai_artifact_versions;
DROP TABLE IF EXISTS ai_artifacts;
