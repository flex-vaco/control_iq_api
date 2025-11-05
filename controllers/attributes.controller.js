const Attributes = require('../models/attributes.model');
const RCM = require('../models/rcm.model');

// GET all Attributes records
exports.getAllAttributes = async (req, res) => {
  try {
    const clientId = req.query.client_id || null;
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }
    // Use findAll to get data with client_name (supports both filtered and unfiltered)
    const data = await Attributes.findAll(tenantId, clientId);
    res.json(data);
  } catch (error) {
    console.error('Error fetching Attributes data:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// PUT update Attribute
exports.updateAttribute = async (req, res) => {
  try {
    const attributeId = req.params.id;
    const { rcm_id, attribute_name, attribute_description, test_steps } = req.body;
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    const attributeData = {
      rcm_id,
      attribute_name,
      attribute_description: attribute_description || null,
      test_steps: test_steps || null
    };

    const updated = await Attributes.update(attributeId, attributeData, tenantId, userId);
    
    if (!updated) {
      return res.status(404).json({ message: 'Attribute not found or already deleted.' });
    }

    res.json({ message: 'Attribute updated successfully.' });
  } catch (error) {
    console.error('Error updating Attribute:', error);
    res.status(500).json({ message: 'Server error during attribute update.' });
  }
};

// DELETE Attribute
exports.deleteAttribute = async (req, res) => {
  try {
    const attributeId = req.params.id;
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    const deleted = await Attributes.delete(attributeId, tenantId, userId);
    
    if (!deleted) {
      return res.status(404).json({ message: 'Attribute not found or already deleted.' });
    }

    res.json({ message: 'Attribute deleted successfully.' });
  } catch (error) {
    console.error('Error deleting Attribute:', error);
    res.status(500).json({ message: 'Server error during attribute deletion.' });
  }
};

// POST to save JSON data to database
exports.saveAttributes = async (req, res) => {
  try {
    const { data, client_id } = req.body;
    const clientId = client_id;
    const tenantId = req.user.tenantId;
    if (!clientId) {
      return res.status(400).json({ message: 'Client ID is required.' });
    }
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }
    const userId = req.user.userId;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ message: 'Invalid data format. Expected an array.' });
    }

    // Re-validate Control UIDs and match to RCM records
    const validatedRecords = [];
    const errors = [];

    for (const row of data) {
      // Validate required fields
      if (!row.control_uid || !row.attribute_name) {
        errors.push({
          control_uid: row.control_uid || 'N/A',
          reason: 'Missing required fields: Control UID or Attribute Name',
          status: 'skipped'
        });
        continue;
      }

      // Match Control UID to RCM control_id to get rcm_id
      const rcmId = await RCM.findRcmIdByControlId(row.control_uid.trim(), clientId, tenantId);
      
      if (!rcmId) {
        errors.push({
          control_uid: row.control_uid,
          reason: `Control UID '${row.control_uid}' not found in RCM records`,
          status: 'skipped'
        });
        continue;
      }

      // Add valid record
      validatedRecords.push({
        rcm_id: rcmId,
        attribute_name: row.attribute_name.trim(),
        attribute_description: row.attribute_description ? row.attribute_description.trim() : null,
        test_steps: row.test_steps ? row.test_steps.trim() : null,
      });
    }

    if (validatedRecords.length === 0) {
      return res.status(400).json({ 
        message: 'No valid records to save after validation.', 
        errors: errors 
      });
    }

    // Bulk insert
    const importSummary = await Attributes.bulkInsertAttributes(validatedRecords, clientId, tenantId, userId);

    // Combine validation errors with DB errors
    importSummary.errors.push(...errors);
    importSummary.skippedCount += errors.length;

    res.json({
      message: 'Attributes saved successfully.',
      inserted: importSummary.insertedCount,
      skipped: importSummary.skippedCount,
      errors: importSummary.errors
    });

  } catch (error) {
    console.error('Attributes Save Error:', error);
    res.status(500).json({ message: 'Failed to save attributes.', error: error.message });
  }
};