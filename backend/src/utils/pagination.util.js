/**
 * Parse standard request query parameters into pagination parameters for Prisma
 */
export const getPaginationParams = (query) => {
  const page = Math.max(1, parseInt(query.page || '1'));
  const limit = Math.max(1, Math.min(1000, parseInt(query.limit || '10')));
  const skip = (page - 1) * limit;

  // Sorting
  const sortBy = query.sort || 'createdAt';
  const order = query.order?.toLowerCase() === 'asc' ? 'asc' : 'desc';

  return {
    page,
    limit,
    skip,
    orderBy: {
      [sortBy]: order
    }
  };
};

/**
 * Construct metadata output structure for standard JSON response pagination block
 */
export const getPaginationMetadata = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages
  };
};
