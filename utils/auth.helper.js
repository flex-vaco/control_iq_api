// Helper function to check if user is Super Admin
// Super Admin has role_id = 1 or role_name = 'Super Admin'
exports.isSuperAdmin = (user) => {
  return user.roleId === 1 || user.role_name === 'Super Admin';
};

// Helper function to get effective tenant ID for super admin
// Super admin can access all tenants, but we need to use the requested tenant_id if provided
exports.getEffectiveTenantId = (user, requestedTenantId = null) => {
  if (exports.isSuperAdmin(user)) {
    // Super admin can access any tenant, use requested tenant or their own
    return requestedTenantId || user.tenantId;
  }
  // Regular users are restricted to their own tenant
  return user.tenantId;
};

