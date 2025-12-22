-- Add sample_name column to evidence_documents table
ALTER TABLE `evidence_documents` 
ADD COLUMN `sample_name` VARCHAR(255) NULL COMMENT 'Sample name for grouping evidence documents' AFTER `is_policy_document`;