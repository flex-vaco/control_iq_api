-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost:8889
-- Generation Time: Nov 05, 2025 at 12:43 PM
-- Server version: 8.0.40
-- PHP Version: 8.3.14

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `controlIQ`
--

-- --------------------------------------------------------

--
-- Table structure for table `clients`
--

CREATE TABLE `clients` (
  `client_id` int NOT NULL,
  `tenant_id` int NOT NULL,
  `client_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `industry` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `region` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_phone` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `evidences`
--

CREATE TABLE `evidences` (
  `evidence_id` int NOT NULL,
  `rcm_id` int NOT NULL,
  `tenant_id` int NOT NULL,
  `client_id` int NOT NULL,
  `evidence_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `testing_status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `year` int DEFAULT NULL,
  `quarter` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `evidence_documents`
--

CREATE TABLE `evidence_documents` (
  `document_id` int NOT NULL,
  `evidence_id` int NOT NULL,
  `tenant_id` int NOT NULL,
  `client_id` int NOT NULL,
  `artifact_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `evidence_ai_details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rcm`
--

CREATE TABLE `rcm` (
  `rcm_id` int NOT NULL,
  `control_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` int NOT NULL,
  `client_id` int NOT NULL,
  `process` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sub_process` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `risk_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `risk_description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `classification` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `control_description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `summary` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `frequency` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `automated_manual` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `preventive_detective` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `significance` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `risk_rating` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `owners` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mitigates` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `location` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `key_reports` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `it_systems` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `role_id` int NOT NULL,
  `role_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `tenant_id` int NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `roles`
--

INSERT INTO `roles` (`role_id`, `role_name`, `description`, `tenant_id`, `created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`, `deleted_by`) VALUES
(1, 'Super Admin', 'Platform administrator with access to all clients', 1, '2025-11-01 20:40:18', NULL, '2025-11-01 20:40:18', NULL, NULL, NULL),
(2, 'Platform Support', 'Platform support staff with read access to all clients', 1, '2025-11-01 20:40:18', NULL, '2025-11-01 20:40:18', NULL, NULL, NULL),
(3, 'Admin', 'Client administrator', 2, '2025-11-01 20:40:18', NULL, '2025-11-01 20:40:18', NULL, NULL, NULL),
(4, 'Auditor', 'Internal auditor', 2, '2025-11-01 20:40:18', NULL, '2025-11-01 20:40:18', NULL, NULL, NULL),
(5, 'Manager', 'Risk manager', 2, '2025-11-01 20:40:18', NULL, '2025-11-01 20:40:18', NULL, NULL, NULL),
(6, 'Viewer', 'Read-only access', 2, '2025-11-01 20:40:18', NULL, '2025-11-01 20:40:18', NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `tenants`
--

CREATE TABLE `tenants` (
  `tenant_id` int NOT NULL,
  `tenant_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `industry` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `region` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_phone` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `tenants`
--

INSERT INTO `tenants` (`tenant_id`, `tenant_name`, `industry`, `region`, `contact_name`, `contact_email`, `contact_phone`, `created_date`, `status`, `created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`, `deleted_by`) VALUES
(1, 'System', 'Platform', 'Global', NULL, NULL, NULL, '2025-11-01 20:40:18', 'active', '2025-11-01 20:40:18', NULL, '2025-11-01 20:40:18', NULL, NULL, NULL),
(2, 'Acme Corporation', 'Technology', 'North America', NULL, NULL, NULL, '2025-11-01 20:40:18', 'active', '2025-11-01 20:40:18', NULL, '2025-11-01 20:40:18', NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `test_attributes`
--

CREATE TABLE `test_attributes` (
  `attribute_id` int NOT NULL,
  `rcm_id` int NOT NULL,
  `attribute_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `attribute_description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `test_steps` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `tenant_id` int NOT NULL,
  `client_id` int NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `test_executions`
--

CREATE TABLE `test_executions` (
  `test_execution_id` int NOT NULL,
  `rcm_id` int NOT NULL,
  `client_id` int NOT NULL,
  `tenant_id` int NOT NULL,
  `pcb_id` int DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `year` year NOT NULL,
  `quarter` enum('Q1','Q2','Q3','Q4') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','in_progress','completed','failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `result` enum('pass','fail','partial','na') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'na',
  `remarks` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `test_execution_evidence_documents`
--

CREATE TABLE `test_execution_evidence_documents` (
  `id` int NOT NULL,
  `test_execution_id` int NOT NULL,
  `evidence_document_id` int NOT NULL,
  `rcm_id` int NOT NULL,
  `client_id` int NOT NULL,
  `tenant_id` int NOT NULL,
  `result` json DEFAULT NULL COMMENT 'Stores the detailed AI comparison results',
  `status` tinyint(1) DEFAULT '0' COMMENT 'TRUE = passed, FALSE = failed',
  `total_attributes` int DEFAULT '0',
  `total_attributes_passed` int DEFAULT '0',
  `total_attributes_failed` int DEFAULT '0',
  `result_artifact_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` int NOT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `deleted_by` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores test execution results for each evidence document';

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int NOT NULL,
  `tenant_id` int NOT NULL,
  `username` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `role_id` int NOT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `last_login` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `tenant_id`, `username`, `first_name`, `last_name`, `email`, `role_id`, `password`, `is_active`, `last_login`, `created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`, `deleted_by`) VALUES
(1, 1, 'superadmin', 'Super', 'Admin', 'superadmin@platform.com', 1, '$2b$09$ErW2VhoJ28WNJV6YArjd3ekEGhOZn5Q6ctU92T4sttG6OfR4uA7A6', 1, NULL, '2025-11-01 20:40:18', NULL, '2025-11-03 23:04:54', NULL, NULL, NULL),
(2, 2, 'acme_admin', 'Acme', 'Admin', 'admin@platform.com', 3, '$2b$09$ErW2VhoJ28WNJV6YArjd3ekEGhOZn5Q6ctU92T4sttG6OfR4uA7A6', 1, NULL, '2025-11-01 20:40:18', NULL, '2025-11-03 23:05:01', NULL, NULL, NULL),
(3, 2, 'john.auditor', 'John', 'Auditor', 'john@platform.com', 4, '$2b$09$ErW2VhoJ28WNJV6YArjd3ekEGhOZn5Q6ctU92T4sttG6OfR4uA7A6', 1, NULL, '2025-11-01 20:40:18', NULL, '2025-11-03 23:05:11', NULL, NULL, NULL),
(4, 2, 'jane.manager', 'Jane', 'Manager', 'jane@platform.com', 5, '$2b$09$ErW2VhoJ28WNJV6YArjd3ekEGhOZn5Q6ctU92T4sttG6OfR4uA7A6', 1, NULL, '2025-11-01 20:40:18', NULL, '2025-11-03 23:05:22', NULL, NULL, NULL),
(5, 2, 'bob.viewer', 'Bob', 'Viewer', 'bob@platform.com', 6, '$2b$09$ErW2VhoJ28WNJV6YArjd3ekEGhOZn5Q6ctU92T4sttG6OfR4uA7A6', 1, NULL, '2025-11-01 20:40:18', NULL, '2025-11-03 23:06:01', NULL, NULL, NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `clients`
--
ALTER TABLE `clients`
  ADD PRIMARY KEY (`client_id`),
  ADD KEY `idx_client_name` (`client_name`),
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_deleted_at` (`deleted_at`),
  ADD KEY `fk_clients_created_by` (`created_by`),
  ADD KEY `fk_clients_updated_by` (`updated_by`),
  ADD KEY `fk_clients_deleted_by` (`deleted_by`);

--
-- Indexes for table `evidences`
--
ALTER TABLE `evidences`
  ADD PRIMARY KEY (`evidence_id`),
  ADD KEY `fk_evidences_created_by` (`created_by`),
  ADD KEY `fk_evidences_updated_by` (`updated_by`),
  ADD KEY `fk_evidences_deleted_by` (`deleted_by`),
  ADD KEY `idx_rcm_id` (`rcm_id`),
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD KEY `idx_client_id` (`client_id`),
  ADD KEY `idx_testing_status` (`testing_status`),
  ADD KEY `idx_evidence_name` (`evidence_name`),
  ADD KEY `idx_deleted_at` (`deleted_at`);

--
-- Indexes for table `evidence_documents`
--
ALTER TABLE `evidence_documents`
  ADD PRIMARY KEY (`document_id`),
  ADD KEY `fk_ed_created_by` (`created_by`),
  ADD KEY `fk_ed_updated_by` (`updated_by`),
  ADD KEY `fk_ed_deleted_by` (`deleted_by`),
  ADD KEY `idx_evidence_id` (`evidence_id`),
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD KEY `idx_client_id` (`client_id`),
  ADD KEY `idx_deleted_at` (`deleted_at`);

--
-- Indexes for table `rcm`
--
ALTER TABLE `rcm`
  ADD PRIMARY KEY (`rcm_id`),
  ADD UNIQUE KEY `unique_control_client` (`client_id`,`control_id`),
  ADD KEY `fk_rcm_created_by` (`created_by`),
  ADD KEY `fk_rcm_updated_by` (`updated_by`),
  ADD KEY `fk_rcm_deleted_by` (`deleted_by`),
  ADD KEY `idx_control_id` (`control_id`),
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD KEY `idx_client_id` (`client_id`),
  ADD KEY `idx_deleted_at` (`deleted_at`);

--
-- Indexes for table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`role_id`),
  ADD UNIQUE KEY `unique_role_tenant` (`role_name`,`tenant_id`),
  ADD KEY `idx_role_name` (`role_name`),
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD KEY `idx_deleted_at` (`deleted_at`);

--
-- Indexes for table `tenants`
--
ALTER TABLE `tenants`
  ADD PRIMARY KEY (`tenant_id`),
  ADD KEY `idx_tenant_name` (`tenant_name`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_deleted_at` (`deleted_at`);

--
-- Indexes for table `test_attributes`
--
ALTER TABLE `test_attributes`
  ADD PRIMARY KEY (`attribute_id`),
  ADD KEY `fk_ta_created_by` (`created_by`),
  ADD KEY `fk_ta_updated_by` (`updated_by`),
  ADD KEY `fk_ta_deleted_by` (`deleted_by`),
  ADD KEY `idx_rcm_id` (`rcm_id`),
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD KEY `idx_client_id` (`client_id`),
  ADD KEY `idx_attribute_name` (`attribute_name`),
  ADD KEY `idx_deleted_at` (`deleted_at`);

--
-- Indexes for table `test_executions`
--
ALTER TABLE `test_executions`
  ADD PRIMARY KEY (`test_execution_id`),
  ADD KEY `idx_rcm_id` (`rcm_id`),
  ADD KEY `idx_client_id` (`client_id`),
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_result` (`result`),
  ADD KEY `idx_year_quarter` (`year`,`quarter`),
  ADD KEY `idx_deleted_at` (`deleted_at`),
  ADD KEY `fk_te_created_by` (`created_by`),
  ADD KEY `fk_te_updated_by` (`updated_by`),
  ADD KEY `fk_te_deleted_by` (`deleted_by`);

--
-- Indexes for table `test_execution_evidence_documents`
--
ALTER TABLE `test_execution_evidence_documents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_test_execution` (`test_execution_id`),
  ADD KEY `idx_evidence_document` (`evidence_document_id`),
  ADD KEY `idx_rcm` (`rcm_id`),
  ADD KEY `idx_client` (`client_id`),
  ADD KEY `idx_tenant` (`tenant_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_deleted_at` (`deleted_at`),
  ADD KEY `idx_client_tenant` (`client_id`,`tenant_id`),
  ADD KEY `fk_teed_created_by` (`created_by`),
  ADD KEY `fk_teed_updated_by` (`updated_by`),
  ADD KEY `fk_teed_deleted_by` (`deleted_by`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `unique_email_tenant` (`email`,`tenant_id`),
  ADD KEY `idx_username` (`username`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD KEY `idx_role_id` (`role_id`),
  ADD KEY `idx_is_active` (`is_active`),
  ADD KEY `idx_deleted_at` (`deleted_at`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `clients`
--
ALTER TABLE `clients`
  MODIFY `client_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `evidences`
--
ALTER TABLE `evidences`
  MODIFY `evidence_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `evidence_documents`
--
ALTER TABLE `evidence_documents`
  MODIFY `document_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `rcm`
--
ALTER TABLE `rcm`
  MODIFY `rcm_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `role_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `tenants`
--
ALTER TABLE `tenants`
  MODIFY `tenant_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `test_attributes`
--
ALTER TABLE `test_attributes`
  MODIFY `attribute_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `test_executions`
--
ALTER TABLE `test_executions`
  MODIFY `test_execution_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `test_execution_evidence_documents`
--
ALTER TABLE `test_execution_evidence_documents`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `clients`
--
ALTER TABLE `clients`
  ADD CONSTRAINT `fk_clients_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_clients_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_clients_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_clients_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `evidences`
--
ALTER TABLE `evidences`
  ADD CONSTRAINT `fk_evidences_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_evidences_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_evidences_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_evidences_rcm` FOREIGN KEY (`rcm_id`) REFERENCES `rcm` (`rcm_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_evidences_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_evidences_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `evidence_documents`
--
ALTER TABLE `evidence_documents`
  ADD CONSTRAINT `fk_ed_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ed_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ed_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ed_evidence` FOREIGN KEY (`evidence_id`) REFERENCES `evidences` (`evidence_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ed_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ed_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `rcm`
--
ALTER TABLE `rcm`
  ADD CONSTRAINT `fk_rcm_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_rcm_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_rcm_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_rcm_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_rcm_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `roles`
--
ALTER TABLE `roles`
  ADD CONSTRAINT `fk_roles_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `test_attributes`
--
ALTER TABLE `test_attributes`
  ADD CONSTRAINT `fk_ta_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ta_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ta_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ta_rcm` FOREIGN KEY (`rcm_id`) REFERENCES `rcm` (`rcm_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ta_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ta_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `test_executions`
--
ALTER TABLE `test_executions`
  ADD CONSTRAINT `fk_te_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_te_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_te_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_te_rcm` FOREIGN KEY (`rcm_id`) REFERENCES `rcm` (`rcm_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_te_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_te_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_te_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `test_execution_evidence_documents`
--
ALTER TABLE `test_execution_evidence_documents`
  ADD CONSTRAINT `fk_teed_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_teed_control` FOREIGN KEY (`rcm_id`) REFERENCES `rcm` (`rcm_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_teed_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_teed_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_teed_evidence_document` FOREIGN KEY (`evidence_document_id`) REFERENCES `evidence_documents` (`document_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_teed_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_teed_test_execution` FOREIGN KEY (`test_execution_id`) REFERENCES `test_executions` (`test_execution_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_teed_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_users_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
