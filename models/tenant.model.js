const db = require('../config/db');

const Tenant = {
  // Get all tenants
  getAll: async () => {
    const [rows] = await db.query(
      `SELECT tenant_id, tenant_name, industry, region, status 
       FROM tenants 
       WHERE deleted_at IS NULL 
       ORDER BY tenant_name`
    );
    return rows;
  },

  // Get tenant by ID
  getById: async (tenantId) => {
    const [rows] = await db.query(
      'SELECT * FROM tenants WHERE tenant_id = ? AND deleted_at IS NULL',
      [tenantId]
    );
    return rows[0];
  }
};

module.exports = Tenant;

