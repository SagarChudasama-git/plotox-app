/**
 * NumberFormatter — Centralized global number formatting utility for Plotox.
 * Supports International (K, M, B, T) and Indian (K, L, Cr) formatting systems.
 */
class NumberFormatter {
  static getSystem() {
    return localStorage.getItem('plotox-number-system') || 'international';
  }

  static setSystem(system) {
    localStorage.setItem('plotox-number-system', system);
    window.dispatchEvent(new CustomEvent('numberSystemChanged', { detail: { system } }));
  }

  static format(value, type) {
    if (value === null || value === undefined || value === '') return '';
    
    let num = Number(value);
    if (isNaN(num)) {
      const cleaned = String(value).replace(/[\$,%\s]/g, '');
      const parsed = Number(cleaned);
      if (!isNaN(parsed) && cleaned !== '') {
        num = parsed;
      } else {
        return value;
      }
    }

    if (type === 'growth') {
      return (num >= 0 ? '+' : '') + num.toFixed(1) + '%';
    }

    const system = this.getSystem();
    const absVal = Math.abs(num);

    if (system === 'full') {
      return this.formatFull(num);
    }

    if (system === 'indian') {
      // Indian numbering system: Thousands (K), Lakhs (L), Crores (Cr)
      if (absVal >= 10000000) {
        return (num / 10000000).toFixed(1).replace(/\.0$/, '') + ' Cr';
      }
      if (absVal >= 100000) {
        return (num / 100000).toFixed(1).replace(/\.0$/, '') + ' L';
      }
      if (absVal >= 1000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, '') + ' K';
      }
    } else {
      // International numbering system: K, M, B, T
      if (absVal >= 1e12) {
        return (num / 1e12).toFixed(1).replace(/\.0$/, '') + 'T';
      }
      if (absVal >= 1e9) {
        return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
      }
      if (absVal >= 1e6) {
        return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
      }
      if (absVal >= 1e3) {
        return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
      }
    }

    // Default formatting for small values and floats
    if (Number.isInteger(num)) {
      return num.toLocaleString();
    }
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  static formatFull(value) {
    if (value === null || value === undefined || value === '') return '';
    let num = Number(value);
    if (isNaN(num)) {
      const cleaned = String(value).replace(/[\$,%\s]/g, '');
      const parsed = Number(cleaned);
      if (!isNaN(parsed) && cleaned !== '') {
        num = parsed;
      } else {
        return value;
      }
    }
    if (Number.isInteger(num)) {
      return num.toLocaleString();
    }
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

window.NumberFormatter = NumberFormatter;
