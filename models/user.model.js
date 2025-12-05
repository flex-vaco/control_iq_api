const db = require('../config/db');
const bcrypt = require('bcryptjs');

const User = {
  findByEmail: async (email) => {
    const [rows] = await db.query(
      'SELECT * FROM users WHERE email = ? AND deleted_at IS NULL',
      [email]
    );
    return rows[0];
  },

  // Get all users for a tenant (or all users if tenantId is null for super admin)
  getAll: async (tenantId = null) => {
    let query = `SELECT u.*, r.role_name, r.description as role_description, t.tenant_name
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.role_id 
       LEFT JOIN tenants t ON u.tenant_id = t.tenant_id
       WHERE u.deleted_at IS NULL`;
    
    const params = [];
    if (tenantId !== null) {
      query += ' AND u.tenant_id = ?';
      params.push(tenantId);
    }
    
    query += ' ORDER BY t.tenant_name, u.first_name, u.last_name';
    
    const [rows] = await db.query(query, params);
    return rows;
  },

  // Get user by ID
  getById: async (userId, tenantId) => {
    const [rows] = await db.query(
      `SELECT u.*, r.role_name, r.description as role_description 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.role_id 
       WHERE u.user_id = ? AND u.tenant_id = ? AND u.deleted_at IS NULL`,
      [userId, tenantId]
    );
    return rows[0];
  },

  // Create new user
  create: async (userData) => {
    const { username, first_name, last_name, email, role_id, password, tenant_id, is_active, created_by } = userData;
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const [result] = await db.query(
      `INSERT INTO users (username, first_name, last_name, email, role_id, password, tenant_id, is_active, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, first_name, last_name, email, role_id, hashedPassword, tenant_id, is_active || 1, created_by]
    );
    return result.insertId;
  },

  // Update user
  update: async (userId, userData, tenantId) => {
    const { username, first_name, last_name, email, role_id, password, is_active, updated_by } = userData;
    
    let query = `UPDATE users SET username = ?, first_name = ?, last_name = ?, email = ?, role_id = ?, is_active = ?, updated_by = ?`;
    const params = [username, first_name, last_name, email, role_id, is_active, updated_by];
    
    // Only update password if provided
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password = ?';
      params.push(hashedPassword);
    }
    
    query += ' WHERE user_id = ? AND tenant_id = ? AND deleted_at IS NULL';
    params.push(userId, tenantId);
    
    const [result] = await db.query(query, params);
    return result.affectedRows > 0;
  },

  // Delete user (soft delete)
  delete: async (userId, tenantId, deletedBy) => {
    const [result] = await db.query(
      'UPDATE users SET deleted_at = NOW(), deleted_by = ? WHERE user_id = ? AND tenant_id = ? AND deleted_at IS NULL',
      [deletedBy, userId, tenantId]
    );
    return result.affectedRows > 0;
  },

  // Check if email exists (excluding current user for updates)
  emailExists: async (email, tenantId, excludeUserId = null) => {
    let query = 'SELECT COUNT(*) as count FROM users WHERE email = ? AND tenant_id = ? AND deleted_at IS NULL';
    const params = [email, tenantId];
    
    if (excludeUserId) {
      query += ' AND user_id != ?';
      params.push(excludeUserId);
    }
    
    const [rows] = await db.query(query, params);
    return rows[0].count > 0;
  },

  // Check if username exists (excluding current user for updates)
  usernameExists: async (username, tenantId, excludeUserId = null) => {
    let query = 'SELECT COUNT(*) as count FROM users WHERE username = ? AND tenant_id = ? AND deleted_at IS NULL';
    const params = [username, tenantId];
    
    if (excludeUserId) {
      query += ' AND user_id != ?';
      params.push(excludeUserId);
    }
    
    const [rows] = await db.query(query, params);
    return rows[0].count > 0;
  }
};

module.exports = User;