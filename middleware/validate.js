/**
 * Joi validation middleware factory.
 * source: 'body' | 'query' | 'params'
 * Strips unknown keys from body; allows unknown keys in query/params.
 */
const validate = (schema, source = 'body') => (req, res, next) => {
  const opts = {
    abortEarly: false,
    convert: true,
    stripUnknown: source === 'body'
  };

  const { error, value } = schema.validate(req[source], opts);

  if (error) {
    return res.status(400).json({
      message: 'Validation error.',
      details: error.details.map(d => d.message)
    });
  }

  req[source] = value;
  next();
};

module.exports = validate;
