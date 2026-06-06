/**
 * DashboardDB — IndexedDB storage layer for Plotox Auto-Generated Dashboard.
 * Handles CRUD operations, auto-save, and import/export for dashboards.
 */
class DashboardDB {
  static DB_NAME = 'plotox-dashboards';
  static DB_VERSION = 1;
  static STORE_NAME = 'dashboards';
  static DATA_STORE = 'datasets';

  static _db = null;
  static _autoSaveTimers = {};

  /**
   * Open (or create) the IndexedDB database.
   * @returns {Promise<IDBDatabase>}
   */
  static async open() {
    if (this._db) return this._db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('name', 'name', { unique: false });
        }
        if (!db.objectStoreNames.contains(this.DATA_STORE)) {
          db.createObjectStore(this.DATA_STORE, { keyPath: 'id' });
        }
      };

      request.onsuccess = (e) => {
        this._db = e.target.result;
        resolve(this._db);
      };

      request.onerror = (e) => {
        console.error('DashboardDB: Failed to open database', e.target.error);
        reject(e.target.error);
      };
    });
  }

  /**
   * Generate a unique dashboard ID.
   */
  static generateId() {
    return 'db-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Create a new empty dashboard.
   * @param {string} name
   * @returns {Promise<Object>} The created dashboard object.
   */
  static async createDashboard(name = 'Untitled Dashboard') {
    const db = await this.open();
    const dashboard = {
      id: this.generateId(),
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      widgets: [],
      dataset: null,
      analysis: null
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.add(dashboard);
      request.onsuccess = () => resolve(dashboard);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Save/update a dashboard.
   * @param {Object} dashboard
   * @returns {Promise<void>}
   */
  static async saveDashboard(dashboard) {
    const db = await this.open();
    dashboard.updatedAt = new Date().toISOString();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.put(dashboard);
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Get a single dashboard by ID.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  static async getDashboard(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * List all dashboards, sorted by updatedAt desc.
   * @returns {Promise<Array>}
   */
  static async listDashboards() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result || [];
        results.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        resolve(results);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Delete a dashboard by ID.
   * @param {string} id
   * @returns {Promise<void>}
   */
  static async deleteDashboard(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Duplicate a dashboard.
   * @param {string} id
   * @returns {Promise<Object>} The new dashboard.
   */
  static async duplicateDashboard(id) {
    const original = await this.getDashboard(id);
    if (!original) throw new Error('Dashboard not found');

    const copy = JSON.parse(JSON.stringify(original));
    copy.id = this.generateId();
    copy.name = original.name + ' (Copy)';
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = new Date().toISOString();

    // Regenerate widget IDs
    copy.widgets = copy.widgets.map(w => ({
      ...w,
      id: 'w-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6)
    }));

    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.add(copy);
      request.onsuccess = () => resolve(copy);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Export a dashboard as a JSON string.
   * @param {string} id
   * @returns {Promise<string>}
   */
  static async exportDashboard(id) {
    const dashboard = await this.getDashboard(id);
    if (!dashboard) throw new Error('Dashboard not found');
    return JSON.stringify(dashboard, null, 2);
  }

  /**
   * Import a dashboard from JSON string.
   * @param {string} jsonStr
   * @returns {Promise<Object>}
   */
  static async importDashboard(jsonStr) {
    const dashboard = JSON.parse(jsonStr);
    dashboard.id = this.generateId();
    dashboard.createdAt = new Date().toISOString();
    dashboard.updatedAt = new Date().toISOString();

    // Regenerate widget IDs to avoid collisions
    if (dashboard.widgets) {
      dashboard.widgets = dashboard.widgets.map(w => ({
        ...w,
        id: 'w-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6)
      }));
    }

    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.add(dashboard);
      request.onsuccess = () => resolve(dashboard);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Auto-save a dashboard with debounce.
   * @param {Object} dashboard
   * @param {number} delay - Debounce delay in ms (default 2000).
   */
  static autoSave(dashboard, delay = 2000) {
    if (this._autoSaveTimers[dashboard.id]) {
      clearTimeout(this._autoSaveTimers[dashboard.id]);
    }
    this._autoSaveTimers[dashboard.id] = setTimeout(async () => {
      try {
        await this.saveDashboard(dashboard);
        window.dispatchEvent(new CustomEvent('dashboardAutoSaved', {
          detail: { id: dashboard.id }
        }));
      } catch (e) {
        console.error('DashboardDB: Auto-save failed', e);
      }
    }, delay);
  }

  /**
   * Save a large dataset separately.
   * @param {string} id
   * @param {Object} data - { headers, rows, types }
   * @returns {Promise<void>}
   */
  static async saveDataset(id, data) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.DATA_STORE, 'readwrite');
      const store = tx.objectStore(this.DATA_STORE);
      const request = store.put({ id, ...data, savedAt: new Date().toISOString() });
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Get a dataset by ID.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  static async getDataset(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.DATA_STORE, 'readonly');
      const store = tx.objectStore(this.DATA_STORE);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Clear all dashboards (danger).
   * @returns {Promise<void>}
   */
  static async clearAll() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.STORE_NAME, this.DATA_STORE], 'readwrite');
      tx.objectStore(this.STORE_NAME).clear();
      tx.objectStore(this.DATA_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }
}

window.DashboardDB = DashboardDB;
