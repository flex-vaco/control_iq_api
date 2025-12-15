const Permission = require('../models/permission.model');
const { isSuperAdmin, getEffectiveTenantId } = require('../utils/auth.helper');

// Get all permissions for a role
exports.getPermissionsByRole = async (req, res) => {
  try {
    const { roleId } = req.params;
    const requestedTenantId = req.query.tenant_id ? parseInt(req.query.tenant_id) : null;
    
    // Super admin can access any tenant's permissions, regular users only their own
    const tenantId = isSuperAdmin(req.user) ? requestedTenantId : req.user.tenantId;
    
    const permissions = await Permission.getByRoleId(roleId, tenantId);
    res.json(permissions);
  } catch (error) {
    console.error('Get permissions by role error:', error);
    res.status(500).json({ message: 'Failed to fetch permissions.' });
  }
};

// Get permissions for current user's role(s)
exports.getMyPermissions = async (req, res) => {
  try {
    const roleId = req.user.roleId;
    
    // Super admin has all permissions, no need to check database
    if (isSuperAdmin(req.user)) {
      // Return all permissions enabled for super admin
      const allResources = [
        'RCM', 'PBC', 'Attributes', 'Client', 'Periodic Testing', 'AI Prompts',
        'User Management', 'Role Management', 'Access Control'
      ];
      return res.json(
        allResources.map(resource => ({
          resource,
          can_view: 1,
          can_create: 1,
          can_update: 1,
          can_delete: 1
        }))
      );
    }
    
    const tenantId = req.user.tenantId;
    const permissions = await Permission.getByRoleId(roleId, tenantId);
    res.json(permissions);
  } catch (error) {
    console.error('Get my permissions error:', error);
    res.status(500).json({ message: 'Failed to fetch permissions.' });
  }
};

// Update permissions for a role (bulk upsert)
exports.updatePermissions = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { permissions, tenant_id } = req.body;
    
    // Super admin can update permissions for any tenant, regular users only their own
    const tenantId = isSuperAdmin(req.user) ? (tenant_id || req.user.tenantId) : req.user.tenantId;
    const userId = req.user.userId;
    
    // Validation
    if (!permissions || !Array.isArray(permissions)) {
      return res.status(400).json({ message: 'Permissions array is required.' });
    }
    
    // Validate each permission
    const validResources = ['RCM', 'PBC', 'Attributes', 'Client', 'Periodic Testing', 'AI Prompts', 'User Management', 'Role Management', 'Access Control'];
    for (const perm of permissions) {
      if (!perm.resource || !validResources.includes(perm.resource)) {
        return res.status(400).json({ 
          message: `Invalid resource: ${perm.resource}. Valid resources are: ${validResources.join(', ')}` 
        });
      }
    }
    
    await Permission.bulkUpsert(roleId, permissions, tenantId, userId);
    
    res.json({ message: 'Permissions updated successfully.' });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({ message: 'Failed to update permissions.' });
  }
};

// Get all available resources
exports.getAvailableResources = async (req, res) => {
  try {
    const resources = [
      { resource: 'RCM', label: 'RCM' },
      { resource: 'PBC', label: 'PBC' },
      { resource: 'Attributes', label: 'Attributes' },
      { resource: 'Client', label: 'Client' },
      { resource: 'Periodic Testing', label: 'Periodic Testing' },
      { resource: 'AI Prompts', label: 'AI Prompts' },
      { resource: 'User Management', label: 'User Management' },
      { resource: 'Role Management', label: 'Role Management' },
      { resource: 'Access Control', label: 'Access Control' }
    ];
    res.json(resources);
  } catch (error) {
    console.error('Get available resources error:', error);
    res.status(500).json({ message: 'Failed to fetch resources.' });
  }
};

// Get all tenants (for super admin)
exports.getAllTenants = async (req, res) => {
  try {
    const Tenant = require('../models/tenant.model');
    const { isSuperAdmin } = require('../utils/auth.helper');
    
    // Only super admin can get all tenants
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ message: 'Access denied. Only Super Admin can view all tenants.' });
    }
    
    const tenants = await Tenant.getAll();
    res.json(tenants);
  } catch (error) {
    console.error('Get all tenants error:', error);
    res.status(500).json({ message: 'Failed to fetch tenants.' });
  }
};

