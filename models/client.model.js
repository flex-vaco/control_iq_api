const db = require('../config/db');

const Client = {
  // Find all clients for a specific tenant
  findAllByTenant: async (tenantId) => {
    const [rows] = await db.query(
      `SELECT * FROM clients 
       WHERE tenant_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [tenantId]
    );
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
    
    return result.insertId;
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

