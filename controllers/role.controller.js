const Role = require('../models/role.model');
const { isSuperAdmin } = require('../utils/auth.helper');

// Get all roles
exports.getAllRoles = async (req, res) => {
  try {
    // Super admin can see all roles, regular users see only their tenant's roles
    const tenantId = isSuperAdmin(req.user) ? null : req.user.tenantId;
    const roles = await Role.getAll(tenantId);
    res.json(roles);
  } catch (error) {
    console.error('Get all roles error:', error);
    res.status(500).json({ message: 'Failed to fetch roles.' });
  }
};

// Get role by ID
exports.getRoleById = async (req, res) => {
  try {
    const { id } = req.params;
    // Super admin can access any role, regular users only their tenant's roles
    const tenantId = isSuperAdmin(req.user) ? null : req.user.tenantId;
    
    const role = await Role.getById(id, tenantId);
    
    if (!role) {
      return res.status(404).json({ message: 'Role not found.' });
    }
    
    res.json(role);
  } catch (error) {
    console.error('Get role by ID error:', error);
    res.status(500).json({ message: 'Failed to fetch role.' });
  }
};

// Create new role
exports.createRole = async (req, res) => {
  try {
    const { role_name, description, tenant_id } = req.body;
    // Super admin can specify tenant_id, regular users use their own tenant
    const tenantId = isSuperAdmin(req.user) ? (tenant_id || req.user.tenantId) : req.user.tenantId;
    const createdBy = req.user.userId;
    
    // Validation
    if (!role_name) {
      return res.status(400).json({ message: 'Role name is required.' });
    }
    
    if (isSuperAdmin(req.user) && !tenant_id) {
      return res.status(400).json({ message: 'Tenant is required for Super Admin.' });
    }
    
    // Check if role name already exists
    const nameExists = await Role.nameExists(role_name, tenantId);
    if (nameExists) {
      return res.status(400).json({ message: 'Role name already exists.' });
    }
    
    const roleId = await Role.create({
      role_name,
      description: description || null,
      tenant_id: tenantId,
      created_by: createdBy
    });
    
    res.status(201).json({ 
      message: 'Role created successfully.',
      role_id: roleId 
    });
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ message: 'Failed to create role.' });
  }
};

// Update role
exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role_name, description } = req.body;
    const tenantId = req.user.tenantId;
    const updatedBy = req.user.userId;
    
    // Validation
    if (!role_name) {
      return res.status(400).json({ message: 'Role name is required.' });
    }
    
    // Check if role exists
    const existingRole = await Role.getById(id, tenantId);
    if (!existingRole) {
      return res.status(404).json({ message: 'Role not found.' });
    }
    
    // Check if role name already exists (excluding current role)
    if (role_name !== existingRole.role_name) {
      const nameExists = await Role.nameExists(role_name, tenantId, id);
      if (nameExists) {
        return res.status(400).json({ message: 'Role name already exists.' });
      }
    }
    
    const success = await Role.update(id, {
      role_name,
      description: description || null,
      updated_by: updatedBy
    }, tenantId);
    
    if (!success) {
      return res.status(404).json({ message: 'Role not found or could not be updated.' });
    }
    
    res.json({ message: 'Role updated successfully.' });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ message: 'Failed to update role.' });
  }
};

// Delete role
exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const deletedBy = req.user.userId;
    
    // Check if role exists
    const existingRole = await Role.getById(id, tenantId);
    if (!existingRole) {
      return res.status(404).json({ message: 'Role not found.' });
    }
    
    // Check if role is in use
    if (existingRole.user_count > 0) {
      return res.status(400).json({ 
        message: `Cannot delete role. It is assigned to ${existingRole.user_count} user(s).` 
      });
    }
    
    const success = await Role.delete(id, tenantId, deletedBy);
    
    if (!success) {
      return res.status(404).json({ message: 'Role not found or could not be deleted.' });
    }
    
    res.json({ message: 'Role deleted successfully.' });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ message: 'Failed to delete role.' });
  }
};

