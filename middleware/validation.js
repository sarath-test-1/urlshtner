const { validationResult } = require("express-validator");

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = {};

    errors.array().forEach((err) => {
      if (!formattedErrors[err.path]) {
        formattedErrors[err.path] = [];
      }
      formattedErrors[err.path].push(err.msg);
    });

    return res.status(422).json({
      success: false,
      message: "The given data was invalid.",
      errors: formattedErrors,
    });
  }

  next();
};

module.exports = handleValidationErrors;
