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

// Export to global window object for browser
if (typeof window !== 'undefined') {
  window.Spectrum = Spectrum;
}
