'use strict';

const Joi = require('joi');

// ─── Re-usable primitives ──────────────────────────────────────────────────────

const id = Joi.number().integer().positive();
// Accepts both numeric strings ("5") and actual numbers from form-data
const numericId = Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().pattern(/^\d+$/));

// ─── Auth ──────────────────────────────────────────────────────────────────────

exports.login = Joi.object({
  email:    Joi.string().email().max(255).required(),
  password: Joi.string().min(1).max(128).required()
});

// ─── Clients ──────────────────────────────────────────────────────────────────

exports.createClient = Joi.object({
  client_name:   Joi.string().max(255).required(),
  industry:      Joi.string().max(255).allow('', null).optional(),
  region:        Joi.string().max(255).allow('', null).optional(),
  contact_name:  Joi.string().max(255).allow('', null).optional(),
  contact_email: Joi.string().email().max(255).allow('', null).optional(),
  contact_phone: Joi.string().max(50).allow('', null).optional(),
  status:        Joi.string().valid('active', 'inactive').default('active')
});

exports.updateClient = exports.createClient.fork(
  ['client_name'],
  field => field.optional()
);

// ─── Users ────────────────────────────────────────────────────────────────────

exports.createUser = Joi.object({
  username:   Joi.string().alphanum().min(3).max(50).required(),
  first_name: Joi.string().max(100).required(),
  last_name:  Joi.string().max(100).required(),
  email:      Joi.string().email().max(255).required(),
  role_id:    id.required(),
  password:   Joi.string().min(8).max(128).required(),
  is_active:  Joi.number().valid(0, 1).default(1),
  tenant_id:  id.optional()
});

exports.updateUser = Joi.object({
  username:   Joi.string().alphanum().min(3).max(50).required(),
  first_name: Joi.string().max(100).required(),
  last_name:  Joi.string().max(100).required(),
  email:      Joi.string().email().max(255).required(),
  role_id:    id.required(),
  password:   Joi.string().min(8).max(128).optional(),
  is_active:  Joi.number().valid(0, 1).optional()
});

// ─── Roles ────────────────────────────────────────────────────────────────────

exports.createRole = Joi.object({
  role_name:   Joi.string().max(100).required(),
  description: Joi.string().max(500).allow('', null).optional(),
  tenant_id:   id.required()
});

exports.updateRole = Joi.object({
  role_name:   Joi.string().max(100).required(),
  description: Joi.string().max(500).allow('', null).optional()
});

// ─── Permissions ──────────────────────────────────────────────────────────────

exports.updatePermissions = Joi.object({
  permissions: Joi.array().items(Joi.object()).required(),
  tenant_id:   id.optional()
});

// ─── RCM ──────────────────────────────────────────────────────────────────────

const rcmRow = Joi.object({
  control_id:            Joi.string().required(),
  process:               Joi.string().allow('', null).optional(),
  sub_process:           Joi.string().allow('', null).optional(),
  risk_id:               Joi.string().allow('', null).optional(),
  risk_description:      Joi.string().allow('', null).optional(),
  classification:        Joi.string().allow('', null).optional(),
  control_description:   Joi.string().allow('', null).optional(),
  summary:               Joi.string().allow('', null).optional(),
  frequency:             Joi.string().allow('', null).optional(),
  automated_manual:      Joi.string().allow('', null).optional(),
  'automated/manual':    Joi.string().allow('', null).optional(),
  preventive_detective:  Joi.string().allow('', null).optional(),
  'preventive/detective': Joi.string().allow('', null).optional(),
  significance:          Joi.string().allow('', null).optional(),
  risk_rating:           Joi.string().allow('', null).optional(),
  owners:                Joi.string().allow('', null).optional(),
  mitigates:             Joi.string().allow('', null).optional(),
  location:              Joi.string().allow('', null).optional(),
  key_reports:           Joi.string().allow('', null).optional(),
  it_systems:            Joi.string().allow('', null).optional()
}).options({ allowUnknown: true });

exports.saveRcm = Joi.object({
  client_id: numericId.required(),
  data:      Joi.array().items(rcmRow).min(1).required()
});

exports.updateRcm = Joi.object({
  control_id:            Joi.string().optional(),
  process:               Joi.string().allow('', null).optional(),
  sub_process:           Joi.string().allow('', null).optional(),
  risk_id:               Joi.string().allow('', null).optional(),
  risk_description:      Joi.string().allow('', null).optional(),
  classification:        Joi.string().allow('', null).optional(),
  control_description:   Joi.string().allow('', null).optional(),
  summary:               Joi.string().allow('', null).optional(),
  frequency:             Joi.string().allow('', null).optional(),
  automated_manual:      Joi.string().allow('', null).optional(),
  preventive_detective:  Joi.string().allow('', null).optional(),
  significance:          Joi.string().allow('', null).optional(),
  risk_rating:           Joi.string().allow('', null).optional(),
  owners:                Joi.string().allow('', null).optional(),
  mitigates:             Joi.string().allow('', null).optional(),
  location:              Joi.string().allow('', null).optional(),
  key_reports:           Joi.string().allow('', null).optional(),
  it_systems:            Joi.string().allow('', null).optional()
});

// ─── PBC / Evidence (multipart form — used inline in controller) ──────────────
// Exported as functions so controllers can call .validate() after multer runs.

exports.pbcCreate = Joi.object({
  control_id:      Joi.string().required(),
  evidence_name:   Joi.string().max(500).required(),
  testing_status:  Joi.string().max(100).required(),
  year:            numericId.optional(),
  quarter:         numericId.optional(),
  client_id:       numericId.required()
}).options({ allowUnknown: true }); // form-data can carry extra multer fields

exports.pbcUpdate = Joi.object({
  control_id:      Joi.string().optional(),
  evidence_name:   Joi.string().max(500).optional(),
  testing_status:  Joi.string().max(100).optional(),
  year:            numericId.optional(),
  quarter:         numericId.optional(),
  client_id:       numericId.optional()
}).options({ allowUnknown: true });

// ─── Attributes ───────────────────────────────────────────────────────────────

exports.saveAttributes = Joi.object({
  client_id: numericId.required(),
  data:      Joi.array().items(Joi.object()).min(1).required()
});

exports.updateAttribute = Joi.object({
  rcm_id:                id.optional(),
  attribute_name:        Joi.string().max(255).optional(),
  attribute_description: Joi.string().allow('', null).optional(),
  test_steps:            Joi.string().allow('', null).optional()
});

// ─── Test Executions ──────────────────────────────────────────────────────────

exports.createTestExecution = Joi.object({
  control_id: Joi.string().required(),
  year:       numericId.required(),
  quarter:    numericId.required(),
  client_id:  numericId.required()
});

exports.updateRemarks = Joi.object({
  test_execution_id: numericId.required(),
  remarks:           Joi.string().max(5000).allow('', null).optional()
});

exports.updateStatusResult = Joi.object({
  test_execution_id:          numericId.required(),
  status:                     Joi.string().valid('pending', 'in_progress', 'completed', 'failed').required(),
  result:                     Joi.string().valid('pass', 'fail', 'partial', 'na').required(),
  test_result_change_comment: Joi.string().max(1000).allow('', null).optional()
});

exports.updatePrompt = Joi.object({
  test_execution_id: numericId.required(),
  ai_prompt_text:    Joi.string().max(10000).allow('', null).optional()
});

exports.updateEvidenceResult = Joi.object({
  test_execution_id:    numericId.required(),
  evidence_document_id: numericId.required(),
  updated_result:       Joi.string().max(100).required()
});

exports.evaluateAllEvidences = Joi.object({
  test_execution_id: numericId.required(),
  rcm_id:            numericId.required(),
  client_id:         numericId.optional(),
  sample_name:       Joi.string().max(255).allow('', null).optional()
});

exports.compareAttributes = Joi.object({
  test_execution_id:    numericId.required(),
  evidence_document_id: numericId.required(),
  rcm_id:              numericId.required(),
  client_id:           numericId.optional(),
  sample_name:         Joi.string().max(255).allow('', null).optional()
});

exports.evidenceAiDetails = Joi.object({
  evidence_document_id: numericId.required(),
  evidence_url:         Joi.string().uri().max(2048).allow('', null).optional()
});

// ─── Common params ────────────────────────────────────────────────────────────

exports.idParam = Joi.object({ id: id.required() });
exports.roleIdParam = Joi.object({ roleId: id.required() });
