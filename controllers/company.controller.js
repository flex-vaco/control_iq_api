const Client = require('../models/client.model');

// GET all clients for the logged-in user's tenant
exports.getAllClients = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const data = await Client.findAllByTenant(tenantId);
    res.json(data);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// GET a single client by ID
exports.getClientById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const client = await Client.findById(id, tenantId);
    
    if (!client) {
      return res.status(404).json({ message: 'Client not found.' });
    }
    
    res.json(client);
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// POST to create a new client
exports.createClient = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    const { client_name, industry, region, contact_name, contact_email, contact_phone, status } = req.body;

    // Validate required fields
    if (!client_name) {
      return res.status(400).json({ message: 'Client name is required.' });
    }

    const clientId = await Client.create(
      { client_name, industry, region, contact_name, contact_email, contact_phone, status },
      tenantId,
      userId
    );

    res.status(201).json({ 
      message: 'Client created successfully.',
      client_id: clientId 
    });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ message: 'Server error during client creation.' });
  }
};

// PUT to update a client
exports.updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    const { client_name, industry, region, contact_name, contact_email, contact_phone, status } = req.body;

    // Validate required fields
    if (!client_name) {
      return res.status(400).json({ message: 'Client name is required.' });
    }

    const updated = await Client.update(
      id,
      { client_name, industry, region, contact_name, contact_email, contact_phone, status },
      tenantId,
      userId
    );

    if (!updated) {
      return res.status(404).json({ message: 'Client not found or you do not have permission to update it.' });
    }

    res.json({ message: 'Client updated successfully.' });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ message: 'Server error during client update.' });
  }
};

// DELETE to soft delete a client
exports.deleteClient = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;

    const deleted = await Client.delete(id, tenantId, userId);

    if (!deleted) {
      return res.status(404).json({ message: 'Client not found or you do not have permission to delete it.' });
    }

    res.json({ message: 'Client deleted successfully.' });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ message: 'Server error during client deletion.' });
  }
};

// GET all clients for dropdown (public endpoint, no tenant filtering needed for selection)
exports.getAllClientsForDropdown = async (req, res) => {
  try {
    const data = await Client.findAll();
    res.json(data);
  } catch (error) {
    console.error('Error fetching clients for dropdown:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

