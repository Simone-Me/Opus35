function Pagination({ currentPage, totalPages, onPageChange }) {
  return (
    <nav className="pagination-row" aria-label="Pagination">
      <button
        className="btn btn-small"
        type="button"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
      >
        Prev
      </button>
      <span className="text-muted">
        Page {currentPage} / {totalPages}
      </span>
      <button
        className="btn btn-small"
        type="button"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
      >
        Next
      </button>
    </nav>
  );
}

export default Pagination;
