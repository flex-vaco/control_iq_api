const db = require('../config/db');
const RCM = require('./rcm.model');

const TestExecution = {
  // Create a new test execution
  create: async (testExecutionData) => {
    const [result] = await db.query(
      `INSERT INTO test_executions 
        (rcm_id, client_id, tenant_id, pcb_id, user_id, year, quarter, status, result, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        testExecutionData.rcm_id,
        testExecutionData.client_id,
        testExecutionData.tenant_id,
        testExecutionData.pcb_id || null,
        testExecutionData.user_id || null,
        testExecutionData.year,
        testExecutionData.quarter,
        testExecutionData.status || 'pending',
        testExecutionData.result || 'na',
        testExecutionData.created_by || null
      ]
    );
    return result.insertId;
  },

  // Find evidence_id (pcb_id) from evidences table using rcm_id, year, and quarter
  findEvidenceIdByRcmYearQuarter: async (rcmId, year, quarter, clientId, tenantId) => {
    const [rows] = await db.query(
      `SELECT evidence_id, testing_status FROM evidences 
       WHERE rcm_id = ? AND year = ? AND quarter = ? AND client_id = ? AND tenant_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [rcmId, year, quarter, clientId, tenantId]
    );
    return rows.length > 0 ? { evidence_id: rows[0].evidence_id, testing_status: rows[0].testing_status } : null;
  },

  // Get evidence documents by evidence_id with evidence_name
  getEvidenceDocuments: async (evidenceId, tenantId) => {
    const [rows] = await db.query(
      `SELECT ed.document_id, ed.artifact_url, ed.created_date, e.evidence_name, ed.evidence_ai_details
       FROM evidence_documents ed
       JOIN evidences e ON ed.evidence_id = e.evidence_id
       WHERE ed.evidence_id = ? AND ed.tenant_id = ? AND ed.deleted_at IS NULL
       ORDER BY ed.created_date DESC`,
      [evidenceId, tenantId]
    );
    return rows;
  },

  // Update test execution remarks
  updateRemarks: async (testExecutionId, remarks, tenantId, userId) => {
    const [result] = await db.query(
      `UPDATE test_executions 
       SET remarks = ?, updated_at = NOW(), updated_by = ?
       WHERE test_execution_id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [remarks, userId, testExecutionId, tenantId]
    );
    return result.affectedRows > 0;
  },

  // Get test attributes by rcm_id
  getTestAttributesByRcmId: async (rcmId, tenantId) => {
    const [rows] = await db.query(
      `SELECT attribute_id, attribute_name, attribute_description, test_steps
       FROM test_attributes
       WHERE rcm_id = ? AND tenant_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [rcmId, tenantId]
    );
    return rows;
  },

  // Find test execution by ID
  findById: async (testExecutionId, tenantId) => {
    const [rows] = await db.query(
      `SELECT te.*, r.control_id, r.control_description, r.process, c.client_name, 
       CONCAT_WS(' ', u.first_name, u.last_name) AS user_name
       FROM test_executions te
       JOIN rcm r ON te.rcm_id = r.rcm_id
       JOIN clients c ON te.client_id = c.client_id
       LEFT JOIN users u ON te.user_id = u.user_id
       WHERE te.test_execution_id = ? AND te.tenant_id = ? AND te.deleted_at IS NULL
       LIMIT 1`,
      [testExecutionId, tenantId]
    );
    return rows[0] || null;
  },

  // Find all test executions for a client (or all if clientId is null)
  findAllByClient: async (clientId, tenantId) => {
    let query = `
      SELECT te.*, r.control_id, r.control_description, r.process, c.client_name, 
      CONCAT_WS(' ', u.first_name, u.last_name) AS user_name
      FROM test_executions te
      JOIN rcm r ON te.rcm_id = r.rcm_id
      JOIN clients c ON te.client_id = c.client_id
      LEFT JOIN users u ON te.user_id = u.user_id
      WHERE te.tenant_id = ? AND te.deleted_at IS NULL
    `;
    const params = [tenantId];
    
    if (clientId) {
      query += ' AND te.client_id = ?';
      params.push(clientId);
    }
    
    query += ' ORDER BY te.created_at DESC';
    
    const [rows] = await db.query(query, params);
    return rows;
  },

  // Check for duplicate test execution (rcm_id, year, quarter combination)
  checkDuplicate: async (rcmId, year, quarter, tenantId) => {
    let query = `
      SELECT te.test_execution_id, r.control_id
      FROM test_executions te
      JOIN rcm r ON te.rcm_id = r.rcm_id
      WHERE te.rcm_id = ? AND te.year = ? AND te.quarter = ? 
        AND te.tenant_id = ? AND te.deleted_at IS NULL
    `;
    const params = [rcmId, year, quarter, tenantId];
    
    query += ' LIMIT 1';
    
    const [rows] = await db.query(query, params);
    return rows.length > 0 ? rows[0] : null;
  }
};

module.exports = TestExecution;

