const db = require('../config/db');

const Role = {
  // Get all roles for a tenant (or all roles if tenantId is null for super admin)
  getAll: async (tenantId = null) => {
    let query = `SELECT r.*, 
       (SELECT COUNT(*) FROM users u WHERE u.role_id = r.role_id AND u.deleted_at IS NULL) as user_count,
       t.tenant_name
       FROM roles r 
       LEFT JOIN tenants t ON r.tenant_id = t.tenant_id
       WHERE r.deleted_at IS NULL`;
    
    const params = [];
    if (tenantId !== null) {
      query += ' AND r.tenant_id = ?';
      params.push(tenantId);
    }
    
    query += ' ORDER BY t.tenant_name, r.role_name';
    
    const [rows] = await db.query(query, params);
    return rows;
  },

  // Get role by ID (tenantId can be null for super admin)
  getById: async (roleId, tenantId = null) => {
    let query = 'SELECT * FROM roles WHERE role_id = ? AND deleted_at IS NULL';
    const params = [roleId];
    
    if (tenantId !== null) {
      query += ' AND tenant_id = ?';
      params.push(tenantId);
    }
    
    const [rows] = await db.query(query, params);
    return rows[0];
  },

  // Create new role
  create: async (roleData) => {
    const { role_name, description, tenant_id, created_by } = roleData;
    const [result] = await db.query(
      'INSERT INTO roles (role_name, description, tenant_id, created_by) VALUES (?, ?, ?, ?)',
      [role_name, description, tenant_id, created_by]
    );
    return result.insertId;
  },

  // Update role
  update: async (roleId, roleData, tenantId) => {
    const { role_name, description, updated_by } = roleData;
    const [result] = await db.query(
      'UPDATE roles SET role_name = ?, description = ?, updated_by = ? WHERE role_id = ? AND tenant_id = ? AND deleted_at IS NULL',
      [role_name, description, updated_by, roleId, tenantId]
    );
    return result.affectedRows > 0;
  },

  // Delete role (soft delete)
  delete: async (roleId, tenantId, deletedBy) => {
    const [result] = await db.query(
      'UPDATE roles SET deleted_at = NOW(), deleted_by = ? WHERE role_id = ? AND tenant_id = ? AND deleted_at IS NULL',
      [deletedBy, roleId, tenantId]
    );
    return result.affectedRows > 0;
  },

  // Check if role name exists (excluding current role for updates)
  nameExists: async (roleName, tenantId, excludeRoleId = null) => {
    let query = 'SELECT COUNT(*) as count FROM roles WHERE role_name = ? AND tenant_id = ? AND deleted_at IS NULL';
    const params = [roleName, tenantId];
    
    if (excludeRoleId) {
      query += ' AND role_id != ?';
      params.push(excludeRoleId);
    }
    
    const [rows] = await db.query(query, params);
    return rows[0].count > 0;
  }
};

module.exports = Role;

