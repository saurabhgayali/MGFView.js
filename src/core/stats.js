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
            const binIndex = Math.floor((value - min) / binSize);
            const index = Math.min(binIndex, numBins - 1);
            bins[index].count++;
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
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StatisticsPanel;
}
