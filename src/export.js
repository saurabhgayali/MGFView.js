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

// Export to global scope
if (typeof window !== 'undefined') {
    window.ExportManager = ExportManager;
}
