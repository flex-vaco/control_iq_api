const db = require('../config/db');

const AiPrompts = {
  // Get prompt by hierarchy: first check rcm_id, then client_id default, then system default
  // Returns the most specific prompt available
  getPromptByHierarchy: async (rcmId, clientId, tenantId) => {
    // First, try to get RCM-specific prompt
    if (rcmId) {
      const [rcmRows] = await db.query(
        `SELECT prompt_text FROM ai_prompts 
         WHERE rcm_id = ? AND client_id = ? AND tenant_id = ? AND deleted_at IS NULL
         LIMIT 1`,
        [rcmId, clientId, tenantId]
      );
      
      if (rcmRows.length > 0) {
        return rcmRows[0].prompt_text;
      }
    }
    
    // If no RCM-specific prompt, try to get client-level default prompt
    const [clientRows] = await db.query(
      `SELECT prompt_text FROM ai_prompts 
       WHERE client_id = ? AND tenant_id = ? AND rcm_id IS NULL AND is_default = 1 AND deleted_at IS NULL
       LIMIT 1`,
      [clientId, tenantId]
    );
    
    if (clientRows.length > 0) {
      return clientRows[0].prompt_text;
    }
    
    // If no client default, return null (will use hardcoded default in controller)
    return null;
  },

  // Create a default prompt for a client
  createDefaultPrompt: async (clientId, tenantId, userId, promptText) => {
    const [result] = await db.query(
      `INSERT INTO ai_prompts 
        (tenant_id, client_id, rcm_id, prompt_text, is_default, created_by)
       VALUES (?, ?, NULL, ?, 1, ?)`,
      [tenantId, clientId, promptText, userId]
    );
    
    return result.insertId;
  },

  // Create an RCM-specific prompt
  // If a prompt already exists for this RCM (non-deleted), update it; otherwise, create new
  createRcmPrompt: async (rcmId, clientId, tenantId, userId, promptText) => {
    // Check if an active prompt already exists
    const [existing] = await db.query(
      `SELECT ai_prompt_id FROM ai_prompts 
       WHERE rcm_id = ? AND client_id = ? AND tenant_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [rcmId, clientId, tenantId]
    );
    
    if (existing.length > 0) {
      // Update existing prompt
      const [result] = await db.query(
        `UPDATE ai_prompts 
         SET prompt_text = ?, updated_at = NOW(), updated_by = ?
         WHERE ai_prompt_id = ?`,
        [promptText, userId, existing[0].ai_prompt_id]
      );
      return existing[0].ai_prompt_id;
    } else {
      // Create new prompt
      const [result] = await db.query(
        `INSERT INTO ai_prompts 
          (tenant_id, client_id, rcm_id, prompt_text, is_default, created_by)
         VALUES (?, ?, ?, ?, 0, ?)`,
        [tenantId, clientId, rcmId, promptText, userId]
      );
      return result.insertId;
    }
  },

  // Update a prompt
  update: async (promptId, promptText, tenantId, userId) => {
    const [result] = await db.query(
      `UPDATE ai_prompts 
       SET prompt_text = ?, updated_at = NOW(), updated_by = ?
       WHERE ai_prompt_id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [promptText, userId, promptId, tenantId]
    );
    
    return result.affectedRows > 0;
  },

  // Get all prompts for a client (for management)
  findAllByClient: async (clientId, tenantId) => {
    const [rows] = await db.query(
      `SELECT ap.*, r.control_id, r.control_description
       FROM ai_prompts ap
       LEFT JOIN rcm r ON ap.rcm_id = r.rcm_id
       WHERE ap.client_id = ? AND ap.tenant_id = ? AND ap.deleted_at IS NULL
       ORDER BY ap.is_default DESC, r.control_id ASC`,
      [clientId, tenantId]
    );
    
    return rows;
  },

  // Get prompt by ID
  findById: async (promptId, tenantId) => {
    const [rows] = await db.query(
      `SELECT ap.*, r.control_id, r.control_description
       FROM ai_prompts ap
       LEFT JOIN rcm r ON ap.rcm_id = r.rcm_id
       WHERE ap.ai_prompt_id = ? AND ap.tenant_id = ? AND ap.deleted_at IS NULL
       LIMIT 1`,
      [promptId, tenantId]
    );
    
    return rows.length > 0 ? rows[0] : null;
  },

  // Soft delete a prompt
  delete: async (promptId, tenantId, userId) => {
    const [result] = await db.query(
      `UPDATE ai_prompts 
       SET deleted_at = NOW(), deleted_by = ?
       WHERE ai_prompt_id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [userId, promptId, tenantId]
    );
    
    return result.affectedRows > 0;
  }
};

module.exports = AiPrompts;

