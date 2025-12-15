const AiPrompts = require('../models/ai_prompts.model');
const Permission = require('../models/permission.model');
const { isSuperAdmin } = require('../utils/auth.helper');

// Helper function to check permission
const checkPermission = async (user, action, tenantId) => {
  // Super admin has all permissions
  if (isSuperAdmin(user)) {
    return true;
  }
  
  const permissions = await Permission.getByRoleId(user.roleId, tenantId);
  const aiPromptsPermission = permissions.find(p => p.resource === 'AI Prompts');
  
  if (!aiPromptsPermission) {
    return false;
  }
  
  switch (action) {
    case 'view':
      return aiPromptsPermission.can_view === 1;
    case 'create':
      return aiPromptsPermission.can_create === 1;
    case 'update':
      return aiPromptsPermission.can_update === 1;
    case 'delete':
      return aiPromptsPermission.can_delete === 1;
    default:
      return false;
  }
};

// GET all AI prompts for a client
exports.getAllAiPrompts = async (req, res) => {
  try {
    const clientId = req.query.client_id;
    const requestedTenantId = req.query.tenant_id ? parseInt(req.query.tenant_id) : null;
    const tenantId = isSuperAdmin(req.user) ? requestedTenantId : req.user.tenantId;

    if (!clientId) {
      return res.status(400).json({ message: 'Client ID is required.' });
    }

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    // Check view permission
    const hasPermission = await checkPermission(req.user, 'view', tenantId);
    if (!hasPermission) {
      return res.status(403).json({ message: 'You do not have permission to view AI prompts.' });
    }

    const data = await AiPrompts.findAllByClient(clientId, tenantId);
    res.json(data);
  } catch (error) {
    console.error('Error fetching AI prompts:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// GET a single AI prompt by ID
exports.getAiPromptById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    // Check view permission
    const hasPermission = await checkPermission(req.user, 'view', tenantId);
    if (!hasPermission) {
      return res.status(403).json({ message: 'You do not have permission to view AI prompts.' });
    }

    const prompt = await AiPrompts.findById(id, tenantId);
    
    if (!prompt) {
      return res.status(404).json({ message: 'AI prompt not found.' });
    }
    
    res.json(prompt);
  } catch (error) {
    console.error('Error fetching AI prompt:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// POST to create a new AI prompt
exports.createAiPrompt = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    const { client_id, rcm_id, control_id, prompt_text } = req.body;
    const RCM = require('../models/rcm.model');

    if (!client_id) {
      return res.status(400).json({ message: 'Client ID is required.' });
    }

    if (!prompt_text || prompt_text.trim() === '') {
      return res.status(400).json({ message: 'Prompt text is required.' });
    }

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    // Check create permission
    const hasPermission = await checkPermission(req.user, 'create', tenantId);
    if (!hasPermission) {
      return res.status(403).json({ message: 'You do not have permission to create AI prompts.' });
    }

    let finalRcmId = rcm_id;
    
    // If control_id is provided instead of rcm_id, look up the rcm_id
    if (control_id && !rcm_id) {
      finalRcmId = await RCM.findRcmIdByControlId(control_id, client_id, tenantId);
      if (!finalRcmId) {
        return res.status(404).json({ message: `RCM Control ID '${control_id}' not found for this client.` });
      }
    }

    let promptId;
    if (finalRcmId) {
      // Create RCM-specific prompt
      promptId = await AiPrompts.createRcmPrompt(finalRcmId, client_id, tenantId, userId, prompt_text.trim());
    } else {
      // Create client-level default prompt
      promptId = await AiPrompts.createDefaultPrompt(client_id, tenantId, userId, prompt_text.trim());
    }

    res.status(201).json({ 
      message: 'AI prompt created successfully.',
      ai_prompt_id: promptId 
    });
  } catch (error) {
    console.error('Error creating AI prompt:', error);
    res.status(500).json({ message: 'Server error during AI prompt creation.' });
  }
};

// PUT to update an AI prompt
exports.updateAiPrompt = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    const { prompt_text } = req.body;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    if (!prompt_text || prompt_text.trim() === '') {
      return res.status(400).json({ message: 'Prompt text is required.' });
    }

    // Check update permission
    const hasPermission = await checkPermission(req.user, 'update', tenantId);
    if (!hasPermission) {
      return res.status(403).json({ message: 'You do not have permission to update AI prompts.' });
    }

    const updated = await AiPrompts.update(id, prompt_text.trim(), tenantId, userId);

    if (!updated) {
      return res.status(404).json({ message: 'AI prompt not found or you do not have permission to update it.' });
    }

    res.json({ message: 'AI prompt updated successfully.' });
  } catch (error) {
    console.error('Error updating AI prompt:', error);
    res.status(500).json({ message: 'Server error during AI prompt update.' });
  }
};

// DELETE to soft delete an AI prompt
exports.deleteAiPrompt = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    // Check delete permission
    const hasPermission = await checkPermission(req.user, 'delete', tenantId);
    if (!hasPermission) {
      return res.status(403).json({ message: 'You do not have permission to delete AI prompts.' });
    }

    const deleted = await AiPrompts.delete(id, tenantId, userId);

    if (!deleted) {
      return res.status(404).json({ message: 'AI prompt not found or you do not have permission to delete it.' });
    }

    res.json({ message: 'AI prompt deleted successfully.' });
  } catch (error) {
    console.error('Error deleting AI prompt:', error);
    res.status(500).json({ message: 'Server error during AI prompt deletion.' });
  }
};

