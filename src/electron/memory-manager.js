// MEMORY MANAGER - Prevents memory leaks and crashes
// Monitors and manages memory usage across the application

const os = require('os');
const { app } = require('electron');

class MemoryManager {
  constructor() {
    this.warningThreshold = 600; // MB (increased from 500 - less aggressive)
    this.criticalThreshold = 1200; // MB (increased from 1000 - more headroom)
    this.lastCleanup = Date.now();
    this.cleanupInterval = 600000; // 10 minutes (increased from 5 - less frequent cleanup)
    this.isMonitoring = false;
    this.callbacks = new Set();
  }

  startMonitoring() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // ARGUMENT: "Should we monitor constantly?"
    // ANSWER: "Yes, but optimized - every 60 seconds saves 50% CPU while still being proactive"
    this.monitorInterval = setInterval(() => {
      this.checkMemory();
    }, 60000); // Optimized from 30s to 60s for better performance

    // Initial check
    this.checkMemory();
    
    console.log('✅ Memory monitoring started');
  }

  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.isMonitoring = false;
    console.log('Memory monitoring stopped');
  }

  checkMemory() {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(usage.rss / 1024 / 1024);
    const externalMB = Math.round(usage.external / 1024 / 1024);
    
    // System memory
    const totalSystemMB = Math.round(os.totalmem() / 1024 / 1024);
    const freeSystemMB = Math.round(os.freemem() / 1024 / 1024);
    const usedSystemPercent = ((totalSystemMB - freeSystemMB) / totalSystemMB * 100).toFixed(1);

    const memoryInfo = {
      heap: heapUsedMB,
      heapTotal: heapTotalMB,
      rss: rssMB,
      external: externalMB,
      systemUsedPercent: usedSystemPercent,
      systemFree: freeSystemMB
    };

    // Log memory status
    console.log(`📊 Memory: Heap ${heapUsedMB}/${heapTotalMB}MB | RSS ${rssMB}MB | System ${usedSystemPercent}% used`);

    // ARGUMENT: "When should we clean up?"
    // ANSWER: "At warning level, not critical - be proactive"
    if (heapUsedMB > this.warningThreshold) {
      console.warn(`⚠️ High memory usage: ${heapUsedMB}MB`);
      this.performCleanup('warning');
    }

    if (heapUsedMB > this.criticalThreshold) {
      console.error(`🚨 CRITICAL memory usage: ${heapUsedMB}MB`);
      this.performCleanup('critical');
    }

    // Auto cleanup every 5 minutes regardless
    if (Date.now() - this.lastCleanup > this.cleanupInterval) {
      this.performCleanup('scheduled');
    }

    return memoryInfo;
  }

  performCleanup(reason = 'manual') {
    console.log(`🧹 Performing memory cleanup (${reason})...`);
    
    const before = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    
    // ARGUMENT: "Should we force garbage collection?"
    // ANSWER: "Yes if available, but don't rely on it"
    if (global.gc) {
      global.gc();
      console.log('Forced garbage collection');
    }

    // Notify all registered cleanup callbacks
    this.callbacks.forEach(callback => {
      try {
        callback(reason);
      } catch (error) {
        console.error('Cleanup callback error:', error);
      }
    });

    // Clear require cache for non-critical modules
    this.clearRequireCache();

    const after = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    const freed = before - after;
    
    console.log(`✅ Cleanup complete: Freed ${freed}MB (${before}MB → ${after}MB)`);
    
    this.lastCleanup = Date.now();
    
    return { before, after, freed };
  }

  clearRequireCache() {
    // ARGUMENT: "Should we clear require cache?"
    // ANSWER: "Only for safe modules, not core ones"
    const safeToDelete = [
      'axios',
      'node-cache',
      'multer'
    ];

    Object.keys(require.cache).forEach(key => {
      // Only clear non-critical modules
      if (safeToDelete.some(mod => key.includes(`node_modules/${mod}`))) {
        delete require.cache[key];
      }
    });
  }

  // Register cleanup callbacks
  onCleanup(callback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  // Get memory stats
  getStats() {
    const usage = process.memoryUsage();
    const system = {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem()
    };

    return {
      process: {
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        rss: usage.rss,
        external: usage.external,
        arrayBuffers: usage.arrayBuffers
      },
      system,
      uptime: process.uptime(),
      warnings: this.getWarnings()
    };
  }

  getWarnings() {
    const warnings = [];
    const heapUsedMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    
    if (heapUsedMB > this.criticalThreshold) {
      warnings.push({
        level: 'critical',
        message: `Memory usage critically high: ${heapUsedMB}MB`
      });
    } else if (heapUsedMB > this.warningThreshold) {
      warnings.push({
        level: 'warning', 
        message: `Memory usage high: ${heapUsedMB}MB`
      });
    }

    const freeSystemMB = Math.round(os.freemem() / 1024 / 1024);
    if (freeSystemMB < 500) {
      warnings.push({
        level: 'warning',
        message: `Low system memory: ${freeSystemMB}MB free`
      });
    }

    return warnings;
  }
}

// Singleton instance
const memoryManager = new MemoryManager();

// Auto-start monitoring
memoryManager.startMonitoring();

module.exports = memoryManager;