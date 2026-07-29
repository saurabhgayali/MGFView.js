/**
 * MGF Parser
 * 
 * Parses Mascot Generic Format (MGF) files into structured spectrum objects.
 * 
 * Features:
 * - Robust whitespace handling
 * - Generic metadata preservation (no hardcoded fields)
 * - Support for vendor-specific fields
 * - Comprehensive error handling
 * - Peak list parsing (m/z and intensity)
 */

class MGFParser {
  constructor() {
    this.spectra = [];
    this.metadata = {};
  }

  /**
   * Load MGF data from various sources
   * Auto-detects input type and normalizes to internal spectrum representation
   * 
   * @param {string|File|Blob|Object|Array} input - MGF content or pre-parsed data
   *   - string: URL (http/https/file), raw MGF content, or data URL
   *   - File/Blob: File object from input element or Blob
   *   - Object: Pre-parsed {spectra: [...], metadata: {...}} or single spectrum
   *   - Array: Array of pre-parsed spectrum objects
   * @returns {Promise<Object>} Parsed result with spectra and file metadata
   * @throws {Error} If input format is invalid or loading fails
   */
  async load(input) {
    // Handle strings - could be URL or raw content
    if (typeof input === 'string') {
      // Check if it's a URL
      if (this.isUrl(input)) {
        return await this.loadUrl(input);
      } else {
        // Treat as raw MGF string content
        return this.loadString(input);
      }
    }
    // Handle File/Blob objects
    else if (input instanceof Blob || input instanceof File) {
      return await this.loadBlob(input);
    }
    // Handle pre-parsed objects (array of spectra or object with spectra property)
    else if (Array.isArray(input) || (input && typeof input === 'object' && (input.spectra || (input.metadata && input.peaks)))) {
      return this.loadObject(input);
    }
    else {
      throw new Error('Invalid input: must be URL string, File, Blob, raw MGF string, or pre-parsed spectrum object');
    }
  }

  /**
   * Check if string is a URL
   * @param {string} str - String to check
   * @returns {boolean} True if string looks like a URL
   */
  isUrl(str) {
    try {
      // Check for common URL patterns
      return /^(https?:\/\/|file:\/\/|data:)/.test(str) || 
             /^\/[^/]/.test(str); // Relative path starting with /
    } catch {
      return false;
    }
  }

  /**
   * Load MGF file from URL or relative path
   * @param {string} url - URL or file path to MGF file
   * @returns {Promise<Object>} Parsed result with spectra and file metadata
   */
  async loadUrl(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const content = await response.text();
      const result = this.loadString(content);
      
      // Add URL metadata
      this.metadata.url = url;
      this.metadata.source = 'url';
      
      return result;
    } catch (error) {
      throw new Error(`Failed to load URL "${url}": ${error.message}`);
    }
  }

  /**
   * Load and parse MGF string content
   * @param {string} content - MGF file content as string
   * @returns {Object} Parsed result with spectra and file metadata
   */
  loadString(content) {
    const result = this.parse(content);
    this.metadata.source = 'string';
    return result;
  }

  /**
   * Load MGF file from Blob or File object
   * @param {Blob|File} blob - Blob or File object
   * @returns {Promise<Object>} Parsed result with spectra and file metadata
   */
  async loadBlob(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const content = event.target.result;
          const result = this.parse(content);
          
          // Add file metadata
          if (blob instanceof File) {
            this.metadata.filename = blob.name;
            this.metadata.filesize = blob.size;
            this.metadata.filetype = blob.type;
          } else {
            this.metadata.filesize = blob.size;
            this.metadata.filetype = blob.type;
          }
          
          this.metadata.source = 'file';
          this.metadata.loadedAt = new Date().toISOString();
          
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.onabort = () => {
        reject(new Error('File reading was aborted'));
      };
      
      reader.readAsText(blob);
    });
  }

  /**
   * Load pre-parsed spectrum data (object or array format)
   * Useful for loading previously exported JSON data
   * @param {Array|Object} data - Pre-parsed spectrum data
   * @returns {Object} Result with spectra and metadata
   */
  loadObject(data) {
    this.spectra = [];
    this.metadata = {};

    // Handle array of spectra
    if (Array.isArray(data)) {
      data.forEach((spectrum, index) => {
        if (spectrum && typeof spectrum === 'object') {
          // Ensure index is set
          spectrum.index = spectrum.index !== undefined ? spectrum.index : index;
          // Ensure metadata and peaks exist
          if (!spectrum.metadata) spectrum.metadata = {};
          if (!spectrum.peaks) spectrum.peaks = [];
          this.spectra.push(spectrum);
        }
      });
    }
    // Handle object with spectra property
    else if (data && Array.isArray(data.spectra)) {
      data.spectra.forEach((spectrum, index) => {
        if (spectrum && typeof spectrum === 'object') {
          spectrum.index = spectrum.index !== undefined ? spectrum.index : index;
          if (!spectrum.metadata) spectrum.metadata = {};
          if (!spectrum.peaks) spectrum.peaks = [];
          this.spectra.push(spectrum);
        }
      });
      // Copy metadata if provided
      if (data.metadata && typeof data.metadata === 'object') {
        this.metadata = { ...data.metadata };
      }
    }
    // Handle single spectrum object
    else if (data && typeof data === 'object' && data.metadata && data.peaks) {
      data.index = 0;
      this.spectra.push(data);
    }

    this.metadata.loadedAt = new Date().toISOString();
    this.metadata.source = 'object';

    return {
      spectra: this.spectra,
      metadata: this.metadata,
      count: this.spectra.length
    };
  }

  /**
   * Parse MGF text content (core parsing logic)
   * @param {string} content - MGF file content
   * @returns {Object} Parsed result with spectra and file metadata
   */
  parse(content) {
    if (typeof content !== 'string') {
      throw new Error('Content must be a string');
    }

    console.log('🔍 Parser.parse() called with content length:', content.length);
    
    this.spectra = [];
    this.metadata = {};

    // Normalize line endings
    const normalizedContent = content.replace(/\r\n/g, '\n');
    const lines = normalizedContent.split('\n');
    console.log('📋 Total lines:', lines.length);

    let currentSpectrum = null;
    let inSpectrum = false;
    let spectrumCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and comments
      if (!line || line.startsWith('#')) {
        continue;
      }

      // BEGIN IONS - start of spectrum block
      if (line === 'BEGIN IONS') {
        if (inSpectrum) {
          console.warn(`Warning: Nested BEGIN IONS at line ${i + 1}`);
        }
        console.log(`📂 BEGIN IONS found at line ${i + 1}`);
        inSpectrum = true;
        currentSpectrum = {
          index: spectrumCount,
          metadata: {},
          peaks: []
        };
        continue;
      }

      // END IONS - end of spectrum block
      if (line === 'END IONS') {
        if (!inSpectrum) {
          console.warn(`Warning: END IONS without BEGIN IONS at line ${i + 1}`);
        } else {
          // Validate spectrum has peaks
          if (currentSpectrum.peaks.length > 0 || Object.keys(currentSpectrum.metadata).length > 0) {
            console.log(`✅ Spectrum ${spectrumCount} complete: ${currentSpectrum.metadata.TITLE || 'Untitled'}, ${currentSpectrum.peaks.length} peaks`);
            this.spectra.push(currentSpectrum);
            spectrumCount++;
          } else {
            console.log('⚠️  Spectrum discarded (no peaks or metadata)');
          }
          inSpectrum = false;
          currentSpectrum = null;
        }
        continue;
      }

      // Process lines within spectrum
      if (inSpectrum && currentSpectrum) {
        // Try to parse as key=value metadata
        const eqIndex = line.indexOf('=');
        if (eqIndex > 0) {
          const key = line.substring(0, eqIndex).toUpperCase();
          const value = line.substring(eqIndex + 1);
          
          // Special handling for PEPMASS (can have charge info)
          if (key === 'PEPMASS') {
            currentSpectrum.metadata[key] = this.parsePepMass(value);
          } else {
            currentSpectrum.metadata[key] = value;
          }
        } else {
          // Try to parse as peak (m/z intensity)
          const peak = this.parsePeak(line);
          if (peak) {
            currentSpectrum.peaks.push(peak);
          }
        }
      }
    }

    // Handle unclosed spectrum block
    if (inSpectrum && currentSpectrum) {
      console.warn('Warning: File ended with unclosed BEGIN IONS block');
      if (currentSpectrum.peaks.length > 0 || Object.keys(currentSpectrum.metadata).length > 0) {
        console.log('✅ Adding unclosed spectrum at EOF');
        this.spectra.push(currentSpectrum);
      }
    }

    // Add metadata about parsing
    this.metadata.source = 'string';
    this.metadata.loadedAt = new Date().toISOString();

    console.log('✅ Parse complete. Total spectra:', this.spectra.length);
    console.log('📊 Spectra:', this.spectra);

    return {
      spectra: this.spectra,
      metadata: this.metadata,
      count: this.spectra.length
    };
  }

  /**
   * Parse a peak line (m/z intensity)
   * @param {string} line - Peak line
   * @returns {Object|null} Peak object with mz and intensity, or null if invalid
   */
  parsePeak(line) {
    // Handle various whitespace formats (space or tab)
    const parts = line.split(/\s+/);
    
    if (parts.length >= 2) {
      const mz = parseFloat(parts[0]);
      const intensity = parseFloat(parts[1]);
      
      if (!isNaN(mz) && !isNaN(intensity)) {
        return {
          mz: mz,
          intensity: intensity
        };
      }
    }

    return null;
  }

  /**
   * Parse PEPMASS field (format: mass or mass intensity)
   * @param {string} value - PEPMASS value
   * @returns {Object} Parsed PEPMASS with mass and optional intensity
   */
  parsePepMass(value) {
    const parts = value.trim().split(/\s+/);
    
    if (parts.length === 0) {
      return { mass: null, intensity: null };
    }

    const mass = parseFloat(parts[0]);
    const intensity = parts.length > 1 ? parseFloat(parts[1]) : null;

    return {
      mass: isNaN(mass) ? null : mass,
      intensity: isNaN(intensity) ? null : intensity
    };
  }

  /**
   * Get a specific spectrum by index
   * @param {number} index - Spectrum index
   * @returns {Object} Spectrum object
   */
  getSpectrum(index) {
    if (index < 0 || index >= this.spectra.length) {
      throw new Error(`Spectrum index ${index} out of range`);
    }
    return this.spectra[index];
  }

  /**
   * Get all spectra
   * @returns {Array} Array of spectrum objects
   */
  getSpectra() {
    return this.spectra;
  }

  /**
   * Get spectrum count
   * @returns {number} Number of spectra
   */
  getSpectrumCount() {
    return this.spectra.length;
  }

  /**
   * Filter spectra by metadata value
   * @param {string} key - Metadata key (will be converted to uppercase)
   * @param {*} value - Expected value
   * @returns {Array} Filtered spectra
   */
  filterByMetadata(key, value) {
    const upperKey = key.toUpperCase();
    return this.spectra.filter(spectrum => {
      const metadata = spectrum.metadata[upperKey];
      return metadata === value || 
             (typeof metadata === 'string' && metadata.includes(String(value)));
    });
  }

  /**
   * Search spectra by title substring
   * @param {string} query - Search query
   * @returns {Array} Matching spectra
   */
  searchByTitle(query) {
    const lowerQuery = query.toLowerCase();
    return this.spectra.filter(spectrum => {
      const title = spectrum.metadata.TITLE || '';
      return title.toLowerCase().includes(lowerQuery);
    });
  }

  /**
   * Sort spectra by precursor mass
   * @param {boolean} ascending - Sort direction (default: true)
   * @returns {Array} Sorted spectra (does not modify original)
   */
  sortByPrecursor(ascending = true) {
    return [...this.spectra].sort((a, b) => {
      const masA = this.getPrecursorMass(a);
      const massB = this.getPrecursorMass(b);
      
      if (masA === null || massB === null) {
        return masA === null ? 1 : -1;
      }
      
      return ascending ? masA - massB : massB - masA;
    });
  }

  /**
   * Get precursor mass from spectrum
   * @param {Object} spectrum - Spectrum object
   * @returns {number|null} Precursor mass or null
   */
  getPrecursorMass(spectrum) {
    const pepMass = spectrum.metadata.PEPMASS;
    
    if (!pepMass) {
      return null;
    }

    if (typeof pepMass === 'string') {
      // Try to parse as "mass intensity" format
      const match = pepMass.match(/^([\d.]+)/);
      return match ? parseFloat(match[1]) : null;
    }

    if (typeof pepMass === 'object' && pepMass.mass !== undefined) {
      return pepMass.mass;
    }

    return parseFloat(pepMass) || null;
  }

  /**
   * Get charge from spectrum
   * @param {Object} spectrum - Spectrum object
   * @returns {number|null} Charge state or null
   */
  getCharge(spectrum) {
    const charge = spectrum.metadata.CHARGE;
    
    if (!charge) {
      return null;
    }

    // CHARGE format can be "2+" or "2"
    const match = String(charge).match(/^(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Get retention time from spectrum
   * @param {Object} spectrum - Spectrum object
   * @returns {number|null} Retention time in seconds or null
   */
  getRetentionTime(spectrum) {
    const rt = spectrum.metadata.RTINSECONDS;
    return rt ? parseFloat(rt) : null;
  }

  /**
   * Calculate statistics for loaded spectra
   * @returns {Object} Statistics object
   */
  getStatistics() {
    if (this.spectra.length === 0) {
      return {
        spectraCount: 0,
        totalPeaks: 0,
        averagePeaksPerSpectrum: 0,
        averagePrecursorMass: null,
        chargeDistribution: {},
        retentionTimesPresent: false
      };
    }

    let totalPeaks = 0;
    let validPrecursors = [];
    let chargeDistribution = {};
    let retentionTimesPresent = false;

    this.spectra.forEach(spectrum => {
      totalPeaks += spectrum.peaks.length;

      // Charge distribution
      const charge = this.getCharge(spectrum);
      if (charge !== null) {
        chargeDistribution[charge] = (chargeDistribution[charge] || 0) + 1;
      }

      // Retention time presence
      if (this.getRetentionTime(spectrum) !== null) {
        retentionTimesPresent = true;
      }

      // Precursor mass
      const mass = this.getPrecursorMass(spectrum);
      if (mass !== null) {
        validPrecursors.push(mass);
      }
    });

    const averagePrecursorMass = validPrecursors.length > 0
      ? validPrecursors.reduce((a, b) => a + b) / validPrecursors.length
      : null;

    return {
      spectraCount: this.spectra.length,
      totalPeaks: totalPeaks,
      averagePeaksPerSpectrum: totalPeaks / this.spectra.length,
      averagePrecursorMass: averagePrecursorMass,
      chargeDistribution: chargeDistribution,
      retentionTimesPresent: retentionTimesPresent
    };
  }
}

// Export to global window object for browser
if (typeof window !== 'undefined') {
  window.MGFParser = MGFParser;
}
