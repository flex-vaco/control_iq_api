const RCM = require('../models/rcm.model');
const PBC = require('../models/pbc.model');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Multer Configuration for MULTIPLE Document Upload ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save files to server/uploads/evidences
    const uploadPath = path.join(__dirname, '..', 'uploads', 'evidences');
    // Ensure the directory exists
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Unique filename: timestamp-originalfilename.ext
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// Configure for multiple files, named 'documents'
const upload = multer({ storage: storage }).array('documents');
// ---------------------------------------------------


// GET all RCM Control IDs and Descriptions for the Add PBC dropdown
exports.getAvailableRcmControls = async (req, res) => {
  try {
    const clientId = req.user.clientId;
    // We reuse a function to get all RCM data, then select only what we need
    const rcmData = await RCM.findAllByClient(clientId);
    
    // Map to an array of objects with control_id and control_description
    const controls = rcmData.map(rcm => ({
      control_id: rcm.control_id,
      control_description: rcm.control_description
    }));

    res.json(controls);
  } catch (error) {
    console.error('Error fetching RCM controls:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// GET all existing Evidence (PBC) requests for the client
exports.getAllEvidence = async (req, res) => {
  try {
    const clientId = req.user.clientId;
    const data = await PBC.findAllByClient(clientId);
    res.json(data);
  } catch (error) {
    console.error('Error fetching Evidence data:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};


// POST to create a new Evidence request with multiple document uploads
exports.createEvidence = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error('Multer file upload error:', err);
      // Handle file size or other multer errors
      if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File upload error: ' + err.message });
      }
      return res.status(500).json({ message: 'File upload failed.' });
    }
    
    // req.body contains form fields, req.files contains file array
    const { control_id, evidence_name, testing_status } = req.body;
    const clientId = req.user.clientId;
    const userId = req.user.userId;

    if (!control_id || !evidence_name || !testing_status) {
      // If validation fails, clean up any uploaded files
      if (req.files) {
        req.files.forEach(file => fs.unlink(file.path, (unlinkErr) => {
          if (unlinkErr) console.error("Failed to delete temp file:", unlinkErr);
        }));
      }
      return res.status(400).json({ message: 'Missing required fields: Control ID, Evidence Name, or Status.' });
    }

    try {
      // 1. Get the RCM Primary Key (rcm_id) from the selected control_id
      const rcmId = await RCM.findRcmIdByControlId(control_id, clientId);
      if (!rcmId) {
         // Clean up files if RCM lookup fails
        if (req.files) {
          req.files.forEach(file => fs.unlink(file.path, (unlinkErr) => {
            if (unlinkErr) console.error("Failed to delete temp file:", unlinkErr);
          }));
        }
        return res.status(404).json({ message: `RCM Control ID '${control_id}' not found for this client.` });
      }

      // 2. Prepare Data for Model Transaction
      const evidenceData = {
        rcm_id: rcmId,
        client_id: clientId,
        evidence_name,
        testing_status,
        created_by: userId,
      };

      const documentsData = req.files ? req.files.map(file => ({
        artifact_url: `evidences/${file.filename}`, // Relative path for storage
      })) : [];

      // 3. Execute Transaction
      const result = await PBC.createEvidenceAndDocuments(evidenceData, documentsData);
      
      res.status(201).json({ 
        message: 'Evidence request created successfully.', 
        evidenceId: result.evidenceId 
      });

    } catch (error) {
      // If DB fails, clean up the uploaded files
      if (req.files) {
        req.files.forEach(file => fs.unlink(file.path, (unlinkErr) => {
          if (unlinkErr) console.error("Failed to delete temp file after DB error:", unlinkErr);
        }));
      }
      console.error('Error creating Evidence Request:', error);
      res.status(500).json({ message: 'Server error during evidence creation.' });
    }
  });
};
