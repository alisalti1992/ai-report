const validateApiToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'Access denied. No token provided.',
      message: 'Please provide a valid API token in the Authorization header as "Bearer <token>"'
    });
  }

  if (token !== process.env.API_TOKEN) {
    return res.status(403).json({ 
      error: 'Invalid token.',
      message: 'The provided API token is not valid'
    });
  }

  next();
};

module.exports = {
  validateApiToken
};