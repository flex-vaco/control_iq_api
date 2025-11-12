const db = require('../config/db');

const PBC = {
  // Fetches all PBC/evidence requests and joins them with RCM data
  findAllByClient: async (clientId, tenantId) => {
    const [rows] = await db.query(
      `SELECT 
        e.*, 
        r.control_id,
        r.control_description,
        (SELECT COUNT(*) FROM evidence_documents d WHERE d.evidence_id = e.evidence_id AND d.deleted_at IS NULL) AS document_count
      FROM evidences e
      JOIN rcm r ON e.rcm_id = r.rcm_id
      WHERE e.client_id = ? AND e.tenant_id = ? AND e.deleted_at IS NULL
      ORDER BY e.created_at DESC`,
      [clientId, tenantId]
    );
    return rows;
  },

  // Fetches all PBC/evidence requests for a tenant (optionally filtered by client_id) with client_name
  findAll: async (tenantId, clientId = null) => {
    let query = `
      SELECT 
        e.*, 
        r.control_id,
        r.control_description,
        c.client_name,
        (SELECT COUNT(*) FROM evidence_documents d WHERE d.evidence_id = e.evidence_id AND d.deleted_at IS NULL) AS document_count
      FROM evidences e
      JOIN rcm r ON e.rcm_id = r.rcm_id
      JOIN clients c ON e.client_id = c.client_id
      WHERE e.tenant_id = ? AND e.deleted_at IS NULL
    `;
    const params = [tenantId];
    
    if (clientId) {
      query += ' AND e.client_id = ?';
      params.push(clientId);
    }
    
    query += ' ORDER BY e.created_at DESC';
    
    const [rows] = await db.query(query, params);
    return rows;
  },

  // Transaction to create evidence and associated documents
  createEvidenceAndDocuments: async (evidenceData, documentsData) => {
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // 1. Insert into evidences table
      const [evidenceResult] = await connection.query(
        `INSERT INTO evidences 
          (rcm_id, tenant_id, client_id, evidence_name, testing_status, year, quarter, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          evidenceData.rcm_id,
          evidenceData.tenant_id,
          evidenceData.client_id,
          evidenceData.evidence_name,
          evidenceData.testing_status,
          evidenceData.year || null,
          evidenceData.quarter || null,
          evidenceData.created_by
        ]
      );
      const evidenceId = evidenceResult.insertId;

      // 2. Insert into evidence_documents table (if files exist)
      if (documentsData && documentsData.length > 0) {
        // Prepare values for bulk insert
        const docValues = documentsData.map(doc => [
          evidenceId,
          evidenceData.tenant_id,
          evidenceData.client_id,
          doc.document_name || null,
          doc.artifact_url,
          evidenceData.created_by
        ]).flat();

        const placeholders = documentsData.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
        
        await connection.query(
          `INSERT INTO evidence_documents 
            (evidence_id, tenant_id, client_id, document_name, artifact_url, created_by)
           VALUES ${placeholders}`,
          docValues
        );
      }

      await connection.commit();
      return { evidenceId };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // Update evidence
  updateEvidence: async (evidenceId, evidenceData, tenantId, userId) => {
    const [result] = await db.query(
      `UPDATE evidences 
       SET evidence_name = ?, testing_status = ?, year = ?, quarter = ?, 
           updated_at = NOW(), updated_by = ?
       WHERE evidence_id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [
        evidenceData.evidence_name,
        evidenceData.testing_status,
        evidenceData.year || null,
        evidenceData.quarter || null,
        userId,
        evidenceId,
        tenantId
      ]
    );
    return result.affectedRows > 0;
  },

  // Delete evidence (soft delete)
  deleteEvidence: async (evidenceId, tenantId, userId) => {
    const [result] = await db.query(
      `UPDATE evidences 
       SET deleted_at = NOW(), deleted_by = ?
       WHERE evidence_id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [userId, evidenceId, tenantId]
    );
    return result.affectedRows > 0;
  },

  // Find evidence by ID
  findById: async (evidenceId, tenantId) => {
    const [rows] = await db.query(
      `SELECT e.*, r.control_id, r.control_description, c.client_name,
              (SELECT COUNT(*) FROM evidence_documents d WHERE d.evidence_id = e.evidence_id AND d.deleted_at IS NULL) AS document_count
       FROM evidences e
       JOIN rcm r ON e.rcm_id = r.rcm_id
       JOIN clients c ON e.client_id = c.client_id
       WHERE e.evidence_id = ? AND e.tenant_id = ? AND e.deleted_at IS NULL
       LIMIT 1`,
      [evidenceId, tenantId]
    );
    return rows[0] || null;
  },

  // Update evidence AI details
  updateEvidenceAIDetails: async (evidenceDocumentId, updateData, tenantId, userId) => {
    const [result] = await db.query(
      `UPDATE evidence_documents 
       SET evidence_ai_details = ?, updated_at = NOW(), updated_by = ?
       WHERE document_id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [updateData.extractedText, userId, evidenceDocumentId, tenantId]
    );
    return result.affectedRows > 0;
  },
  findEvidenceDocumentById: async (evidenceDocumentId, tenantId) => {
    const [rows] = await db.query(
      `SELECT * FROM evidence_documents WHERE document_id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [evidenceDocumentId, tenantId]
    );
    return rows[0] || null;
  },

  // Check if a combination of rcm_id, year, and quarter already exists
  checkDuplicate: async (rcmId, year, quarter, tenantId, excludeEvidenceId = null) => {
    let query = `
      SELECT e.evidence_id, r.control_id
      FROM evidences e
      JOIN rcm r ON e.rcm_id = r.rcm_id
      WHERE e.rcm_id = ? AND e.year = ? AND e.quarter = ? 
        AND e.tenant_id = ? AND e.deleted_at IS NULL
    `;
    const params = [rcmId, year, quarter, tenantId];
    
    if (excludeEvidenceId) {
      query += ' AND e.evidence_id != ?';
      params.push(excludeEvidenceId);
    }
    
    query += ' LIMIT 1';
    
    const [rows] = await db.query(query, params);
    return rows.length > 0 ? rows[0] : null;
  },

  // Get evidence documents by evidence_id
  getEvidenceDocuments: async (evidenceId, tenantId) => {
    const [rows] = await db.query(
      `SELECT document_id, artifact_url, document_name, created_date, created_at
       FROM evidence_documents
       WHERE evidence_id = ? AND tenant_id = ? AND deleted_at IS NULL
       ORDER BY created_date DESC, created_at DESC`,
      [evidenceId, tenantId]
    );
    return rows;
  },

  // Delete evidence document (soft delete)
  deleteEvidenceDocument: async (documentId, tenantId, userId) => {
    const [result] = await db.query(
      `UPDATE evidence_documents 
       SET deleted_at = NOW(), deleted_by = ?
       WHERE document_id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [userId, documentId, tenantId]
    );
    return result.affectedRows > 0;
  },
};

module.exports = PBC;
