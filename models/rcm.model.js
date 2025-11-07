const db = require('../config/db');

const RCM = {
  // Finds all RCM records for a specific client
  findAllByClient: async (clientId, tenantId) => {
    const [rows] = await db.query(
      'SELECT * FROM rcm WHERE client_id = ? AND tenant_id = ? AND deleted_at IS NULL ORDER BY control_id ASC',
      [clientId, tenantId]
    );
    return rows;
  },

  // Finds all RCM records for a tenant (optionally filtered by client_id) with client_name
  findAll: async (tenantId, clientId = null) => {
    let query = `
      SELECT r.*, c.client_name 
      FROM rcm r
      JOIN clients c ON r.client_id = c.client_id
      WHERE r.tenant_id = ? AND r.deleted_at IS NULL ORDER BY r.control_id ASC
    `;
    const params = [tenantId];
    
    if (clientId) {
      query += ' AND r.client_id = ?';
      params.push(clientId);
    }
    
    query += ' ORDER BY r.created_at DESC';
    
    const [rows] = await db.query(query, params);
    return rows;
  },

  // Soft delete all existing RCM records for a client
  deleteAllByClient: async (clientId, tenantId) => {
    const [result] = await db.query(
      'UPDATE rcm SET deleted_at = NOW() WHERE client_id = ? AND tenant_id = ? AND deleted_at IS NULL',
      [clientId, tenantId]
    );
    return result.affectedRows;
  },

  // Bulk insert with duplicate check (assuming data properties are now DB column names)
  bulkInsertRCM: async (data, clientId, tenantId, userId) => {
    if (!data || data.length === 0) {
      return { insertedCount: 0, skippedCount: 0, errors: [] };
    }

    const connection = await db.getConnection();
    await connection.beginTransaction();

    let insertedCount = 0;
    let skippedCount = 0;
    const errors = [];

    const ALL_RCM_COLUMNS = [
      'control_id', 'process', 'sub_process', 'risk_id', 
      'risk_description', 'classification', 'control_description', 
      'summary', 'frequency', 'automated_manual', 'preventive_detective', 
      'significance', 'risk_rating', 'owners', 'mitigates', 'location', 
      'key_reports', 'it_systems'
    ];
    
    try {
      for (const row of data) {
        const controlId = row.control_id;

        // Validate required field
        if (!controlId) {
          skippedCount++;
          errors.push({ 
            control_id: controlId || 'N/A', 
            reason: 'Missing required field: control_id.',
            status: 'skipped'
          });
          continue;
        }

        // Check for Duplicate (client_id, control_id)
        const [existing] = await connection.query(
          'SELECT rcm_id FROM rcm WHERE client_id = ? AND tenant_id = ? AND control_id = ? AND deleted_at IS NULL',
          [clientId, tenantId, controlId]
        );

        if (existing.length > 0) {
          skippedCount++;
          errors.push({ 
            control_id: controlId, 
            reason: 'Duplicate Control ID for this client.',
            status: 'skipped'
          });
          continue; // Skip this row
        }

        // Prepare Insert Query
        const columnsToInsert = ['tenant_id', 'client_id', 'created_by', ...ALL_RCM_COLUMNS];
        const placeholders = columnsToInsert.map(() => '?').join(', ');
        
        const insertSql = `
          INSERT INTO rcm (${columnsToInsert.join(', ')}) 
          VALUES (${placeholders})
        `;

        // Map data to the order of columns, providing null for missing non-mandatory fields
        const values = [
          tenantId, // tenant_id (Injected)
          clientId, // client_id (Injected)
          userId, // created_by (Injected)
          // Data from CSV/Excel
          row.control_id || null, 
          row.process || null,
          row.sub_process || null,
          row.risk_id || null,
          row.risk_description || null,
          row.classification || null,
          row.control_description || null,
          row.summary || null,
          row.frequency || null,
          row.automated_manual || null,
          row.preventive_detective || null,
          row.significance || null,
          row.risk_rating || null,
          row.owners || null,
          row.mitigates || null,
          row.location || null,
          row.key_reports || null,
          row.it_systems || null,
        ];

        if (values.length !== columnsToInsert.length) {
            console.error('Column/Value mismatch error for row:', row);
            throw new Error('Internal data structure error during bulk insert.');
        }

        await connection.query(insertSql, values);
        insertedCount++;
      }

      await connection.commit();
      return { insertedCount, skippedCount, errors };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // --- PBC/EVIDENCE LOOKUP FUNCTION ---
  findRcmIdByControlId: async (controlId, clientId, tenantId) => {
    const [rows] = await db.query(
      'SELECT rcm_id FROM rcm WHERE control_id = ? AND client_id = ? AND tenant_id = ? AND deleted_at IS NULL',
      [controlId, clientId, tenantId]
    );
    return rows.length > 0 ? rows[0].rcm_id : null;
  },

  // Update RCM record
  update: async (rcmId, rcmData, tenantId, userId) => {
    const ALL_RCM_COLUMNS = [
      'control_id', 'process', 'sub_process', 'risk_id', 
      'risk_description', 'classification', 'control_description', 
      'summary', 'frequency', 'automated_manual', 'preventive_detective', 
      'significance', 'risk_rating', 'owners', 'mitigates', 'location', 
      'key_reports', 'it_systems'
    ];
    
    const updateFields = [];
    const values = [];
    
    ALL_RCM_COLUMNS.forEach(col => {
      if (rcmData[col] !== undefined) {
        updateFields.push(`${col} = ?`);
        values.push(rcmData[col] || null);
      }
    });
    
    if (updateFields.length === 0) {
      return false;
    }
    
    updateFields.push('updated_at = NOW()', 'updated_by = ?');
    values.push(userId, rcmId, tenantId);
    
    const [result] = await db.query(
      `UPDATE rcm SET ${updateFields.join(', ')} WHERE rcm_id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      values
    );
    
    return result.affectedRows > 0;
  },

  // Delete RCM record (soft delete)
  delete: async (rcmId, tenantId, userId) => {
    const [result] = await db.query(
      'UPDATE rcm SET deleted_at = NOW(), deleted_by = ? WHERE rcm_id = ? AND tenant_id = ? AND deleted_at IS NULL',
      [userId, rcmId, tenantId]
    );
    return result.affectedRows > 0;
  },

  // Find RCM by ID
  findById: async (rcmId, tenantId) => {
    const [rows] = await db.query(
      'SELECT r.*, c.client_name FROM rcm r JOIN clients c ON r.client_id = c.client_id WHERE r.rcm_id = ? AND r.tenant_id = ? AND r.deleted_at IS NULL LIMIT 1',
      [rcmId, tenantId]
    );
    return rows[0] || null;
  }
};

module.exports = RCM;
