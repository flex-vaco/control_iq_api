-- Migration: Add ai_prompts table for RCM-level prompt management
-- Date: 2025-01-15
-- Description: Creates ai_prompts table with RCM hierarchy (tenant_id, client_id, rcm_id) to store custom AI prompts for attribute comparison

CREATE TABLE IF NOT EXISTS `ai_prompts` (
  `ai_prompt_id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `client_id` int NOT NULL,
  `rcm_id` int DEFAULT NULL COMMENT 'NULL for client-level default prompts, specific rcm_id for RCM-level prompts',
  `prompt_text` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'The AI prompt text to be used for attribute comparison',
  `is_default` tinyint(1) DEFAULT '0' COMMENT '1 = default prompt for client, 0 = RCM-specific prompt',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  PRIMARY KEY (`ai_prompt_id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_client_id` (`client_id`),
  KEY `idx_rcm_id` (`rcm_id`),
  KEY `idx_is_default` (`is_default`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_ai_prompts_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ai_prompts_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ai_prompts_rcm` FOREIGN KEY (`rcm_id`) REFERENCES `rcm` (`rcm_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

