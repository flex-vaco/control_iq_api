const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.middleware');

// Import Controllers
const rcmController = require('../controllers/rcm.controller');
const pbcController = require('../controllers/pbc.controller');
const attributesController = require('../controllers/attributes.controller');
const clientController = require('../controllers/company.controller');
const testExecutionsController = require('../controllers/test_executions.controller');
const userController = require('../controllers/user.controller');
const roleController = require('../controllers/role.controller');
const permissionController = require('../controllers/permission.controller');

// --- Protected Routes ---

// RCM Routes
router.get('/rcm', verifyToken, rcmController.getAllRcm);
router.post('/rcm/save', verifyToken, rcmController.saveRcm);
router.put('/rcm/:id', verifyToken, rcmController.updateRcm);
router.delete('/rcm/:id', verifyToken, rcmController.deleteRcm); 

// PBC/Evidence Routes
router.get('/pbc', verifyToken, pbcController.getAllEvidence); // Fetch all evidence requests
router.post('/pbc', verifyToken, pbcController.createEvidence); // Create new evidence request
router.put('/pbc/:id', verifyToken, pbcController.updateEvidence); // Update evidence request
router.delete('/pbc/:id', verifyToken, pbcController.deleteEvidence); // Delete evidence request
router.get('/pbc/:id/documents', verifyToken, pbcController.getEvidenceDocuments); // Get evidence documents (excludes policy)
router.get('/pbc/:id/policy-documents', verifyToken, pbcController.getPolicyDocuments); // Get policy documents only
router.post('/pbc/:id/add-documents', verifyToken, pbcController.addEvidenceDocuments); // Add documents to existing evidence
router.delete('/pbc/documents/:documentId', verifyToken, pbcController.deleteEvidenceDocument); // Delete evidence document
router.get('/rcm-controls', verifyToken, pbcController.getAvailableRcmControls); // Fetch RCM data for PBC creation
router.get('/pbc/check-duplicate', verifyToken, pbcController.checkDuplicatePbc); // Check for duplicate PBC

// Attribute Routes
router.get('/attributes', verifyToken, attributesController.getAllAttributes);
router.post('/attributes/save', verifyToken, attributesController.saveAttributes);
router.put('/attributes/:id', verifyToken, attributesController.updateAttribute);
router.delete('/attributes/:id', verifyToken, attributesController.deleteAttribute);

// Client Routes (formerly Company)
router.get('/clients', verifyToken, clientController.getAllClients);
router.get('/clients/dropdown', verifyToken, clientController.getAllClientsForDropdown);
router.get('/clients/:id', verifyToken, clientController.getClientById);
router.post('/clients', verifyToken, clientController.createClient);
router.put('/clients/:id', verifyToken, clientController.updateClient);
router.delete('/clients/:id', verifyToken, clientController.deleteClient);

// Test Executions Routes
router.get('/test-executions', verifyToken, testExecutionsController.getAllTestExecutions);
router.get('/test-executions/check-duplicate', verifyToken, testExecutionsController.checkDuplicateTestExecution);
router.get('/test-executions/data', verifyToken, testExecutionsController.getTestExecutionData);
router.get('/test-executions/preview', verifyToken, testExecutionsController.getEvidenceDataForTesting);
router.get('/test-executions/:id', verifyToken, testExecutionsController.getTestExecutionById);
router.post('/test-executions', verifyToken, testExecutionsController.createTestExecution);
router.put('/test-executions/remarks', verifyToken, testExecutionsController.updateTestExecutionRemarks);

// Evidence AI Details Route
router.post('/evidence-ai-details', verifyToken, testExecutionsController.getEvidenceAIDetails);
router.post('/compare-attributes', verifyToken, testExecutionsController.compareAttributes);
router.post('/evaluate-all-evidences', verifyToken, testExecutionsController.evaluateAllEvidences);
router.get('/check-test-execution-evidence', verifyToken, testExecutionsController.checkTestExecutionEvidenceDocument);
router.get('/test-execution-evidence-documents', verifyToken, testExecutionsController.getTestExecutionEvidenceDocuments);
router.post('/save-annotated-image', verifyToken, testExecutionsController.saveAnnotatedImage);
router.put('/test-execution-evidence-result', verifyToken, testExecutionsController.updateTestExecutionEvidenceResult);
router.put('/test-executions/status-result', verifyToken, testExecutionsController.updateTestExecutionStatusAndResult);

// User Management Routes
router.get('/users', verifyToken, userController.getAllUsers);
router.get('/users/:id', verifyToken, userController.getUserById);
router.post('/users', verifyToken, userController.createUser);
router.put('/users/:id', verifyToken, userController.updateUser);
router.delete('/users/:id', verifyToken, userController.deleteUser);

// Role Management Routes
router.get('/roles', verifyToken, roleController.getAllRoles);
router.get('/roles/:id', verifyToken, roleController.getRoleById);
router.post('/roles', verifyToken, roleController.createRole);
router.put('/roles/:id', verifyToken, roleController.updateRole);
router.delete('/roles/:id', verifyToken, roleController.deleteRole);

// Permission/Access Control Routes
router.get('/permissions/role/:roleId', verifyToken, permissionController.getPermissionsByRole);
router.get('/permissions/my-permissions', verifyToken, permissionController.getMyPermissions);
router.put('/permissions/role/:roleId', verifyToken, permissionController.updatePermissions);
router.get('/permissions/resources', verifyToken, permissionController.getAvailableResources);
router.get('/permissions/tenants', verifyToken, permissionController.getAllTenants);

module.exports = router;
