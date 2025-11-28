const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const multer = require('multer');
const axios = require('axios');
const TestExecution = require('../models/test_executions.model');
const RCM = require('../models/rcm.model');
const PBC = require('../models/pbc.model');
const TestExecutionEvidenceDocuments = require('../models/test_execution_evidence_documents.model');

// Multer configuration for execution evidence images
const executionEvidenceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'uploads', 'executionevidence');
    fsSync.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate temporary filename - we'll rename it after we get control_id from body
    const timestamp = Date.now();
    const randomSuffix = Math.round(Math.random() * 1E9);
    const tempFilename = `temp-${timestamp}-${randomSuffix}.png`;
    cb(null, tempFilename);
  }
});

const uploadExecutionEvidence = multer({ 
  storage: executionEvidenceStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
}).single('image');

// POST create a new test execution
exports.createTestExecution = async (req, res) => {
  try {
    const { control_id, year, quarter, client_id } = req.body;
    const clientId = client_id;
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;

    if (!clientId) {
      return res.status(400).json({ message: 'Client ID is required.' });
    }

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    // Validate required fields
    if (!control_id || !year || !quarter) {
      return res.status(400).json({ 
        message: 'Missing required fields: control_id, year, or quarter.' 
      });
    }

    // 1. Get rcm_id from control_id
    const rcmId = await RCM.findRcmIdByControlId(control_id, clientId, tenantId);
    if (!rcmId) {
      return res.status(404).json({ 
        message: `RCM Control ID '${control_id}' not found for this client.` 
      });
    }

    // 2. Find evidence_id (pcb_id) from evidences table using rcm_id, year, and quarter
    const evidenceData = await TestExecution.findEvidenceIdByRcmYearQuarter(
      rcmId, 
      year, 
      quarter, 
      clientId, 
      tenantId
    );

    // Check if evidence exists - if not, return error and don't save
    if (!evidenceData || !evidenceData.evidence_id) {
      return res.status(404).json({ 
        message: 'No PBC found with given Period and control. Please choose a different set.',
        code: 'NO_EVIDENCE_FOUND'
      });
    }

    const evidenceId = evidenceData.evidence_id;
    const testingStatus = evidenceData.testing_status;

    // 3. Create test execution
    const testExecutionData = {
      rcm_id: rcmId,
      client_id: clientId,
      tenant_id: tenantId,
      pcb_id: evidenceId, // This is the evidence_id from evidences table
      user_id: userId,
      year: year,
      quarter: quarter,
      status: 'pending',
      result: 'na',
      created_by: userId
    };

    const testExecutionId = await TestExecution.create(testExecutionData);

    // 4. Get related data for the response
    const evidenceDocuments = evidenceId 
      ? await TestExecution.getEvidenceDocuments(evidenceId, tenantId)
      : [];
    
    const testAttributes = await TestExecution.getTestAttributesByRcmId(rcmId, tenantId);

    res.status(201).json({
      message: 'Test execution created successfully.',
      test_execution_id: testExecutionId,
      evidence_documents: evidenceDocuments,
      test_attributes: testAttributes,
      testing_status: testingStatus,
      control_id: control_id
    });

  } catch (error) {
    console.error('Error creating test execution:', error);
    res.status(500).json({ message: 'Server error during test execution creation.' });
  }
};

// GET check if duplicate test execution exists (control_id, year, quarter combination)
exports.checkDuplicateTestExecution = async (req, res) => {
  console.log('checkDuplicateTestExecution');
  try {
    const { control_id, year, quarter, client_id } = req.query;
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
    console.log(control_id, year, quarter, client_id);
    // Get the RCM Primary Key (rcm_id) from the selected control_id
    const rcmId = await RCM.findRcmIdByControlId(control_id, client_id, tenantId);
    if (!rcmId) {
      return res.status(404).json({ 
        exists: false, 
        message: `RCM Control ID '${control_id}' not found for this client.` 
      });
    }
    console.log(rcmId);
    // Check for duplicate
    const duplicate = await TestExecution.checkDuplicate(
      rcmId, 
      parseInt(year), 
      quarter, 
      tenantId
    );
    console.log(duplicate);
    if (duplicate) {
      return res.json({ 
        exists: true, 
        message: 'Test execution already exists for this control, year, and quarter combination.',
        control_id: duplicate.control_id
      });
    }

    return res.json({ exists: false, message: 'No duplicate found.' });
  } catch (error) {
    console.error('Error checking duplicate test execution:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// GET evidence documents and test attributes for a control_id
exports.getTestExecutionData = async (req, res) => {
  try {
    const { control_id, client_id } = req.query;
    const clientId = client_id;
    const tenantId = req.user.tenantId;

    if (!clientId) {
      return res.status(400).json({ message: 'Client ID is required.' });
    }

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    if (!control_id) {
      return res.status(400).json({ 
        message: 'Missing required parameter: control_id.' 
      });
    }

    // Get rcm_id from control_id
    const rcmId = await RCM.findRcmIdByControlId(control_id, clientId, tenantId);
    if (!rcmId) {
      return res.status(404).json({ 
        message: `RCM Control ID '${control_id}' not found for this client.` 
      });
    }

    // Get test attributes by rcm_id
    const testAttributes = await TestExecution.getTestAttributesByRcmId(rcmId, tenantId);

    res.json({
      test_attributes: testAttributes,
      control_id: control_id
    });

  } catch (error) {
    console.error('Error fetching test execution data:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// GET evidence data without creating test execution (for preview)
exports.getEvidenceDataForTesting = async (req, res) => {
  try {
    const { control_id, year, quarter, client_id } = req.query;
    const clientId = client_id;
    const tenantId = req.user.tenantId;

    if (!clientId) {
      return res.status(400).json({ message: 'Client ID is required.' });
    }

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    if (!control_id || !year || !quarter) {
      return res.status(400).json({ 
        message: 'Missing required parameters: control_id, year, or quarter.' 
      });
    }

    // Get rcm_id from control_id
    const rcmId = await RCM.findRcmIdByControlId(control_id, clientId, tenantId);
    if (!rcmId) {
      return res.status(404).json({ 
        message: `RCM Control ID '${control_id}' not found for this client.` 
      });
    }

    // Find evidence_id (pcb_id) from evidences table using rcm_id, year, and quarter
    const evidenceData = await TestExecution.findEvidenceIdByRcmYearQuarter(
      rcmId, 
      parseInt(year), 
      quarter, 
      clientId, 
      tenantId
    );

    const evidenceId = evidenceData ? evidenceData.evidence_id : null;
    const testingStatus = evidenceData ? evidenceData.testing_status : null;

    // Get evidence documents
    const evidenceDocuments = evidenceId 
      ? await TestExecution.getEvidenceDocuments(evidenceId, tenantId)
      : [];
    
    // Get test attributes by rcm_id
    const testAttributes = await TestExecution.getTestAttributesByRcmId(rcmId, tenantId);

    res.json({
      evidence_documents: evidenceDocuments,
      test_attributes: testAttributes,
      testing_status: testingStatus,
      control_id: control_id
    });

  } catch (error) {
    console.error('Error fetching evidence data for testing:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// GET all test executions for the client
exports.getAllTestExecutions = async (req, res) => {
  try {
    const clientId = req.query.client_id || null;
    const requestedTenantId = req.query.tenant_id ? parseInt(req.query.tenant_id) : null;
    const { isSuperAdmin } = require('../utils/auth.helper');
    // Super admin can see all data or filter by tenant, regular users see only their tenant
    const tenantId = isSuperAdmin(req.user) ? requestedTenantId : req.user.tenantId;

    const data = await TestExecution.findAllByClient(clientId, tenantId);
    res.json(data);
  } catch (error) {
    console.error('Error fetching test executions:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// PUT update test execution remarks
exports.updateTestExecutionRemarks = async (req, res) => {
  try {
    const { test_execution_id, remarks } = req.body;
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    if (!test_execution_id) {
      return res.status(400).json({ message: 'Test execution ID is required.' });
    }

    if (remarks === undefined || remarks === null) {
      return res.status(400).json({ message: 'Remarks is required.' });
    }

    const updated = await TestExecution.updateRemarks(test_execution_id, remarks, tenantId, userId);
    
    if (!updated) {
      return res.status(404).json({ message: 'Test execution not found or already deleted.' });
    }

    res.json({ message: 'Test execution remarks updated successfully.' });
  } catch (error) {
    console.error('Error updating test execution remarks:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// GET test execution details by ID
exports.getTestExecutionById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    if (!id) {
      return res.status(400).json({ message: 'Test execution ID is required.' });
    }

    // Get test execution with RCM data
    const testExecution = await TestExecution.findById(parseInt(id), tenantId);
    
    if (!testExecution) {
      return res.status(404).json({ message: 'Test execution not found.' });
    }

    // Get RCM details including classification
    const rcmDetails = await RCM.findById(testExecution.rcm_id, tenantId);
    
    // Get evidence documents (excludes policy documents)
    const evidenceDocuments = testExecution.pcb_id 
      ? await TestExecution.getEvidenceDocuments(testExecution.pcb_id, tenantId)
      : [];
    
    // Get policy documents
    const policyDocuments = testExecution.pcb_id 
      ? await TestExecution.getPolicyDocuments(testExecution.pcb_id, tenantId)
      : [];
    
    const evidenceDetails = await PBC.findById(testExecution.pcb_id, tenantId);
    if (!evidenceDetails) {
      return res.status(404).json({ message: 'Evidence details not found.' });
    }

    // Get test attributes by rcm_id
    const testAttributes = await TestExecution.getTestAttributesByRcmId(testExecution.rcm_id, tenantId);

    res.json({
      test_execution: testExecution,
      rcm_details: rcmDetails,
      evidence_documents: evidenceDocuments,
      policy_documents: policyDocuments,
      test_attributes: testAttributes,
      evidence_details: evidenceDetails
    });

  } catch (error) {
    console.error('Error fetching test execution details:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// POST get evidence AI details by document ID
exports.getEvidenceAIDetails = async (req, res) => {
  try {
    const { evidence_document_id, evidence_url } = req.body;
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    if (!evidence_document_id) {
      return res.status(400).json({ message: 'Evidence document ID is required.' });
    }

    if (!evidence_url) {
      return res.status(400).json({ message: 'Evidence URL is required.' });
    }

    console.log('Original URL:', evidence_url);
    const imageBase64 = await convertImageUrlToBase64(evidence_url);
    console.log('Image converted to base64 successfully');

    const extractedText = await extractTextFromImage(process.env.GEMINI_AI_KEY, imageBase64);

    const updateData = {
      extractedText: extractedText
    };
    await PBC.updateEvidenceAIDetails(evidence_document_id, updateData, tenantId, userId);

    res.json({
      message: 'Evidence AI details fetched successfully.',
      evidence_document_id: evidence_document_id,
      extracted_text: extractedText
    });

  } catch (error) {
    console.error('Error fetching evidence AI details:', error);
    res.status(500).json({ 
      message: 'Server error.',
      error: error.message 
    });
  }
};

// POST compare attributes
exports.compareAttributes = async (req, res) => {
  try {
    const { evidence_document_id, rcm_id, test_execution_id, client_id } = req.body;
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    if (!evidence_document_id) {
      return res.status(400).json({ message: 'Evidence document ID is required.' });
    }

    if (!rcm_id) {
      return res.status(400).json({ message: 'RCM ID is required.' });
    }

    const evidenceDocument = await PBC.findEvidenceDocumentById(evidence_document_id, tenantId);

    if (!evidenceDocument) {
      return res.status(404).json({ message: 'Evidence document not found.' });
    }

    const evidenceAiDetails = evidenceDocument.evidence_ai_details;

    // Validate that evidence_ai_details exists in the database (we fetch from DB, not request body)
    if (!evidenceAiDetails || 
        (typeof evidenceAiDetails === 'string' && evidenceAiDetails.trim() === '') ||
        (typeof evidenceAiDetails === 'object' && Object.keys(evidenceAiDetails).length === 0)) {
      return res.status(400).json({ 
        message: 'Evidence AI details are required. Please fetch evidence AI details first.' 
      });
    }

    const testAttributes = await TestExecution.getTestAttributesByRcmId(rcm_id, tenantId);

    if (!testAttributes) {
      return res.status(404).json({ message: 'Test attributes not found.' });
    }
    console.log(testAttributes);

    const attributesList = testAttributes.map((attr) => 
      `{"attribute_name": "${attr.attribute_name}", "attribute_description": "${attr.attribute_description}", "test_steps": "${attr.test_steps}"}`
    ).join(',\n');
  
    const prompt = `Analyze the evidence and verify compliance with each requirement based on context.
  
    EVIDENCE:
    ${evidenceAiDetails}
    
    REQUIREMENTS:
    [${attributesList}]
    
    TASK:
    - Understand the context and meaning of both evidence and requirements
    - Match based on semantic meaning, not exact text
    - Consider synonyms, equivalent terms, and policy variations
    
    Return JSON array with each requirement evaluated:
    [
      attributes_results: [
          "attribute_name": "string",
          "attribute_description": "string", 
          "test_steps": "string",
          "result": boolean,
          "reason": "string explaining match/mismatch based on context",
          "attribute_final_result": boolean
        }
      ],
      summary: "string",
      total_attributes: number,
      total_attributes_passed: number,
      total_attributes_failed: number,
      final_result: boolean,
      manual_final_result: boolean
    }
    
    Rules:
    - result=true if evidence contextually satisfies the requirement
    - attribute_final_result same as result
    - result=false if evidence contradicts or is missing
    - Compare meaning, not exact wording
    - For numeric values, check if condition is met (>=, <=, ==)
    - Be strict but contextually aware
    - final_result is true if all attributes are passed, false otherwise
    - manual_final_result is same as final_result`;

    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
        ]
      }]
    };

    const apiUrl = `${process.env.GEMINI_AI_ENDPOINT}?key=${process.env.GEMINI_AI_KEY}`;

    let response;
    try {
      response = await axios.post(apiUrl, requestBody, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (axiosError) {
      const errorData = axiosError.response?.data || {};
      console.error('Gemini API Error:', errorData);
      throw new Error(`API Error: ${errorData.error?.message || axiosError.message}`);
    }

    const data = response.data;
    let resultText = data.candidates[0].content.parts[0].text;
    resultText = resultText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let parsedResult;
    try {
      parsedResult = JSON.parse(resultText);
    } catch (parseError) {
      console.error('Invalid JSON from Gemini:', resultText);
      throw new Error('Invalid JSON response from AI');
    }

    const result = JSON.stringify(parsedResult); 
    
    // Check if record already exists
    const existingRecord = await TestExecutionEvidenceDocuments.findByTestExecutionAndEvidenceDocument(
      test_execution_id,
      evidence_document_id,
      tenantId
    );

    if (existingRecord) {
      // Record exists, return existing data instead of creating duplicate
      let parsedExistingResult = null;
      try {
        parsedExistingResult = existingRecord.result;
      } catch (parseError) {
        console.error('Error parsing existing result JSON:', parseError);
        parsedExistingResult = parsedResult; // Fallback to new parsed result
      }

      return res.json({
        message: 'Evidence Results Retrieved Successfully.',
        evidence_document_id: evidence_document_id,
        results: parsedExistingResult,
        test_execution_evidence_document_id: existingRecord.test_execution_evidence_document_id
      });
    }

    // Record doesn't exist, create new one
    const testExecutionEvidenceDocumentData = {
      test_execution_id: test_execution_id,
      evidence_document_id: evidence_document_id,
      rcm_id: rcm_id,
      tenant_id: tenantId,
      client_id: client_id,
      result: result,
      status: parsedResult.final_result,
      total_attributes: parsedResult.total_attributes,
      total_attributes_passed: parsedResult.total_attributes_passed,
      total_attributes_failed: parsedResult.total_attributes_failed,
      created_by: userId
    };
    const testExecutionEvidenceDocumentId = await TestExecutionEvidenceDocuments.create(testExecutionEvidenceDocumentData);
    res.json({
      message: 'Evidence Resutls Fetched Successfully.',
      evidence_document_id: evidence_document_id,
      results: parsedResult,
      test_execution_evidence_document_id: testExecutionEvidenceDocumentId
    });
  } catch (error) {
    console.error('Error comparing attributes:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// GET check if test execution evidence document exists
exports.checkTestExecutionEvidenceDocument = async (req, res) => {
  try {
    const { test_execution_id, evidence_document_id } = req.query;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    if (!test_execution_id) {
      return res.status(400).json({ message: 'Test execution ID is required.' });
    }

    if (!evidence_document_id) {
      return res.status(400).json({ message: 'Evidence document ID is required.' });
    }

    const existingRecord = await TestExecutionEvidenceDocuments.findByTestExecutionAndEvidenceDocument(
      test_execution_id,
      evidence_document_id,
      tenantId
    );

    if (existingRecord) {
      // Parse the result JSON (could be string or object depending on MySQL driver)
      let parsedResult = null;
      try {
        if (typeof existingRecord.result === 'string') {
          parsedResult = JSON.parse(existingRecord.result);
        } else {
          parsedResult = existingRecord.result;
        }
      } catch (parseError) {
        console.error('Error parsing result JSON:', parseError);
      }

      return res.json({
        exists: true,
        data: {
          ...existingRecord,
          results: parsedResult
        }
      });
    }

    return res.json({
      exists: false
    });

  } catch (error) {
    console.error('Error checking test execution evidence document:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// GET all test execution evidence documents for a test execution
exports.getTestExecutionEvidenceDocuments = async (req, res) => {
  try {
    const { test_execution_id } = req.query;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    if (!test_execution_id) {
      return res.status(400).json({ message: 'Test execution ID is required.' });
    }

    const records = await TestExecutionEvidenceDocuments.findByTestExecutionId(
      test_execution_id,
      tenantId
    );

    // Parse result JSON for each record
    const parsedRecords = records.map(record => {
      let parsedResult = null;
      try {
        if (record.result) {
          parsedResult = typeof record.result === 'string' 
            ? JSON.parse(record.result) 
            : record.result;
        }
      } catch (parseError) {
        console.error('Error parsing result JSON:', parseError);
      }

      return {
        ...record,
        result_parsed: parsedResult
      };
    });

    return res.json({
      data: parsedRecords
    });

  } catch (error) {
    console.error('Error fetching test execution evidence documents:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// POST save annotated image and update result_artifact_url
exports.saveAnnotatedImage = (req, res) => {
  uploadExecutionEvidence(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: 'File upload error: ' + err.message });
    }

    try {
      const { test_execution_id, evidence_document_id, control_id } = req.body;
      const tenantId = req.user.tenantId;

      // Validate control_id - check for undefined, null, or empty string
      if (!test_execution_id || !evidence_document_id) {
        // Clean up uploaded file if validation fails
        if (req.file) {
          fsSync.unlink(req.file.path, (unlinkErr) => {
            if (unlinkErr) console.error("Failed to delete temp file:", unlinkErr);
          });
        }
        return res.status(400).json({ 
          message: 'Missing required fields: test_execution_id or evidence_document_id.' 
        });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No image file provided.' });
      }

      if (!tenantId) {
        // Clean up uploaded file if tenant ID is missing
        if (req.file) {
          fsSync.unlink(req.file.path, (unlinkErr) => {
            if (unlinkErr) console.error("Failed to delete temp file:", unlinkErr);
          });
        }
        return res.status(400).json({ message: 'Tenant ID is required.' });
      }

      // Get control_id - try from request body first, then from test execution
      let finalControlId = control_id;
      if (!finalControlId || finalControlId === 'undefined' || finalControlId === 'null' || String(finalControlId).trim() === '') {
        console.warn('Control ID missing from request body, fetching from test execution');
        const testExecution = await TestExecution.findById(test_execution_id, tenantId);
        if (testExecution && testExecution.control_id) {
          finalControlId = testExecution.control_id;
          console.log('Retrieved control_id from test execution:', finalControlId);
        } else {
          // Clean up uploaded file if we can't get control_id
          if (req.file) {
            fsSync.unlink(req.file.path, (unlinkErr) => {
              if (unlinkErr) console.error("Failed to delete temp file:", unlinkErr);
            });
          }
          return res.status(400).json({ 
            message: 'Control ID is required and could not be retrieved from test execution.' 
          });
        }
      }

      // Rename the file with proper control_id
      const timestamp = Date.now();
      const finalFilename = `${String(finalControlId).trim()}-${timestamp}.png`;
      const finalPath = path.join(path.dirname(req.file.path), finalFilename);
      
      try {
        await fsSync.promises.rename(req.file.path, finalPath);
      } catch (renameError) {
        console.error('Error renaming file:', renameError);
        // Clean up uploaded file
        if (req.file) {
          fsSync.unlink(req.file.path, (unlinkErr) => {
            if (unlinkErr) console.error("Failed to delete temp file:", unlinkErr);
          });
        }
        return res.status(500).json({ 
          message: 'Error saving file with proper filename.' 
        });
      }

      // Construct the relative path for storage
      const resultArtifactUrl = `executionevidence/${finalFilename}`;

      // Check if record exists, if not create it first
      let existingRecord = await TestExecutionEvidenceDocuments.findByTestExecutionAndEvidenceDocument(
        test_execution_id,
        evidence_document_id,
        tenantId
      );

      if (!existingRecord) {
        // Create a basic record first (we'll update it with result later if needed)
        // But for now, we just need the record to exist to update result_artifact_url
        const testExecution = await TestExecution.findById(test_execution_id, tenantId);
        if (!testExecution) {
          if (req.file) {
            fsSync.unlink(req.file.path, (unlinkErr) => {
              if (unlinkErr) console.error("Failed to delete temp file:", unlinkErr);
            });
          }
          return res.status(404).json({ message: 'Test execution not found.' });
        }

        const testExecutionEvidenceDocumentData = {
          test_execution_id: test_execution_id,
          evidence_document_id: evidence_document_id,
          rcm_id: testExecution.rcm_id,
          tenant_id: tenantId,
          client_id: testExecution.client_id,
          result: null,
          status: null,
          total_attributes: null,
          total_attributes_passed: null,
          total_attributes_failed: null,
          created_by: req.user.userId
        };
        await TestExecutionEvidenceDocuments.create(testExecutionEvidenceDocumentData);
      }

      // Update the result_artifact_url
      const updated = await TestExecutionEvidenceDocuments.updateResultArtifactUrl(
        test_execution_id,
        evidence_document_id,
        resultArtifactUrl,
        tenantId
      );

      if (!updated) {
        if (req.file) {
          fsSync.unlink(req.file.path, (unlinkErr) => {
            if (unlinkErr) console.error("Failed to delete temp file:", unlinkErr);
          });
        }
        return res.status(404).json({ message: 'Failed to update result artifact URL.' });
      }

      res.json({ 
        message: 'Annotated image saved successfully.',
        result_artifact_url: resultArtifactUrl
      });

    } catch (error) {
      // Clean up uploaded file on error
      if (req.file) {
        fsSync.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error("Failed to delete temp file after error:", unlinkErr);
        });
      }
      console.error('Error saving annotated image:', error);
      res.status(500).json({ message: 'Server error during image save.' });
    }
  });
};

async function extractTextFromImage(apiKey, imageBase64) {
  const prompt = `This image is a screenshot from MS active directory showing Policy settings, analyse the image and extract the settings into a JSON file`;

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: "image/png",
            data: imageBase64
          }
        }
      ]
    }]
  };

  const apiUrl = `${process.env.GEMINI_AI_ENDPOINT}?key=${apiKey}`;
  console.log('Calling Gemini API...');

  let response;
  try {
    response = await axios.post(apiUrl, requestBody, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (axiosError) {
    const errorData = axiosError.response?.data || {};
    console.error('Gemini API Error:', errorData);
    throw new Error(`API Error: ${errorData.error?.message || axiosError.message}`);
  }

  const data = response.data;
  let resultText = data.candidates[0].content.parts[0].text;
    resultText = resultText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let parsedResult;
    try {
      parsedResult = JSON.parse(resultText);
    } catch (parseError) {
      console.error('Invalid JSON from Gemini:', resultText);
      throw new Error('Invalid JSON response from AI');
    }

    const result = JSON.stringify(parsedResult); 
  
  return result;
}

// PUT update test execution evidence document result (attribute_final_result and manual_final_result)
exports.updateTestExecutionEvidenceResult = async (req, res) => {
  try {
    const { test_execution_id, evidence_document_id, updated_result } = req.body;
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    if (!test_execution_id || !evidence_document_id) {
      return res.status(400).json({ message: 'Test execution ID and evidence document ID are required.' });
    }

    if (!updated_result) {
      return res.status(400).json({ message: 'Updated result is required.' });
    }

    // Check if test execution is completed - if so, don't allow updates
    const testExecution = await TestExecution.findById(test_execution_id, tenantId);
    if (!testExecution) {
      return res.status(404).json({ message: 'Test execution not found.' });
    }

    if (testExecution.status === 'completed') {
      return res.status(400).json({ message: 'Cannot update results when test execution is completed.' });
    }

    // Get existing record
    const existingRecord = await TestExecutionEvidenceDocuments.findByTestExecutionAndEvidenceDocument(
      test_execution_id,
      evidence_document_id,
      tenantId
    );

    if (!existingRecord) {
      return res.status(404).json({ message: 'Test execution evidence document not found.' });
    }

    // Update the result
    const updated = await TestExecutionEvidenceDocuments.updateResult(
      test_execution_id,
      evidence_document_id,
      updated_result,
      tenantId,
      userId
    );

    if (!updated) {
      return res.status(404).json({ message: 'Failed to update result.' });
    }

    res.json({ message: 'Test execution evidence result updated successfully.' });
  } catch (error) {
    console.error('Error updating test execution evidence result:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// PUT update test execution status and result
exports.updateTestExecutionStatusAndResult = async (req, res) => {
  try {
    const { test_execution_id, status, result } = req.body;
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    if (!test_execution_id) {
      return res.status(400).json({ message: 'Test execution ID is required.' });
    }

    if (!status || !result) {
      return res.status(400).json({ message: 'Status and result are required.' });
    }

    // Validate status
    if (!['pending', 'in_progress', 'completed', 'failed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value.' });
    }

    // Validate result
    if (!['pass', 'fail', 'partial', 'na'].includes(result)) {
      return res.status(400).json({ message: 'Invalid result value.' });
    }

    // Check if already completed - if so, don't allow changes
    const testExecution = await TestExecution.findById(test_execution_id, tenantId);
    if (!testExecution) {
      return res.status(404).json({ message: 'Test execution not found.' });
    }

    if (testExecution.status === 'completed' && status !== 'completed') {
      return res.status(400).json({ message: 'Cannot change status from completed. This action cannot be reverted.' });
    }

    const updated = await TestExecution.updateStatusAndResult(
      test_execution_id,
      status,
      result,
      tenantId,
      userId
    );

    if (!updated) {
      return res.status(404).json({ message: 'Failed to update test execution status and result.' });
    }

    res.json({ message: 'Test execution status and result updated successfully.' });
  } catch (error) {
    console.error('Error updating test execution status and result:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

async function convertImageUrlToBase64(imageUrl) {
  try {
    const finalPath = 'uploads/'.concat(imageUrl);
    const imageBuffer = await fs.readFile(finalPath);
    const base64 = imageBuffer.toString('base64');
    
    return base64;
  } catch (error) {
    throw new Error(`Error converting image to base64: ${error.message}`);
  }
}

