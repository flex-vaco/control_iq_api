const logger = require('./utils/logger');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');

const PORT = process.env.SERVER_PORT || 5000;

app.listen(PORT, () => {
  logger.info(`Server is running on http://localhost:${PORT}`);
});
