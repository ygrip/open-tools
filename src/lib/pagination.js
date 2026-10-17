/** @param {number} value @param {string} name @param {number} minimum */
function integer(value, name, minimum) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${name} must be a safe integer of at least ${minimum}`);
  }
}

/**
 * A bounded page window; catalogue size never controls the number of buttons.
 * @param {number} totalItems
 * @param {number} pageSize
 * @param {number} currentPage
 */
export function getPagination(totalItems, pageSize, currentPage) {
  integer(totalItems, 'totalItems', 0);
  integer(pageSize, 'pageSize', 1);
  integer(currentPage, 'currentPage', Number.MIN_SAFE_INTEGER);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(totalPages, Math.max(1, currentPage));
  const offset = (page - 1) * pageSize;
  /** @type {Array<number | 'ellipsis'>} */
  const pages = [];

  if (totalPages <= 7) {
    for (let number = 1; number <= totalPages; number++) pages.push(number);
  } else {
    const first = Math.max(2, Math.min(page - 1, totalPages - 3));
    const last = Math.min(totalPages - 1, Math.max(page + 1, 4));
    pages.push(1);
    if (first === 3) pages.push(2);
    else if (first > 3) pages.push('ellipsis');
    for (let number = first; number <= last; number++) pages.push(number);
    if (last === totalPages - 2) pages.push(totalPages - 1);
    else if (last < totalPages - 2) pages.push('ellipsis');
    pages.push(totalPages);
  }

  return {
    page,
    totalPages,
    offset,
    start: totalItems === 0 ? 0 : offset + 1,
    end: Math.min(totalItems, offset + pageSize),
    pages,
    hasPrevious: page > 1,
    hasNext: page < totalPages
  };
}
