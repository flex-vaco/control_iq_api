-- Migration: Add overall_execution_result column to test_executions table
-- Date: 2025-01-XX
-- Description: Adds a column to store overall execution results from evaluate all functionality

ALTER TABLE `test_executions` 
ADD COLUMN `overall_execution_result` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL 
AFTER `remarks`;

