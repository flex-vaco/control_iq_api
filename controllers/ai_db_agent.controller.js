const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const multer = require('multer');
const axios = require('axios');
const TestExecution = require('../models/test_executions.model');
const RCM = require('../models/rcm.model');
const PBC = require('../models/pbc.model');
const TestExecutionEvidenceDocuments = require('../models/test_execution_evidence_documents.model');



// get AI DB Agent Home Page
exports.getAIDBAgentHomePage = async (req, res) => {
    try {
        res.render('ai_db_agent_home', { title: 'AI DB Agent Home' });
    } catch (error) {
        console.error('Error rendering AI DB Agent Home Page:', error);
        res.status(500).send('Internal Server Error');
    }
};