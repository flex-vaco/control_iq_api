const User = require('../models/user.model');
const { isSuperAdmin } = require('../utils/auth.helper');

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    // Super admin can see all users, regular users see only their tenant's users
    const tenantId = isSuperAdmin(req.user) ? null : req.user.tenantId;
    const users = await User.getAll(tenantId);
    
    // Remove password from response
    const sanitizedUsers = users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
    
    res.json(sanitizedUsers);
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Failed to fetch users.' });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    
    const user = await User.getById(id, tenantId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ message: 'Failed to fetch user.' });
  }
};

// Create new user
exports.createUser = async (req, res) => {
  try {
    const { username, first_name, last_name, email, role_id, password, is_active, tenant_id } = req.body;
    // Super admin can specify tenant_id, regular users use their own tenant
    const tenantId = isSuperAdmin(req.user) ? (tenant_id || req.user.tenantId) : req.user.tenantId;
    const createdBy = req.user.userId;
    
    // Validation
    if (!username || !first_name || !last_name || !email || !role_id || !password) {
      return res.status(400).json({ message: 'All required fields must be provided.' });
    }
    
    if (isSuperAdmin(req.user) && !tenant_id) {
      return res.status(400).json({ message: 'Tenant is required for Super Admin.' });
    }
    
    // Check if email already exists
    const emailExists = await User.emailExists(email, tenantId);
    if (emailExists) {
      return res.status(400).json({ message: 'Email already exists.' });
    }
    
    // Check if username already exists
    const usernameExists = await User.usernameExists(username, tenantId);
    if (usernameExists) {
      return res.status(400).json({ message: 'Username already exists.' });
    }
    
    const userId = await User.create({
      username,
      first_name,
      last_name,
      email,
      role_id,
      password,
      tenant_id: tenantId,
      is_active: is_active !== undefined ? is_active : 1,
      created_by: createdBy
    });
    
    res.status(201).json({ 
      message: 'User created successfully.',
      user_id: userId 
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Failed to create user.' });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, first_name, last_name, email, role_id, password, is_active } = req.body;
    const tenantId = req.user.tenantId;
    const updatedBy = req.user.userId;
    
    // Validation
    if (!username || !first_name || !last_name || !email || !role_id) {
      return res.status(400).json({ message: 'All required fields must be provided.' });
    }
    
    // Check if user exists
    const existingUser = await User.getById(id, tenantId);
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    // Check if email already exists (excluding current user)
    if (email !== existingUser.email) {
      const emailExists = await User.emailExists(email, tenantId, id);
      if (emailExists) {
        return res.status(400).json({ message: 'Email already exists.' });
      }
    }
    
    // Check if username already exists (excluding current user)
    if (username !== existingUser.username) {
      const usernameExists = await User.usernameExists(username, tenantId, id);
      if (usernameExists) {
        return res.status(400).json({ message: 'Username already exists.' });
      }
    }
    
    const success = await User.update(id, {
      username,
      first_name,
      last_name,
      email,
      role_id,
      password, // Will only update if provided
      is_active: is_active !== undefined ? is_active : existingUser.is_active,
      updated_by: updatedBy
    }, tenantId);
    
    if (!success) {
      return res.status(404).json({ message: 'User not found or could not be updated.' });
    }
    
    res.json({ message: 'User updated successfully.' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Failed to update user.' });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const deletedBy = req.user.userId;
    
    // Prevent self-deletion
    if (parseInt(id) === req.user.userId) {
      return res.status(400).json({ message: 'You cannot delete your own account.' });
    }
    
    const success = await User.delete(id, tenantId, deletedBy);
    
    if (!success) {
      return res.status(404).json({ message: 'User not found or could not be deleted.' });
    }
    
    res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Failed to delete user.' });
  }
};

