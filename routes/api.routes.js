const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.middleware');

// Import Controllers
const rcmController = require('../controllers/rcm.controller');
const pbcController = require('../controllers/pbc.controller');
const attributesController = require('../controllers/attributes.controller');
const clientController = require('../controllers/company.controller');
const testExecutionsController = require('../controllers/test_executions.controller');

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
router.get('/pbc/:id/documents', verifyToken, pbcController.getEvidenceDocuments); // Get evidence documents
router.post('/pbc/:id/add-documents', verifyToken, pbcController.addEvidenceDocuments); // Add documents to existing evidence
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
router.get('/check-test-execution-evidence', verifyToken, testExecutionsController.checkTestExecutionEvidenceDocument);
router.get('/test-execution-evidence-documents', verifyToken, testExecutionsController.getTestExecutionEvidenceDocuments);
router.post('/save-annotated-image', verifyToken, testExecutionsController.saveAnnotatedImage);

module.exports = router;
