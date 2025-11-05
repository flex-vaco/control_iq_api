const RCM = require('../models/rcm.model');

// GET all RCM records
exports.getAllRcm = async (req, res) => {
  try {
    const clientId = req.query.client_id || null;
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }
    // Use findAll to get data with client_name (supports both filtered and unfiltered)
    const data = await RCM.findAll(tenantId, clientId);
    res.json(data);
  } catch (error) {
    console.error('Error fetching RCM data:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// POST to save JSON data to database
exports.saveRcm = async (req, res) => {
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

    // Validate records
    const validatedRecords = [];
    const errors = [];

    for (const row of data) {
      // Validate required fields
      if (!row.control_id) {
        errors.push({
          control_id: row.control_id || 'N/A',
          reason: 'Missing required field: Control ID',
          status: 'skipped'
        });
        continue;
      }

      // Add valid record
      validatedRecords.push({
        control_id: row.control_id || null,
        process: row.process || null,
        sub_process: row.sub_process || null,
        risk_id: row.risk_id || null,
        risk_description: row.risk_description || null,
        classification: row.classification || null,
        control_description: row.control_description || null,
        summary: row.summary || null,
        frequency: row.frequency || null,
        automated_manual: row.automated_manual || row['automated/manual'] || null,
        preventive_detective: row.preventive_detective || row['preventive/detective'] || null,
        significance: row.significance || null,
        risk_rating: row.risk_rating || null,
        owners: row.owners || null,
        mitigates: row.mitigates || null,
        location: row.location || null,
        key_reports: row.key_reports || null,
        it_systems: row.it_systems || null,
      });
    }

    if (validatedRecords.length === 0) {
      return res.status(400).json({ 
        message: 'No valid records to save after validation.', 
        errors: errors 
      });
    }

    // Bulk insert
    const importSummary = await RCM.bulkInsertRCM(validatedRecords, clientId, tenantId, userId);

    // Combine validation errors with DB errors
    importSummary.errors.push(...errors);
    importSummary.skippedCount += errors.length;

    res.json({
      message: 'RCM data saved successfully.',
      inserted: importSummary.insertedCount,
      skipped: importSummary.skippedCount,
      errors: importSummary.errors
    });

  } catch (error) {
    console.error('RCM Save Error:', error);
    res.status(500).json({ message: 'Failed to save RCM data.', error: error.message });
  }
};

// PUT update RCM record
exports.updateRcm = async (req, res) => {
  try {
    const rcmId = req.params.id;
    const rcmData = req.body;
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    const updated = await RCM.update(rcmId, rcmData, tenantId, userId);
    
    if (!updated) {
      return res.status(404).json({ message: 'RCM record not found or already deleted.' });
    }

    res.json({ message: 'RCM record updated successfully.' });
  } catch (error) {
    console.error('Error updating RCM:', error);
    res.status(500).json({ message: 'Server error during RCM update.' });
  }
};

// DELETE RCM record
exports.deleteRcm = async (req, res) => {
  try {
    const rcmId = req.params.id;
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    const deleted = await RCM.delete(rcmId, tenantId, userId);
    
    if (!deleted) {
      return res.status(404).json({ message: 'RCM record not found or already deleted.' });
    }

    res.json({ message: 'RCM record deleted successfully.' });
  } catch (error) {
    console.error('Error deleting RCM:', error);
    res.status(500).json({ message: 'Server error during RCM deletion.' });
  }
};
