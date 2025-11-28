-- Create permissions table for role-based access control
CREATE TABLE IF NOT EXISTS `permissions` (
  `permission_id` int NOT NULL AUTO_INCREMENT,
  `role_id` int NOT NULL,
  `resource` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Resource/module name (e.g., RCM, PBC, Attributes, Client, Periodic Testing)',
  `can_view` tinyint(1) DEFAULT '0' COMMENT 'View access',
  `can_create` tinyint(1) DEFAULT '0' COMMENT 'Create access',
  `can_update` tinyint(1) DEFAULT '0' COMMENT 'Update access',
  `can_delete` tinyint(1) DEFAULT '0' COMMENT 'Delete access',
  `tenant_id` int NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  PRIMARY KEY (`permission_id`),
  UNIQUE KEY `unique_role_resource_tenant` (`role_id`, `resource`, `tenant_id`),
  KEY `idx_role_id` (`role_id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_resource` (`resource`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_permissions_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add is_policy_document column to evidence_documents table
ALTER TABLE `evidence_documents` 
ADD COLUMN `is_policy_document` tinyint(1) DEFAULT '0' COMMENT '1 = policy document, 0 = evidence document' AFTER `document_name`;

