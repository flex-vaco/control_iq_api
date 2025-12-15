const db = require('../config/db');
const AiPrompts = require('./ai_prompts.model');

const Client = {
  // Find all clients for a specific tenant (tenantId can be null for super admin)
  findAllByTenant: async (tenantId = null) => {
    let query = `
      SELECT c.*, t.tenant_name
      FROM clients c
      LEFT JOIN tenants t ON c.tenant_id = t.tenant_id
      WHERE c.deleted_at IS NULL
    `;
    const params = [];
    
    if (tenantId !== null) {
      query += ' AND c.tenant_id = ?';
      params.push(tenantId);
    }
    
    query += ' ORDER BY t.tenant_name, c.client_name ASC';
    
    const [rows] = await db.query(query, params);
    return rows;
  },

  // Find a client by ID and tenant ID
  findById: async (clientId, tenantId) => {
    const [rows] = await db.query(
      `SELECT * FROM clients 
       WHERE client_id = ? AND tenant_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [clientId, tenantId]
    );
    return rows[0] || null;
  },

  // Create a new client
  create: async (clientData, tenantId, userId) => {
    const {
      client_name,
      industry,
      region,
      contact_name,
      contact_email,
      contact_phone,
      status = 'active'
    } = clientData;

    const [result] = await db.query(
      `INSERT INTO clients 
        (tenant_id, client_name, industry, region, contact_name, contact_email, contact_phone, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, client_name, industry || null, region || null, contact_name || null, contact_email || null, contact_phone || null, status, userId]
    );
    
    const clientId = result.insertId;
    
    // Create default AI prompt for the client
    const defaultPromptText = `- Understand the context and meaning of both evidence and requirements
- Match based on semantic meaning, not exact text
- Consider synonyms, equivalent terms, and policy variations`;
    
    try {
      await AiPrompts.createDefaultPrompt(clientId, tenantId, userId, defaultPromptText);
    } catch (error) {
      // Log error but don't fail client creation if prompt creation fails
      console.error('Error creating default AI prompt for client:', error);
    }
    
    return clientId;
  },

  // Update a client
  update: async (clientId, clientData, tenantId, userId) => {
    const {
      client_name,
      industry,
      region,
      contact_name,
      contact_email,
      contact_phone,
      status
    } = clientData;

    const [result] = await db.query(
      `UPDATE clients 
       SET client_name = ?, industry = ?, region = ?, contact_name = ?, 
           contact_email = ?, contact_phone = ?, status = ?, 
           updated_at = NOW(), updated_by = ?
       WHERE client_id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [client_name, industry || null, region || null, contact_name || null, 
       contact_email || null, contact_phone || null, status, userId, clientId, tenantId]
    );
    
    return result.affectedRows > 0;
  },

  // Soft delete a client
  delete: async (clientId, tenantId, userId) => {
    const [result] = await db.query(
      `UPDATE clients 
       SET deleted_at = NOW(), deleted_by = ?
       WHERE client_id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [userId, clientId, tenantId]
    );
    
    return result.affectedRows > 0;
  },

  // Get all clients (for dropdowns)
  findAll: async () => {
    const [rows] = await db.query(
      `SELECT client_id, client_name FROM clients 
       WHERE deleted_at IS NULL
       ORDER BY client_name ASC`
    );
    return rows;
  }
};

module.exports = Client;

