const db = require('../config/db');

const Attributes = {
  // Find all Test Attributes records for a specific client
  findAllByClient: async (clientId, tenantId) => {
    const [rows] = await db.query(
      `SELECT ta.*, r.control_id, r.control_description 
       FROM test_attributes ta
       JOIN rcm r ON ta.rcm_id = r.rcm_id
       WHERE ta.client_id = ? AND ta.tenant_id = ? AND ta.deleted_at IS NULL
       ORDER BY ta.created_at DESC`,
      [clientId, tenantId]
    );
    return rows;
  },

  // Find all Test Attributes records for a tenant (optionally filtered by client_id) with client_name
  // tenantId can be null for super admin to see all data
  findAll: async (tenantId = null, clientId = null) => {
    let query = `
      SELECT ta.*, r.control_id, r.control_description, c.client_name, t.tenant_name
      FROM test_attributes ta
      JOIN rcm r ON ta.rcm_id = r.rcm_id
      JOIN clients c ON ta.client_id = c.client_id
      LEFT JOIN tenants t ON ta.tenant_id = t.tenant_id
      WHERE ta.deleted_at IS NULL
    `;
    const params = [];
    
    if (tenantId !== null) {
      query += ' AND ta.tenant_id = ?';
      params.push(tenantId);
    }
    
    if (clientId) {
      query += ' AND ta.client_id = ?';
      params.push(clientId);
    }
    
    query += ' ORDER BY t.tenant_name, ta.created_at DESC';
    
    const [rows] = await db.query(query, params);
    return rows;
  },

  // Bulk insert attributes with duplicate check
  bulkInsertAttributes: async (data, clientId, tenantId, userId) => {
    if (!data || data.length === 0) {
      return { insertedCount: 0, skippedCount: 0, errors: [] };
    }

    const connection = await db.getConnection();
    await connection.beginTransaction();

    let insertedCount = 0;
    let skippedCount = 0;
    const errors = [];

    try {
      for (const row of data) {
        const { rcm_id, attribute_name, attribute_description, test_steps } = row;

        // Validate required fields
        if (!rcm_id || !attribute_name) {
          skippedCount++;
          errors.push({ 
            control_uid: row.control_uid || 'N/A',
            reason: 'Missing required fields: rcm_id or attribute_name.',
            status: 'skipped'
          });
          continue;
        }

        // Insert into test_attributes table
        await connection.query(
          `INSERT INTO test_attributes 
            (rcm_id, tenant_id, client_id, attribute_name, attribute_description, test_steps, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [rcm_id, tenantId, clientId, attribute_name, attribute_description || null, test_steps || null, userId]
        );
        
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

  // Update attribute
  update: async (attributeId, attributeData, tenantId, userId) => {
    const [result] = await db.query(
      `UPDATE test_attributes 
       SET attribute_name = ?, attribute_description = ?, test_steps = ?, 
           updated_at = NOW(), updated_by = ?
       WHERE attribute_id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [
        attributeData.attribute_name,
        attributeData.attribute_description || null,
        attributeData.test_steps || null,
        userId,
        attributeId,
        tenantId
      ]
    );
    return result.affectedRows > 0;
  },

  // Delete attribute (soft delete)
  delete: async (attributeId, tenantId, userId) => {
    const [result] = await db.query(
      'UPDATE test_attributes SET deleted_at = NOW(), deleted_by = ? WHERE attribute_id = ? AND tenant_id = ? AND deleted_at IS NULL',
      [userId, attributeId, tenantId]
    );
    return result.affectedRows > 0;
  },

  // Find attribute by ID
  findById: async (attributeId, tenantId) => {
    const [rows] = await db.query(
      `SELECT ta.*, r.control_id, r.control_description, c.client_name
       FROM test_attributes ta
       JOIN rcm r ON ta.rcm_id = r.rcm_id
       JOIN clients c ON ta.client_id = c.client_id
       WHERE ta.attribute_id = ? AND ta.tenant_id = ? AND ta.deleted_at IS NULL
       LIMIT 1`,
      [attributeId, tenantId]
    );
    return rows[0] || null;
  }
};

module.exports = Attributes;