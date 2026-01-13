-- Migration: Add ai_prompt_text to test_executions table
-- Description: Adds ai_prompt_text field to store AI prompt text directly at test execution level

ALTER TABLE `test_executions` 
ADD COLUMN `ai_prompt_text` longtext DEFAULT NULL AFTER `result`;

