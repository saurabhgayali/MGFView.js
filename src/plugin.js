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

// Export to global scope
if (typeof window !== 'undefined') {
    window.Plugin = Plugin;
    window.PluginSystem = PluginSystem;
    window.MirrorPlotPlugin = MirrorPlotPlugin;
    window.SimilarityPlugin = SimilarityPlugin;
    window.AnnotationPlugin = AnnotationPlugin;
    window.ComparisonPlugin = ComparisonPlugin;
}
