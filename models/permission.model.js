const db = require('../config/db');

const Permission = {
  // Get all permissions for a role (tenantId can be null for super admin)
  getByRoleId: async (roleId, tenantId = null) => {
    let query = 'SELECT * FROM permissions WHERE role_id = ? AND deleted_at IS NULL';
    const params = [roleId];
    
    if (tenantId !== null) {
      query += ' AND tenant_id = ?';
      params.push(tenantId);
    }
    
    query += ' ORDER BY resource';
    
    const [rows] = await db.query(query, params);
    return rows;
  },

  // Get permissions for multiple roles
  getByRoleIds: async (roleIds, tenantId) => {
    if (!roleIds || roleIds.length === 0) return [];
    const placeholders = roleIds.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT * FROM permissions 
       WHERE role_id IN (${placeholders}) AND tenant_id = ? AND deleted_at IS NULL 
       ORDER BY resource`,
      [...roleIds, tenantId]
    );
    return rows;
  },

  // Get permission by ID
  getById: async (permissionId, tenantId) => {
    const [rows] = await db.query(
      'SELECT * FROM permissions WHERE permission_id = ? AND tenant_id = ? AND deleted_at IS NULL',
      [permissionId, tenantId]
    );
    return rows[0];
  },

  // Create or update permission (upsert)
  upsert: async (permissionData) => {
    const { role_id, resource, can_view, can_create, can_update, can_delete, tenant_id, created_by, updated_by } = permissionData;
    
    // Check if permission exists
    const [existing] = await db.query(
      'SELECT permission_id FROM permissions WHERE role_id = ? AND resource = ? AND tenant_id = ? AND deleted_at IS NULL',
      [role_id, resource, tenant_id]
    );

    if (existing.length > 0) {
      // Update existing
      const [result] = await db.query(
        `UPDATE permissions 
         SET can_view = ?, can_create = ?, can_update = ?, can_delete = ?, updated_by = ? 
         WHERE permission_id = ?`,
        [can_view, can_create, can_update, can_delete, updated_by, existing[0].permission_id]
      );
      return existing[0].permission_id;
    } else {
      // Create new
      const [result] = await db.query(
        `INSERT INTO permissions (role_id, resource, can_view, can_create, can_update, can_delete, tenant_id, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [role_id, resource, can_view, can_create, can_update, can_delete, tenant_id, created_by]
      );
      return result.insertId;
    }
  },

  // Bulk upsert permissions for a role
  bulkUpsert: async (roleId, permissions, tenantId, userId) => {
    const results = [];
    
    for (const perm of permissions) {
      const permissionData = {
        role_id: roleId,
        resource: perm.resource,
        can_view: perm.can_view ? 1 : 0,
        can_create: perm.can_create ? 1 : 0,
        can_update: perm.can_update ? 1 : 0,
        can_delete: perm.can_delete ? 1 : 0,
        tenant_id: tenantId,
        created_by: userId,
        updated_by: userId
      };
      
      // Check if permission exists
      const [existing] = await db.query(
        'SELECT permission_id FROM permissions WHERE role_id = ? AND resource = ? AND tenant_id = ? AND deleted_at IS NULL',
        [roleId, perm.resource, tenantId]
      );

      let permissionId;
      if (existing.length > 0) {
        // Update existing
        await db.query(
          `UPDATE permissions 
           SET can_view = ?, can_create = ?, can_update = ?, can_delete = ?, updated_by = ? 
           WHERE permission_id = ?`,
          [permissionData.can_view, permissionData.can_create, permissionData.can_update, permissionData.can_delete, userId, existing[0].permission_id]
        );
        permissionId = existing[0].permission_id;
      } else {
        // Create new
        const [result] = await db.query(
          `INSERT INTO permissions (role_id, resource, can_view, can_create, can_update, can_delete, tenant_id, created_by) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [roleId, perm.resource, permissionData.can_view, permissionData.can_create, permissionData.can_update, permissionData.can_delete, tenantId, userId]
        );
        permissionId = result.insertId;
      }
      
      results.push(permissionId);
    }
    
    return results;
  },

  // Delete permission (soft delete)
  delete: async (permissionId, tenantId, deletedBy) => {
    const [result] = await db.query(
      'UPDATE permissions SET deleted_at = NOW(), deleted_by = ? WHERE permission_id = ? AND tenant_id = ? AND deleted_at IS NULL',
      [deletedBy, permissionId, tenantId]
    );
    return result.affectedRows > 0;
  },

  // Delete all permissions for a role
  deleteByRoleId: async (roleId, tenantId, deletedBy) => {
    const [result] = await db.query(
      'UPDATE permissions SET deleted_at = NOW(), deleted_by = ? WHERE role_id = ? AND tenant_id = ? AND deleted_at IS NULL',
      [deletedBy, roleId, tenantId]
    );
    return result.affectedRows;
  }
};

module.exports = Permission;

