/**
 * Send standard success JSON response
 */
export const sendSuccess = (res, {
  status = 200,
  message = 'Request completed successfully',
  data = null,
  pagination = null
}) => {
  const responsePayload = {
    success: true,
    status,
    message,
    data,
    meta: {
      requestId: res?.req?.id || 'N/A',
      timestamp: new Date()
    }
  };

  if (pagination) {
    responsePayload.pagination = {
      page: parseInt(pagination.page),
      limit: parseInt(pagination.limit),
      total: parseInt(pagination.total),
      totalPages: parseInt(pagination.totalPages)
    };
  }

  return res.status(status).json(responsePayload);
};

/**
 * Send standard error JSON response
 */
export const sendError = (res, {
  status = 500,
  message = 'Internal server error occurred',
  errors = null
}) => {
  const responsePayload = {
    success: false,
    status,
    message,
    meta: {
      requestId: res?.req?.id || 'N/A',
      timestamp: new Date()
    }
  };

  if (errors) {
    responsePayload.errors = errors;
  }

  return res.status(status).json(responsePayload);
};
