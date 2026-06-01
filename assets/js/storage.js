class StorageManager {
  /**
   * Save the active dashboard session to sessionStorage.
   * @param {string} filename - The name of the active dataset file.
   * @param {string} rawText - The raw CSV/TSV data string.
   * @param {Object} config - The active chart configuration object.
   */
  static saveActiveSession(filename, rawText, config) {
    try {
      sessionStorage.setItem('plotiq-session-filename', filename);
      sessionStorage.setItem('plotiq-session-text', rawText);
      sessionStorage.setItem('plotiq-session-config', JSON.stringify(config));

      // Fallback
      sessionStorage.setItem('plotox-session-filename', filename);
      sessionStorage.setItem('plotox-session-text', rawText);
      sessionStorage.setItem('plotox-session-config', JSON.stringify(config));
    } catch (e) {
      console.warn("StorageManager: Could not save active session (quota exceeded or cookies blocked).", e);
    }
  }

  /**
   * Load the active session from sessionStorage.
   * @returns {Object|null} - The saved session object or null if none exists.
   */
  static getActiveSession() {
    try {
      let filename = sessionStorage.getItem('plotiq-session-filename') || sessionStorage.getItem('plotox-session-filename');
      let rawText = sessionStorage.getItem('plotiq-session-text') || sessionStorage.getItem('plotox-session-text');
      let configStr = sessionStorage.getItem('plotiq-session-config') || sessionStorage.getItem('plotox-session-config');

      if (filename && rawText && configStr) {
        return {
          filename,
          rawText,
          config: JSON.parse(configStr)
        };
      }
    } catch (e) {
      console.error("StorageManager: Failed to parse loaded session.", e);
    }
    return null;
  }

  /**
   * Clear the active session details from sessionStorage.
   */
  static clearActiveSession() {
    try {
      sessionStorage.removeItem('plotiq-session-filename');
      sessionStorage.removeItem('plotiq-session-text');
      sessionStorage.removeItem('plotiq-session-config');

      sessionStorage.removeItem('plotox-session-filename');
      sessionStorage.removeItem('plotox-session-text');
      sessionStorage.removeItem('plotox-session-config');
    } catch (e) {
      console.error("StorageManager: Failed to clear session.", e);
    }
  }
}

class HistoryStorage {
  /**
   * Get the list of history entries from localStorage.
   * @returns {Array} - The array of historical sessions.
   */
  static getHistory() {
    try {
      const historyStr = localStorage.getItem('plotox-history');
      return historyStr ? JSON.parse(historyStr) : [];
    } catch (e) {
      console.error("HistoryStorage: Failed to retrieve history.", e);
      return [];
    }
  }

  /**
   * Save the entire history list to localStorage.
   * @param {Array} history - The array of history entries.
   */
  static saveHistory(history) {
    try {
      localStorage.setItem('plotox-history', JSON.stringify(history));
    } catch (e) {
      console.warn("HistoryStorage: Failed to save history.", e);
    }
  }

  /**
   * Add a new entry to history (limit to some number or keep growing).
   * @param {string} filename
   * @param {string} chartType
   * @param {Object} config
   * @param {string} rawText
   * @returns {Object} - The created entry.
   */
  static addEntry(filename, chartType, config, rawText) {
    try {
      const history = this.getHistory();
      const entry = {
        id: 'hist-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        filename,
        date: new Date().toISOString(),
        chartType,
        config: JSON.parse(JSON.stringify(config)), // Deep clone
        rawText
      };

      history.unshift(entry);

      // Limit history size to 25 to avoid browser storage limit
      if (history.length > 25) {
        history.pop();
      }

      this.saveHistory(history);
      return entry;
    } catch (e) {
      console.error("HistoryStorage: Failed to add entry.", e);
      return null;
    }
  }

  /**
   * Clear all history.
   */
  static clearHistory() {
    try {
      localStorage.removeItem('plotox-history');
    } catch (e) {
      console.error("HistoryStorage: Failed to clear history.", e);
    }
  }
}

// Make globally available
window.StorageManager = StorageManager;
window.HistoryStorage = HistoryStorage;

// Make globally available
window.StorageManager = StorageManager;
window.HistoryStorage = HistoryStorage;
