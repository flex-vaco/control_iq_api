const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const multer = require('multer');
const axios = require('axios');
const libre = require('libreoffice-convert');
const { promisify } = require('util');
const ExcelJS = require('exceljs');
const FormData = require('form-data');
const mammoth = require('mammoth');
const AdmZip = require('adm-zip');
const { parseStringPromise } = require('xml2js');
const TestExecution = require('../models/test_executions.model');
const RCM = require('../models/rcm.model');
const PBC = require('../models/pbc.model');
const TestExecutionEvidenceDocuments = require('../models/test_execution_evidence_documents.model');
const AiPrompts = require('../models/ai_prompts.model');

// Promisify libreoffice convert
const libreConvert = promisify(libre.convert);

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
    // Preserve original file extension
    const originalExt = file.originalname.split('.').pop() || 
                       (file.mimetype === 'application/pdf' ? 'pdf' : 'png');
    const tempFilename = `temp-${timestamp}-${randomSuffix}.${originalExt}`;
    cb(null, tempFilename);
  }
});

const uploadExecutionEvidence = multer({ 
  storage: executionEvidenceStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Accept images, PDFs, and office documents (doc, docx, xlsx, xls)
    const allowedMimes = [
      'image/png', 
      'image/jpeg', 
      'image/jpg', 
      'image/gif', 
      'image/webp', 
      'application/pdf',
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // .xlsx
    ];
    
    // Also check file extension as fallback (some browsers may not send correct mime type)
    const fileExtension = file.originalname.toLowerCase().split('.').pop();
    const allowedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx'];
    
    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs, and office documents (doc, docx, xlsx, xls) are allowed.'), false);
    }
  }
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

// Helper function to extract AI details from evidence document (reusable)
async function extractEvidenceAIDetails(evidence_document_id, evidence_url, tenantId, userId) {
  if (!evidence_document_id || !evidence_url || !tenantId || !userId) {
    throw new Error('Missing required parameters for AI extraction');
  }

  console.log('Extracting AI details for document:', evidence_document_id, 'URL:', evidence_url);
  
  // Detect file type from file extension (handle paths like "evidences/filename.docx")
  const urlLower = evidence_url.toLowerCase();
  const lastDotIndex = urlLower.lastIndexOf('.');
  const fileExtension = lastDotIndex !== -1 ? urlLower.substring(lastDotIndex + 1) : '';
  
  console.log('Detected file extension:', fileExtension);
  
  let mimeType = 'image/png'; // default
  let fileBase64;
  let extractedText;

  // Check if it's an office document (doc, docx, xls, xlsx)
  if (fileExtension === 'doc' || fileExtension === 'docx') {
    console.log('Processing Word document (doc/docx)');
    // Convert Word document to PDF and extract text
    extractedText = await extractTextFromWord(process.env.GEMINI_AI_KEY, evidence_url);
  } else if (fileExtension === 'xls' || fileExtension === 'xlsx') {
    console.log('Processing Excel document (xls/xlsx)');
    // Convert Excel document to PDF and extract text
    extractedText = await extractTextFromExcelWithImages(process.env.GEMINI_AI_KEY, evidence_url);
  } else {
    // For PDFs and images, use existing method
    fileBase64 = await convertImageUrlToBase64(evidence_url);
    console.log('File converted to base64 successfully');

    if (fileExtension === 'pdf') {
      mimeType = 'application/pdf';
    } else if (fileExtension === 'jpg' || fileExtension === 'jpeg') {
      mimeType = 'image/jpeg';
    } else if (fileExtension === 'png') {
      mimeType = 'image/png';
    } else if (fileExtension === 'gif') {
      mimeType = 'image/gif';
    } else if (fileExtension === 'webp') {
      mimeType = 'image/webp';
    }

    extractedText = await extractTextFromEvidenceFile(process.env.GEMINI_AI_KEY, fileBase64, mimeType);
  }

  const updateData = {
    extractedText: extractedText
  };
  await PBC.updateEvidenceAIDetails(evidence_document_id, updateData, tenantId, userId);

  return extractedText;
}

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

    const extractedText = await extractEvidenceAIDetails(evidence_document_id, evidence_url, tenantId, userId);

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

// Export the helper function for use in other controllers
exports.extractEvidenceAIDetails = extractEvidenceAIDetails;

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
  // Set CORS headers explicitly for file upload responses
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
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
        return res.status(400).json({ message: 'No file provided.' });
      }

      // Detect file type from mimetype or extension
      const fileMimeType = req.file.mimetype;
      let fileExtension = req.file.originalname.toLowerCase().split('.').pop();
      
      // If extension not found, try to infer from mime type
      if (!fileExtension) {
        if (fileMimeType === 'application/pdf') {
          fileExtension = 'pdf';
        } else if (fileMimeType === 'application/msword') {
          fileExtension = 'doc';
        } else if (fileMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          fileExtension = 'docx';
        } else if (fileMimeType === 'application/vnd.ms-excel') {
          fileExtension = 'xls';
        } else if (fileMimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
          fileExtension = 'xlsx';
        } else {
          fileExtension = 'png'; // default
        }
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

      // Rename the file with proper control_id and correct extension
      const timestamp = Date.now();
      const finalFilename = `${String(finalControlId).trim()}-${timestamp}.${fileExtension}`;
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

      // Ensure CORS headers are set in success response
      res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.json({ 
        message: fileExtension === 'pdf' ? 'Annotated PDF saved successfully.' : 'Annotated image saved successfully.',
        result_artifact_url: resultArtifactUrl
      });

    } catch (error) {
      // Clean up uploaded file on error
      if (req.file) {
        fsSync.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error("Failed to delete temp file after error:", unlinkErr);
        });
      }
      console.error('Error saving annotated file:', error);
      // Ensure CORS headers are set in error response
      res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.status(500).json({ message: 'Server error during file save.' });
    }
  });
};

async function extractTextFromEvidenceFile(apiKey, fileBase64, mimeType = 'image/png') {
  // Adjust prompt based on file type
  let prompt = '';
  if (mimeType === 'application/pdf') {
    prompt = `This is a PDF document containing policy settings or configuration information. Analyse the document and extract the settings into a JSON file. Extract all relevant policy settings, configurations, and important information from the PDF.`;
  } else {
    prompt = `This image is a screenshot from MS active directory showing Policy settings, analyse the image and extract the settings into a JSON file`;
  }

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: mimeType,
            data: fileBase64
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

    // Parse existing result to compare old vs new values
    let existingResult = null;
    try {
      if (typeof existingRecord.result === 'string') {
        existingResult = JSON.parse(existingRecord.result);
      } else {
        existingResult = existingRecord.result;
      }
    } catch (parseError) {
      console.error('Error parsing existing result:', parseError);
      existingResult = {};
    }

    // Validate comments for attribute result changes
    if (updated_result.attributes_results && Array.isArray(updated_result.attributes_results)) {
      for (let i = 0; i < updated_result.attributes_results.length; i++) {
        const newAttr = updated_result.attributes_results[i];
        const oldAttr = existingResult?.attributes_results?.[i];
        
        if (oldAttr) {
          const oldValue = oldAttr.attribute_final_result !== undefined ? oldAttr.attribute_final_result : oldAttr.result;
          const newValue = newAttr.attribute_final_result;
          
          // Check if result changed from pass to fail or fail to pass (excluding NA/null)
          if (oldValue !== newValue && 
              oldValue !== null && oldValue !== undefined && 
              newValue !== null && newValue !== undefined &&
              (oldValue === true || oldValue === false) && 
              (newValue === true || newValue === false)) {
            // Require comment when changing result
            if (!newAttr.attribute_result_change_comment || newAttr.attribute_result_change_comment.trim() === '') {
              return res.status(400).json({ 
                message: `Comment is required when changing result for attribute "${newAttr.attribute_name || 'Unknown'}".`,
                field: 'attribute_result_change_comment',
                attribute_index: i
              });
            }
          }
        }
      }
    }

    // Validate comment for overall evidence result change (manual_final_result)
    if (existingResult && existingResult.manual_final_result !== undefined) {
      const oldManualResult = existingResult.manual_final_result;
      const newManualResult = updated_result.manual_final_result;
      
      // Check if result changed from pass to fail or fail to pass
      if (oldManualResult !== newManualResult && (oldManualResult === true || oldManualResult === false) && (newManualResult === true || newManualResult === false)) {
        // Require comment when changing result
        if (!updated_result.evidence_result_change_comment || updated_result.evidence_result_change_comment.trim() === '') {
          return res.status(400).json({ 
            message: 'Comment is required when changing overall evidence result.',
            field: 'evidence_result_change_comment'
          });
        }
      }
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
    const { test_execution_id, status, result, test_result_change_comment } = req.body;
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

    // Check if result changed from pass to fail or fail to pass
    const oldResult = testExecution.result;
    const isPassToFail = (oldResult === 'pass' && result === 'fail');
    const isFailToPass = (oldResult === 'fail' && result === 'pass');
    
    if ((isPassToFail || isFailToPass) && (!test_result_change_comment || test_result_change_comment.trim() === '')) {
      return res.status(400).json({ 
        message: 'Comment is required when changing test result from pass to fail or fail to pass.',
        field: 'test_result_change_comment'
      });
    }

    const updated = await TestExecution.updateStatusAndResult(
      test_execution_id,
      status,
      result,
      test_result_change_comment,
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

/**
 * Convert office document (doc, docx, xls, xlsx) to PDF using libreoffice-convert
 * @param {string} filePath - Path to the office document
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function convertOfficeToPdf(filePath) {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const pdfBuffer = await libreConvert(fileBuffer, '.pdf', undefined);
    return pdfBuffer;
  } catch (error) {
    console.error('Error converting office document to PDF:', error);
    throw new Error(`Failed to convert office document to PDF: ${error.message}`);
  }
}

// ============================================
// WORD EXTRACTION HELPER FUNCTIONS
// ============================================

async function extractWordMetadata(filePath) {
  const zip = new AdmZip(filePath);
  const metadata = {
    core: {},
    app: {},
    custom: {}
  };

  try {
    // Extract core properties
    const coreXml = zip.readAsText('docProps/core.xml');
    const coreData = await parseStringPromise(coreXml);
    const coreProps = coreData['cp:coreProperties'];
    
    if (coreProps) {
      metadata.core = {
        title: coreProps['dc:title']?.[0] || null,
        subject: coreProps['dc:subject']?.[0] || null,
        creator: coreProps['dc:creator']?.[0] || null,
        keywords: coreProps['cp:keywords']?.[0] || null,
        description: coreProps['dc:description']?.[0] || null,
        lastModifiedBy: coreProps['cp:lastModifiedBy']?.[0] || null,
        revision: coreProps['cp:revision']?.[0] || null,
        created: coreProps['dcterms:created']?.[0]?._ || null,
        modified: coreProps['dcterms:modified']?.[0]?._ || null
      };
    }

    // Extract app properties
    const appXml = zip.readAsText('docProps/app.xml');
    const appData = await parseStringPromise(appXml);
    const appProps = appData.Properties;
    
    if (appProps) {
      metadata.app = {
        application: appProps.Application?.[0] || null,
        appVersion: appProps.AppVersion?.[0] || null,
        totalTime: appProps.TotalTime?.[0] || null,
        pages: parseInt(appProps.Pages?.[0]) || 0,
        words: parseInt(appProps.Words?.[0]) || 0,
        characters: parseInt(appProps.Characters?.[0]) || 0,
        lines: parseInt(appProps.Lines?.[0]) || 0,
        paragraphs: parseInt(appProps.Paragraphs?.[0]) || 0,
        company: appProps.Company?.[0] || null
      };
    }
  } catch (error) {
    console.warn(`Could not extract all metadata: ${error.message}`);
  }

  return metadata;
}

async function extractWordImages(filePath) {
  const zip = new AdmZip(filePath);
  const images = [];
  
  const mediaEntries = zip.getEntries().filter(entry => 
    entry.entryName.startsWith('word/media/')
  );

  mediaEntries.forEach((entry, idx) => {
    const filename = path.basename(entry.entryName);
    const ext = path.extname(filename).toLowerCase().slice(1);
    const buffer = entry.getData();
    
    images.push({
      id: `img_${idx}`,
      filename: filename,
      extension: ext,
      path: entry.entryName,
      buffer: buffer,
      size: buffer.length
    });
  });

  return images;
}

async function extractWordTables(filePath) {
  const result = await mammoth.convertToHtml(
    { path: filePath },
    { 
      convertImage: mammoth.images.inline(() => ({ src: '' }))
    }
  );

  const tables = [];
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  const tableMatches = [...result.value.matchAll(tableRegex)];

  tableMatches.forEach((match, idx) => {
    const tableHtml = match[0];
    const rows = [];
    
    // Extract rows
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rowMatches = [...tableHtml.matchAll(rowRegex)];
    
    rowMatches.forEach(rowMatch => {
      const cells = [];
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      const cellMatches = [...rowMatch[1].matchAll(cellRegex)];
      
      cellMatches.forEach(cellMatch => {
        const cellText = cellMatch[1].replace(/<[^>]*>/g, '').trim();
        cells.push(cellText);
      });
      
      if (cells.length > 0) {
        rows.push(cells);
      }
    });

    if (rows.length > 0) {
      tables.push({
        id: `table_${idx}`,
        rowCount: rows.length,
        columnCount: rows[0]?.length || 0,
        headers: rows[0],
        data: rows.slice(1)
      });
    }
  });

  return tables;
}

async function extractWordTextContent(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

async function extractWordStructuredContent(filePath) {
  const result = await mammoth.convertToHtml(
    { path: filePath },
    { 
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Heading 5'] => h5:fresh",
        "p[style-name='Heading 6'] => h6:fresh"
      ]
    }
  );

  const html = result.value;
  const structure = {
    headings: [],
    paragraphs: [],
    lists: []
  };

  // Extract headings
  const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const headingMatches = [...html.matchAll(headingRegex)];
  headingMatches.forEach((match, idx) => {
    structure.headings.push({
      id: `heading_${idx}`,
      level: parseInt(match[1]),
      text: match[2].replace(/<[^>]*>/g, '').trim()
    });
  });

  // Extract paragraphs
  const paraRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  const paraMatches = [...html.matchAll(paraRegex)];
  paraMatches.forEach((match, idx) => {
    const text = match[1].replace(/<[^>]*>/g, '').trim();
    if (text) {
      structure.paragraphs.push({
        id: `para_${idx}`,
        text: text
      });
    }
  });

  // Extract lists
  const listRegex = /<[ou]l[^>]*>([\s\S]*?)<\/[ou]l>/gi;
  const listMatches = [...html.matchAll(listRegex)];
  listMatches.forEach((match, idx) => {
    const items = [];
    const itemRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    const itemMatches = [...match[1].matchAll(itemRegex)];
    
    itemMatches.forEach(itemMatch => {
      const text = itemMatch[1].replace(/<[^>]*>/g, '').trim();
      if (text) items.push(text);
    });

    if (items.length > 0) {
      structure.lists.push({
        id: `list_${idx}`,
        type: match[0].startsWith('<ol') ? 'ordered' : 'unordered',
        items: items
      });
    }
  });

  return structure;
}

// REMOVED: uploadWordFileToGemini and callGeminiForWordImage - no longer needed, using inline base64

// Extract content from image using inline base64 (no file upload needed)
async function extractWordImageContent(apiKey, imageInfo) {
  try {
    console.log(`Analyzing image: ${imageInfo.id}`);
    
    // Validate buffer exists
    if (!imageInfo.buffer || !Buffer.isBuffer(imageInfo.buffer)) {
      throw new Error(`Image ${imageInfo.id} has no valid buffer`);
    }
    
    const mimeType = imageInfo.extension === 'png' ? 'image/png' : 
                    imageInfo.extension === 'jpg' || imageInfo.extension === 'jpeg' ? 'image/jpeg' :
                    imageInfo.extension === 'gif' ? 'image/gif' :
                    imageInfo.extension === 'bmp' ? 'image/bmp' :
                    'image/png';
    
    const extractedData = await analyzeImageWithInlineData(apiKey, imageInfo.buffer, mimeType, imageInfo.id);
    
    console.log(`Extracted data from ${imageInfo.id} using inline data`);
    
    return {
      id: imageInfo.id,
      filename: imageInfo.filename,
      extractedContent: extractedData
    };
    
  } catch (error) {
    console.error(`Failed to analyze ${imageInfo.id}: ${error.message}`);
    return {
      id: imageInfo.id,
      filename: imageInfo.filename,
      extractedContent: null,
      error: error.message
    };
  }
}


/**
 * Extract text from Word document (doc, docx) with image analysis
 * @param {string} apiKey - Gemini API key
 * @param {string} wordPath - Path to the Word document (relative to uploads folder)
 * @returns {Promise<string>} - Extracted text as JSON string
 */
async function extractTextFromWord(apiKey, wordPath) {
  try {
    // Construct full file path
    const fullPath = path.join(__dirname, '..', 'uploads', wordPath);
    
    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch (accessError) {
      throw new Error(`Word document not found at path: ${fullPath}`);
    }

    console.log('Extracting data from Word file:', fullPath);

    // Extract document metadata
    console.log('Extracting document metadata...');
    const documentProperties = await extractWordMetadata(fullPath);
    console.log('Document metadata extracted');

    const metadata = {
      filename: path.basename(fullPath),
      filepath: fullPath,
      extractedAt: new Date().toISOString(),
      documentProperties: documentProperties,
      content: {},
      images: [],
      tables: [],
      structure: {}
    };
    
    // Extract text content
    console.log('Extracting text content...');
    metadata.content.rawText = await extractWordTextContent(fullPath);
    console.log(`Extracted ${metadata.content.rawText.length} characters of text`);
    
    // Extract structured content
    console.log('Extracting structured content...');
    metadata.structure = await extractWordStructuredContent(fullPath);
    console.log(`Found ${metadata.structure.headings.length} headings, ${metadata.structure.paragraphs.length} paragraphs, ${metadata.structure.lists.length} lists`);
    
    // Extract tables
    console.log('Extracting tables...');
    metadata.tables = await extractWordTables(fullPath);
    console.log(`Extracted ${metadata.tables.length} tables`);
    
    // Extract images
    console.log('Extracting images...');
    //metadata.images = await extractWordImages(fullPath);
    console.log(`Extracted ${metadata.images.length} images`);
    
    // Analyze images directly using inline base64 (no upload needed)
    if (metadata.images.length > 0) {
      console.log(`Analyzing ${metadata.images.length} images using inline base64...`);
        
        const imageAnalysis = await processBatch(
        metadata.images,
          (img) => extractWordImageContent(apiKey, img),
          3 // batch size
        );
        
        // Merge image analysis back into metadata
        for (const img of metadata.images) {
          const analysis = imageAnalysis.find(a => a.id === img.id);
          if (analysis) {
            // Remove buffer (too large for JSON)
            delete img.buffer;
            // Add extracted content
            img.extractedContent = analysis.extractedContent;
            if (analysis.error) {
              img.extractionError = analysis.error;
            }
          } else {
            delete img.buffer;
          }
        }
        
        const successCount = imageAnalysis.filter(r => r.extractedContent !== null).length;
      console.log(`Successfully analyzed ${successCount}/${metadata.images.length} images`);
    } else {
      // Remove buffers even if no images
      for (const img of metadata.images) {
        delete img.buffer;
      }
    }
    
    // Create summary
    metadata.summary = {
      totalCharacters: metadata.content.rawText.length,
      totalWords: metadata.documentProperties.app.words || metadata.content.rawText.split(/\s+/).length,
      totalParagraphs: metadata.structure.paragraphs.length,
      totalHeadings: metadata.structure.headings.length,
      totalLists: metadata.structure.lists.length,
      totalTables: metadata.tables.length,
      totalImages: metadata.images.length,
      imagesAnalyzed: metadata.images.filter(img => img.extractedContent !== null).length,
      pages: metadata.documentProperties.app.pages || 0
    };
    
    console.log('Word extraction completed successfully');
    
    // Return as JSON string for database storage
    const result = JSON.stringify(metadata);
    return result;
    
  } catch (error) {
    console.error('Error extracting text from Word document:', error);
    throw error;
  }
}

// ============================================
// EXCEL EXTRACTION HELPER FUNCTIONS
// ============================================

function colToLetter(col) {
  let letter = '';
  while (col >= 0) {
    letter = String.fromCharCode((col % 26) + 65) + letter;
    col = Math.floor(col / 26) - 1;
  }
  return letter;
}

function formatCellValue(cell) {
  if (!cell || cell.value === null || cell.value === undefined) {
    return { raw: null, formatted: '', type: 'empty' };
  }

  const cellValue = cell.value;
  let raw = cellValue;
  let formatted = '';
  let type = 'string';

  if (typeof cellValue === 'number') {
    type = 'number';
    raw = cellValue;
    formatted = cell.numFmt ? cell.text : cellValue.toString();
  } else if (cellValue instanceof Date) {
    type = 'date';
    raw = cellValue.toISOString();
    formatted = cell.text || cellValue.toLocaleDateString();
  } else if (typeof cellValue === 'boolean') {
    type = 'boolean';
    raw = cellValue;
    formatted = cellValue.toString();
  } else if (typeof cellValue === 'object') {
    if (cellValue.formula) {
      type = 'formula';
      raw = cellValue.formula;
      formatted = cellValue.result?.toString() || '';
    } else if (cellValue.richText) {
      type = 'richText';
      raw = cellValue.richText.map(rt => rt.text).join('');
      formatted = raw;
    } else if (cellValue.text) {
      type = 'string';
      raw = cellValue.text;
      formatted = cellValue.text;
    } else {
      raw = JSON.stringify(cellValue);
      formatted = raw;
    }
  } else {
    raw = cellValue.toString();
    formatted = raw;
  }

  return { raw, formatted, type };
}

function extractCellStyle(cell) {
  const style = {};
  
  if (cell.font) {
    style.font = {
      name: cell.font.name,
      size: cell.font.size,
      bold: cell.font.bold,
      italic: cell.font.italic,
      underline: cell.font.underline,
      color: cell.font.color?.argb
    };
  }
  
  if (cell.fill && cell.fill.type === 'pattern') {
    style.fill = {
      type: cell.fill.pattern,
      fgColor: cell.fill.fgColor?.argb,
      bgColor: cell.fill.bgColor?.argb
    };
  }
  
  if (cell.border) {
    style.border = {
      top: cell.border.top ? { style: cell.border.top.style, color: cell.border.top.color?.argb } : null,
      left: cell.border.left ? { style: cell.border.left.style, color: cell.border.left.color?.argb } : null,
      bottom: cell.border.bottom ? { style: cell.border.bottom.style, color: cell.border.bottom.color?.argb } : null,
      right: cell.border.right ? { style: cell.border.right.style, color: cell.border.right.color?.argb } : null
    };
  }
  
  if (cell.alignment) {
    style.alignment = {
      horizontal: cell.alignment.horizontal,
      vertical: cell.alignment.vertical,
      wrapText: cell.alignment.wrapText,
      indent: cell.alignment.indent
    };
  }
  
  if (cell.numFmt) {
    style.numberFormat = cell.numFmt;
  }
  
  return Object.keys(style).length > 0 ? style : null;
}

function extractSheetData(worksheet, sheetName, zipImages = []) {
  console.log(`Processing sheet: ${sheetName}`);
  
  const data = {
    name: sheetName,
    dimensions: {
      rowCount: worksheet.rowCount,
      columnCount: worksheet.columnCount,
      actualRowCount: worksheet.actualRowCount,
      actualColumnCount: worksheet.actualColumnCount
    },
    cells: [],
    mergedCells: [],
    images: [],
    comments: [],
    dataValidations: [],
    conditionalFormatting: []
  };

  // Extract merged cells
  if (worksheet._merges && Object.keys(worksheet._merges).length > 0) {
    for (const merge in worksheet._merges) {
      data.mergedCells.push(merge);
    }
    console.log(`Found ${data.mergedCells.length} merged cell ranges`);
  }

  // Extract all cells
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const cellAddress = `${colToLetter(colNumber - 1)}${rowNumber}`;
      const valueData = formatCellValue(cell);
      const style = extractCellStyle(cell);
      
      const cellData = {
        address: cellAddress,
        row: rowNumber,
        col: colNumber,
        colLetter: colToLetter(colNumber - 1),
        value: valueData.raw,
        formattedValue: valueData.formatted,
        type: valueData.type
      };
      
      if (style) cellData.style = style;
      if (cell.note) cellData.note = cell.note;
      
      data.cells.push(cellData);
    });
  });
  
  console.log(`Extracted ${data.cells.length} cells with content`);

  // Extract images with buffers for later analysis
  if (worksheet._media && worksheet._media.length > 0) {
    worksheet._media.forEach((media, idx) => {
      try {
        // Try to get buffer from different possible locations
        let buffer = null;
        if (media.buffer) {
          buffer = media.buffer;
        } else if (media.image && media.image.buffer) {
          buffer = media.image.buffer;
        } else if (media.image && Buffer.isBuffer(media.image)) {
          buffer = media.image;
        } else if (media.data && Buffer.isBuffer(media.data)) {
          buffer = media.data;
        }
        
        // If no buffer found in media object, try to get from zip images
        if (!buffer && zipImages && zipImages.length > idx) {
          buffer = zipImages[idx].buffer;
          console.log(`Using buffer from zip image ${idx} for media ${idx}`);
        } else if (!buffer && zipImages && zipImages.length > 0) {
          // Try to match by index (fallback to first available)
          buffer = zipImages[Math.min(idx, zipImages.length - 1)].buffer;
          console.log(`Using fallback zip image buffer for media ${idx}`);
        }
        
        // Determine extension from type or name
        let extension = 'png'; // default
        if (media.extension) {
          extension = media.extension;
        } else if (media.type) {
          // Map MIME type to extension
          const typeMap = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/gif': 'gif',
            'image/bmp': 'bmp',
            'image/webp': 'webp'
          };
          extension = typeMap[media.type] || 'png';
        } else if (media.name) {
          // Extract extension from filename
          const match = media.name.match(/\.([^.]+)$/);
          if (match) {
            extension = match[1].toLowerCase();
          }
        } else if (zipImages && zipImages.length > idx && zipImages[idx].extension) {
          // Use extension from zip image
          extension = zipImages[idx].extension;
        }
        
        // Only add image if we have a valid buffer
        if (buffer && Buffer.isBuffer(buffer)) {
        const imageData = {
          id: `${sheetName}_img_${idx}`,
          sheetName: sheetName,
            type: media.type || `image/${extension}`,
            extension: extension,
          position: {
            from: {
                col: media.range?.tl?.nativeCol || 0,
                row: media.range?.tl?.nativeRow || 0,
                colOff: media.range?.tl?.nativeColOff || 0,
                rowOff: media.range?.tl?.nativeRowOff || 0
            },
            to: {
                col: media.range?.br?.nativeCol || 0,
                row: media.range?.br?.nativeRow || 0,
                colOff: media.range?.br?.nativeColOff || 0,
                rowOff: media.range?.br?.nativeRowOff || 0
              }
            },
            buffer: buffer, // Keep buffer for upload
            size: buffer.length
        };
        
        data.images.push(imageData);
        } else {
          console.warn(`Image ${idx} in sheet "${sheetName}" has no valid buffer. Available properties: ${Object.keys(media).join(', ')}`);
        }
      } catch (error) {
        console.warn(`Failed to extract image ${idx}: ${error.message}`);
        console.warn(`Error stack: ${error.stack}`);
      }
    });
    
    console.log(`Extracted ${data.images.length} images from sheet "${sheetName}"`);
  } else if (zipImages && zipImages.length > 0) {
    // If no media objects but we have zip images, use them
    console.log(`No media objects found, using ${zipImages.length} images from zip file`);
    zipImages.forEach((zipImg, idx) => {
      data.images.push({
        id: `${sheetName}_img_${idx}`,
        sheetName: sheetName,
        type: `image/${zipImg.extension}`,
        extension: zipImg.extension,
        position: {
          from: { col: 0, row: 0, colOff: 0, rowOff: 0 },
          to: { col: 0, row: 0, colOff: 0, rowOff: 0 }
        },
        buffer: zipImg.buffer,
        size: zipImg.size
      });
    });
  }

  // Extract data validations
  if (worksheet.dataValidations && worksheet.dataValidations.model) {
    for (const [range, validation] of Object.entries(worksheet.dataValidations.model)) {
      data.dataValidations.push({
        range,
        type: validation.type,
        operator: validation.operator,
        formulae: validation.formulae,
        allowBlank: validation.allowBlank
      });
    }
    
    if (data.dataValidations.length > 0) {
      console.log(`Extracted ${data.dataValidations.length} data validations`);
    }
  }

  // Extract conditional formatting
  if (worksheet.conditionalFormattings) {
    worksheet.conditionalFormattings.forEach((cf, idx) => {
      data.conditionalFormatting.push({
        id: idx,
        ref: cf.ref,
        rules: cf.rules
      });
    });
    
    if (data.conditionalFormatting.length > 0) {
      console.log(`Extracted ${data.conditionalFormatting.length} conditional formatting rules`);
    }
  }

  // Extract comments
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      if (cell.note) {
        const cellAddress = `${colToLetter(colNumber - 1)}${rowNumber}`;
        data.comments.push({
          address: cellAddress,
          row: rowNumber,
          col: colNumber,
          note: cell.note
        });
      }
    });
  });
  
  if (data.comments.length > 0) {
    console.log(`Extracted ${data.comments.length} comments`);
  }

  return data;
}

// Rate limiter for Gemini API
class RateLimiter {
  constructor(maxRequestsPerMinute) {
    this.maxRPM = maxRequestsPerMinute;
    this.requestTimestamps = [];
  }
  
  async waitIfNeeded() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    this.requestTimestamps = this.requestTimestamps.filter(t => t > oneMinuteAgo);
    
    if (this.requestTimestamps.length < this.maxRPM) {
      this.requestTimestamps.push(now);
      return 0;
    }
    
    const oldestRequest = this.requestTimestamps[0];
    const timeSinceOldest = now - oldestRequest;
    const waitTime = 60000 - timeSinceOldest + 1000;
    
    if (waitTime > 0) {
      console.warn(`Rate limit reached. Waiting ${(waitTime/1000).toFixed(1)}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      const afterWait = Date.now();
      this.requestTimestamps = this.requestTimestamps.filter(t => t > afterWait - 60000);
      this.requestTimestamps.push(afterWait);
      
      return waitTime;
    } else {
      this.requestTimestamps.push(now);
      return 0;
    }
  }
}

// Batch processing utility
async function processBatch(items, processFn, batchSize) {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(items.length / batchSize);
    
    console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)`);
    
    const batchResults = await Promise.all(
      batch.map(item => processFn(item))
    );
    
    results.push(...batchResults);
  }
  
  return results;
}

// REMOVED: uploadFileToGemini and callGeminiForImage - no longer needed, using inline base64

// Analyze image using inline base64 data (no file upload needed)
async function analyzeImageWithInlineData(apiKey, buffer, mimeType, imageId) {
  const rateLimiter = new RateLimiter(10);
  await rateLimiter.waitIfNeeded();
  
  // Convert buffer to base64
  const fileBase64 = buffer.toString('base64');
    
    const prompt = `Analyze this image and extract ALL visible content in a structured format.

IMPORTANT: Return ONLY valid JSON, no markdown formatting, no code blocks.

Extract:
1. All visible text (headers, labels, data, numbers)
2. Any tables with their structure (rows, columns, headers, values)
3. Charts/graphs with their data points and labels
4. Any other structured data visible in the image

Return the data in this exact JSON format:
{
  "text_content": "All raw text found in the image",
  "structured_data": {
    "tables": [
      {
        "name": "table name or description",
        "headers": ["column1", "column2", ...],
        "rows": [
          ["value1", "value2", ...],
          ...
        ]
      }
    ],
    "key_value_pairs": [
      {"key": "label", "value": "data"}
    ],
    "charts": [
      {
        "type": "chart type",
        "title": "chart title",
        "data": "description of data shown"
      }
    ]
  },
  "summary": "Brief description of what this image contains"
}`;

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: mimeType,
            data: fileBase64
          }
        }
      ]
    }]
  };

  const apiUrl = `${process.env.GEMINI_AI_ENDPOINT}?key=${apiKey}`;
  
  try {
    const response = await axios.post(apiUrl, requestBody, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    const data = response.data;
    let resultText = data.candidates[0].content.parts[0].text;
    resultText = resultText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const extractedData = JSON.parse(resultText);
    return extractedData;
  } catch (error) {
    const errorData = error.response?.data || {};
    console.error(`Gemini API Error for ${imageId}:`, errorData);
    throw new Error(`API Error: ${errorData.error?.message || error.message}`);
  }
}

async function extractImageContent(apiKey, imageInfo) {
  try {
    console.log(`Analyzing image: ${imageInfo.id}`);
    
    // Validate buffer exists
    if (!imageInfo.buffer || !Buffer.isBuffer(imageInfo.buffer)) {
      throw new Error(`Image ${imageInfo.id} has no valid buffer`);
    }
    
    const mimeType = imageInfo.extension === 'png' ? 'image/png' : 
                    imageInfo.extension === 'jpg' || imageInfo.extension === 'jpeg' ? 'image/jpeg' : 
                    'image/png';
    
    const extractedData = await analyzeImageWithInlineData(apiKey, imageInfo.buffer, mimeType, imageInfo.id);
    
    console.log(`Extracted data from ${imageInfo.id} using inline data`);
    
    return {
      id: imageInfo.id,
      sheetName: imageInfo.sheetName,
      position: imageInfo.position,
      extractedContent: extractedData
    };
    
  } catch (error) {
    console.error(`Failed to analyze ${imageInfo.id}: ${error.message}`);
    return {
      id: imageInfo.id,
      sheetName: imageInfo.sheetName,
      position: imageInfo.position,
      extractedContent: null,
      error: error.message
    };
  }
}


/**
 * Extract text from Excel document (xls, xlsx) with image analysis
 * @param {string} apiKey - Gemini API key
 * @param {string} excelPath - Path to the Excel document (relative to uploads folder)
 * @returns {Promise<string>} - Extracted text as JSON string
 */
// Extract images directly from Excel zip file
async function extractExcelImagesFromZip(filePath) {
  const images = [];
  try {
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();
    
    // Excel stores images in xl/media/ folder
    const mediaEntries = entries.filter(entry => 
      entry.entryName.startsWith('xl/media/') && 
      !entry.isDirectory
    );
    
    mediaEntries.forEach((entry, idx) => {
      try {
        const filename = path.basename(entry.entryName);
        const ext = path.extname(filename).toLowerCase().slice(1) || 'png';
        const buffer = entry.getData();
        
        if (buffer && buffer.length > 0) {
          images.push({
            id: `excel_img_${idx}`,
            filename: filename,
            extension: ext,
            path: entry.entryName,
            buffer: buffer,
            size: buffer.length
          });
        }
    } catch (error) {
        console.warn(`Failed to extract image from zip entry ${entry.entryName}: ${error.message}`);
      }
    });
    
    console.log(`Extracted ${images.length} images from Excel zip file`);
  } catch (error) {
    console.error(`Failed to extract images from Excel zip: ${error.message}`);
  }
  
  return images;
}

async function extractTextFromExcelWithImages(apiKey, excelPath) {
  try {
    // Construct full file path
    const fullPath = path.join(__dirname, '..', 'uploads', excelPath);
    
    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch (accessError) {
      throw new Error(`Excel document not found at path: ${fullPath}`);
    }

    console.log('Extracting data from Excel file:', fullPath);

    // Extract images from zip file first (as backup)
    const zipImages = await extractExcelImagesFromZip(fullPath);

    // Load Excel workbook
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(fullPath);
    
    console.log(`Loaded workbook with ${workbook.worksheets.length} sheets`);
    
    const metadata = {
      filename: path.basename(fullPath),
      filepath: fullPath,
      extractedAt: new Date().toISOString(),
      workbook: {
        creator: workbook.creator,
        lastModifiedBy: workbook.lastModifiedBy,
        created: workbook.created,
        modified: workbook.modified,
        properties: workbook.properties
      },
      sheets: []
    };
    
    // Extract data from all sheets
    for (const worksheet of workbook.worksheets) {
      try {
        const sheetData = extractSheetData(worksheet, worksheet.name, zipImages);
        metadata.sheets.push(sheetData);
      } catch (error) {
        console.error(`Failed to process sheet "${worksheet.name}": ${error.message}`);
      }
    }
    
    console.log(`Extracted data from ${metadata.sheets.length} sheets`);
    
    // Analyze images directly using inline base64 (no upload needed)
    const allImages = [];
    // Collect all images from all sheets
    for (const sheet of metadata.sheets) {
      if (sheet.images.length > 0) {
        console.log(`Found ${sheet.images.length} images in sheet "${sheet.name}"`);
        allImages.push(...sheet.images);
      }
    }
    
    console.log(`Total images to analyze: ${allImages.length}`);
    
    // Analyze images directly using inline data
    if (allImages.length > 0) {
      console.log(`Analyzing ${allImages.length} images using inline base64...`);
      
      const imageAnalysis = await processBatch(
        allImages,
        (img) => extractImageContent(apiKey, img),
        3 // batch size
      );
      
      // Merge image analysis back into metadata
      for (const sheet of metadata.sheets) {
        for (const img of sheet.images) {
          const analysis = imageAnalysis.find(a => a.id === img.id);
          if (analysis) {
            // Remove buffer (too large for JSON)
            delete img.buffer;
            // Add extracted content
            img.extractedContent = analysis.extractedContent;
            if (analysis.error) {
              img.extractionError = analysis.error;
            }
          } else {
            delete img.buffer;
          }
        }
      }
      
      const successCount = imageAnalysis.filter(r => r.extractedContent !== null).length;
      console.log(`Successfully analyzed ${successCount}/${allImages.length} images`);
    } else {
      // Remove buffers even if no images
      for (const sheet of metadata.sheets) {
        for (const img of sheet.images) {
          delete img.buffer;
        }
      }
    }
    
    // Add summary
    const totalCells = metadata.sheets.reduce((sum, sheet) => sum + sheet.cells.length, 0);
    const totalImages = metadata.sheets.reduce((sum, sheet) => sum + sheet.images.length, 0);
    const totalMergedCells = metadata.sheets.reduce((sum, sheet) => sum + sheet.mergedCells.length, 0);
    
    metadata.summary = {
      totalSheets: metadata.sheets.length,
      totalCells,
      totalImages,
      totalMergedCells,
      sheetNames: metadata.sheets.map(s => s.name)
    };
    
    // No cleanup needed - using inline base64 data instead of file uploads
    
    // Return as JSON string for database storage
    const result = JSON.stringify(metadata);
    console.log('Excel extraction completed successfully');
    return result;
    
  } catch (error) {
    console.error('Error extracting text from Excel document:', error);
    throw error;
  }
}

// POST evaluate all evidences for a test execution
exports.evaluateAllEvidences = async (req, res) => {
  try {
    const { test_execution_id, rcm_id, client_id, sample_name } = req.body;
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    if (!test_execution_id) {
      return res.status(400).json({ message: 'Test execution ID is required.' });
    }

    if (!rcm_id) {
      return res.status(400).json({ message: 'RCM ID is required.' });
    }

    // Get test execution to find evidence documents
    const testExecution = await TestExecution.findById(test_execution_id, tenantId);
    if (!testExecution) {
      return res.status(404).json({ message: 'Test execution not found.' });
    }

    // Normalize sample_name (use 'No Sample' for null/empty)
    const normalizedSampleName = sample_name || 'No Sample';

    // Check if overall_execution_result already exists in database
    let existingResultsBySample = {};
    if (testExecution.overall_execution_result) {
      try {
        // Parse the existing result from database
        let parsedResult;
        if (typeof testExecution.overall_execution_result === 'string') {
          parsedResult = JSON.parse(testExecution.overall_execution_result);
        } else {
          parsedResult = testExecution.overall_execution_result;
        }

        // Check if it's the old format (single result) or new format (sample-based)
        if (parsedResult && typeof parsedResult === 'object' && !Array.isArray(parsedResult)) {
          // Check if it has sample_name keys (new format) or is old format
          if (parsedResult.attribute_results || parsedResult.evidence_results) {
            // Old format - convert to sample-based format
            existingResultsBySample = { [normalizedSampleName]: parsedResult };
          } else {
            // New format - already sample-based
            existingResultsBySample = parsedResult;
          }
        }

        // If we have results for this sample, return them
        if (existingResultsBySample[normalizedSampleName]) {
          return res.json({
            message: 'Overall execution results retrieved successfully from database.',
            results: existingResultsBySample[normalizedSampleName]
          });
        }
      } catch (parseError) {
        console.error('Error parsing existing overall_execution_result:', parseError);
        // If parsing fails, continue with AI evaluation
      }
    }

    // If overall_execution_result is null or parsing failed, proceed with AI evaluation
    // Use client_id from testExecution if not provided in request
    const finalClientId = client_id || testExecution.client_id;
    if (!finalClientId) {
      return res.status(400).json({ message: 'Client ID is required.' });
    }

    // Get all evidence documents for this test execution
    let evidenceDocuments = testExecution.pcb_id 
      ? await TestExecution.getEvidenceDocuments(testExecution.pcb_id, tenantId)
      : [];

    // Filter by sample_name (normalizedSampleName is always set, either from sample_name or 'No Sample')
    evidenceDocuments = evidenceDocuments.filter(doc => {
      const docSampleName = doc.sample_name || 'No Sample';
      return docSampleName === normalizedSampleName;
    });

    if (evidenceDocuments.length === 0) {
      return res.status(404).json({ 
        message: `No evidence documents found for sample "${normalizedSampleName}".` 
      });
    }

    // Get test attributes
    const testAttributes = await TestExecution.getTestAttributesByRcmId(rcm_id, tenantId);
    if (!testAttributes || testAttributes.length === 0) {
      return res.status(404).json({ message: 'Test attributes not found.' });
    }

    // Process each evidence document
    const evidenceResults = [];
    const attributeEvidenceMap = {}; // Map attribute_name to array of matching evidence documents

    // Initialize attribute map
    testAttributes.forEach(attr => {
      attributeEvidenceMap[attr.attribute_name] = {
        attribute_id: attr.attribute_id,
        attribute_name: attr.attribute_name,
        attribute_description: attr.attribute_description,
        test_steps: attr.test_steps,
        matching_evidences: [],
        non_matching_evidences: []
      };
    });

    for (const doc of evidenceDocuments) {
      try {
        // Step 1: Check if evidence_ai_details exists, if not fetch it
        let evidenceDocument = await PBC.findEvidenceDocumentById(doc.document_id, tenantId);
        if (!evidenceDocument) {
          throw new Error(`Evidence document ${doc.document_id} not found`);
        }

        let evidenceAiDetails = evidenceDocument.evidence_ai_details;
        if (!evidenceAiDetails || 
            (typeof evidenceAiDetails === 'string' && evidenceAiDetails.trim() === '') ||
            (typeof evidenceAiDetails === 'object' && Object.keys(evidenceAiDetails).length === 0)) {
          // Fetch AI details
          await extractEvidenceAIDetails(doc.document_id, doc.artifact_url, tenantId, userId);
          // Re-fetch document to get updated AI details
          evidenceDocument = await PBC.findEvidenceDocumentById(doc.document_id, tenantId);
          evidenceAiDetails = evidenceDocument.evidence_ai_details;
        }

        // Step 2: Compare attributes - call the compareAttributes logic directly
        if (!evidenceAiDetails || 
            (typeof evidenceAiDetails === 'string' && evidenceAiDetails.trim() === '') ||
            (typeof evidenceAiDetails === 'object' && Object.keys(evidenceAiDetails).length === 0)) {
          throw new Error(`Evidence AI details not available for document ${doc.document_id}`);
        }

        const attributesList = testAttributes.map((attr) => 
          `{"attribute_name": "${attr.attribute_name}", "attribute_description": "${attr.attribute_description}", "test_steps": "${attr.test_steps}"}`
        ).join(',\n');

        let taskPrompt = await AiPrompts.getPromptByHierarchy(rcm_id, finalClientId, tenantId);
        
        if (!taskPrompt) {
          taskPrompt = `- Understand the context and meaning of both evidence and requirements
- Match based on semantic meaning, not exact text
- Consider synonyms, equivalent terms, and policy variations`;
        }

        const prompt = `Analyze the evidence and verify compliance with each requirement based on context.
  
    EVIDENCE:
    ${evidenceAiDetails}
    
    REQUIREMENTS:
    [${attributesList}]
    
    TASK:
    ${taskPrompt}
    
    Return JSON array with each requirement evaluated:
    {
      attributes_results: [
        {
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
        const response = await axios.post(apiUrl, requestBody, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

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

        // Check if record exists, if not create it
        const existingRecord = await TestExecutionEvidenceDocuments.findByTestExecutionAndEvidenceDocument(
          test_execution_id,
          doc.document_id,
          tenantId
        );

        if (!existingRecord) {
          const result = JSON.stringify(parsedResult);
          const testExecutionEvidenceDocumentData = {
            test_execution_id: test_execution_id,
            evidence_document_id: doc.document_id,
            rcm_id: rcm_id,
            tenant_id: tenantId,
            client_id: finalClientId,
            result: result,
            status: parsedResult.final_result,
            total_attributes: parsedResult.total_attributes,
            total_attributes_passed: parsedResult.total_attributes_passed,
            total_attributes_failed: parsedResult.total_attributes_failed,
            created_by: userId
          };
          await TestExecutionEvidenceDocuments.create(testExecutionEvidenceDocumentData);
        }

        if (parsedResult) {
          const results = parsedResult;
          const attributesResults = results.attributes_results || [];

          // Store evidence result
          evidenceResults.push({
            document_id: doc.document_id,
            document_name: doc.document_name,
            artifact_url: doc.artifact_url,
            results: results,
            final_result: results.final_result
          });

          // Map each attribute to its matching/non-matching evidences
          attributesResults.forEach(attrResult => {
            const attrName = attrResult.attribute_name;
            if (attributeEvidenceMap[attrName]) {
              const evidenceInfo = {
                document_id: doc.document_id,
                document_name: doc.document_name,
                result: attrResult.result,
                reason: attrResult.reason || attrResult.explanation || ''
              };

              if (attrResult.result === true) {
                attributeEvidenceMap[attrName].matching_evidences.push(evidenceInfo);
              } else {
                attributeEvidenceMap[attrName].non_matching_evidences.push(evidenceInfo);
              }
            }
          });
        }
      } catch (error) {
        console.error(`Error processing evidence document ${doc.document_id}:`, error);
        // Continue with next document even if one fails
        evidenceResults.push({
          document_id: doc.document_id,
          document_name: doc.document_name,
          artifact_url: doc.artifact_url,
          error: error.message
        });
      }
    }

    // Convert attributeEvidenceMap to array
    const attributeResults = Object.values(attributeEvidenceMap);

    // Calculate overall summary
    const totalAttributes = testAttributes.length;
    let totalAttributesPassed = 0;
    let totalAttributesFailed = 0;

    attributeResults.forEach(attr => {
      if (attr.matching_evidences.length > 0) {
        totalAttributesPassed++;
      } else {
        totalAttributesFailed++;
      }
    });

    const overallResult = {
      attribute_results: attributeResults,
      evidence_results: evidenceResults,
      total_attributes: totalAttributes,
      total_attributes_passed: totalAttributesPassed,
      total_attributes_failed: totalAttributesFailed,
      total_evidences: evidenceDocuments.length,
      total_evidences_processed: evidenceResults.filter(r => !r.error).length,
      final_result: totalAttributesFailed === 0
    };

    // Save overall result to test_executions table (sample-based structure)
    // Merge with existing results from other samples
    existingResultsBySample[normalizedSampleName] = overallResult;
    const overallResultJson = JSON.stringify(existingResultsBySample);
    await TestExecution.updateOverallExecutionResult(test_execution_id, overallResultJson, tenantId, userId);

    res.json({
      message: `All evidences evaluated successfully for sample "${normalizedSampleName}".`,
      results: overallResult
    });

  } catch (error) {
    console.error('Error evaluating all evidences:', error);
    res.status(500).json({ 
      message: 'Server error.',
      error: error.message 
    });
  }
};

