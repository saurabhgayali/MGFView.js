/**
 * Utilities
 * 
 * Common utility functions for MGFView.js
 */

const MGFUtils = {
  /**
   * Escape HTML special characters
   * @param {string} text 
   * @returns {string}
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  },

  /**
   * Format number with fixed decimal places
   * @param {number} num 
   * @param {number} decimals - Default: 2
   * @returns {string}
   */
  formatNumber(num, decimals = 2) {
    if (typeof num !== 'number' || isNaN(num)) {
      return '';
    }
    return num.toFixed(decimals);
  },

  /**
   * Format large numbers with commas
   * @param {number} num 
   * @returns {string}
   */
  formatLargeNumber(num) {
    if (typeof num !== 'number') return '';
    return num.toLocaleString();
  },

  /**
   * Format m/z value
   * @param {number} mz 
   * @param {number} decimals - Default: 4
   * @returns {string}
   */
  formatMz(mz, decimals = 4) {
    return this.formatNumber(mz, decimals);
  },

  /**
   * Format intensity value
   * @param {number} intensity 
   * @param {number} decimals - Default: 2
   * @returns {string}
   */
  formatIntensity(intensity, decimals = 2) {
    return this.formatNumber(intensity, decimals);
  },

  /**
   * Format retention time
   * @param {number} rtSeconds 
   * @returns {string} Formatted as MM:SS
   */
  formatRetentionTime(rtSeconds) {
    if (typeof rtSeconds !== 'number') return '';
    
    const minutes = Math.floor(rtSeconds / 60);
    const seconds = Math.floor(rtSeconds % 60);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  },

  /**
   * Validate m/z value
   * @param {number} mz 
   * @returns {boolean}
   */
  isValidMz(mz) {
    return typeof mz === 'number' && !isNaN(mz) && mz > 0;
  },

  /**
   * Validate intensity value
   * @param {number} intensity 
   * @returns {boolean}
   */
  isValidIntensity(intensity) {
    return typeof intensity === 'number' && !isNaN(intensity) && intensity >= 0;
  },

  /**
   * Validate peak object
   * @param {Object} peak 
   * @returns {boolean}
   */
  isValidPeak(peak) {
    return peak && 
           typeof peak === 'object' &&
           this.isValidMz(peak.mz) &&
           this.isValidIntensity(peak.intensity);
  },

  /**
   * Check if file is likely MGF format
   * @param {File} file 
   * @returns {boolean}
   */
  isMgfFile(file) {
    if (!file || !file.name) return false;
    
    const ext = file.name.toLowerCase().split('.').pop();
    const type = file.type || '';
    
    return ext === 'mgf' || 
           ext === 'txt' ||
           type.includes('text') ||
           file.name.includes('.mgf');
  },

  /**
   * Parse query string
   * @param {string} str 
   * @returns {Object}
   */
  parseQueryString(str) {
    const params = {};
    const parts = str.split('&');
    
    parts.forEach(part => {
      const [key, value] = part.split('=');
      if (key) {
        params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
      }
    });
    
    return params;
  },

  /**
   * Generate download link
   * @param {string} filename 
   * @param {string} content 
   * @param {string} mimeType - Default: 'text/plain'
   */
  downloadFile(filename, content, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Copy text to clipboard
   * @param {string} text 
   * @returns {Promise<boolean>}
   */
  async copyToClipboard(text) {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
      }
    } catch (error) {
      console.error('Copy to clipboard failed:', error);
      return false;
    }
  },

  /**
   * Read file as text
   * @param {File} file 
   * @returns {Promise<string>}
   */
  async readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  },

  /**
   * Parse CSV string
   * @param {string} csv 
   * @returns {Array} Array of arrays
   */
  parseCSV(csv) {
    const lines = csv.split('\n');
    const result = [];
    
    lines.forEach(line => {
      const row = [];
      let inQuotes = false;
      let current = '';
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      
      if (current) row.push(current);
      if (row.length > 0) result.push(row);
    });
    
    return result;
  },

  /**
   * Convert array of arrays to CSV
   * @param {Array} data 
   * @returns {string} CSV string
   */
  toCSV(data) {
    return data.map(row => 
      row.map(cell => {
        if (typeof cell === 'string' && cell.includes(',')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    ).join('\n');
  },

  /**
   * Deep clone object
   * @param {Object} obj 
   * @returns {Object}
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Array) {
      return obj.map(item => this.deepClone(item));
    }
    
    if (obj instanceof Object) {
      const cloned = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          cloned[key] = this.deepClone(obj[key]);
        }
      }
      return cloned;
    }
  },

  /**
   * Debounce function
   * @param {Function} func 
   * @param {number} wait - Milliseconds
   * @returns {Function}
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Throttle function
   * @param {Function} func 
   * @param {number} limit - Milliseconds
   * @returns {Function}
   */
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * Get browser information
   * @returns {Object}
   */
  getBrowserInfo() {
    const ua = navigator.userAgent;
    
    let browser = 'Unknown';
    let version = 'Unknown';
    
    if (ua.includes('Chrome')) {
      browser = 'Chrome';
      version = ua.split('Chrome/')[1]?.split(' ')[0];
    } else if (ua.includes('Safari')) {
      browser = 'Safari';
      version = ua.split('Version/')[1]?.split(' ')[0];
    } else if (ua.includes('Firefox')) {
      browser = 'Firefox';
      version = ua.split('Firefox/')[1];
    } else if (ua.includes('Edge')) {
      browser = 'Edge';
      version = ua.split('Edge/')[1];
    }
    
    return {
      browser,
      version,
      userAgent: ua
    };
  },

  /**
   * Check if value exists in array
   * @param {Array} arr 
   * @param {*} value 
   * @returns {boolean}
   */
  arrayIncludes(arr, value) {
    return arr && Array.isArray(arr) && arr.includes(value);
  },

  /**
   * Get unique values from array
   * @param {Array} arr 
   * @returns {Array}
   */
  getUnique(arr) {
    return [...new Set(arr)];
  },

  /**
   * Sort array by key
   * @param {Array} arr 
   * @param {string} key 
   * @param {boolean} ascending - Default: true
   * @returns {Array}
   */
  sortByKey(arr, key, ascending = true) {
    return [...arr].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      
      if (ascending) {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  }
};

// Export to global window object for browser
if (typeof window !== 'undefined') {
  window.MGFUtils = MGFUtils;
}
