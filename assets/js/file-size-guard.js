/**
 * Plotox File Size Guard — Central file size validation utility.
 * Enforces a strict 1 MB maximum across all data entry points.
 * Must be loaded before app.js and data-cleaner.js.
 */
const FileSizeGuard = (() => {
  const MAX_SIZE = 1048576; // 1 MB in bytes
  const MAX_SIZE_LABEL = '1 MB';

  /**
   * Format a byte count into a human-readable string.
   * @param {number} bytes
   * @returns {string} e.g. "245.3 KB", "1.2 MB"
   */
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }

  /**
   * Build a user-friendly error message for oversized files.
   * @param {string} name - filename or label
   * @param {number} size - actual size in bytes
   * @returns {string}
   */
  function buildErrorMessage(name, size) {
    return `"${name}" is ${formatSize(size)}, which exceeds the maximum supported size of ${MAX_SIZE_LABEL}. Please reduce the file size and try again.`;
  }

  /**
   * Validate a File object against the size limit.
   * @param {File} file
   * @returns {{ valid: boolean, fileSize: number, fileSizeLabel: string, title: string|null, errorMessage: string|null }}
   */
  function validateFile(file) {
    if (!file) {
      return { valid: false, fileSize: 0, fileSizeLabel: '0 B', title: 'Error', errorMessage: 'No file provided.' };
    }
    const size = file.size;
    const label = formatSize(size);
    if (size > MAX_SIZE) {
      return {
        valid: false,
        fileSize: size,
        fileSizeLabel: label,
        title: 'File is too large',
        errorMessage: 'The file exceeds 1 MB. Please import a smaller dataset.'
      };
    }
    return { valid: true, fileSize: size, fileSizeLabel: label, title: null, errorMessage: null };
  }

  /**
   * Validate a text string against the size limit (uses Blob for accurate byte count).
   * @param {string} text
   * @param {string} [name] - optional label for the error message
   * @returns {{ valid: boolean, fileSize: number, fileSizeLabel: string, title: string|null, errorMessage: string|null }}
   */
  function validateText(text, name) {
    if (!text) {
      return { valid: true, fileSize: 0, fileSizeLabel: '0 B', title: null, errorMessage: null };
    }
    const size = new Blob([text]).size;
    const label = formatSize(size);
    if (size > MAX_SIZE) {
      return {
        valid: false,
        fileSize: size,
        fileSizeLabel: label,
        title: 'File is too large',
        errorMessage: 'The file exceeds 1 MB. Please import a smaller dataset.'
      };
    }
    return { valid: true, fileSize: size, fileSizeLabel: label, title: null, errorMessage: null };
  }

  return Object.freeze({
    MAX_SIZE,
    MAX_SIZE_LABEL,
    formatSize,
    validateFile,
    validateText
  });
})();

// Make globally available
window.FileSizeGuard = FileSizeGuard;
