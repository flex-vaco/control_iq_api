const RCM = require('../models/rcm.model');
const PBC = require('../models/pbc.model');
const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { extractEvidenceAIDetails } = require('./test_executions.controller');

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
    const clientId = req.query.client_id;
    const tenantId = req.user.tenantId;
    if (!clientId) {
      return res.status(400).json({ message: 'Client ID is required.' });
    }
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }
    // We reuse a function to get all RCM data, then select only what we need
    const rcmData = await RCM.findAllByClient(clientId, tenantId);
    
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

// GET check if duplicate PBC exists (control_id, year, quarter combination)
exports.checkDuplicatePbc = async (req, res) => {
  try {
    const { control_id, year, quarter, client_id, evidence_id } = req.query;
    const tenantId = req.user.tenantId;

    if (!control_id || !year || !quarter || !client_id) {
      return res.status(400).json({ 
        exists: false, 
        message: 'Control ID, Year, Quarter, and Client ID are required.' 
      });
    }

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    // Get the RCM Primary Key (rcm_id) from the selected control_id
    const rcmId = await RCM.findRcmIdByControlId(control_id, client_id, tenantId);
    if (!rcmId) {
      return res.status(404).json({ 
        exists: false, 
        message: `RCM Control ID '${control_id}' not found for this client.` 
      });
    }

    // Check for duplicate (exclude current evidence_id if editing)
    const duplicate = await PBC.checkDuplicate(
      rcmId, 
      year, 
      quarter, 
      tenantId, 
      evidence_id || null
    );

    if (duplicate) {
      return res.json({ 
        exists: true, 
        message: 'PBC already exists ,edit it for adding new evidences',
        control_id: duplicate.control_id
      });
    }

    return res.json({ exists: false, message: 'No duplicate found.' });
  } catch (error) {
    console.error('Error checking duplicate PBC:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// GET all existing Evidence (PBC) requests for the client
exports.getAllEvidence = async (req, res) => {
  try {
    const clientId = req.query.client_id || null;
    const requestedTenantId = req.query.tenant_id ? parseInt(req.query.tenant_id) : null;
    const { isSuperAdmin } = require('../utils/auth.helper');
    // Super admin can see all data or filter by tenant, regular users see only their tenant
    const tenantId = isSuperAdmin(req.user) ? requestedTenantId : req.user.tenantId;
    // Use findAll to get data with client_name (supports both filtered and unfiltered)
    const data = await PBC.findAll(tenantId, clientId);
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
    const { control_id, evidence_name, testing_status, year, quarter, client_id } = req.body;
    const clientId = client_id;
    const tenantId = req.user.tenantId;
    if (!clientId) {
      // If validation fails, clean up any uploaded files
      if (req.files) {
        req.files.forEach(file => fs.unlink(file.path, (unlinkErr) => {
          if (unlinkErr) console.error("Failed to delete temp file:", unlinkErr);
        }));
      }
      return res.status(400).json({ message: 'Client ID is required.' });
    }
    if (!tenantId) {
      // If validation fails, clean up any uploaded files
      if (req.files) {
        req.files.forEach(file => fs.unlink(file.path, (unlinkErr) => {
          if (unlinkErr) console.error("Failed to delete temp file:", unlinkErr);
        }));
      }
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }
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
      const rcmId = await RCM.findRcmIdByControlId(control_id, clientId, tenantId);
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
        tenant_id: tenantId,
        client_id: clientId,
        evidence_name,
        testing_status,
        year: year || null,
        quarter: quarter || null,
        created_by: userId,
      };

      // Parse is_policy_document array from request body
      const isPolicyDocumentArray = req.body.is_policy_document 
        ? (Array.isArray(req.body.is_policy_document) 
            ? req.body.is_policy_document 
            : [req.body.is_policy_document])
        : [];
      
      const documentsData = req.files ? req.files.map((file, index) => {
        // Extract original filename without extension
        const originalName = file.originalname || '';
        const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
        // Get is_policy_document flag for this file (default to false)
        const isPolicyDocument = isPolicyDocumentArray[index] === 'true' || isPolicyDocumentArray[index] === true;
        return {
          artifact_url: `evidences/${file.filename}`, // Relative path for storage
          document_name: nameWithoutExt || null,
          is_policy_document: isPolicyDocument
        };
      }) : [];

      // 3. Execute Transaction
      const result = await PBC.createEvidenceAndDocuments(evidenceData, documentsData);
      
      // 4. Extract AI details for policy documents (async, don't wait for completion)
      if (documentsData && documentsData.length > 0) {
        // Query to get the inserted document IDs for policy documents
        const policyDocuments = documentsData.filter(doc => doc.is_policy_document);
        if (policyDocuments.length > 0) {
          // Get document IDs from database
          const [insertedDocs] = await db.query(
            `SELECT document_id, artifact_url FROM evidence_documents 
             WHERE evidence_id = ? AND tenant_id = ? AND is_policy_document = 1 
             ORDER BY document_id DESC LIMIT ?`,
            [result.evidenceId, tenantId, policyDocuments.length]
          );
          
          // Process AI extraction for each policy document (supports doc, docx, xls, xlsx, pdf, images)
          const policyDocumentPromises = insertedDocs.map(async (doc) => {
            try {
              const fileExtension = doc.artifact_url.toLowerCase().split('.').pop();
              await extractEvidenceAIDetails(doc.document_id, doc.artifact_url, tenantId, userId);
            } catch (error) {
              console.error(`Error extracting AI details for policy document ${doc.document_id}:`, error);
              // Don't throw - continue with other documents
            }
          });
          // Process in background, don't block response
          Promise.all(policyDocumentPromises).catch(err => {
            console.error('Error processing policy document AI extraction:', err);
          });
        }
      }
      
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

// PUT update evidence
exports.updateEvidence = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(500).json({ message: 'File upload error: ' + err.message });
    }
    
    try {
      const evidenceId = req.params.id;
      const { control_id, evidence_name, testing_status, year, quarter, client_id } = req.body;
      const tenantId = req.user.tenantId;
      const userId = req.user.userId;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required.' });
      }

      // Get the RCM Primary Key (rcm_id) from the selected control_id
      const rcmId = await RCM.findRcmIdByControlId(control_id, client_id, tenantId);
      if (!rcmId) {
        return res.status(404).json({ message: `RCM Control ID '${control_id}' not found for this client.` });
      }

      const evidenceData = {
        rcm_id: rcmId,
        evidence_name,
        testing_status,
        year: year || null,
        quarter: quarter || null
      };

      const updated = await PBC.updateEvidence(evidenceId, evidenceData, tenantId, userId);
      
      if (!updated) {
        return res.status(404).json({ message: 'Evidence not found or already deleted.' });
      }

      // Handle file uploads if any (similar to create)
      if (req.files && req.files.length > 0) {
        // Parse is_policy_document array from request body
        const isPolicyDocumentArray = req.body.is_policy_document 
          ? (Array.isArray(req.body.is_policy_document) 
              ? req.body.is_policy_document 
              : [req.body.is_policy_document])
          : [];
        
        const documentsData = req.files.map((file, index) => {
          // Extract original filename without extension
          const originalName = file.originalname || '';
          const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
          // Get is_policy_document flag for this file (default to false)
          const isPolicyDocument = isPolicyDocumentArray[index] === 'true' || isPolicyDocumentArray[index] === true;
          return {
            artifact_url: `evidences/${file.filename}`,
            document_name: nameWithoutExt || null,
            is_policy_document: isPolicyDocument
          };
        });
        // Add documents to existing evidence
        const connection = await db.getConnection();
        try {
          const docValues = documentsData.map(doc => [
            evidenceId,
            tenantId,
            client_id,
            doc.document_name,
            doc.artifact_url,
            doc.is_policy_document ? 1 : 0,
            userId
          ]).flat();
          const placeholders = documentsData.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
          await connection.query(
            `INSERT INTO evidence_documents (evidence_id, tenant_id, client_id, document_name, artifact_url, is_policy_document, created_by) VALUES ${placeholders}`,
            docValues
          );
          
        } finally {
          connection.release();
        }
        
        // Extract AI details for policy documents (async, don't wait for completion)
        const policyDocuments = documentsData.filter(doc => doc.is_policy_document);
        if (policyDocuments.length > 0) {
          // Get document IDs from database
          const [insertedDocs] = await db.query(
            `SELECT document_id, artifact_url FROM evidence_documents 
             WHERE evidence_id = ? AND tenant_id = ? AND is_policy_document = 1 
             ORDER BY document_id DESC LIMIT ?`,
            [evidenceId, tenantId, policyDocuments.length]
          );
          
          // Process AI extraction for each policy document (supports doc, docx, xls, xlsx, pdf, images)
          const policyDocumentPromises = insertedDocs.map(async (doc) => {
            try {
              const fileExtension = doc.artifact_url.toLowerCase().split('.').pop();
              await extractEvidenceAIDetails(doc.document_id, doc.artifact_url, tenantId, userId);
            } catch (error) {
              console.error(`Error extracting AI details for policy document ${doc.document_id}:`, error);
              // Don't throw - continue with other documents
            }
          });
          // Process in background, don't block response
          Promise.all(policyDocumentPromises).catch(err => {
            console.error('Error processing policy document AI extraction:', err);
          });
        }
      }

      res.json({ message: 'Evidence updated successfully.' });
    } catch (error) {
      console.error('Error updating Evidence:', error);
      res.status(500).json({ message: 'Server error during evidence update.' });
    }
  });
};

// DELETE evidence
exports.deleteEvidence = async (req, res) => {
  try {
    const evidenceId = req.params.id;
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    const deleted = await PBC.deleteEvidence(evidenceId, tenantId, userId);
    
    if (!deleted) {
      return res.status(404).json({ message: 'Evidence not found or already deleted.' });
    }

    res.json({ message: 'Evidence deleted successfully.' });
  } catch (error) {
    console.error('Error deleting Evidence:', error);
    res.status(500).json({ message: 'Server error during evidence deletion.' });
  }
};

// GET evidence documents by evidence_id (excludes policy documents)
exports.getEvidenceDocuments = async (req, res) => {
  try {
    const evidenceId = req.params.id;
    const tenantId = req.user.tenantId;

    if (!evidenceId) {
      return res.status(400).json({ message: 'Evidence ID is required.' });
    }

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    const documents = await PBC.getEvidenceDocuments(evidenceId, tenantId, false);
    res.json(documents);
  } catch (error) {
    console.error('Error fetching evidence documents:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// GET policy documents by evidence_id
exports.getPolicyDocuments = async (req, res) => {
  try {
    const evidenceId = req.params.id;
    const tenantId = req.user.tenantId;

    if (!evidenceId) {
      return res.status(400).json({ message: 'Evidence ID is required.' });
    }

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    const documents = await PBC.getPolicyDocuments(evidenceId, tenantId);
    res.json(documents);
  } catch (error) {
    console.error('Error fetching policy documents:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// POST add documents to existing evidence
exports.addEvidenceDocuments = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error('Multer file upload error:', err);
      if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File upload error: ' + err.message });
      }
      return res.status(500).json({ message: 'File upload failed.' });
    }
    
    try {
      const evidenceId = req.params.id;
      const tenantId = req.user.tenantId;
      const userId = req.user.userId;

      if (!evidenceId) {
        // Clean up uploaded files if validation fails
        if (req.files) {
          req.files.forEach(file => fs.unlink(file.path, (unlinkErr) => {
            if (unlinkErr) console.error("Failed to delete temp file:", unlinkErr);
          }));
        }
        return res.status(400).json({ message: 'Evidence ID is required.' });
      }

      if (!tenantId) {
        // Clean up uploaded files if validation fails
        if (req.files) {
          req.files.forEach(file => fs.unlink(file.path, (unlinkErr) => {
            if (unlinkErr) console.error("Failed to delete temp file:", unlinkErr);
          }));
        }
        return res.status(400).json({ message: 'Tenant ID is required.' });
      }

      // Verify evidence exists and get client_id
      const evidence = await PBC.findById(evidenceId, tenantId);
      if (!evidence) {
        // Clean up uploaded files if evidence not found
        if (req.files) {
          req.files.forEach(file => fs.unlink(file.path, (unlinkErr) => {
            if (unlinkErr) console.error("Failed to delete temp file:", unlinkErr);
          }));
        }
        return res.status(404).json({ message: 'Evidence not found.' });
      }

      // Handle file uploads if any
      if (req.files && req.files.length > 0) {
        // Parse is_policy_document array from request body
        const isPolicyDocumentArray = req.body.is_policy_document 
          ? (Array.isArray(req.body.is_policy_document) 
              ? req.body.is_policy_document 
              : [req.body.is_policy_document])
          : [];
        const documentsData = req.files.map((file, index) => {
          // Extract original filename without extension
          const originalName = file.originalname || '';
          const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
          // Get is_policy_document flag for this file (default to false)
          const isPolicyDocument = isPolicyDocumentArray[index] === 'true' || isPolicyDocumentArray[index] === true;
          return {
            artifact_url: `evidences/${file.filename}`,
            document_name: nameWithoutExt || null,
            is_policy_document: isPolicyDocument
          };
        });
        
        // Add documents to existing evidence
        const connection = await db.getConnection();
        await connection.beginTransaction();
        try {
          const docValues = documentsData.map(doc => [
            evidenceId,
            tenantId,
            evidence.client_id,
            doc.document_name,
            doc.artifact_url,
            doc.is_policy_document ? 1 : 0,
            userId
          ]).flat();
          const placeholders = documentsData.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
          await connection.query(
            `INSERT INTO evidence_documents (evidence_id, tenant_id, client_id, document_name, artifact_url, is_policy_document, created_by) VALUES ${placeholders}`,
            docValues
          );
          await connection.commit();
          
          // Extract AI details for policy documents (async, don't wait for completion)
          const policyDocuments = documentsData.filter(doc => doc.is_policy_document);
          if (policyDocuments.length > 0) {
            // Get document IDs from database
            const [insertedDocs] = await db.query(
              `SELECT document_id, artifact_url FROM evidence_documents 
               WHERE evidence_id = ? AND tenant_id = ? AND is_policy_document = 1 
               ORDER BY document_id DESC LIMIT ?`,
              [evidenceId, tenantId, policyDocuments.length]
            );
            
            // Process AI extraction for each policy document (supports doc, docx, xls, xlsx, pdf, images)
            const policyDocumentPromises = insertedDocs.map(async (doc) => {
              try {
                const fileExtension = doc.artifact_url.toLowerCase().split('.').pop();
                await extractEvidenceAIDetails(doc.document_id, doc.artifact_url, tenantId, userId);
              } catch (error) {
                console.error(`Error extracting AI details for policy document ${doc.document_id}:`, error);
                // Don't throw - continue with other documents
              }
            });
            // Process in background, don't block response
            Promise.all(policyDocumentPromises).catch(err => {
              console.error('Error processing policy document AI extraction:', err);
            });
          }
        } catch (dbError) {
          await connection.rollback();
          // Clean up uploaded files on DB error
          if (req.files) {
            req.files.forEach(file => fs.unlink(file.path, (unlinkErr) => {
              if (unlinkErr) console.error("Failed to delete temp file:", unlinkErr);
            }));
          }
          throw dbError;
        } finally {
          connection.release();
        }
      } else {
        return res.status(400).json({ message: 'No files provided for upload.' });
      }

      res.status(201).json({ 
        message: 'Documents added successfully.',
        count: req.files.length
      });
    } catch (error) {
      // If DB fails, clean up the uploaded files
      if (req.files) {
        req.files.forEach(file => fs.unlink(file.path, (unlinkErr) => {
          if (unlinkErr) console.error("Failed to delete temp file after DB error:", unlinkErr);
        }));
      }
      console.error('Error adding evidence documents:', error);
      res.status(500).json({ message: 'Server error during document upload.' });
    }
  });
};

// DELETE evidence document
exports.deleteEvidenceDocument = async (req, res) => {
  try {
    const documentId = req.params.documentId;
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;

    if (!documentId) {
      return res.status(400).json({ message: 'Document ID is required.' });
    }

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    const deleted = await PBC.deleteEvidenceDocument(documentId, tenantId, userId);
    
    if (!deleted) {
      return res.status(404).json({ message: 'Document not found or already deleted.' });
    }

    res.json({ message: 'Document deleted successfully.' });
  } catch (error) {
    console.error('Error deleting evidence document:', error);
    res.status(500).json({ message: 'Server error during document deletion.' });
  }
};

