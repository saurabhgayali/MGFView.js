/**
 * ===============================================================
 * MGFView.js v0.1.0 - Single-file Distribution
 * ===============================================================
 * 
 * Complete client-side JavaScript library for viewing and
 * analyzing Mascot Generic Format (MGF) mass spectrometry files
 * 
 * Author: Saurabh Gayali
 * License: MIT
 * Repository: https://github.com/saurabhgayali/MGFView.js
 * 
 * Features:
 * - Zero dependencies - works completely offline
 * - 100% client-side processing
 * - Interactive spectrum viewer with zoom/pan
 * - Advanced search & filter capabilities
 * - Multiple export formats (JSON, CSV, MGF, PNG, SVG)
 * - Extensible plugin architecture
 * - State-driven reactive architecture
 * 
 * Usage:
 *   <link rel="stylesheet" href="css/mgfview.css">
 *   <script src="dist/browser/mgfview.js"></script>
 *   
 *   const viewer = new MGFViewer('#container');
 *   await viewer.load('file.mgf');
 * 
 * ===============================================================
 */

(function(window) {

// ========== src/core/parser.js ==========
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

// CommonJS export for Node.js


// ========== src/core/spectrum.js ==========
/**
 * Spectrum
 * 
 * Represents a single mass spectrometry spectrum with metadata and peaks.
 * Provides convenient methods for accessing and manipulating spectrum data.
 */

class Spectrum {
  /**
   * Create a new Spectrum
   * @param {Object} data - Spectrum data
   * @param {number} data.index - Spectrum index in collection
   * @param {Object} data.metadata - Key-value metadata
   * @param {Array} data.peaks - Array of {mz, intensity} objects
   */
  constructor(data = {}) {
    this.index = data.index || 0;
    this.metadata = data.metadata || {};
    this.peaks = data.peaks || [];
  }

  /**
   * Get spectrum title
   * @returns {string|null}
   */
  getTitle() {
    return this.metadata.TITLE || null;
  }

  /**
   * Get precursor mass (from PEPMASS)
   * @returns {number|null}
   */
  getPrecursorMass() {
    const pepMass = this.metadata.PEPMASS;
    
    if (!pepMass) return null;

    if (typeof pepMass === 'string') {
      const match = pepMass.match(/^([\d.]+)/);
      return match ? parseFloat(match[1]) : null;
    }

    if (typeof pepMass === 'object' && pepMass.mass !== undefined) {
      return pepMass.mass;
    }

    return parseFloat(pepMass) || null;
  }

  /**
   * Get precursor intensity (from PEPMASS)
   * @returns {number|null}
   */
  getPrecursorIntensity() {
    const pepMass = this.metadata.PEPMASS;
    
    if (!pepMass) return null;

    if (typeof pepMass === 'object' && pepMass.intensity !== undefined) {
      return pepMass.intensity;
    }

    if (typeof pepMass === 'string') {
      const parts = pepMass.trim().split(/\s+/);
      return parts.length > 1 ? parseFloat(parts[1]) : null;
    }

    return null;
  }

  /**
   * Get charge state
   * @returns {number|null}
   */
  getCharge() {
    const charge = this.metadata.CHARGE;
    
    if (!charge) return null;

    const match = String(charge).match(/^(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Get retention time in seconds
   * @returns {number|null}
   */
  getRetentionTime() {
    const rt = this.metadata.RTINSECONDS;
    return rt ? parseFloat(rt) : null;
  }

  /**
   * Get scan number
   * @returns {number|null}
   */
  getScanNumber() {
    const scans = this.metadata.SCANS;
    return scans ? parseInt(scans) : null;
  }

  /**
   * Get all metadata fields
   * @returns {Object}
   */
  getMetadata() {
    return { ...this.metadata };
  }

  /**
   * Get metadata field
   * @param {string} key - Field name (case-insensitive)
   * @returns {*}
   */
  getMetadataField(key) {
    const upperKey = key.toUpperCase();
    return this.metadata[upperKey];
  }

  /**
   * Get all peaks
   * @returns {Array}
   */
  getPeaks() {
    return [...this.peaks];
  }

  /**
   * Get peak count
   * @returns {number}
   */
  getPeakCount() {
    return this.peaks.length;
  }

  /**
   * Get peak at index
   * @param {number} index 
   * @returns {Object|null}
   */
  getPeakAt(index) {
    return this.peaks[index] || null;
  }

  /**
   * Get peaks in m/z range
   * @param {number} minMz 
   * @param {number} maxMz 
   * @returns {Array}
   */
  getPeaksInRange(minMz, maxMz) {
    return this.peaks.filter(peak => peak.mz >= minMz && peak.mz <= maxMz);
  }

  /**
   * Get peak with highest intensity
   * @returns {Object|null}
   */
  getBasePeak() {
    if (this.peaks.length === 0) return null;
    return this.peaks.reduce((max, peak) => 
      peak.intensity > max.intensity ? peak : max
    );
  }

  /**
   * Get total ion current (sum of all intensities)
   * @returns {number}
   */
  getTotalIonCurrent() {
    return this.peaks.reduce((sum, peak) => sum + peak.intensity, 0);
  }

  /**
   * Sort peaks by m/z
   * @param {boolean} ascending - Default: true
   * @returns {Array} Sorted peaks
   */
  sortPeaksByMz(ascending = true) {
    const sorted = [...this.peaks].sort((a, b) => 
      ascending ? a.mz - b.mz : b.mz - a.mz
    );
    return sorted;
  }

  /**
   * Sort peaks by intensity
   * @param {boolean} ascending - Default: false
   * @returns {Array} Sorted peaks
   */
  sortPeaksByIntensity(ascending = false) {
    const sorted = [...this.peaks].sort((a, b) => 
      ascending ? a.intensity - b.intensity : b.intensity - a.intensity
    );
    return sorted;
  }

  /**
   * Filter peaks by intensity threshold
   * @param {number} minIntensity 
   * @returns {Array}
   */
  filterPeaksByIntensity(minIntensity) {
    return this.peaks.filter(peak => peak.intensity >= minIntensity);
  }

  /**
   * Normalize peak intensities to 0-100
   * @returns {Array} Normalized peaks
   */
  getNormalizedPeaks() {
    const tic = this.getTotalIonCurrent();
    if (tic === 0) return this.peaks;

    return this.peaks.map(peak => ({
      mz: peak.mz,
      intensity: (peak.intensity / tic) * 100
    }));
  }

  /**
   * Get spectrum statistics
   * @returns {Object}
   */
  getStatistics() {
    if (this.peaks.length === 0) {
      return {
        peakCount: 0,
        totalIonCurrent: 0,
        basePeak: null,
        minMz: null,
        maxMz: null,
        averageIntensity: 0
      };
    }

    const tics = this.peaks.map(p => p.intensity);
    const mzs = this.peaks.map(p => p.mz);

    return {
      peakCount: this.peaks.length,
      totalIonCurrent: this.getTotalIonCurrent(),
      basePeak: this.getBasePeak(),
      minMz: Math.min(...mzs),
      maxMz: Math.max(...mzs),
      averageIntensity: tics.reduce((a, b) => a + b, 0) / tics.length
    };
  }

  /**
   * Convert to JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      index: this.index,
      metadata: this.metadata,
      peaks: this.peaks
    };
  }

  /**
   * Convert to string representation
   * @returns {string}
   */
  toString() {
    const title = this.getTitle() || 'Untitled';
    const peakCount = this.getPeakCount();
    const mass = this.getPrecursorMass();
    return `Spectrum ${this.index + 1}: ${title} (${peakCount} peaks${mass ? `, ${mass.toFixed(2)} m/z` : ''})`;
  }
}

// CommonJS export for Node.js


// ========== src/core/search.js ==========
/**
 * SearchFilter - Advanced search and filtering component for MGF spectra
 * Supports: title search, precursor mass range, charge filter, retention time range, metadata filtering
 * 
 * Usage:
 *   const search = new SearchFilter();
 *   search.on('filtered', (results) => console.log(results));
 *   search.filter(spectra, {title: 'peptide', chargeLow: 2, chargeHigh: 4});
 */
class SearchFilter {
    constructor(options = {}) {
        this.options = {
            caseSensitive: false,
            fuzzyMatch: false,
            highlightMatches: true,
            ...options
        };
        this.listeners = {};
        this.lastResults = null;
    }

    /**
     * Filter spectra based on search criteria
     * @param {Array} spectra - Array of spectrum objects
     * @param {Object} criteria - Filter criteria
     * @returns {Object} {matched: [], excluded: [], metadata: {}}
     */
    filter(spectra, criteria = {}) {
        const results = {
            matched: [],
            excluded: [],
            metadata: {
                totalSpectra: spectra.length,
                criteriaApplied: this._normalizeCriteria(criteria),
                timestamp: new Date().toISOString()
            }
        };

        spectra.forEach((spectrum, idx) => {
            if (this._matchesCriteria(spectrum, criteria)) {
                results.matched.push({
                    spectrum,
                    index: idx,
                    highlights: this._getHighlights(spectrum, criteria)
                });
            } else {
                results.excluded.push({spectrum, index: idx});
            }
        });

        this.lastResults = results;
        this.emit('filtered', results);
        return results;
    }

    /**
     * Search for title text
     * @param {Array} spectra - Spectra to search
     * @param {String} query - Search query
     * @returns {Array} Matching spectra with index
     */
    searchByTitle(spectra, query) {
        if (!query || query.length === 0) {
            return spectra.map((s, idx) => ({spectrum: s, index: idx}));
        }

        const searchText = this.options.caseSensitive ? query : query.toLowerCase();
        return spectra
            .map((spectrum, idx) => {
                const title = spectrum.getTitle ? spectrum.getTitle() : (spectrum.title || '');
                const titleText = this.options.caseSensitive ? title : title.toLowerCase();
                
                if (this.options.fuzzyMatch) {
                    return {
                        spectrum,
                        index: idx,
                        score: this._fuzzyMatchScore(titleText, searchText)
                    };
                } else {
                    return titleText.includes(searchText) ? {spectrum, index: idx, score: 100} : null;
                }
            })
            .filter(r => r !== null && r.score > 0)
            .sort((a, b) => b.score - a.score);
    }

    /**
     * Search by precursor mass with tolerance
     * @param {Array} spectra - Spectra to search
     * @param {Number} targetMass - Target precursor mass
     * @param {Number} tolerance - Mass tolerance (ppm or Da)
     * @param {String} toleranceUnit - 'ppm' or 'da'
     * @returns {Array} Matching spectra
     */
    searchByPrecursorMass(spectra, targetMass, tolerance, toleranceUnit = 'ppm') {
        if (!targetMass || targetMass <= 0) {
            return spectra.map((s, idx) => ({spectrum: s, index: idx}));
        }

        const toleranceDa = toleranceUnit === 'ppm' 
            ? (targetMass * tolerance / 1000000)
            : tolerance;

        const lower = targetMass - toleranceDa;
        const upper = targetMass + toleranceDa;

        return spectra
            .map((spectrum, idx) => {
                const precursor = spectrum.getPrecursorMass ? spectrum.getPrecursorMass() : spectrum.precursor_mass;
                if (precursor >= lower && precursor <= upper) {
                    return {
                        spectrum,
                        index: idx,
                        massDiff: Math.abs(precursor - targetMass)
                    };
                }
                return null;
            })
            .filter(r => r !== null)
            .sort((a, b) => a.massDiff - b.massDiff);
    }

    /**
     * Filter by charge state
     * @param {Array} spectra - Spectra to filter
     * @param {Number|Array} charges - Single charge or array of charges
     * @returns {Array} Spectra with matching charge states
     */
    filterByCharge(spectra, charges) {
        if (!charges || (Array.isArray(charges) && charges.length === 0)) {
            return spectra.map((s, idx) => ({spectrum: s, index: idx}));
        }

        const chargeArray = Array.isArray(charges) ? charges : [charges];
        return spectra
            .map((spectrum, idx) => {
                const charge = spectrum.getCharge ? spectrum.getCharge() : spectrum.charge;
                if (charge && chargeArray.includes(charge)) {
                    return {spectrum, index: idx, charge};
                }
                return null;
            })
            .filter(r => r !== null);
    }

    /**
     * Filter by retention time range
     * @param {Array} spectra - Spectra to filter
     * @param {Number} rtMin - Minimum RT
     * @param {Number} rtMax - Maximum RT
     * @returns {Array} Spectra within RT range
     */
    filterByRetentionTime(spectra, rtMin, rtMax) {
        if ((rtMin === null || rtMin === undefined) && (rtMax === null || rtMax === undefined)) {
            return spectra.map((s, idx) => ({spectrum: s, index: idx}));
        }

        const min = rtMin || 0;
        const max = rtMax || Infinity;

        return spectra
            .map((spectrum, idx) => {
                const rt = spectrum.getRetentionTime ? spectrum.getRetentionTime() : spectrum.retention_time;
                if (rt !== null && rt !== undefined && rt >= min && rt <= max) {
                    return {spectrum, index: idx, rt};
                }
                return null;
            })
            .filter(r => r !== null);
    }

    /**
     * Filter by metadata field value
     * @param {Array} spectra - Spectra to filter
     * @param {String} field - Metadata field name
     * @param {String|Number} value - Value to match
     * @param {String} operator - 'equals', 'contains', 'startsWith', 'endsWith'
     * @returns {Array} Matching spectra
     */
    filterByMetadata(spectra, field, value, operator = 'equals') {
        if (!field || value === null || value === undefined) {
            return spectra.map((s, idx) => ({spectrum: s, index: idx}));
        }

        return spectra
            .map((spectrum, idx) => {
                let fieldValue;
                if (spectrum.getMetadata) {
                    fieldValue = spectrum.getMetadata(field);
                } else if (spectrum.metadata && spectrum.metadata[field]) {
                    fieldValue = spectrum.metadata[field];
                } else {
                    fieldValue = spectrum[field];
                }

                if (fieldValue === null || fieldValue === undefined) {
                    return null;
                }

                const str1 = String(fieldValue).toLowerCase();
                const str2 = String(value).toLowerCase();

                let matches = false;
                switch (operator) {
                    case 'equals':
                        matches = str1 === str2;
                        break;
                    case 'contains':
                        matches = str1.includes(str2);
                        break;
                    case 'startsWith':
                        matches = str1.startsWith(str2);
                        break;
                    case 'endsWith':
                        matches = str1.endsWith(str2);
                        break;
                    default:
                        matches = str1 === str2;
                }

                return matches ? {spectrum, index: idx, fieldValue} : null;
            })
            .filter(r => r !== null);
    }

    /**
     * Clear all filters and return all spectra
     * @param {Array} spectra - All spectra
     * @returns {Array} All spectra with indices
     */
    clear(spectra) {
        this.lastResults = null;
        return spectra.map((s, idx) => ({spectrum: s, index: idx}));
    }

    /**
     * Get statistics about current filter results
     * @returns {Object} Statistics object
     */
    getResultsStatistics() {
        if (!this.lastResults) return null;

        const results = this.lastResults;
        return {
            totalSpectra: results.metadata.totalSpectra,
            matchedCount: results.matched.length,
            excludedCount: results.excluded.length,
            matchPercentage: ((results.matched.length / results.metadata.totalSpectra) * 100).toFixed(1),
            criteria: results.metadata.criteriaApplied,
            timestamp: results.metadata.timestamp
        };
    }

    /**
     * Apply multiple filters at once (AND logic)
     * @private
     */
    _matchesCriteria(spectrum, criteria) {
        // Title filter
        if (criteria.title) {
            const title = spectrum.getTitle ? spectrum.getTitle() : (spectrum.title || '');
            const searchText = this.options.caseSensitive ? criteria.title : criteria.title.toLowerCase();
            const titleText = this.options.caseSensitive ? title : title.toLowerCase();
            if (!titleText.includes(searchText)) return false;
        }

        // Precursor mass filter
        if (criteria.precursorMass !== null && criteria.precursorMass !== undefined) {
            const precursor = spectrum.getPrecursorMass ? spectrum.getPrecursorMass() : spectrum.precursor_mass;
            const tolerance = criteria.massToleranceDa || 5;
            if (Math.abs(precursor - criteria.precursorMass) > tolerance) return false;
        }

        // Charge filter
        if (criteria.charge) {
            const charge = spectrum.getCharge ? spectrum.getCharge() : spectrum.charge;
            const charges = Array.isArray(criteria.charge) ? criteria.charge : [criteria.charge];
            if (!charge || !charges.includes(charge)) return false;
        }

        // Charge range filter
        if (criteria.chargeLow !== null && criteria.chargeLow !== undefined) {
            const charge = spectrum.getCharge ? spectrum.getCharge() : spectrum.charge;
            if (!charge || charge < criteria.chargeLow) return false;
        }
        if (criteria.chargeHigh !== null && criteria.chargeHigh !== undefined) {
            const charge = spectrum.getCharge ? spectrum.getCharge() : spectrum.charge;
            if (!charge || charge > criteria.chargeHigh) return false;
        }

        // Retention time filter
        if (criteria.rtMin !== null && criteria.rtMin !== undefined) {
            const rt = spectrum.getRetentionTime ? spectrum.getRetentionTime() : spectrum.retention_time;
            if (rt === null || rt === undefined || rt < criteria.rtMin) return false;
        }
        if (criteria.rtMax !== null && criteria.rtMax !== undefined) {
            const rt = spectrum.getRetentionTime ? spectrum.getRetentionTime() : spectrum.retention_time;
            if (rt === null || rt === undefined || rt > criteria.rtMax) return false;
        }

        // Metadata filter
        if (criteria.metadata) {
            for (const [field, value] of Object.entries(criteria.metadata)) {
                let fieldValue;
                if (spectrum.getMetadata) {
                    fieldValue = spectrum.getMetadata(field);
                } else if (spectrum.metadata && spectrum.metadata[field]) {
                    fieldValue = spectrum.metadata[field];
                } else {
                    fieldValue = spectrum[field];
                }
                if (String(fieldValue).toLowerCase() !== String(value).toLowerCase()) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Get highlights for matching criteria
     * @private
     */
    _getHighlights(spectrum, criteria) {
        const highlights = {};

        if (criteria.title) {
            const title = spectrum.getTitle ? spectrum.getTitle() : (spectrum.title || '');
            highlights.title = {
                original: title,
                highlighted: this._highlightText(title, criteria.title)
            };
        }

        return highlights;
    }

    /**
     * Highlight matching text
     * @private
     */
    _highlightText(text, query) {
        if (!this.options.highlightMatches) return text;
        const searchText = this.options.caseSensitive ? query : query.toLowerCase();
        const textLower = this.options.caseSensitive ? text : text.toLowerCase();
        
        const idx = textLower.indexOf(searchText);
        if (idx === -1) return text;

        return text.substring(0, idx) + 
               '<mark>' + text.substring(idx, idx + query.length) + '</mark>' + 
               text.substring(idx + query.length);
    }

    /**
     * Calculate fuzzy match score
     * @private
     */
    _fuzzyMatchScore(text, query) {
        let score = 0;
        let queryIdx = 0;

        for (let i = 0; i < text.length && queryIdx < query.length; i++) {
            if (text[i] === query[queryIdx]) {
                score += 10;
                queryIdx++;
            } else {
                score += 1;
            }
        }

        if (queryIdx !== query.length) {
            return 0; // Didn't match all characters
        }

        return Math.max(0, 100 - (text.length - query.length));
    }

    /**
     * Normalize criteria object
     * @private
     */
    _normalizeCriteria(criteria) {
        const normalized = {};
        Object.keys(criteria).forEach(key => {
            if (criteria[key] !== null && criteria[key] !== undefined && criteria[key] !== '') {
                normalized[key] = criteria[key];
            }
        });
        return normalized;
    }

    /**
     * Event system - register listener
     */
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
        return this;
    }

    /**
     * Event system - unregister listener
     */
    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
        return this;
    }

    /**
     * Event system - emit event
     */
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
        return this;
    }

    /**
     * Get all available charges in spectra
     * @param {Array} spectra - Spectra to analyze
     * @returns {Array} Sorted unique charges
     */
    static getAvailableCharges(spectra) {
        const charges = new Set();
        spectra.forEach(spectrum => {
            const charge = spectrum.getCharge ? spectrum.getCharge() : spectrum.charge;
            if (charge) {
                charges.add(charge);
            }
        });
        return Array.from(charges).sort((a, b) => a - b);
    }

    /**
     * Get retention time range from spectra
     * @param {Array} spectra - Spectra to analyze
     * @returns {Object} {min, max, hasRtData}
     */
    static getRTRange(spectra) {
        let min = Infinity;
        let max = -Infinity;
        let hasRtData = false;

        spectra.forEach(spectrum => {
            const rt = spectrum.getRetentionTime ? spectrum.getRetentionTime() : spectrum.retention_time;
            if (rt !== null && rt !== undefined) {
                hasRtData = true;
                min = Math.min(min, rt);
                max = Math.max(max, rt);
            }
        });

        return {
            min: hasRtData ? min : 0,
            max: hasRtData ? max : 0,
            hasRtData
        };
    }

    /**
     * Get precursor mass range from spectra
     * @param {Array} spectra - Spectra to analyze
     * @returns {Object} {min, max}
     */
    static getPrecursorMassRange(spectra) {
        let min = Infinity;
        let max = -Infinity;

        spectra.forEach(spectrum => {
            const mass = spectrum.getPrecursorMass ? spectrum.getPrecursorMass() : spectrum.precursor_mass;
            if (mass) {
                min = Math.min(min, mass);
                max = Math.max(max, mass);
            }
        });

        return {
            min: min === Infinity ? 0 : min,
            max: max === -Infinity ? 0 : max
        };
    }
}

// CommonJS export for Node.js


// ========== src/core/stats.js ==========
/**
 * StatisticsPanel - Advanced statistics and analysis for MGF spectra
 * Generates distribution charts, histograms, and statistical summaries
 * 
 * Usage:
 *   const stats = new StatisticsPanel();
 *   stats.analyze(spectra);
 *   const html = stats.render();
 */
class StatisticsPanel {
    constructor(options = {}) {
        this.options = {
            histogramBins: 20,
            charWidth: 5,
            maxBarHeight: 100,
            colors: {
                bar: '#b0b0b0',
                text: '#333',
                grid: '#ddd'
            },
            ...options
        };
        this.data = null;
        this.listeners = {};
    }

    /**
     * Analyze spectra and generate statistics
     * @param {Array} spectra - Array of spectrum objects
     * @returns {Object} Complete statistics object
     */
    analyze(spectra) {
        if (!spectra || spectra.length === 0) {
            return this.data = {
                spectraCount: 0,
                totalPeaks: 0,
                averagePeaksPerSpectrum: 0,
                stats: {}
            };
        }

        const result = {
            spectraCount: spectra.length,
            totalPeaks: 0,
            peakCounts: [],
            charges: [],
            precursorMasses: [],
            retentionTimes: [],
            basePeakIntensities: [],
            totalIonCurrents: []
        };

        spectra.forEach(spectrum => {
            // Peak count
            const peakCount = spectrum.getPeakCount ? spectrum.getPeakCount() : (spectrum.peaks ? spectrum.peaks.length : 0);
            result.totalPeaks += peakCount;
            result.peakCounts.push(peakCount);

            // Charge
            const charge = spectrum.getCharge ? spectrum.getCharge() : (spectrum.metadata?.CHARGE ? String(spectrum.metadata.CHARGE).match(/^(\d+)/)?.[1] : null);
            if (charge) result.charges.push(parseInt(charge));

            // Precursor mass - handle both Spectrum objects and plain objects
            let precursor = null;
            if (spectrum.getPrecursorMass) {
                // Spectrum object with method
                precursor = spectrum.getPrecursorMass();
            } else if (spectrum.metadata?.PEPMASS) {
                // Plain object - extract from PEPMASS
                const pepMass = spectrum.metadata.PEPMASS;
                if (typeof pepMass === 'object' && pepMass.mass !== undefined) {
                    precursor = pepMass.mass;
                } else if (typeof pepMass === 'number') {
                    precursor = pepMass;
                } else if (typeof pepMass === 'string') {
                    const match = pepMass.match(/^([\d.]+)/);
                    precursor = match ? parseFloat(match[1]) : null;
                }
            } else if (spectrum.precursor_mass) {
                // Legacy property
                precursor = spectrum.precursor_mass;
            }
            if (precursor) result.precursorMasses.push(precursor);

            // Retention time
            const rt = spectrum.getRetentionTime ? spectrum.getRetentionTime() : (spectrum.metadata?.RTINSECONDS ? parseFloat(spectrum.metadata.RTINSECONDS) : (spectrum.retention_time || null));
            if (rt) result.retentionTimes.push(rt);

            // Base peak intensity
            if (spectrum.getBasePeak) {
                const basePeak = spectrum.getBasePeak();
                if (basePeak) result.basePeakIntensities.push(basePeak.intensity);
            }

            // Total ion current
            if (spectrum.getTotalIonCurrent) {
                const tic = spectrum.getTotalIonCurrent();
                if (tic) result.totalIonCurrents.push(tic);
            }
        });

        // Calculate summary statistics
        result.stats = {
            peaks: this._calculateStats(result.peakCounts),
            charges: this._calculateStats(result.charges),
            precursorMasses: this._calculateStats(result.precursorMasses),
            retentionTimes: this._calculateStats(result.retentionTimes),
            basePeakIntensities: this._calculateStats(result.basePeakIntensities),
            totalIonCurrents: this._calculateStats(result.totalIonCurrents)
        };

        // Charge distribution
        result.chargeDistribution = this._getDistribution(result.charges);

        // Precursor mass distribution (binned)
        result.precursorDistribution = this._getBinnedDistribution(
            result.precursorMasses,
            this.options.histogramBins
        );

        // Peak count distribution
        result.peakDistribution = this._getBinnedDistribution(
            result.peakCounts,
            this.options.histogramBins
        );

        this.data = result;
        this.emit('analyzed', result);
        return result;
    }

    /**
     * Get complete statistics object
     * @returns {Object} Statistics data
     */
    getStatistics() {
        return this.data;
    }

    /**
     * Render HTML statistics panel
     * @returns {String} HTML string
     */
    render() {
        if (!this.data || this.data.spectraCount === 0) {
            return '<div class="stats-empty">No data to display</div>';
        }

        let html = '<div class="stats-panel">';

        // Summary cards
        html += this._renderSummaryCards();

        // Distribution charts
        html += this._renderChargeDistribution();
        html += this._renderPrecursorDistribution();
        html += this._renderPeakDistribution();

        // Detailed statistics
        html += this._renderDetailedStats();

        html += '</div>';
        return html;
    }

    /**
     * Render summary statistics cards
     * @private
     */
    _renderSummaryCards() {
        const stats = this.data;
        let html = '<div class="stats-cards">';

        const cards = [
            { label: 'Total Spectra', value: stats.spectraCount },
            { label: 'Total Peaks', value: stats.totalPeaks.toLocaleString() },
            { label: 'Avg Peaks/Spectrum', value: (stats.totalPeaks / stats.spectraCount).toFixed(1) },
            { label: 'Min Peaks', value: Math.min(...stats.peakCounts) },
            { label: 'Max Peaks', value: Math.max(...stats.peakCounts) }
        ];

        if (stats.stats.precursorMasses.count > 0) {
            cards.push(
                { label: 'Avg Precursor', value: stats.stats.precursorMasses.mean.toFixed(2) },
                { label: 'Charge States', value: stats.chargeDistribution.length }
            );
        }

        cards.forEach(card => {
            html += `
                <div class="stat-card">
                    <div class="stat-label">${card.label}</div>
                    <div class="stat-value">${card.value}</div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    /**
     * Render charge distribution
     * @private
     */
    _renderChargeDistribution() {
        const dist = this.data.chargeDistribution;
        if (!dist || dist.length === 0) return '';

        let html = '<div class="stats-section">';
        html += '<h3>Charge State Distribution</h3>';
        html += '<div class="distribution-chart">';

        const maxCount = Math.max(...dist.map(d => d.count));

        dist.forEach(item => {
            const height = (item.count / maxCount) * this.options.maxBarHeight;
            const percentage = ((item.count / this.data.spectraCount) * 100).toFixed(1);
            html += `
                <div class="chart-bar" style="height: ${height}px;" title="${item.value}: ${item.count} (${percentage}%)">
                    <span class="bar-label">${item.count}</span>
                </div>
            `;
        });

        html += '</div>';
        html += '<div class="chart-legend">';
        dist.forEach(item => {
            html += `<span class="legend-item">+${item.value}: ${item.count}</span>`;
        });
        html += '</div>';
        html += '</div>';

        return html;
    }

    /**
     * Render precursor mass distribution
     * @private
     */
    _renderPrecursorDistribution() {
        const dist = this.data.precursorDistribution;
        if (!dist || dist.length === 0) return '';

        let html = '<div class="stats-section">';
        html += '<h3>Precursor Mass Distribution</h3>';
        html += '<div class="distribution-chart">';

        const maxCount = Math.max(...dist.map(d => d.count));

        dist.forEach(item => {
            const height = (item.count / maxCount) * this.options.maxBarHeight;
            const percentage = ((item.count / this.data.spectraCount) * 100).toFixed(1);
            const label = `${item.min.toFixed(0)}-${item.max.toFixed(0)}`;
            html += `
                <div class="chart-bar" style="height: ${height}px;" title="${label}: ${item.count} (${percentage}%)">
                    <span class="bar-label">${item.count}</span>
                </div>
            `;
        });

        html += '</div>';
        html += '<div class="chart-legend">';
        dist.forEach(item => {
            const label = `${item.min.toFixed(0)}-${item.max.toFixed(0)}`;
            html += `<span class="legend-item">${label}: ${item.count}</span>`;
        });
        html += '</div>';
        html += '</div>';

        return html;
    }

    /**
     * Render peak count distribution
     * @private
     */
    _renderPeakDistribution() {
        const dist = this.data.peakDistribution;
        if (!dist || dist.length === 0) return '';

        let html = '<div class="stats-section">';
        html += '<h3>Peaks per Spectrum Distribution</h3>';
        html += '<div class="distribution-chart">';

        const maxCount = Math.max(...dist.map(d => d.count));

        dist.forEach(item => {
            const height = (item.count / maxCount) * this.options.maxBarHeight;
            const percentage = ((item.count / this.data.spectraCount) * 100).toFixed(1);
            const label = `${item.min.toFixed(0)}-${item.max.toFixed(0)}`;
            html += `
                <div class="chart-bar" style="height: ${height}px;" title="${label}: ${item.count} (${percentage}%)">
                    <span class="bar-label">${item.count}</span>
                </div>
            `;
        });

        html += '</div>';
        html += '<div class="chart-legend">';
        dist.forEach(item => {
            const label = `${item.min.toFixed(0)}-${item.max.toFixed(0)}`;
            html += `<span class="legend-item">${label}: ${item.count}</span>`;
        });
        html += '</div>';
        html += '</div>';

        return html;
    }

    /**
     * Render detailed statistics table
     * @private
     */
    _renderDetailedStats() {
        const stats = this.data.stats;
        let html = '<div class="stats-section">';
        html += '<h3>Detailed Statistics</h3>';
        html += '<table class="stats-table"><tbody>';

        const categories = [
            { key: 'peaks', label: 'Peaks per Spectrum' },
            { key: 'charges', label: 'Charge States' },
            { key: 'precursorMasses', label: 'Precursor Masses' },
            { key: 'retentionTimes', label: 'Retention Times' },
            { key: 'basePeakIntensities', label: 'Base Peak Intensities' },
            { key: 'totalIonCurrents', label: 'Total Ion Currents' }
        ];

        categories.forEach(cat => {
            const s = stats[cat.key];
            if (s && s.count > 0) {
                html += `
                    <tr>
                        <td>${cat.label}</td>
                        <td>n=${s.count}</td>
                        <td>μ=${s.mean.toFixed(2)}</td>
                        <td>σ=${s.std.toFixed(2)}</td>
                        <td>min=${s.min.toFixed(2)}</td>
                        <td>max=${s.max.toFixed(2)}</td>
                        <td>median=${s.median.toFixed(2)}</td>
                    </tr>
                `;
            }
        });

        html += '</tbody></table>';
        html += '</div>';

        return html;
    }

    /**
     * Calculate statistics for array
     * @private
     */
    _calculateStats(arr) {
        if (!arr || arr.length === 0) {
            return { count: 0, mean: 0, std: 0, min: 0, max: 0, median: 0 };
        }

        const sorted = arr.slice().sort((a, b) => a - b);
        const sum = arr.reduce((a, b) => a + b, 0);
        const mean = sum / arr.length;
        const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
        const std = Math.sqrt(variance);

        return {
            count: arr.length,
            mean: mean,
            std: std,
            min: Math.min(...arr),
            max: Math.max(...arr),
            median: sorted[Math.floor(sorted.length / 2)],
            sum: sum
        };
    }

    /**
     * Get distribution of discrete values
     * @private
     */
    _getDistribution(values) {
        const counts = {};
        values.forEach(v => {
            counts[v] = (counts[v] || 0) + 1;
        });

        return Object.entries(counts)
            .map(([value, count]) => ({
                value: parseInt(value),
                count: count
            }))
            .sort((a, b) => a.value - b.value);
    }

    /**
     * Get binned distribution for continuous values
     * @private
     */
    _getBinnedDistribution(values, numBins) {
        if (!values || values.length === 0) return [];

        const min = Math.min(...values);
        const max = Math.max(...values);
        const binSize = (max - min) / numBins;

        const bins = [];
        for (let i = 0; i < numBins; i++) {
            bins.push({
                min: min + (i * binSize),
                max: min + ((i + 1) * binSize),
                count: 0
            });
        }

        values.forEach(value => {
            // Handle case where all values are identical (binSize === 0)
            let index = 0;
            if (binSize > 0) {
                const binIndex = Math.floor((value - min) / binSize);
                index = Math.min(binIndex, numBins - 1);
            }
            if (index >= 0 && index < bins.length) {
                bins[index].count++;
            }
        });

        return bins.filter(b => b.count > 0);
    }

    /**
     * Export statistics as JSON
     * @returns {Object} Statistics object
     */
    exportJSON() {
        return JSON.stringify(this.data, null, 2);
    }

    /**
     * Export statistics as CSV
     * @returns {String} CSV formatted statistics
     */
    exportCSV() {
        let csv = 'Statistic,Value\n';

        if (this.data && this.data.stats) {
            const stats = this.data.stats;
            
            csv += `Total Spectra,${this.data.spectraCount}\n`;
            csv += `Total Peaks,${this.data.totalPeaks}\n`;
            csv += `Avg Peaks per Spectrum,${(this.data.totalPeaks / this.data.spectraCount).toFixed(2)}\n\n`;

            Object.entries(stats).forEach(([key, s]) => {
                if (s && s.count > 0) {
                    csv += `${key}\n`;
                    csv += `Count,${s.count}\n`;
                    csv += `Mean,${s.mean.toFixed(2)}\n`;
                    csv += `Std Dev,${s.std.toFixed(2)}\n`;
                    csv += `Min,${s.min.toFixed(2)}\n`;
                    csv += `Max,${s.max.toFixed(2)}\n`;
                    csv += `Median,${s.median.toFixed(2)}\n\n`;
                }
            });
        }

        return csv;
    }

    /**
     * Event system - register listener
     */
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
        return this;
    }

    /**
     * Event system - unregister listener
     */
    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
        return this;
    }

    /**
     * Event system - emit event
     */
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
        return this;
    }
}

// CommonJS export for Node.js


// ========== src/core/export.js ==========
/**
 * ExportManager - Handle exporting spectra data in multiple formats
 * Supports: JSON, CSV, MGF, PNG (plots), SVG
 * 
 * Usage:
 *   const exporter = new ExportManager();
 *   exporter.exportJSON(spectra);
 *   exporter.exportCSV(spectra);
 *   exporter.exportMGF(spectra);
 */
class ExportManager {
    constructor(options = {}) {
        this.options = {
            delimiter: ',',
            includePeaks: true,
            includeMetadata: true,
            ...options
        };
        this.listeners = {};
    }

    /**
     * Export spectra as JSON
     * @param {Array} spectra - Array of spectrum objects
     * @param {Boolean} pretty - Pretty print JSON (default: true)
     * @returns {String} JSON string
     */
    exportJSON(spectra, pretty = true) {
        if (!spectra || spectra.length === 0) {
            return '{"spectra": [], "count": 0}';
        }

        const data = {
            spectra: spectra.map(s => this._spectrumToObject(s)),
            count: spectra.length,
            exportDate: new Date().toISOString(),
            exportFormat: 'JSON'
        };

        return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    }

    /**
     * Export spectra as CSV
     * @param {Array} spectra - Array of spectrum objects
     * @param {Object} options - Export options
     * @returns {String} CSV content
     */
    exportCSV(spectra, options = {}) {
        const opts = { ...this.options, ...options };
        
        if (!spectra || spectra.length === 0) {
            return '';
        }

        let csv = '';

        // Header with spectrum info
        csv += '# Mascot Generic Format (MGF) Export\n';
        csv += `# Exported: ${new Date().toISOString()}\n`;
        csv += `# Total Spectra: ${spectra.length}\n`;
        csv += `# Total Peaks: ${spectra.reduce((sum, s) => sum + (s.getPeakCount ? s.getPeakCount() : (s.peaks ? s.peaks.length : 0)), 0)}\n`;
        csv += '\n';

        // Per-spectrum data
        spectra.forEach((spectrum, idx) => {
            csv += `# SPECTRUM ${idx + 1}\n`;

            if (opts.includeMetadata) {
                const metadata = spectrum.metadata || {};
                const title = spectrum.getTitle ? spectrum.getTitle() : metadata.TITLE || `Spectrum ${idx + 1}`;
                const charge = spectrum.getCharge ? spectrum.getCharge() : metadata.CHARGE;
                const mz = spectrum.getPrecursorMass ? spectrum.getPrecursorMass() : metadata.PRECURSOR_MZ;
                const rt = spectrum.getRetentionTime ? spectrum.getRetentionTime() : metadata.RETENTION_TIME;

                csv += `Title,${this._escapeCSV(title)}\n`;
                if (charge) csv += `Charge,${charge}\n`;
                if (mz) csv += `Precursor_MZ,${mz.toFixed(4)}\n`;
                if (rt) csv += `Retention_Time,${rt.toFixed(2)}\n`;

                // Additional metadata
                Object.entries(metadata).forEach(([key, value]) => {
                    if (!['TITLE', 'CHARGE', 'PRECURSOR_MZ', 'RETENTION_TIME', 'BEGIN', 'END'].includes(key)) {
                        csv += `${key},${this._escapeCSV(value)}\n`;
                    }
                });
            }

            // Peaks
            if (opts.includePeaks) {
                csv += 'M/Z,Intensity\n';
                const peaks = spectrum.getPeaks ? spectrum.getPeaks() : (spectrum.peaks || []);
                peaks.forEach(peak => {
                    csv += `${peak.mz.toFixed(4)},${peak.intensity.toFixed(2)}\n`;
                });
            }

            csv += '\n';
        });

        return csv;
    }

    /**
     * Export spectra as MGF (reconstruct original format)
     * @param {Array} spectra - Array of spectrum objects
     * @returns {String} MGF content
     */
    exportMGF(spectra) {
        if (!spectra || spectra.length === 0) {
            return '';
        }

        let mgf = '';

        spectra.forEach(spectrum => {
            mgf += 'BEGIN IONS\n';

            // Metadata
            const metadata = spectrum.metadata || {};
            const title = spectrum.getTitle ? spectrum.getTitle() : metadata.TITLE;
            const charge = spectrum.getCharge ? spectrum.getCharge() : metadata.CHARGE;
            const mz = spectrum.getPrecursorMass ? spectrum.getPrecursorMass() : metadata.PRECURSOR_MZ;
            const rt = spectrum.getRetentionTime ? spectrum.getRetentionTime() : metadata.RETENTION_TIME;

            if (title) mgf += `TITLE=${title}\n`;
            if (charge) mgf += `CHARGE=${charge}+\n`;
            if (mz) mgf += `PRECURSOR_MZ=${mz.toFixed(4)}\n`;
            if (rt) mgf += `RETENTION_TIME=${rt.toFixed(2)}\n`;

            // Additional metadata from original
            Object.entries(metadata).forEach(([key, value]) => {
                if (!['TITLE', 'CHARGE', 'PRECURSOR_MZ', 'RETENTION_TIME', 'BEGIN', 'END'].includes(key)) {
                    if (value !== null && value !== undefined) {
                        mgf += `${key}=${value}\n`;
                    }
                }
            });

            // Peaks
            const peaks = spectrum.getPeaks ? spectrum.getPeaks() : (spectrum.peaks || []);
            peaks.forEach(peak => {
                mgf += `${peak.mz.toFixed(4)} ${peak.intensity.toFixed(2)}\n`;
            });

            mgf += 'END IONS\n\n';
        });

        return mgf;
    }

    /**
     * Export single spectrum as CSV
     * @param {Object} spectrum - Spectrum object
     * @returns {String} CSV content
     */
    exportSpectrumCSV(spectrum) {
        return this.exportCSV([spectrum]);
    }

    /**
     * Export single spectrum as MGF
     * @param {Object} spectrum - Spectrum object
     * @returns {String} MGF content
     */
    exportSpectrumMGF(spectrum) {
        return this.exportMGF([spectrum]);
    }

    /**
     * Download file to browser
     * @param {String} content - File content
     * @param {String} filename - File name
     * @param {String} mimeType - MIME type
     */
    downloadFile(content, filename, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        this.emit('fileDownloaded', { filename, size: content.length });
    }

    /**
     * Export and download JSON
     * @param {Array} spectra - Spectra to export
     * @param {String} filename - Output filename
     */
    downloadJSON(spectra, filename = 'spectra.json') {
        const content = this.exportJSON(spectra, true);
        this.downloadFile(content, filename, 'application/json');
    }

    /**
     * Export and download CSV
     * @param {Array} spectra - Spectra to export
     * @param {String} filename - Output filename
     */
    downloadCSV(spectra, filename = 'spectra.csv') {
        const content = this.exportCSV(spectra);
        this.downloadFile(content, filename, 'text/csv');
    }

    /**
     * Export and download MGF
     * @param {Array} spectra - Spectra to export
     * @param {String} filename - Output filename
     */
    downloadMGF(spectra, filename = 'spectra.mgf') {
        const content = this.exportMGF(spectra);
        this.downloadFile(content, filename, 'chemical/x-mgf');
    }

    /**
     * Export spectrum plot as PNG
     * @param {Object} plot - SpectrumPlot instance
     * @param {String} filename - Output filename
     */
    downloadPlotPNG(plot, filename = 'spectrum.png') {
        if (!plot || !plot.canvas) {
            console.error('No plot canvas available');
            return;
        }

        const canvas = plot.canvas;
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            this.emit('fileDownloaded', { filename, size: blob.size, type: 'image/png' });
        }, 'image/png');
    }

    /**
     * Export spectrum plot as SVG
     * @param {Object} plot - SpectrumPlot instance
     * @param {String} filename - Output filename
     */
    downloadPlotSVG(plot, filename = 'spectrum.svg') {
        if (!plot || !plot.generateSVG) {
            console.error('No plot SVG generator available');
            return;
        }

        const svgContent = plot.generateSVG();
        this.downloadFile(svgContent, filename, 'image/svg+xml');
    }

    /**
     * Copy content to clipboard
     * @param {String} content - Content to copy
     * @returns {Promise<Boolean>} Success flag
     */
    async copyToClipboard(content) {
        try {
            await navigator.clipboard.writeText(content);
            this.emit('clipboardCopied', { contentLength: content.length });
            return true;
        } catch (err) {
            console.error('Failed to copy:', err);
            return false;
        }
    }

    /**
     * Copy JSON to clipboard
     * @param {Array} spectra - Spectra to copy
     */
    async copyJSONToClipboard(spectra) {
        const json = this.exportJSON(spectra, true);
        return this.copyToClipboard(json);
    }

    /**
     * Copy CSV to clipboard
     * @param {Array} spectra - Spectra to copy
     */
    async copyCSVToClipboard(spectra) {
        const csv = this.exportCSV(spectra);
        return this.copyToClipboard(csv);
    }

    /**
     * Create shareable link (base64 encoded data)
     * @param {Array} spectra - Spectra to encode
     * @returns {String} Data URI
     */
    createShareableLink(spectra) {
        const json = this.exportJSON(spectra, false);
        const encoded = btoa(json);
        return `data:application/json;base64,${encoded}`;
    }

    /**
     * Generate export summary
     * @param {Array} spectra - Spectra to summarize
     * @returns {Object} Summary object
     */
    getSummary(spectra) {
        if (!spectra || spectra.length === 0) {
            return { spectraCount: 0, totalPeaks: 0, totalSize: 0 };
        }

        const totalPeaks = spectra.reduce((sum, s) => {
            return sum + (s.getPeakCount ? s.getPeakCount() : (s.peaks ? s.peaks.length : 0));
        }, 0);

        const json = this.exportJSON(spectra, false);
        const csv = this.exportCSV(spectra);
        const mgf = this.exportMGF(spectra);

        return {
            spectraCount: spectra.length,
            totalPeaks: totalPeaks,
            formats: {
                json: {
                    size: json.length,
                    compressed: new Blob([json]).size
                },
                csv: {
                    size: csv.length,
                    compressed: new Blob([csv]).size
                },
                mgf: {
                    size: mgf.length,
                    compressed: new Blob([mgf]).size
                }
            }
        };
    }

    /**
     * Convert spectrum to plain object
     * @private
     */
    _spectrumToObject(spectrum) {
        return {
            title: spectrum.getTitle ? spectrum.getTitle() : spectrum.metadata?.TITLE,
            charge: spectrum.getCharge ? spectrum.getCharge() : spectrum.charge,
            precursorMass: spectrum.getPrecursorMass ? spectrum.getPrecursorMass() : spectrum.precursor_mass,
            retentionTime: spectrum.getRetentionTime ? spectrum.getRetentionTime() : spectrum.retention_time,
            peakCount: spectrum.getPeakCount ? spectrum.getPeakCount() : (spectrum.peaks ? spectrum.peaks.length : 0),
            peaks: spectrum.getPeaks ? spectrum.getPeaks() : spectrum.peaks,
            metadata: spectrum.metadata || spectrum
        };
    }

    /**
     * Escape CSV value
     * @private
     */
    _escapeCSV(value) {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }

    /**
     * Event system - register listener
     */
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
        return this;
    }

    /**
     * Event system - unregister listener
     */
    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
        return this;
    }

    /**
     * Event system - emit event
     */
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
        return this;
    }
}

// CommonJS export for Node.js


// ========== src/core/utils.js ==========
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

// CommonJS export for Node.js


// ========== src/core/plugin.js ==========
/**
 * PluginSystem - Plugin architecture for extending MGFView.js
 * Allows users to create and register custom plugins
 * 
 * Usage:
 *   const plugin = new Plugin({
 *     name: 'MyPlugin',
 *     version: '1.0.0',
 *     init: (mgfview) => { },
 *     destroy: () => { }
 *   });
 *   
 *   PluginSystem.register(plugin);
 */

/**
 * Base Plugin class
 */
class Plugin {
    constructor(config = {}) {
        this.name = config.name || 'UnnamedPlugin';
        this.version = config.version || '1.0.0';
        this.description = config.description || '';
        this.author = config.author || '';
        this.dependencies = config.dependencies || [];
        this.enabled = false;
        
        // Hooks
        this.onInit = config.init || (() => {});
        this.onDestroy = config.destroy || (() => {});
        this.onSpectrumLoaded = config.onSpectrumLoaded || (() => {});
        this.onSpectrumChanged = config.onSpectrumChanged || (() => {});
        this.onDataFiltered = config.onDataFiltered || (() => {});
        this.onExport = config.onExport || (() => {});
    }

    /**
     * Initialize plugin
     */
    init(context) {
        try {
            this.onInit(context);
            this.enabled = true;
            this.context = context;
            return true;
        } catch (error) {
            console.error(`Plugin ${this.name} failed to initialize:`, error);
            return false;
        }
    }

    /**
     * Destroy plugin
     */
    destroy() {
        try {
            this.onDestroy();
            this.enabled = false;
            this.context = null;
            return true;
        } catch (error) {
            console.error(`Plugin ${this.name} failed to destroy:`, error);
            return false;
        }
    }

    /**
     * Get plugin info
     */
    getInfo() {
        return {
            name: this.name,
            version: this.version,
            description: this.description,
            author: this.author,
            enabled: this.enabled,
            dependencies: this.dependencies
        };
    }
}

/**
 * Plugin System - Manage plugins
 */
const PluginSystem = {
    plugins: {},
    hooks: {},
    context: null,

    /**
     * Initialize plugin system
     * @param {Object} context - MGFView context
     */
    init(context) {
        this.context = context;
        console.log('PluginSystem initialized');
    },

    /**
     * Register a plugin
     * @param {Plugin} plugin - Plugin instance
     * @returns {Boolean} Success
     */
    register(plugin) {
        if (!plugin || !plugin.name) {
            console.error('Invalid plugin: missing name');
            return false;
        }

        if (this.plugins[plugin.name]) {
            console.warn(`Plugin ${plugin.name} already registered`);
            return false;
        }

        // Check dependencies
        for (const dep of plugin.dependencies) {
            if (!this.plugins[dep]) {
                console.error(`Plugin ${plugin.name} requires ${dep}`);
                return false;
            }
        }

        this.plugins[plugin.name] = plugin;
        console.log(`Plugin registered: ${plugin.name} v${plugin.version}`);
        return true;
    },

    /**
     * Unregister a plugin
     * @param {String} name - Plugin name
     * @returns {Boolean} Success
     */
    unregister(name) {
        if (!this.plugins[name]) {
            console.warn(`Plugin ${name} not found`);
            return false;
        }

        const plugin = this.plugins[name];
        if (plugin.enabled) {
            this.disable(name);
        }

        delete this.plugins[name];
        console.log(`Plugin unregistered: ${name}`);
        return true;
    },

    /**
     * Enable a plugin
     * @param {String} name - Plugin name
     * @returns {Boolean} Success
     */
    enable(name) {
        const plugin = this.plugins[name];
        if (!plugin) {
            console.error(`Plugin ${name} not found`);
            return false;
        }

        if (plugin.enabled) {
            console.warn(`Plugin ${name} already enabled`);
            return true;
        }

        return plugin.init(this.context);
    },

    /**
     * Disable a plugin
     * @param {String} name - Plugin name
     * @returns {Boolean} Success
     */
    disable(name) {
        const plugin = this.plugins[name];
        if (!plugin) {
            console.error(`Plugin ${name} not found`);
            return false;
        }

        if (!plugin.enabled) {
            console.warn(`Plugin ${name} already disabled`);
            return true;
        }

        return plugin.destroy();
    },

    /**
     * Get plugin
     * @param {String} name - Plugin name
     * @returns {Plugin} Plugin instance
     */
    get(name) {
        return this.plugins[name] || null;
    },

    /**
     * Get all plugins
     * @returns {Array} Array of plugins
     */
    getAll() {
        return Object.values(this.plugins);
    },

    /**
     * List plugins with status
     * @returns {Array} Plugin info array
     */
    list() {
        return Object.values(this.plugins).map(p => p.getInfo());
    },

    /**
     * Execute hook across plugins
     * @param {String} hookName - Hook name
     * @param {Object} data - Data to pass to hook
     */
    executeHook(hookName, data) {
        Object.values(this.plugins).forEach(plugin => {
            if (plugin.enabled && plugin[hookName]) {
                try {
                    plugin[hookName](data);
                } catch (error) {
                    console.error(`Hook ${hookName} failed in ${plugin.name}:`, error);
                }
            }
        });
    }
};

/**
 * Example Plugins
 */

/**
 * MirrorPlot Plugin - Show mirror plot of spectra
 */
class MirrorPlotPlugin extends Plugin {
    constructor() {
        super({
            name: 'MirrorPlot',
            version: '1.0.0',
            description: 'Display mirror plots of paired spectra',
            author: 'MGFView Team',
            init: function(context) {
                console.log('MirrorPlot plugin initialized');
                // Add mirror plot UI element
                if (context && context.addTab) {
                    context.addTab('Mirror', '<div id="mirror-plot"></div>');
                }
            },
            destroy: function() {
                console.log('MirrorPlot plugin destroyed');
            },
            onSpectrumChanged: function(spectrum) {
                console.log('Spectrum changed - updating mirror plot');
            }
        });
    }
}

/**
 * Similarity Plugin - Calculate spectrum similarity
 */
class SimilarityPlugin extends Plugin {
    constructor() {
        super({
            name: 'Similarity',
            version: '1.0.0',
            description: 'Calculate similarity between spectra',
            author: 'MGFView Team',
            init: function(context) {
                console.log('Similarity plugin initialized');
            },
            destroy: function() {
                console.log('Similarity plugin destroyed');
            }
        });
    }

    /**
     * Calculate cosine similarity between two spectra
     */
    cosineSimilarity(spec1, spec2) {
        const peaks1 = spec1.getPeaks ? spec1.getPeaks() : spec1.peaks || [];
        const peaks2 = spec2.getPeaks ? spec2.getPeaks() : spec2.peaks || [];

        if (peaks1.length === 0 || peaks2.length === 0) return 0;

        // Create normalized vectors
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        // Build peak maps for faster lookup
        const map1 = {};
        peaks1.forEach(p => {
            map1[p.mz.toFixed(2)] = p.intensity;
            norm1 += Math.pow(p.intensity, 2);
        });

        const map2 = {};
        peaks2.forEach(p => {
            map2[p.mz.toFixed(2)] = p.intensity;
            norm2 += Math.pow(p.intensity, 2);
        });

        // Calculate dot product
        Object.keys(map1).forEach(mz => {
            if (map2[mz]) {
                dotProduct += map1[mz] * map2[mz];
            }
        });

        const denom = Math.sqrt(norm1) * Math.sqrt(norm2);
        return denom === 0 ? 0 : dotProduct / denom;
    }
}

/**
 * Annotation Plugin - Add manual annotations to spectra
 */
class AnnotationPlugin extends Plugin {
    constructor() {
        super({
            name: 'Annotation',
            version: '1.0.0',
            description: 'Add and manage annotations on spectra',
            author: 'MGFView Team',
            init: function(context) {
                console.log('Annotation plugin initialized');
                this.annotations = {};
            },
            destroy: function() {
                console.log('Annotation plugin destroyed');
                this.annotations = {};
            }
        });
    }

    /**
     * Add annotation to spectrum
     */
    addAnnotation(spectrumIndex, annotation) {
        if (!this.annotations[spectrumIndex]) {
            this.annotations[spectrumIndex] = [];
        }
        this.annotations[spectrumIndex].push({
            text: annotation,
            timestamp: new Date().toISOString(),
            id: Math.random().toString(36).substr(2, 9)
        });
        return this.annotations[spectrumIndex][this.annotations[spectrumIndex].length - 1];
    }

    /**
     * Get annotations for spectrum
     */
    getAnnotations(spectrumIndex) {
        return this.annotations[spectrumIndex] || [];
    }

    /**
     * Remove annotation
     */
    removeAnnotation(spectrumIndex, annotationId) {
        if (!this.annotations[spectrumIndex]) return false;
        const index = this.annotations[spectrumIndex].findIndex(a => a.id === annotationId);
        if (index >= 0) {
            this.annotations[spectrumIndex].splice(index, 1);
            return true;
        }
        return false;
    }
}

/**
 * Comparison Plugin - Compare multiple spectra
 */
class ComparisonPlugin extends Plugin {
    constructor() {
        super({
            name: 'Comparison',
            version: '1.0.0',
            description: 'Compare multiple spectra side by side',
            author: 'MGFView Team',
            init: function(context) {
                console.log('Comparison plugin initialized');
                this.selected = [];
            },
            destroy: function() {
                console.log('Comparison plugin destroyed');
                this.selected = [];
            }
        });
    }

    /**
     * Add spectrum to comparison
     */
    addSpectrum(spectrum) {
        if (this.selected.length < 5) {
            this.selected.push(spectrum);
            return true;
        }
        return false;
    }

    /**
     * Remove spectrum from comparison
     */
    removeSpectrum(index) {
        this.selected.splice(index, 1);
    }

    /**
     * Clear comparison
     */
    clear() {
        this.selected = [];
    }

    /**
     * Get comparison data
     */
    getComparison() {
        return {
            count: this.selected.length,
            spectra: this.selected
        };
    }
}

// CommonJS export for Node.js
;
}

// ========== src/core/state.js ==========
/**
 * State Management
 * 
 * Centralized state management for MGFView.js
 * Provides reactive state updates with event system
 * 
 * Usage:
 *   const state = new ViewerState();
 *   state.on('change', (data) => updateUI(data));
 *   state.setState({ selectedIndex: 5 });
 */

class ViewerState {
  constructor() {
    // Core data
    this.data = {
      // Dataset
      spectra: [],
      metadata: {},
      statistics: null,
      
      // Selection
      selectedIndex: 0,
      
      // Filtering
      filters: {
        title: '',
        mass: null,
        massTolerance: 5,
        charge: null,
        rtMin: null,
        rtMax: null,
        scan: null,
        minPeaks: null
      },
      
      // Search results
      searchResults: null,
      
      // UI state
      showStatistics: false,
      showSearch: false,
      showExport: false,
      
      // Plot state
      plotZoom: null,
      plotPan: null,
      
      // Loading state
      isLoading: false,
      error: null
    };
    
    // Event listeners
    this.listeners = {
      'change': [],
      'dataLoaded': [],
      'spectrumSelected': [],
      'filterChanged': [],
      'searchChanged': [],
      'error': []
    };
    
    // Computed properties cache
    this.computed = {};
  }
  
  /**
   * Get current state
   * @returns {Object} Current state
   */
  getState() {
    return { ...this.data };
  }
  
  /**
   * Get specific state property
   * @param {string} key - Property path (supports dot notation)
   * @returns {*} Property value
   */
  get(key) {
    const keys = key.split('.');
    let value = this.data;
    for (const k of keys) {
      value = value?.[k];
    }
    return value;
  }
  
  /**
   * Set state (triggers change event)
   * @param {Object} updates - State updates
   * @param {boolean} silent - If true, don't emit change event
   */
  setState(updates, silent = false) {
    const oldState = { ...this.data };
    
    // Deep merge updates
    this.data = this.deepMerge(this.data, updates);
    
    // Clear computed cache
    this.computed = {};
    
    if (!silent) {
      this.emit('change', {
        state: this.data,
        updates,
        oldState
      });
    }
  }
  
  /**
   * Load dataset
   * @param {Array} spectra - Spectrum array
   * @param {Object} metadata - File metadata
   */
  loadDataset(spectra, metadata = {}) {
    this.setState({
      spectra,
      metadata,
      selectedIndex: 0,
      searchResults: null,
      error: null,
      isLoading: false
    });
    
    this.emit('dataLoaded', { spectra, metadata });
  }
  
  /**
   * Select spectrum by index
   * @param {number} index - Spectrum index
   */
  selectSpectrum(index) {
    if (index < 0 || index >= this.data.spectra.length) {
      throw new Error(`Invalid spectrum index: ${index}`);
    }
    
    this.setState({ selectedIndex: index });
    
    this.emit('spectrumSelected', {
      index,
      spectrum: this.getSelectedSpectrum()
    });
  }
  
  /**
   * Get selected spectrum
   * @returns {Object|null} Selected spectrum
   */
  getSelectedSpectrum() {
    return this.data.spectra[this.data.selectedIndex] || null;
  }
  
  /**
   * Get all spectra (respects filters)
   * @returns {Array} Filtered spectra
   */
  getVisibleSpectra() {
    if (this.data.searchResults) {
      return this.data.searchResults;
    }
    return this.data.spectra;
  }
  
  /**
   * Update filters
   * @param {Object} filters - Filter updates
   */
  updateFilters(filters) {
    this.setState({
      filters: { ...this.data.filters, ...filters }
    });
    
    this.emit('filterChanged', { filters: this.data.filters });
  }
  
  /**
   * Apply search/filter to dataset
   * @param {Object} criteria - Search criteria
   * @returns {Array} Matching spectra
   */
  applySearch(criteria) {
    const results = this.data.spectra.filter(spectrum => {
      // Title search
      if (criteria.title) {
        const title = spectrum.metadata.TITLE || '';
        if (!title.toLowerCase().includes(criteria.title.toLowerCase())) {
          return false;
        }
      }
      
      // Mass filter
      if (criteria.mass !== null && criteria.mass !== undefined) {
        const pepmass = spectrum.metadata.PEPMASS;
        const mass = Array.isArray(pepmass) ? pepmass[0] : pepmass;
        if (!mass) return false;
        
        const tolerance = criteria.massTolerance || 5;
        if (Math.abs(mass - criteria.mass) > tolerance) {
          return false;
        }
      }
      
      // Charge filter
      if (criteria.charge !== null && criteria.charge !== undefined && criteria.charge !== '') {
        const charge = spectrum.metadata.CHARGE;
        if (charge !== criteria.charge) {
          return false;
        }
      }
      
      // RT range filter
      if (criteria.rtMin !== null || criteria.rtMax !== null) {
        const rt = spectrum.metadata.RTINSECONDS;
        if (!rt) return false;
        
        if (criteria.rtMin !== null && rt < criteria.rtMin * 60) return false;
        if (criteria.rtMax !== null && rt > criteria.rtMax * 60) return false;
      }
      
      // Scan number filter
      if (criteria.scan !== null && criteria.scan !== undefined) {
        const scan = spectrum.metadata.SCANS;
        if (scan !== criteria.scan) return false;
      }
      
      // Min peaks filter
      if (criteria.minPeaks !== null && criteria.minPeaks !== undefined) {
        if (spectrum.peaks.length < criteria.minPeaks) return false;
      }
      
      return true;
    });
    
    this.setState({ searchResults: results });
    this.emit('searchChanged', { results, criteria });
    
    return results;
  }
  
  /**
   * Clear search results
   */
  clearSearch() {
    this.setState({
      searchResults: null,
      filters: {
        title: '',
        mass: null,
        massTolerance: 5,
        charge: null,
        rtMin: null,
        rtMax: null,
        scan: null,
        minPeaks: null
      }
    });
    
    this.emit('searchChanged', { results: null, criteria: null });
  }
  
  /**
   * Set loading state
   * @param {boolean} isLoading - Loading state
   */
  setLoading(isLoading) {
    this.setState({ isLoading }, true); // Silent update
  }
  
  /**
   * Set error state
   * @param {string|Error} error - Error message or object
   */
  setError(error) {
    const errorMessage = error instanceof Error ? error.message : error;
    this.setState({ error: errorMessage, isLoading: false });
    this.emit('error', { error: errorMessage });
  }
  
  /**
   * Clear error state
   */
  clearError() {
    this.setState({ error: null });
  }
  
  /**
   * Reset state to initial values
   */
  reset() {
    this.data = {
      spectra: [],
      metadata: {},
      statistics: null,
      selectedIndex: 0,
      filters: {
        title: '',
        mass: null,
        massTolerance: 5,
        charge: null,
        rtMin: null,
        rtMax: null,
        scan: null,
        minPeaks: null
      },
      searchResults: null,
      showStatistics: false,
      showSearch: false,
      showExport: false,
      plotZoom: null,
      plotPan: null,
      isLoading: false,
      error: null
    };
    
    this.computed = {};
    this.emit('change', { state: this.data, updates: {}, oldState: {} });
  }
  
  /**
   * Register event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    
    this.listeners[event].push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }
  
  /**
   * Emit event to all listeners
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }
  
  /**
   * Deep merge objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   */
  deepMerge(target, source) {
    const output = { ...target };
    
    for (const key in source) {
      if (source[key] instanceof Object && !Array.isArray(source[key])) {
        output[key] = this.deepMerge(output[key] || {}, source[key]);
      } else {
        output[key] = source[key];
      }
    }
    
    return output;
  }
  
  /**
   * Get computed statistics
   * @returns {Object} Statistics object
   */
  getStatistics() {
    // Use cached value if available
    if (this.computed.statistics) {
      return this.computed.statistics;
    }
    
    const spectra = this.data.spectra;
    if (spectra.length === 0) {
      return null;
    }
    
    // Calculate statistics
    const stats = {
      totalSpectra: spectra.length,
      totalPeaks: 0,
      avgPeaksPerSpectrum: 0,
      minPeaks: Infinity,
      maxPeaks: 0,
      charges: {},
      massRange: { min: Infinity, max: 0 },
      rtRange: { min: Infinity, max: 0 }
    };
    
    spectra.forEach(spectrum => {
      const peakCount = spectrum.peaks.length;
      stats.totalPeaks += peakCount;
      stats.minPeaks = Math.min(stats.minPeaks, peakCount);
      stats.maxPeaks = Math.max(stats.maxPeaks, peakCount);
      
      // Charge distribution
      const charge = spectrum.metadata.CHARGE;
      if (charge) {
        stats.charges[charge] = (stats.charges[charge] || 0) + 1;
      }
      
      // Mass range
      const pepmass = spectrum.metadata.PEPMASS;
      const mass = Array.isArray(pepmass) ? pepmass[0] : pepmass;
      if (mass) {
        stats.massRange.min = Math.min(stats.massRange.min, mass);
        stats.massRange.max = Math.max(stats.massRange.max, mass);
      }
      
      // RT range
      const rt = spectrum.metadata.RTINSECONDS;
      if (rt) {
        stats.rtRange.min = Math.min(stats.rtRange.min, rt);
        stats.rtRange.max = Math.max(stats.rtRange.max, rt);
      }
    });
    
    stats.avgPeaksPerSpectrum = stats.totalPeaks / stats.totalSpectra;
    
    // Cache result
    this.computed.statistics = stats;
    
    return stats;
  }
}

// CommonJS export for Node.js


// ========== src/viewer/uibuilder.js ==========
/**
 * UI Builder
 * 
 * Builds the viewer UI programmatically
 * Creates DOM structure once and caches references
 * All subsequent updates modify existing elements (no innerHTML)
 * 
 * Usage:
 *   const ui = new UIBuilder(container, options);
 *   ui.build();
 *   ui.refs // Access cached DOM references
 */

class UIBuilder {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' 
      ? document.querySelector(container) 
      : container;
    
    if (!this.container) {
      throw new Error('Invalid container element');
    }
    
    this.options = {
      showToolbar: true,
      showSearch: true,
      showStatistics: true,
      showExport: true,
      showDistribution: true,
      theme: 'light',
      ...options
    };
    
    // DOM reference cache
    this.refs = {};
    
    // Component instances
    this.components = {};
  }
  
  /**
   * Build complete UI structure
   * This runs exactly once during initialization
   */
  build() {
    // Clear container
    this.container.innerHTML = '';
    this.container.className = 'mgf-container';
    
    // Build structure
    this.buildHeader();
    this.buildControls();
    this.buildViewer();
    this.buildEmptyState();
    
    // Cache all important references
    this.cacheReferences();
    
    // Set initial visibility
    this.refs.viewer.style.display = 'none';
    this.refs.emptyState.style.display = 'flex';
    
    return this.refs;
  }
  
  /**
   * Build header section
   */
  buildHeader() {
    const header = document.createElement('header');
    header.className = 'mgf-header';
    header.innerHTML = `
      <h1>🧬 MGFView.js</h1>
      <p>Interactive Mascot Generic Format (MGF) File Viewer</p>
      <p style="margin-top: 10px; font-size: 13px;">
        <a href="https://github.com/saurabhgayali/MGFView.js" target="_blank" style="color: white; text-decoration: underline;">GitHub Repository</a> | 
        <a href="doc/index.html" style="color: white; text-decoration: underline;">Documentation</a> | 
        <a href="index.html" style="color: white; text-decoration: underline;">Home</a>
      </p>
    `;
    
    this.container.appendChild(header);
    this.refs.header = header;
  }
  
  /**
   * Build controls panel
   */
  buildControls() {
    const controls = document.createElement('div');
    controls.className = 'mgf-controls';
    
    // Load example section
    const loadSection = this.createControlGroup();
    loadSection.innerHTML = `
      <label>Load Example:</label>
      <select id="exampleSelect">
        <option value="">-- Select an example file --</option>
        <option value="small.mgf">Small (5 spectra)</option>
        <option value="medium.mgf">Medium (20 spectra)</option>
        <option value="large.mgf">Large (100+ spectra)</option>
        <option value="Metabolomics.mgf">Metabolomics</option>
        <option value="spectral.mgf">Spectral Library</option>
      </select>
      <button id="loadExampleBtn">Load</button>
    `;
    controls.appendChild(loadSection);
    
    // File upload section
    const uploadSection = this.createControlGroup();
    uploadSection.innerHTML = `
      <label>Upload MGF:</label>
      <input type="file" id="fileInput" accept=".mgf,.txt" />
    `;
    controls.appendChild(uploadSection);
    
    // Message box
    const messageBox = document.createElement('div');
    messageBox.id = 'messageBox';
    controls.appendChild(messageBox);
    
    // Statistics panel
    if (this.options.showStatistics) {
      const statsPanel = document.createElement('div');
      statsPanel.id = 'statsPanel';
      statsPanel.style.display = 'none';
      statsPanel.style.cssText = 'display:none; padding: 20px; margin: 0; background: #f0f2f5; border-radius: 4px; margin-bottom: 15px;';
      statsPanel.innerHTML = `
        <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #333; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #555555; padding-bottom: 8px;">📊 File Statistics</h3>
        <div id="statsContent" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;"></div>
      `;
      controls.appendChild(statsPanel);
    }
    
    // Distribution panel
    if (this.options.showDistribution) {
      const distPanel = document.createElement('div');
      distPanel.id = 'distributionPanel';
      distPanel.style.cssText = 'display:none; padding: 20px; margin: 0; background: #f9f9f9; border-radius: 4px; margin-bottom: 15px;';
      distPanel.innerHTML = `
        <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #333; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #555555; padding-bottom: 8px;">📊 Peak Distribution</h3>
        <canvas id="distributionCanvas" style="width: 100%; border: 1px solid #e0e0e0; border-radius: 4px; background: white; display: block; margin-bottom: 15px;"></canvas>
        <div style="display: flex; gap: 8px; padding: 0; border-top: 1px solid #e0e0e0; flex-wrap: wrap; padding-top: 15px;">
          <button id="exportDistributionPNG" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555; border-radius: 4px; cursor: pointer; font-weight: 500;">📥 PNG</button>
          <button id="exportDistributionSVG" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555; border-radius: 4px; cursor: pointer; font-weight: 500;">📥 SVG</button>
          <button id="exportDistributionHTML" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555; border-radius: 4px; cursor: pointer; font-weight: 500;">📥 HTML</button>
          <button id="exportDistributionCSV" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555; border-radius: 4px; cursor: pointer; font-weight: 500;">📊 CSV</button>
        </div>
      `;
      controls.appendChild(distPanel);
    }
    
    // Export panel
    if (this.options.showExport) {
      const exportPanel = document.createElement('div');
      exportPanel.id = 'exportPanel';
      exportPanel.style.cssText = 'display:none; padding: 15px 0; border-top: 1px solid #e0e0e0;';
      exportPanel.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 12px; color: #333;">💾 Data Export</div>
        <div class="mgf-control-group" style="gap: 8px; flex-wrap: wrap;">
          <button id="exportJSON" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555;">All JSON</button>
          <button id="exportCSV" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555;">All CSV</button>
          <button id="exportMGF" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555;">All MGF</button>
          <button id="exportSpecJSON" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555;">Spectrum JSON</button>
          <button id="exportSpecCSV" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555;">Spectrum CSV</button>
        </div>
      `;
      controls.appendChild(exportPanel);
    }
    
    // Search panel
    if (this.options.showSearch) {
      const searchPanel = document.createElement('div');
      searchPanel.id = 'searchPanel';
      searchPanel.style.cssText = 'display:none; padding: 15px 20px; border-top: 1px solid #e0e0e0; background: #f9f9f9; margin-top: 15px; border-radius: 4px;';
      searchPanel.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 15px; color: #333;">🔍 Search & Filter</div>
        
        <div class="mgf-control-group">
          <label>Title:</label>
          <input type="text" id="searchTitle" placeholder="Search title..." style="flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
          <button id="clearSearchBtn" style="padding: 8px 15px; font-size: 13px;">Clear</button>
        </div>
        
        <div class="mgf-control-group">
          <label>Precursor m/z:</label>
          <input type="number" id="searchMass" placeholder="m/z" step="0.01" style="flex: 0.8; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
          <input type="number" id="searchMassTol" placeholder="±Da" value="5" step="0.1" style="flex: 0.6; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
        </div>
        
        <div class="mgf-control-group">
          <label>Charge State:</label>
          <select id="searchCharge" style="flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
            <option value="">Any Charge</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
          </select>
        </div>
        
        <div class="mgf-control-group">
          <label>RT Range (min):</label>
          <input type="number" id="searchRTMin" placeholder="Min" step="0.1" style="flex: 0.6; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
          <input type="number" id="searchRTMax" placeholder="Max" step="0.1" style="flex: 0.6; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
        </div>
        
        <div id="scanFilterGroup" class="mgf-control-group" style="display: none;">
          <label>Scan Number:</label>
          <input type="number" id="searchScan" placeholder="Scan #" style="flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
        </div>
        
        <div id="peakFilterGroup" class="mgf-control-group" style="display: none;">
          <label>Min Peaks:</label>
          <input type="number" id="searchMinPeaks" placeholder="Min peak count" min="1" style="flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
        </div>
        
        <div id="filterResults" style="margin-top: 10px; padding: 10px; background: #f0f0f0; border-radius: 4px; font-size: 13px; color: #999; display: none;"></div>
      `;
      controls.appendChild(searchPanel);
    }
    
    this.container.appendChild(controls);
    this.refs.controls = controls;
  }
  
  /**
   * Build viewer section
   */
  buildViewer() {
    const viewer = document.createElement('div');
    viewer.className = 'mgf-viewer';
    viewer.id = 'viewer';
    viewer.style.display = 'none';
    
    // Spectrum list
    const spectrumList = document.createElement('div');
    spectrumList.className = 'mgf-spectrum-list';
    spectrumList.id = 'spectrumList';
    viewer.appendChild(spectrumList);
    
    // Spectrum content container
    const contentWrapper = document.createElement('div');
    contentWrapper.style.cssText = 'display: flex; flex-direction: column; flex: 1; height: 100%;';
    
    const spectrumContent = document.createElement('div');
    spectrumContent.id = 'spectrumContent';
    spectrumContent.className = 'mgf-spectrum-content';
    spectrumContent.style.cssText = 'flex: 1; overflow-y: auto; display: flex; flex-direction: column; max-width: 100%; box-sizing: border-box;';
    
    // Plot container
    const plotContainer = document.createElement('div');
    plotContainer.id = 'plotContainer';
    plotContainer.style.cssText = 'width: 100%; height: 300px; flex-shrink: 0; border: 1px solid #e0e0e0; border-radius: 4px; background: white; margin: 0; box-sizing: border-box;';
    spectrumContent.appendChild(plotContainer);
    
    // Export spectrum buttons
    const exportButtons = document.createElement('div');
    exportButtons.style.cssText = 'display: flex; gap: 8px; padding: 15px 20px; border-top: 1px solid #e0e0e0; background: #f9f9f9; flex-shrink: 0; flex-wrap: wrap;';
    exportButtons.innerHTML = `
      <button id="exportSpectrumPNG" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555; border-radius: 4px; cursor: pointer; font-weight: 500;">📥 PNG</button>
      <button id="exportSpectrumSVG" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555; border-radius: 4px; cursor: pointer; font-weight: 500;">📥 SVG</button>
      <button id="exportSpectrumHTML" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555; border-radius: 4px; cursor: pointer; font-weight: 500;">📥 HTML</button>
      <button id="exportSpectrumCSV" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555; border-radius: 4px; cursor: pointer; font-weight: 500;">📊 CSV</button>
    `;
    spectrumContent.appendChild(exportButtons);
    
    // Spectrum details
    const spectrumDetails = document.createElement('div');
    spectrumDetails.id = 'spectrumDetails';
    spectrumDetails.style.cssText = 'flex: 1; overflow-y: auto; padding: 20px; box-sizing: border-box; width: 100%; background: white; min-height: 100%;';
    spectrumContent.appendChild(spectrumDetails);
    
    contentWrapper.appendChild(spectrumContent);
    viewer.appendChild(contentWrapper);
    
    this.container.appendChild(viewer);
    this.refs.viewer = viewer;
  }
  
  /**
   * Build empty state
   */
  buildEmptyState() {
    const emptyState = document.createElement('div');
    emptyState.className = 'mgf-empty-state';
    emptyState.id = 'emptyState';
    emptyState.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
        <polyline points="13 2 13 9 20 9"></polyline>
        <line x1="9" y1="14" x2="15" y2="14"></line>
        <line x1="9" y1="18" x2="15" y2="18"></line>
      </svg>
      <h2>No MGF file loaded</h2>
      <p>Load an example file or upload your own MGF file to begin analysis</p>
    `;
    
    this.container.appendChild(emptyState);
    this.refs.emptyState = emptyState;
  }
  
  /**
   * Create control group div
   * @returns {HTMLElement}
   */
  createControlGroup() {
    const group = document.createElement('div');
    group.className = 'mgf-control-group';
    return group;
  }
  
  /**
   * Cache all important DOM references
   */
  cacheReferences() {
    // Core sections
    this.refs.header = this.container.querySelector('.mgf-header');
    this.refs.controls = this.container.querySelector('.mgf-controls');
    this.refs.viewer = this.container.querySelector('.mgf-viewer');
    this.refs.emptyState = this.container.querySelector('.mgf-empty-state');
    
    // Controls
    this.refs.exampleSelect = document.getElementById('exampleSelect');
    this.refs.loadExampleBtn = document.getElementById('loadExampleBtn');
    this.refs.fileInput = document.getElementById('fileInput');
    this.refs.messageBox = document.getElementById('messageBox');
    
    // Panels
    this.refs.statsPanel = document.getElementById('statsPanel');
    this.refs.statsContent = document.getElementById('statsContent');
    this.refs.distributionPanel = document.getElementById('distributionPanel');
    this.refs.distributionCanvas = document.getElementById('distributionCanvas');
    this.refs.exportPanel = document.getElementById('exportPanel');
    this.refs.searchPanel = document.getElementById('searchPanel');
    
    // Search inputs
    this.refs.searchTitle = document.getElementById('searchTitle');
    this.refs.searchMass = document.getElementById('searchMass');
    this.refs.searchMassTol = document.getElementById('searchMassTol');
    this.refs.searchCharge = document.getElementById('searchCharge');
    this.refs.searchRTMin = document.getElementById('searchRTMin');
    this.refs.searchRTMax = document.getElementById('searchRTMax');
    this.refs.searchScan = document.getElementById('searchScan');
    this.refs.searchMinPeaks = document.getElementById('searchMinPeaks');
    this.refs.clearSearchBtn = document.getElementById('clearSearchBtn');
    this.refs.filterResults = document.getElementById('filterResults');
    
    // Viewer components
    this.refs.spectrumList = document.getElementById('spectrumList');
    this.refs.spectrumContent = document.getElementById('spectrumContent');
    this.refs.plotContainer = document.getElementById('plotContainer');
    this.refs.spectrumDetails = document.getElementById('spectrumDetails');
    
    // Export buttons
    this.refs.exportJSON = document.getElementById('exportJSON');
    this.refs.exportCSV = document.getElementById('exportCSV');
    this.refs.exportMGF = document.getElementById('exportMGF');
    this.refs.exportSpecJSON = document.getElementById('exportSpecJSON');
    this.refs.exportSpecCSV = document.getElementById('exportSpecCSV');
    
    this.refs.exportSpectrumPNG = document.getElementById('exportSpectrumPNG');
    this.refs.exportSpectrumSVG = document.getElementById('exportSpectrumSVG');
    this.refs.exportSpectrumHTML = document.getElementById('exportSpectrumHTML');
    this.refs.exportSpectrumCSV = document.getElementById('exportSpectrumCSV');
    
    this.refs.exportDistributionPNG = document.getElementById('exportDistributionPNG');
    this.refs.exportDistributionSVG = document.getElementById('exportDistributionSVG');
    this.refs.exportDistributionHTML = document.getElementById('exportDistributionHTML');
    this.refs.exportDistributionCSV = document.getElementById('exportDistributionCSV');
  }
  
  /**
   * Show viewer, hide empty state
   */
  showViewer() {
    this.refs.viewer.style.display = 'grid';
    this.refs.emptyState.style.display = 'none';
    
    if (this.refs.statsPanel) this.refs.statsPanel.style.display = 'block';
    if (this.refs.distributionPanel) this.refs.distributionPanel.style.display = 'block';
    if (this.refs.exportPanel) this.refs.exportPanel.style.display = 'block';
    if (this.refs.searchPanel) this.refs.searchPanel.style.display = 'block';
  }
  
  /**
   * Hide viewer, show empty state
   */
  showEmptyState() {
    this.refs.viewer.style.display = 'none';
    this.refs.emptyState.style.display = 'flex';
    
    if (this.refs.statsPanel) this.refs.statsPanel.style.display = 'none';
    if (this.refs.distributionPanel) this.refs.distributionPanel.style.display = 'none';
    if (this.refs.exportPanel) this.refs.exportPanel.style.display = 'none';
    if (this.refs.searchPanel) this.refs.searchPanel.style.display = 'none';
  }
  
  /**
   * Show message
   * @param {string} message - Message text
   * @param {string} type - Message type (success, error, info)
   */
  showMessage(message, type = 'info') {
    if (!this.refs.messageBox) return;
    
    const className = `mgf-message mgf-${type}`;
    this.refs.messageBox.innerHTML = `<div class="${className}">${this.escapeHtml(message)}</div>`;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.refs.messageBox.innerHTML = '';
    }, 5000);
  }
  
  /**
   * Clear message
   */
  clearMessage() {
    if (this.refs.messageBox) {
      this.refs.messageBox.innerHTML = '';
    }
  }
  
  /**
   * Escape HTML
   * @param {string} text
   * @returns {string}
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export to global window object for browser
if (typeof window !== 'undefined') {
  window.UIBuilder = UIBuilder;
}

// ========== src/viewer/components.js ==========
/**
 * Component Updaters
 * 
 * Efficient DOM update functions for viewer components
 * These functions update existing DOM elements without recreating them
 * 
 * Usage:
 *   ComponentUpdaters.updateSpectrumList(container, spectra, selectedIndex);
 *   ComponentUpdaters.updateMetadata(container, metadata);
 */

const ComponentUpdaters = {
  /**
   * Update spectrum list
   * Efficiently updates only what changed
   * @param {HTMLElement} container - Spectrum list container
   * @param {Array} spectra - Array of spectra
   * @param {number} selectedIndex - Currently selected spectrum index
   */
  updateSpectrumList(container, spectra, selectedIndex) {
    if (!container) return;
    
    // Get existing items
    const existingItems = container.querySelectorAll('.spectrum-item');
    
    // If count doesn't match, rebuild
    if (existingItems.length !== spectra.length) {
      this.rebuildSpectrumList(container, spectra, selectedIndex);
      return;
    }
    
    // Update existing items
    existingItems.forEach((item, index) => {
      const spectrum = spectra[index];
      const title = spectrum.metadata.TITLE || 'Untitled';
      const isActive = index === selectedIndex;
      
      // Update data attribute
      item.dataset.index = index;
      
      // Update classes
      if (isActive) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
      
      // Update content (only if changed)
      const numberDiv = item.querySelector('.number');
      const titleDiv = item.querySelector('.title');
      
      if (numberDiv && numberDiv.textContent !== `Spectrum ${index + 1}`) {
        numberDiv.textContent = `Spectrum ${index + 1}`;
      }
      
      if (titleDiv && titleDiv.textContent !== title) {
        titleDiv.textContent = title;
        titleDiv.title = title;
      }
    });
  },
  
  /**
   * Rebuild spectrum list (when count changes)
   * @param {HTMLElement} container - Spectrum list container
   * @param {Array} spectra - Array of spectra
   * @param {number} selectedIndex - Currently selected spectrum index
   */
  rebuildSpectrumList(container, spectra, selectedIndex) {
    container.innerHTML = '';
    
    spectra.forEach((spectrum, index) => {
      const item = document.createElement('div');
      item.className = 'spectrum-item';
      item.dataset.index = index;
      
      if (index === selectedIndex) {
        item.classList.add('active');
      }
      
      const title = spectrum.metadata.TITLE || 'Untitled';
      
      item.innerHTML = `
        <div class="number">Spectrum ${index + 1}</div>
        <div class="title" title="${this.escapeHtml(title)}">${this.escapeHtml(title)}</div>
      `;
      
      container.appendChild(item);
    });
  },
  
  /**
   * Update metadata panel
   * @param {HTMLElement} container - Metadata container
   * @param {Object} metadata - Spectrum metadata
   */
  updateMetadata(container, metadata) {
    if (!container) return;
    
    // Build metadata table
    let html = '<div style="margin-bottom: 30px;">';
    html += '<h3 style="font-size: 14px; font-weight: 600; color: #333; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #555555; padding-bottom: 8px;">Metadata</h3>';
    html += '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
    
    for (const [key, value] of Object.entries(metadata)) {
      if (key === 'TITLE') continue;
      
      let displayValue = value;
      if (typeof value === 'object') {
        displayValue = JSON.stringify(value);
      }
      
      html += `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; font-weight: 500; color: #555555; width: 150px;">${this.escapeHtml(key)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${this.escapeHtml(String(displayValue))}</td>
        </tr>
      `;
    }
    
    html += '</table></div>';
    
    // Find or create metadata section
    let metadataSection = container.querySelector('.metadata-section');
    if (!metadataSection) {
      metadataSection = document.createElement('div');
      metadataSection.className = 'metadata-section';
      container.appendChild(metadataSection);
    }
    
    metadataSection.innerHTML = html;
  },
  
  /**
   * Update peak table
   * @param {HTMLElement} container - Peak table container
   * @param {Array} peaks - Array of peaks
   */
  updatePeakTable(container, peaks) {
    if (!container) return;
    
    let html = '<div style="margin-bottom: 30px;">';
    html += `<h3 style="font-size: 14px; font-weight: 600; color: #333; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #555555; padding-bottom: 8px;">Peaks (${peaks.length} total)</h3>`;
    html += '<div style="max-height: 400px; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 4px;">';
    html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
    html += `
      <thead style="position: sticky; top: 0; background: #f5f5f5; z-index: 1;">
        <tr>
          <th style="padding: 10px 8px; text-align: right; color: #555555; font-weight: 600; border-bottom: 2px solid #ddd;">m/z</th>
          <th style="padding: 10px 8px; text-align: right; color: #555555; font-weight: 600; border-bottom: 2px solid #ddd;">Intensity</th>
        </tr>
      </thead>
      <tbody>
    `;
    
    peaks.forEach(peak => {
      html += `
        <tr style="border-bottom: 1px solid #e0e0e0;">
          <td style="padding: 8px; text-align: right;">${peak.mz.toFixed(4)}</td>
          <td style="padding: 8px; text-align: right;">${peak.intensity.toFixed(2)}</td>
        </tr>
      `;
    });
    
    html += '</tbody></table></div></div>';
    
    // Find or create peak table section
    let peakSection = container.querySelector('.peak-table-section');
    if (!peakSection) {
      peakSection = document.createElement('div');
      peakSection.className = 'peak-table-section';
      container.appendChild(peakSection);
    }
    
    peakSection.innerHTML = html;
  },
  
  /**
   * Update statistics panel
   * @param {HTMLElement} container - Statistics container
   * @param {Object} stats - Statistics object
   */
  updateStatistics(container, stats) {
    if (!container) return;
    
    let html = '';
    
    // Total spectra
    html += this.createStatCard('Total Spectra', stats.totalSpectra);
    
    // Total peaks
    html += this.createStatCard('Total Peaks', stats.totalPeaks.toLocaleString());
    
    // Avg peaks
    html += this.createStatCard('Avg Peaks/Spectrum', stats.avgPeaksPerSpectrum.toFixed(1));
    
    // Peak range
    html += this.createStatCard('Peak Range', `${stats.minPeaks} - ${stats.maxPeaks}`);
    
    // Mass range
    if (stats.massRange.min !== Infinity) {
      html += this.createStatCard('Mass Range (m/z)', 
        `${stats.massRange.min.toFixed(2)} - ${stats.massRange.max.toFixed(2)}`);
    }
    
    // RT range
    if (stats.rtRange.min !== Infinity) {
      const rtMinMin = (stats.rtRange.min / 60).toFixed(2);
      const rtMaxMin = (stats.rtRange.max / 60).toFixed(2);
      html += this.createStatCard('RT Range (min)', `${rtMinMin} - ${rtMaxMin}`);
    }
    
    // Charge states
    if (Object.keys(stats.charges).length > 0) {
      const chargeStr = Object.entries(stats.charges)
        .map(([charge, count]) => `${charge}+ (${count})`)
        .join(', ');
      html += this.createStatCard('Charge States', chargeStr);
    }
    
    container.innerHTML = html;
  },
  
  /**
   * Create stat card HTML
   * @param {string} label - Stat label
   * @param {string|number} value - Stat value
   * @returns {string} HTML
   */
  createStatCard(label, value) {
    return `
      <div style="background: white; padding: 15px; border-radius: 4px; border: 1px solid #e0e0e0;">
        <div style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">${label}</div>
        <div style="font-size: 18px; font-weight: 600; color: #333;">${value}</div>
      </div>
    `;
  },
  
  /**
   * Update spectrum title
   * @param {HTMLElement} container - Container for title
   * @param {string} title - Spectrum title
   */
  updateSpectrumTitle(container, title) {
    if (!container) return;
    
    let titleSection = container.querySelector('.spectrum-title-section');
    if (!titleSection) {
      titleSection = document.createElement('div');
      titleSection.className = 'spectrum-title-section';
      titleSection.style.cssText = 'margin-bottom: 30px;';
      container.insertBefore(titleSection, container.firstChild);
    }
    
    titleSection.innerHTML = `
      <h2 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">${this.escapeHtml(title)}</h2>
    `;
  },
  
  /**
   * Update filter results display
   * @param {HTMLElement} container - Filter results container
   * @param {number} matchCount - Number of matching spectra
   * @param {number} totalCount - Total number of spectra
   */
  updateFilterResults(container, matchCount, totalCount) {
    if (!container) return;
    
    if (matchCount === totalCount) {
      container.style.display = 'none';
      return;
    }
    
    container.style.display = 'block';
    container.textContent = `Showing ${matchCount} of ${totalCount} spectra`;
  },
  
  /**
   * Clear a container
   * @param {HTMLElement} container - Container to clear
   */
  clear(container) {
    if (container) {
      container.innerHTML = '';
    }
  },
  
  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Export to global window object for browser
if (typeof window !== 'undefined') {
  window.ComponentUpdaters = ComponentUpdaters;
}

// ========== src/viewer/plot.js ==========
/**
 * Plot
 * 
 * Interactive spectrum plot visualization using HTML5 Canvas
 * Supports zoom, pan, hover tooltips, and peak selection
 */

class SpectrumPlot {
  /**
   * Create a new spectrum plot
   * @param {string|Element} container - Container selector or element
   * @param {Object} options - Plot options
   */
  constructor(container, options = {}) {
    console.log('🎨 SpectrumPlot constructor called with container:', container);
    
    this.container = typeof container === 'string' 
      ? document.querySelector(container) 
      : container;

    if (!this.container) {
      throw new Error('Invalid container: element not found');
    }
    
    console.log('📦 Container element:', this.container);
    console.log('📏 Container size:', this.container.clientWidth, 'x', this.container.clientHeight);
    console.log('📏 Container style height:', this.container.style.height);

    // Configuration
    // Use container dimensions, but fall back to reasonable defaults
    const containerWidth = this.container.clientWidth || 800;
    const containerHeight = this.container.clientHeight || 400;
    
    console.log('📐 Using dimensions:', containerWidth, 'x', containerHeight);
    
    this.options = {
      width: options.width || containerWidth,
      height: options.height || containerHeight,
      padding: options.padding || { top: 40, right: 20, bottom: 50, left: 60 },
      backgroundColor: options.backgroundColor || '#fafafa',
      peakColor: options.peakColor || '#667eea',
      peakWidth: options.peakWidth || 2,
      gridColor: options.gridColor || '#e0e0e0',
      axisColor: options.axisColor || '#333',
      tooltipBgColor: options.tooltipBgColor || '#333',
      tooltipTextColor: options.tooltipTextColor || '#fff',
      ...options
    };
    
    console.log('⚙️  Plot options:', this.options);

    // State
    this.spectrum = null;
    this.peaks = [];
    this.canvas = null;
    this.ctx = null;
    this.zoomLevel = 1;
    this.panX = 0;
    this.panY = 0;
    this.selectedPeaks = [];
    this.hoveredPeak = null;

    // Event listeners
    this.listeners = {};

    // Initialize
    this.init();
  }

  /**
   * Initialize the plot
   */
  init() {
    console.log('⚙️  init() called');
    console.log('� Container:', this.container);
    console.log('📏 Container size: clientWidth=' + this.container.clientWidth + ', clientHeight=' + this.container.clientHeight);
    
    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.border = '1px solid #e0e0e0';
    this.canvas.style.borderRadius = '4px';
    this.canvas.style.cursor = 'crosshair';
    this.canvas.style.boxSizing = 'border-box';

    this.container.appendChild(this.canvas);
    console.log('📌 Canvas appended to container');
    
    this.ctx = this.canvas.getContext('2d');
    console.log('🖌️  2D context obtained');

    // Attach event listeners
    this.canvas.addEventListener('mousemove', e => this.handleMouseMove(e));
    this.canvas.addEventListener('mousedown', e => this.handleMouseDown(e));
    this.canvas.addEventListener('mouseup', e => this.handleMouseUp(e));
    this.canvas.addEventListener('wheel', e => this.handleWheel(e));
    this.canvas.addEventListener('click', e => this.handleClick(e));
    
    console.log('✅ init() complete');
  }

  /**
   * Set spectrum data
   * @param {Spectrum|Object} spectrum 
   */
  setSpectrum(spectrum) {
    console.log('📊 setSpectrum() called');
    
    this.spectrum = spectrum;
    this.peaks = spectrum.peaks || [];
    
    console.log('  Peaks loaded:', this.peaks.length);
    
    this.selectedPeaks = [];
    this.hoveredPeak = null;
    this.zoomLevel = 1;
    this.panX = 0;
    this.panY = 0;
    
    // Set canvas dimensions from container before drawing
    this.canvas.width = this.container.clientWidth;
    this.canvas.height = this.container.clientHeight;
    
    console.log('  Canvas dimensions set to:', this.canvas.width, 'x', this.canvas.height);
    console.log('✅ Drawing spectrum');
    
    this.draw();
    this.emit('spectrumSet', { spectrum });
  }

  /**
   * Draw the plot
   */
  draw() {
    const { ctx, canvas } = this;
    const { padding, backgroundColor } = this.options;

    if (!canvas || !ctx) {
      console.error('❌ Canvas or context not initialized!');
      return;
    }

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (this.peaks.length === 0) {
      this.drawEmptyState();
      return;
    }

    // Draw grid
    this.drawGrid();

    // Draw axes
    this.drawAxes();

    // Draw peaks
    this.drawPeaks();

    // Draw tooltip if hovered
    if (this.hoveredPeak !== null) {
      this.drawTooltip(this.hoveredPeak);
    }
  }

  /**
   * Draw empty state
   */
  drawEmptyState() {
    const { ctx, canvas } = this;
    const text = 'No peaks to display';

    ctx.fillStyle = '#999';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  }

  /**
   * Draw grid
   */
  drawGrid() {
    const { ctx, canvas } = this;
    const { padding, gridColor } = this.options;

    const plotWidth = canvas.width - padding.left - padding.right;
    const plotHeight = canvas.height - padding.top - padding.bottom;

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    // Vertical grid lines (m/z)
    const mzRange = this.getMzRange();
    const mzStep = this.calculateStep(mzRange.max - mzRange.min);
    
    for (let mz = Math.ceil(mzRange.min / mzStep) * mzStep; mz <= mzRange.max; mz += mzStep) {
      const x = padding.left + ((mz - mzRange.min) / (mzRange.max - mzRange.min)) * plotWidth;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, canvas.height - padding.bottom);
      ctx.stroke();
    }

    // Horizontal grid lines (intensity)
    const intensityRange = this.getIntensityRange();
    const intensityStep = this.calculateStep(intensityRange.max);
    
    for (let intensity = 0; intensity <= intensityRange.max; intensity += intensityStep) {
      const y = canvas.height - padding.bottom - (intensity / intensityRange.max) * plotHeight;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(canvas.width - padding.right, y);
      ctx.stroke();
    }
  }

  /**
   * Draw axes
   */
  drawAxes() {
    const { ctx, canvas } = this;
    const { padding, axisColor } = this.options;

    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 2;
    ctx.fillStyle = axisColor;
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // X-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, canvas.height - padding.bottom);
    ctx.lineTo(canvas.width - padding.right, canvas.height - padding.bottom);
    ctx.stroke();

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, canvas.height - padding.bottom);
    ctx.stroke();

    // X-axis labels (m/z)
    const mzRange = this.getMzRange();
    const mzStep = this.calculateStep(mzRange.max - mzRange.min);
    const plotWidth = canvas.width - padding.left - padding.right;

    for (let mz = Math.ceil(mzRange.min / mzStep) * mzStep; mz <= mzRange.max; mz += mzStep) {
      const x = padding.left + ((mz - mzRange.min) / (mzRange.max - mzRange.min)) * plotWidth;
      ctx.fillText(mz.toFixed(0), x, canvas.height - padding.bottom + 5);
    }

    // Y-axis label
    ctx.save();
    ctx.translate(15, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Intensity', 0, 0);
    ctx.restore();

    // X-axis label
    ctx.textAlign = 'center';
    ctx.fillText('m/z', canvas.width / 2, canvas.height - 10);
  }

  /**
   * Draw peaks
   */
  drawPeaks() {
    const { ctx, canvas } = this;
    const { padding, peakColor, peakWidth } = this.options;

    const mzRange = this.getMzRange();
    const intensityRange = this.getIntensityRange();
    const plotWidth = canvas.width - padding.left - padding.right;
    const plotHeight = canvas.height - padding.top - padding.bottom;

    ctx.strokeStyle = peakColor;
    ctx.lineWidth = peakWidth;

    this.peaks.forEach((peak, index) => {
      const x = padding.left + ((peak.mz - mzRange.min) / (mzRange.max - mzRange.min)) * plotWidth;
      const y = canvas.height - padding.bottom - (peak.intensity / intensityRange.max) * plotHeight;

      // Draw peak as vertical line
      ctx.beginPath();
      ctx.moveTo(x, canvas.height - padding.bottom);
      ctx.lineTo(x, y);
      ctx.stroke();

      // Highlight selected or hovered peaks
      if (this.selectedPeaks.includes(index) || this.hoveredPeak === index) {
        ctx.fillStyle = this.hoveredPeak === index ? '#ff6b6b' : '#ffd700';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  /**
   * Draw tooltip
   * @param {number} peakIndex 
   */
  drawTooltip(peakIndex) {
    const peak = this.peaks[peakIndex];
    if (!peak) return;

    const { ctx, canvas } = this;
    const { padding, tooltipBgColor, tooltipTextColor } = this.options;

    const mzRange = this.getMzRange();
    const intensityRange = this.getIntensityRange();
    const plotWidth = canvas.width - padding.left - padding.right;
    const plotHeight = canvas.height - padding.top - padding.bottom;

    const x = padding.left + ((peak.mz - mzRange.min) / (mzRange.max - mzRange.min)) * plotWidth;
    const y = canvas.height - padding.bottom - (peak.intensity / intensityRange.max) * plotHeight;

    const text = `m/z: ${peak.mz.toFixed(4)}\nIntensity: ${peak.intensity.toFixed(2)}`;
    const lines = text.split('\n');

    ctx.font = '12px Arial';
    ctx.fillStyle = tooltipBgColor;
    const width = 180;
    const height = 20 + lines.length * 15;
    const tooltipX = Math.min(x + 10, canvas.width - width - 10);
    const tooltipY = Math.max(y - height - 10, 5);

    ctx.fillRect(tooltipX, tooltipY, width, height);
    ctx.fillStyle = tooltipTextColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    lines.forEach((line, i) => {
      ctx.fillText(line, tooltipX + 10, tooltipY + 5 + i * 15);
    });
  }

  /**
   * Get m/z range
   * @returns {Object} {min, max}
   */
  getMzRange() {
    if (this.peaks.length === 0) {
      return { min: 0, max: 1000 };
    }

    const mzs = this.peaks.map(p => p.mz);
    return {
      min: Math.floor(Math.min(...mzs) - 50),
      max: Math.ceil(Math.max(...mzs) + 50)
    };
  }

  /**
   * Get intensity range
   * @returns {Object} {min, max}
   */
  getIntensityRange() {
    if (this.peaks.length === 0) {
      return { min: 0, max: 1000 };
    }

    const intensities = this.peaks.map(p => p.intensity);
    return {
      min: 0,
      max: Math.ceil(Math.max(...intensities) * 1.1)
    };
  }

  /**
   * Calculate step size for axis labels
   * @param {number} range 
   * @returns {number}
   */
  calculateStep(range) {
    const magnitude = Math.floor(Math.log10(range));
    const normalized = range / Math.pow(10, magnitude);

    let step = 1;
    if (normalized > 5) step = 5;
    else if (normalized > 2) step = 2;

    return step * Math.pow(10, magnitude);
  }

  /**
   * Handle mouse move
   * @param {MouseEvent} e 
   */
  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find nearest peak
    const peakIndex = this.findNearestPeak(x, y);
    
    if (peakIndex !== this.hoveredPeak) {
      this.hoveredPeak = peakIndex;
      this.draw();
      this.emit('peakHovered', { index: peakIndex, peak: this.peaks[peakIndex] || null });
    }
  }

  /**
   * Handle mouse down
   * @param {MouseEvent} e 
   */
  handleMouseDown(e) {
    this.isPanning = true;
    this.panStartX = e.clientX;
    this.panStartY = e.clientY;
  }

  /**
   * Handle mouse up
   */
  handleMouseUp() {
    this.isPanning = false;
  }

  /**
   * Handle wheel (zoom)
   * @param {WheelEvent} e 
   */
  handleWheel(e) {
    e.preventDefault();

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this.zoomLevel *= delta;
    this.zoomLevel = Math.max(1, Math.min(10, this.zoomLevel));

    this.draw();
    this.emit('zoomed', { zoomLevel: this.zoomLevel });
  }

  /**
   * Handle click
   * @param {MouseEvent} e 
   */
  handleClick(e) {
    if (this.hoveredPeak !== null) {
      const isSelected = this.selectedPeaks.includes(this.hoveredPeak);
      if (e.ctrlKey || e.metaKey) {
        // Toggle selection with Ctrl/Cmd
        if (isSelected) {
          this.selectedPeaks = this.selectedPeaks.filter(i => i !== this.hoveredPeak);
        } else {
          this.selectedPeaks.push(this.hoveredPeak);
        }
      } else {
        // Single selection
        this.selectedPeaks = [this.hoveredPeak];
      }

      this.draw();
      this.emit('peakSelected', {
        index: this.hoveredPeak,
        peak: this.peaks[this.hoveredPeak],
        selected: this.selectedPeaks
      });
    }
  }

  /**
   * Find nearest peak to coordinates
   * @param {number} x 
   * @param {number} y 
   * @returns {number|null} Peak index or null
   */
  findNearestPeak(x, y) {
    const { canvas } = this;
    const { padding } = this.options;

    const mzRange = this.getMzRange();
    const intensityRange = this.getIntensityRange();
    const plotWidth = canvas.width - padding.left - padding.right;
    const plotHeight = canvas.height - padding.top - padding.bottom;

    let nearest = null;
    let minDistance = 15; // Click tolerance in pixels

    this.peaks.forEach((peak, index) => {
      const peakX = padding.left + ((peak.mz - mzRange.min) / (mzRange.max - mzRange.min)) * plotWidth;
      const peakY = canvas.height - padding.bottom - (peak.intensity / intensityRange.max) * plotHeight;

      const distance = Math.sqrt((x - peakX) ** 2 + (y - peakY) ** 2);

      if (distance < minDistance) {
        minDistance = distance;
        nearest = index;
      }
    });

    return nearest;
  }

  /**
   * Reset view
   */
  resetView() {
    this.zoomLevel = 1;
    this.panX = 0;
    this.panY = 0;
    this.selectedPeaks = [];
    this.hoveredPeak = null;
    this.draw();
    this.emit('viewReset', {});
  }

  /**
   * Export as PNG
   * @returns {string} Data URL
   */
  exportPNG() {
    return this.canvas.toDataURL('image/png');
  }

  /**
   * Export as SVG
   * @returns {string} SVG string
   */
  exportSVG() {
    const { canvas } = this;
    let svg = `<svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect width="${canvas.width}" height="${canvas.height}" fill="${this.options.backgroundColor}"/>`;

    // Add peaks
    const { padding } = this.options;
    const mzRange = this.getMzRange();
    const intensityRange = this.getIntensityRange();
    const plotWidth = canvas.width - padding.left - padding.right;
    const plotHeight = canvas.height - padding.top - padding.bottom;

    this.peaks.forEach(peak => {
      const x = padding.left + ((peak.mz - mzRange.min) / (mzRange.max - mzRange.min)) * plotWidth;
      const y = canvas.height - padding.bottom - (peak.intensity / intensityRange.max) * plotHeight;

      svg += `<line x1="${x}" y1="${canvas.height - padding.bottom}" x2="${x}" y2="${y}" stroke="${this.options.peakColor}" stroke-width="${this.options.peakWidth}"/>`;
    });

    svg += '</svg>';
    return svg;
  }

  /**
   * Listen for events
   * @param {string} event 
   * @param {Function} callback 
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * Emit event
   * @param {string} event 
   * @param {Object} data 
   */
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  /**
   * Destroy plot
   */
  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}

// Export to global window object for browser
if (typeof window !== 'undefined') {
  window.SpectrumPlot = SpectrumPlot;
}

// ========== src/viewer/viewer.js ==========
/**
 * MGF Viewer
 * 
 * High-level API for loading, viewing, and interacting with MGF files
 * in the browser. Uses state-driven architecture for efficient updates.
 * 
 * Usage:
 *   const viewer = new MGFViewer('#container');
 *   await viewer.load('path/to/file.mgf');
 *   // or
 *   await viewer.load(fileInput.files[0]);
 *   // or
 *   await viewer.load(rawMGFString);
 *   // or
 *   await viewer.load([{metadata: {...}, peaks: [...]}]);
 */

class MGFViewer {
  constructor(container, options = {}) {
    // Container can be a selector string or DOM element
    this.containerElement = typeof container === 'string' 
      ? document.querySelector(container) 
      : container;

    if (!this.containerElement) {
      throw new Error('Invalid container: element not found');
    }

    // Initialize parser
    this.parser = new MGFParser();
    
    // Initialize state management (if ViewerState is available)
    if (typeof ViewerState !== 'undefined') {
      this.state = new ViewerState();
      this.usingNewArchitecture = true;
      
      // Setup state change listeners
      this.state.on('dataLoaded', (data) => {
        this.onDataLoaded(data);
      });
      
      this.state.on('spectrumSelected', (data) => {
        this.onSpectrumSelected(data);
      });
      
      // Initialize listeners for backward compatibility
      this.listeners = {};
    } else {
      // Fallback to old architecture
      this.usingNewArchitecture = false;
      this.currentSpectrumIndex = 0;
      this.spectra = [];
      this.metadata = {};
      this.listeners = {};
    }
    
    // Initialize UI builder (if available)
    if (typeof UIBuilder !== 'undefined' && this.usingNewArchitecture) {
      this.ui = new UIBuilder(this.containerElement, options);
      // Build UI once
      this.refs = this.ui.build();
      // Attach event handlers
      this.attachEventHandlers();
    } else {
      // Fallback: render empty state
      this.container = this.containerElement;
      this.renderEmpty();
    }
    
    // Plot instance (created lazily when needed)
    this.plot = null;
  }

  /**
   * Unified load method - accepts all input types
   * 
   * @param {string|File|Blob|Object|Array} input 
   *   - string: URL, file path, raw MGF string, or data URL
   *   - File/Blob: File object or Blob from input element
   *   - Object: {spectra: [...], metadata: {...}} or single spectrum
   *   - Array: Array of spectrum objects
   * 
   * @returns {Promise<void>}
   * @fires MGFViewer#loaded
   */
  async load(input) {
    try {
      if (this.usingNewArchitecture) {
        this.state.setLoading(true);
      } else {
        this.renderLoading();
      }
      
      // Use parser's unified load method
      const result = await this.parser.load(input);
      
      if (this.usingNewArchitecture) {
        // Load into state
        this.state.loadDataset(result.spectra || [], result.metadata || {});
      } else {
        // Old architecture
        this.spectra = result.spectra || [];
        this.metadata = result.metadata || {};
        this.currentSpectrumIndex = 0;

        // Trigger loaded event
        this.emit('loaded', {
          spectraCount: this.spectra.length,
          metadata: this.metadata
        });

        // Render UI
        if (this.spectra.length > 0) {
          this.render();
        } else {
          this.renderEmpty();
        }
      }

      return result;
    } catch (error) {
      if (this.usingNewArchitecture) {
        this.state.setError(error);
      } else {
        this.renderError(error.message);
        this.emit('error', { error: error.message });
      }
      throw error;
    }
  }

  /**
   * Load from URL
   * @param {string} url - URL to MGF file
   * @returns {Promise<void>}
   */
  async loadUrl(url) {
    return this.load(url);
  }

  /**
   * Load from File or Blob
   * @param {File|Blob} fileOrBlob 
   * @returns {Promise<void>}
   */
  async loadFile(fileOrBlob) {
    return this.load(fileOrBlob);
  }

  /**
   * Load from raw MGF string
   * @param {string} mgfString 
   * @returns {Promise<void>}
   */
  async loadString(mgfString) {
    return this.load(mgfString);
  }

  /**
   * Load from pre-parsed data
   * @param {Object|Array} data 
   * @returns {Promise<void>}
   */
  async loadData(data) {
    return this.load(data);
  }

  /**
   * Get current spectrum
   * @returns {Object} Current spectrum
   */
  getCurrentSpectrum() {
    if (this.usingNewArchitecture) {
      return this.state.getSelectedSpectrum();
    }
    return this.spectra[this.currentSpectrumIndex];
  }

  /**
   * Get spectrum by index
   * @param {number} index 
   * @returns {Object} Spectrum at index
   */
  getSpectrum(index) {
    if (this.usingNewArchitecture) {
      return this.state.get('spectra')[index];
    }
    return this.spectra[index];
  }

  /**
   * Get all spectra
   * @returns {Array} All spectra
   */
  getSpectra() {
    if (this.usingNewArchitecture) {
      return this.state.get('spectra');
    }
    return this.spectra;
  }

  /**
   * Get spectrum count
   * @returns {number}
   */
  getSpectrumCount() {
    if (this.usingNewArchitecture) {
      return this.state.get('spectra').length;
    }
    return this.spectra.length;
  }

  /**
   * Get file metadata
   * @returns {Object}
   */
  getMetadata() {
    if (this.usingNewArchitecture) {
      return this.state.get('metadata');
    }
    return this.metadata;
  }

  /**
   * Get statistics
   * @returns {Object}
   */
  getStatistics() {
    if (this.usingNewArchitecture) {
      return this.state.getStatistics();
    }
    return this.parser.getStatistics();
  }

  /**
   * Select spectrum by index
   * @param {number} index 
   * @returns {Object} Selected spectrum
   */
  selectSpectrum(index) {
    if (this.usingNewArchitecture) {
      this.state.selectSpectrum(index);
      return this.getCurrentSpectrum();
    } else {
      if (index < 0 || index >= this.spectra.length) {
        throw new Error(`Spectrum index ${index} out of range`);
      }
      this.currentSpectrumIndex = index;
      this.render();
      this.emit('spectrumChanged', { index, spectrum: this.getCurrentSpectrum() });
      return this.getCurrentSpectrum();
    }
  }

  /**
   * Go to next spectrum
   * @returns {Object} Next spectrum
   */
  next() {
    if (this.currentSpectrumIndex < this.spectra.length - 1) {
      return this.selectSpectrum(this.currentSpectrumIndex + 1);
    }
    return this.getCurrentSpectrum();
  }

  /**
   * Go to previous spectrum
   * @returns {Object} Previous spectrum
   */
  previous() {
    if (this.currentSpectrumIndex > 0) {
      return this.selectSpectrum(this.currentSpectrumIndex - 1);
    }
    return this.getCurrentSpectrum();
  }

  /**
   * Search spectra by title
   * @param {string} query 
   * @returns {Array} Matching spectra
   */
  searchByTitle(query) {
    return this.parser.searchByTitle(query);
  }

  /**
   * Filter by metadata
   * @param {string} key 
   * @param {*} value 
   * @returns {Array} Matching spectra
   */
  filterByMetadata(key, value) {
    return this.parser.filterByMetadata(key, value);
  }

  /**
   * Reset view
   */
  resetView() {
    this.currentSpectrumIndex = 0;
    this.render();
  }

  /**
   * Export current spectrum as JSON
   * @returns {string} JSON string
   */
  exportJSON() {
    const spectrum = this.getCurrentSpectrum();
    return JSON.stringify(spectrum, null, 2);
  }

  /**
   * Export current spectrum peaks as CSV
   * @returns {string} CSV string
   */
  exportCSV() {
    const spectrum = this.getCurrentSpectrum();
    let csv = 'm/z,Intensity\n';
    spectrum.peaks.forEach(peak => {
      csv += `${peak.mz},${peak.intensity}\n`;
    });
    return csv;
  }

  /**
   * Render the viewer UI
   */
  render() {
    if (this.spectra.length === 0) {
      this.renderEmpty();
      return;
    }

    const spectrum = this.getCurrentSpectrum();
    const html = this.buildSpectrumHTML(spectrum);
    this.container.innerHTML = html;

    // Attach event listeners
    this.attachEventListeners();

    this.emit('rendered', { index: this.currentSpectrumIndex });
  }

  /**
   * Render empty state
   */
  renderEmpty() {
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 400px; color: #999; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 20px;">📊</div>
        <h2 style="color: #333; margin-bottom: 10px;">No file loaded</h2>
        <p style="margin: 0;">Load an MGF file to begin viewing spectra</p>
      </div>
    `;
  }

  /**
   * Render loading state
   */
  renderLoading() {
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 400px; color: #667eea; text-align: center;">
        <div style="font-size: 32px; margin-bottom: 20px; animation: spin 1s linear infinite;">⌛</div>
        <p style="margin: 0; font-size: 16px;">Loading...</p>
      </div>
      <style>
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      </style>
    `;
  }

  /**
   * Render error state
   * @param {string} message 
   */
  renderError(message) {
    this.container.innerHTML = `
      <div style="background: #ffebee; border-left: 4px solid #f44336; color: #c62828; padding: 20px; border-radius: 4px; margin: 20px;">
        <h3 style="margin-top: 0; color: #d32f2f;">Error loading file</h3>
        <p style="margin: 10px 0 0 0; font-size: 14px;">${this.escapeHtml(message)}</p>
      </div>
    `;
  }

  /**
   * Build HTML for spectrum display
   * @param {Object} spectrum 
   * @returns {string} HTML
   */
  buildSpectrumHTML(spectrum) {
    let html = `
      <div class="mgf-viewer" style="display: grid; grid-template-columns: 250px 1fr; gap: 0; height: 100%; background: white;">
        <div class="spectrum-list" style="border-right: 1px solid #e0e0e0; overflow-y: auto; background: #fafafa;">
    `;

    // Spectrum list
    this.spectra.forEach((spec, index) => {
      const title = spec.metadata.TITLE || 'Untitled';
      const isActive = index === this.currentSpectrumIndex ? 'active' : '';
      const bgColor = isActive ? '#667eea' : 'transparent';
      const color = isActive ? 'white' : '#333';

      html += `
        <div class="spectrum-item" data-index="${index}" 
             style="padding: 15px; border-bottom: 1px solid #e0e0e0; cursor: pointer; 
                    background: ${bgColor}; color: ${color}; transition: all 0.2s;"
             onmouseover="this.style.background = '${isActive ? '#667eea' : '#f0f0f0'}'" 
             onmouseout="this.style.background = '${bgColor}'">
          <div style="font-weight: 600; font-size: 12px; opacity: 0.8;">Spectrum ${index + 1}</div>
          <div style="font-size: 12px; margin-top: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; title="${title}">${title}</div>
        </div>
      `;
    });

    html += `
        </div>
        <div class="spectrum-content" style="padding: 30px; overflow-y: auto;">
    `;

    // Spectrum detail
    if (spectrum.metadata.TITLE) {
      html += `
        <div style="margin-bottom: 30px;">
          <h2 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">${this.escapeHtml(spectrum.metadata.TITLE)}</h2>
        </div>
      `;
    }

    // Metadata
    if (Object.keys(spectrum.metadata).length > 0) {
      html += `
        <div style="margin-bottom: 30px;">
          <h3 style="font-size: 14px; font-weight: 600; color: #333; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #667eea; padding-bottom: 8px;">Metadata</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      `;

      for (const [key, value] of Object.entries(spectrum.metadata)) {
        if (key === 'TITLE') continue;
        
        let displayValue = value;
        if (typeof value === 'object') {
          displayValue = JSON.stringify(value);
        }

        html += `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; font-weight: 500; color: #667eea; width: 150px;">${this.escapeHtml(key)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${this.escapeHtml(String(displayValue))}</td>
          </tr>
        `;
      }

      html += `
          </table>
        </div>
      `;
    }

    // Peaks
    if (spectrum.peaks.length > 0) {
      html += `
        <div style="margin-bottom: 30px;">
          <h3 style="font-size: 14px; font-weight: 600; color: #333; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #667eea; padding-bottom: 8px;">Peaks (${spectrum.peaks.length} total)</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; max-height: 400px; overflow-y: auto;">
            <thead>
              <tr style="background: #f5f5f5; position: sticky; top: 0;">
                <th style="padding: 10px; text-align: left; font-weight: 600; color: #333; border-bottom: 2px solid #ddd;">m/z</th>
                <th style="padding: 10px; text-align: left; font-weight: 600; color: #333; border-bottom: 2px solid #ddd;">Intensity</th>
              </tr>
            </thead>
            <tbody>
      `;

      spectrum.peaks.forEach(peak => {
        html += `
          <tr style="border-bottom: 1px solid #e0e0e0;">
            <td style="padding: 8px 10px;">${peak.mz.toFixed(4)}</td>
            <td style="padding: 8px 10px;">${peak.intensity.toFixed(2)}</td>
          </tr>
        `;
      });

      html += `
            </tbody>
          </table>
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Attach event listeners to rendered elements
   */
  attachEventListeners() {
    const items = this.container.querySelectorAll('[data-index]');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.getAttribute('data-index'));
        this.selectSpectrum(index);
      });
    });
  }

  /**
   * Listen for events
   * @param {string} event 
   * @param {Function} callback 
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * Emit event
   * @param {string} event 
   * @param {Object} data 
   */
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

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
  }
  
  // ==========================================
  // New Architecture Methods
  // ==========================================
  
  /**
   * Attach event handlers to UI elements
   * Only used in new architecture
   */
  attachEventHandlers() {
    if (!this.refs) return;
    
    // Spectrum list click handler (event delegation)
    if (this.refs.spectrumList) {
      this.refs.spectrumList.addEventListener('click', (e) => {
        const item = e.target.closest('.spectrum-item');
        if (item) {
          const index = parseInt(item.dataset.index);
          if (!isNaN(index)) {
            this.selectSpectrum(index);
          }
        }
      });
    }
  }
  
  /**
   * Handle data loaded event
   * @param {Object} data - Event data
   */
  onDataLoaded(data) {
    if (!this.refs) return;
    
    // Show viewer, hide empty state
    this.ui.showViewer();
    
    // Update spectrum list
    if (typeof ComponentUpdaters !== 'undefined') {
      ComponentUpdaters.updateSpectrumList(
        this.refs.spectrumList,
        data.spectra,
        0
      );
      
      // Update statistics
      const stats = this.state.getStatistics();
      if (stats && this.refs.statsContent) {
        ComponentUpdaters.updateStatistics(this.refs.statsContent, stats);
      }
    }
    
    // Select first spectrum
    if (data.spectra.length > 0) {
      this.selectSpectrum(0);
    }
    
    // Emit event for backward compatibility
    this.emit('loaded', {
      spectraCount: data.spectra.length,
      metadata: data.metadata
    });
  }
  
  /**
   * Handle spectrum selected event
   * @param {Object} data - Event data
   */
  onSpectrumSelected(data) {
    if (!this.refs) return;
    
    const spectrum = data.spectrum;
    if (!spectrum) return;
    
    // Update spectrum list selection
    if (typeof ComponentUpdaters !== 'undefined') {
      ComponentUpdaters.updateSpectrumList(
        this.refs.spectrumList,
        this.state.get('spectra'),
        data.index
      );
      
      // Update spectrum details
      if (this.refs.spectrumDetails) {
        // Clear container
        this.refs.spectrumDetails.innerHTML = '';
        
        // Update title
        if (spectrum.metadata.TITLE) {
          ComponentUpdaters.updateSpectrumTitle(
            this.refs.spectrumDetails,
            spectrum.metadata.TITLE
          );
        }
        
        // Update metadata
        ComponentUpdaters.updateMetadata(
          this.refs.spectrumDetails,
          spectrum.metadata
        );
        
        // Update peak table
        ComponentUpdaters.updatePeakTable(
          this.refs.spectrumDetails,
          spectrum.peaks
        );
      }
      
      // Update plot (create if needed)
      if (this.refs.plotContainer) {
        if (!this.plot && typeof SpectrumPlot !== 'undefined') {
          this.plot = new SpectrumPlot(this.refs.plotContainer);
        }
        if (this.plot) {
          this.plot.setSpectrum(spectrum);
        }
      }
    }
    
    // Emit event for backward compatibility
    this.emit('spectrumChanged', { index: data.index, spectrum });
    this.emit('rendered', { index: data.index });
  }
}

// Export to global window object for browser
if (typeof window !== 'undefined') {
  window.MGFViewer = MGFViewer;
}

// ========== src/mgfview.js ==========
/**
 * MGFView.js
 * 
 * Main entry point for the MGFView.js library
 * Aggregates all components: Parser, Viewer, Spectrum, Plot, Utils
 * 
 * Usage:
 *   <script src="src/mgfview.js"></script>
 *   
 *   const viewer = new MGFViewer('#container');
 *   await viewer.load('path/to/file.mgf');
 */

// Namespace for the library
const MGFView = {
  version: '1.0.0',
  name: 'MGFView.js',

  /**
   * Create a new viewer instance
   * @param {string|Element} container 
   * @param {Object} options 
   * @returns {MGFViewer}
   */
  createViewer(container, options = {}) {
    if (typeof MGFViewer === 'undefined') {
      throw new Error('MGFViewer class not found. Include src/viewer.js');
    }
    return new MGFViewer(container, options);
  },

  /**
   * Create a new parser instance
   * @returns {MGFParser}
   */
  createParser() {
    if (typeof MGFParser === 'undefined') {
      throw new Error('MGFParser class not found. Include src/parser.js');
    }
    return new MGFParser();
  },

  /**
   * Create a new spectrum instance
   * @param {Object} data 
   * @returns {Spectrum}
   */
  createSpectrum(data = {}) {
    if (typeof Spectrum === 'undefined') {
      throw new Error('Spectrum class not found. Include src/spectrum.js');
    }
    return new Spectrum(data);
  },

  /**
   * Create a new plot instance
   * @param {string|Element} container 
   * @param {Object} options 
   * @returns {SpectrumPlot}
   */
  createPlot(container, options = {}) {
    if (typeof SpectrumPlot === 'undefined') {
      throw new Error('SpectrumPlot class not found. Include src/plot.js');
    }
    return new SpectrumPlot(container, options);
  },

  /**
   * Get utilities
   * @returns {Object}
   */
  getUtils() {
    if (typeof MGFUtils === 'undefined') {
      throw new Error('MGFUtils not found. Include src/utils.js');
    }
    return MGFUtils;
  },

  /**
   * Check if all components are loaded
   * @returns {Object} Component status
   */
  checkComponents() {
    return {
      MGFParser: typeof MGFParser !== 'undefined',
      MGFViewer: typeof MGFViewer !== 'undefined',
      Spectrum: typeof Spectrum !== 'undefined',
      SpectrumPlot: typeof SpectrumPlot !== 'undefined',
      MGFUtils: typeof MGFUtils !== 'undefined'
    };
  },

  /**
   * Get library version
   * @returns {string}
   */
  getVersion() {
    return this.version;
  },

  /**
   * Initialize example
   * @param {Object} options 
   * @returns {MGFViewer}
   */
  initExample(options = {}) {
    const container = options.container || '#mgf-viewer';
    const exampleFiles = options.exampleFiles || [
      'small.mgf',
      'medium.mgf.txt',
      'large.mgf'
    ];
    const examplePath = options.examplePath || './example/';

    try {
      const viewer = this.createViewer(container, options);
      
      // Store example files for later use
      viewer.exampleFiles = exampleFiles;
      viewer.examplePath = examplePath;

      return viewer;
    } catch (error) {
      console.error('Failed to initialize MGFView:', error);
      throw error;
    }
  }
};

// Export to global window object
if (typeof window !== 'undefined') {
  window.MGFView = MGFView;
}

// Define ASCII art
const loaderArt = `
===============================================================
 __  __   _____   ______ __      __ _                   
|  \\/  | / ____| |  ____|\ \\    / /(_)                  
| \\  / || |  __  | |__    \\ \\  / /  _   ___ __      __
| |\\/| || | |_ | |  __|    \\ \\/ /  | | / _ \\\\ \\ /\\ / /
| |  | || |__| | | |        \\  /   | ||  __/ \\ V  V /
|_|  |_| \\_____| |_|         \\/    |_| \\___|  \\_/\\_/

                        MGFView.js
        Client-side JavaScript MGF Spectrum Viewer
===============================================================

Version     : 1.0.0
Author      : Saurabh Gayali
License     : MIT
Website     : https://github.com/saurabhgayali/MGFView.js

Features
✓ 100% Client-side
✓ No dependencies
✓ Parse MGF files
✓ Interactive spectrum viewer
✓ Search & filter
✓ Export support

Ready.
===============================================================
`;

// Log library initialization and component status
if (typeof console !== 'undefined' && console.log) {
  console.log('%c' + loaderArt, 'color: #667eea; font-family: monospace; font-weight: bold;');
  
  // Check loaded components
  const components = {
    'Parser': typeof MGFParser !== 'undefined',
    'Viewer': typeof MGFViewer !== 'undefined',
    'Spectrum': typeof Spectrum !== 'undefined',
    'Plot': typeof SpectrumPlot !== 'undefined',
    'Search': typeof SearchFilter !== 'undefined',
    'Statistics': typeof StatisticsPanel !== 'undefined',
    'Export': typeof ExportManager !== 'undefined',
    'Utils': typeof MGFUtils !== 'undefined'
  };
  
  const loaded = Object.values(components).filter(v => v).length;
  const total = Object.keys(components).length;
  
  console.log(`%cComponents: ${loaded}/${total} loaded`, 
    `color: ${loaded === total ? '#4caf50' : '#ff9800'}; font-weight: bold;`);
  
  Object.entries(components).forEach(([name, loaded]) => {
    const status = loaded ? '✓' : '✗';
    const color = loaded ? '#4caf50' : '#f44336';
    console.log(`  %c${status} ${name}`, `color: ${color};`);
  });
  
  console.log('%cReady to use! https://github.com/saurabhgayali/MGFView.js', 'color: #667eea;');
}

})(typeof window !== 'undefined' ? window : global);

console.log('%c✓ MGFView.js Bundle Loaded', 'color: #4caf50; font-weight: bold; font-size: 12px;');
