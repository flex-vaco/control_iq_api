const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate');
const s = require('../validations/schemas');

const rcmController         = require('../controllers/rcm.controller');
const pbcController         = require('../controllers/pbc.controller');
const attributesController  = require('../controllers/attributes.controller');
const clientController      = require('../controllers/company.controller');
const testExecutionsController = require('../controllers/test_executions.controller');
const userController        = require('../controllers/user.controller');
const roleController        = require('../controllers/role.controller');
const permissionController  = require('../controllers/permission.controller');

// ─── RCM ──────────────────────────────────────────────────────────────────────

router.get('/rcm',          verifyToken, rcmController.getAllRcm);
router.post('/rcm/save',    verifyToken, validate(s.saveRcm),            rcmController.saveRcm);
router.put('/rcm/:id',      verifyToken, validate(s.updateRcm),          rcmController.updateRcm);
router.delete('/rcm/:id',   verifyToken, rcmController.deleteRcm);

// ─── PBC / Evidence (multipart — multer runs inside controller) ───────────────
// Body validation for these routes is applied inline in the controller after multer.

router.get('/pbc',                        verifyToken, pbcController.getAllEvidence);
router.post('/pbc',                       verifyToken, pbcController.createEvidence);
router.put('/pbc/:id',                    verifyToken, pbcController.updateEvidence);
router.delete('/pbc/:id',                 verifyToken, pbcController.deleteEvidence);
router.get('/pbc/:id/documents',          verifyToken, pbcController.getEvidenceDocuments);
router.get('/pbc/:id/policy-documents',   verifyToken, pbcController.getPolicyDocuments);
router.post('/pbc/:id/add-documents',     verifyToken, pbcController.addEvidenceDocuments);
router.delete('/pbc/documents/:documentId', verifyToken, pbcController.deleteEvidenceDocument);
router.delete('/pbc/:id/sample',          verifyToken, pbcController.deleteSample);
router.get('/rcm-controls',               verifyToken, pbcController.getAvailableRcmControls);
router.get('/pbc/check-duplicate',        verifyToken, pbcController.checkDuplicatePbc);

// ─── Attributes ───────────────────────────────────────────────────────────────

router.get('/attributes',           verifyToken, attributesController.getAllAttributes);
router.post('/attributes/save',     verifyToken, validate(s.saveAttributes),   attributesController.saveAttributes);
router.put('/attributes/:id',       verifyToken, validate(s.updateAttribute),  attributesController.updateAttribute);
router.delete('/attributes/:id',    verifyToken, attributesController.deleteAttribute);

// ─── Clients ──────────────────────────────────────────────────────────────────

router.get('/clients',              verifyToken, clientController.getAllClients);
router.get('/clients/dropdown',     verifyToken, clientController.getAllClientsForDropdown);
router.get('/clients/:id',          verifyToken, clientController.getClientById);
router.post('/clients',             verifyToken, validate(s.createClient),  clientController.createClient);
router.put('/clients/:id',          verifyToken, validate(s.updateClient),  clientController.updateClient);
router.delete('/clients/:id',       verifyToken, clientController.deleteClient);

// ─── Test Executions ──────────────────────────────────────────────────────────

router.get('/test-executions',                verifyToken, testExecutionsController.getAllTestExecutions);
router.get('/test-executions/check-duplicate',verifyToken, testExecutionsController.checkDuplicateTestExecution);
router.get('/test-executions/data',           verifyToken, testExecutionsController.getTestExecutionData);
router.get('/test-executions/preview',        verifyToken, testExecutionsController.getEvidenceDataForTesting);
router.get('/test-executions/:id',            verifyToken, testExecutionsController.getTestExecutionById);
router.post('/test-executions',               verifyToken, validate(s.createTestExecution),  testExecutionsController.createTestExecution);
router.put('/test-executions/remarks',        verifyToken, validate(s.updateRemarks),        testExecutionsController.updateTestExecutionRemarks);
router.put('/test-executions/status-result',  verifyToken, validate(s.updateStatusResult),   testExecutionsController.updateTestExecutionStatusAndResult);
router.put('/test-executions/prompt',         verifyToken, validate(s.updatePrompt),         testExecutionsController.updateTestExecutionPrompt);

router.post('/evidence-ai-details',           verifyToken, validate(s.evidenceAiDetails),    testExecutionsController.getEvidenceAIDetails);
router.post('/compare-attributes',            verifyToken, validate(s.compareAttributes),    testExecutionsController.compareAttributes);
router.post('/evaluate-all-evidences',        verifyToken, validate(s.evaluateAllEvidences), testExecutionsController.evaluateAllEvidences);
router.get('/check-test-execution-evidence',  verifyToken, testExecutionsController.checkTestExecutionEvidenceDocument);
router.get('/test-execution-evidence-documents', verifyToken, testExecutionsController.getTestExecutionEvidenceDocuments);
router.post('/save-annotated-image',          verifyToken, testExecutionsController.saveAnnotatedImage);
router.put('/test-execution-evidence-result', verifyToken, validate(s.updateEvidenceResult), testExecutionsController.updateTestExecutionEvidenceResult);

// ─── Users ────────────────────────────────────────────────────────────────────

router.get('/users',        verifyToken, userController.getAllUsers);
router.get('/users/:id',    verifyToken, userController.getUserById);
router.post('/users',       verifyToken, validate(s.createUser),  userController.createUser);
router.put('/users/:id',    verifyToken, validate(s.updateUser),  userController.updateUser);
router.delete('/users/:id', verifyToken, userController.deleteUser);

// ─── Roles ────────────────────────────────────────────────────────────────────

router.get('/roles',        verifyToken, roleController.getAllRoles);
router.get('/roles/:id',    verifyToken, roleController.getRoleById);
router.post('/roles',       verifyToken, validate(s.createRole),  roleController.createRole);
router.put('/roles/:id',    verifyToken, validate(s.updateRole),  roleController.updateRole);
router.delete('/roles/:id', verifyToken, roleController.deleteRole);

// ─── Permissions ──────────────────────────────────────────────────────────────

router.get('/permissions/role/:roleId',    verifyToken, permissionController.getPermissionsByRole);
router.get('/permissions/my-permissions',  verifyToken, permissionController.getMyPermissions);
router.put('/permissions/role/:roleId',    verifyToken, validate(s.updatePermissions), permissionController.updatePermissions);
router.get('/permissions/resources',       verifyToken, permissionController.getAvailableResources);
router.get('/permissions/tenants',         verifyToken, permissionController.getAllTenants);

module.exports = router;
