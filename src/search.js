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

// Export to global scope
if (typeof window !== 'undefined') {
    window.SearchFilter = SearchFilter;
}
