const db = require('../config/db');
const RCM = require('./rcm.model');

const TestExecutionEvidenceDocuments = {
  // Create a new test execution evidence document
  create: async (testExecutionEvidenceDocumentData) => {
    const [result] = await db.query(
      `INSERT INTO test_execution_evidence_documents 
        (test_execution_id, evidence_document_id, rcm_id, tenant_id, client_id, result, status, total_attributes, total_attributes_passed, total_attributes_failed, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [testExecutionEvidenceDocumentData.test_execution_id, testExecutionEvidenceDocumentData.evidence_document_id, testExecutionEvidenceDocumentData.rcm_id, testExecutionEvidenceDocumentData.tenant_id, testExecutionEvidenceDocumentData.client_id, testExecutionEvidenceDocumentData.result, testExecutionEvidenceDocumentData.status, testExecutionEvidenceDocumentData.total_attributes, testExecutionEvidenceDocumentData.total_attributes_passed, testExecutionEvidenceDocumentData.total_attributes_failed, testExecutionEvidenceDocumentData.created_by]
    );
    return result.insertId;
  },

  // Find existing record by test_execution_id and evidence_document_id
  findByTestExecutionAndEvidenceDocument: async (testExecutionId, evidenceDocumentId, tenantId) => {
    const [rows] = await db.query(
      `SELECT * FROM test_execution_evidence_documents 
       WHERE test_execution_id = ? AND evidence_document_id = ? AND tenant_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [testExecutionId, evidenceDocumentId, tenantId]
    );
    return rows[0] || null;
  },

  // Update result_artifact_url for a test execution evidence document
  updateResultArtifactUrl: async (testExecutionId, evidenceDocumentId, resultArtifactUrl, tenantId) => {
    const [result] = await db.query(
      `UPDATE test_execution_evidence_documents 
       SET result_artifact_url = ?
       WHERE test_execution_id = ? AND evidence_document_id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [resultArtifactUrl, testExecutionId, evidenceDocumentId, tenantId]
    );
    return result.affectedRows > 0;
  },

  // Get all test execution evidence documents for a test execution with evidence names
  findByTestExecutionId: async (testExecutionId, tenantId) => {
    const [rows] = await db.query(
      `SELECT 
        teed.*,
        e.evidence_name
       FROM test_execution_evidence_documents teed
       JOIN evidence_documents ed ON teed.evidence_document_id = ed.document_id
       JOIN evidences e ON ed.evidence_id = e.evidence_id
       WHERE teed.test_execution_id = ? AND teed.tenant_id = ? AND teed.deleted_at IS NULL
       ORDER BY teed.created_at DESC`,
      [testExecutionId, tenantId]
    );
    return rows;
  },

  // Update result JSON with manual changes to attribute_final_result and manual_final_result
  // Also updates status field based on manual_final_result
  updateResult: async (testExecutionId, evidenceDocumentId, updatedResult, tenantId, userId) => {
    // Extract manual_final_result to update status field
    // status: 1 = Pass (true), 0 = Fail (false)
    const manualFinalResult = updatedResult.manual_final_result !== undefined 
      ? updatedResult.manual_final_result 
      : (updatedResult.final_result !== undefined ? updatedResult.final_result : false);
    const statusValue = manualFinalResult ? 1 : 0;

    const [result] = await db.query(
      `UPDATE test_execution_evidence_documents 
       SET result = ?, status = ?, updated_at = NOW(), updated_by = ?
       WHERE test_execution_id = ? AND evidence_document_id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [JSON.stringify(updatedResult), statusValue, userId, testExecutionId, evidenceDocumentId, tenantId]
    );
    return result.affectedRows > 0;
  }
};

module.exports = TestExecutionEvidenceDocuments;