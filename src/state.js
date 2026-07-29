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

// Export to global window object for browser
if (typeof window !== 'undefined') {
  window.ViewerState = ViewerState;
}
