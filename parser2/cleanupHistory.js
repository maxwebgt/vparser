import { connectToDatabase, closeDatabaseConnection, isDatabaseConnected } from './modules/db.js';
import ProductModel from './modules/product.js';
import { log, setupLogger } from './modules/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup logger
setupLogger();

/**
 * Formats a date for display in reports
 * @param {Date} date - The date to format
 * @returns {string} - Formatted date string
 */
const formatDate = (date) => {
  return date instanceof Date 
    ? date.toISOString().replace('T', ' ').substring(0, 19)
    : 'Invalid Date';
};

/**
 * Cleans up price and availability history by removing entries where price is 0
 * and corresponding availability entries where quantity is 0
 */
async function cleanupPriceAndAvailabilityHistory() {
  try {
    log('Starting database cleanup process...', 'info');
    
    // Connect to database
    await connectToDatabase();
    
    if (!isDatabaseConnected()) {
      throw new Error('Failed to connect to database');
    }
    
    // Get all products
    const products = await ProductModel.find({});
    log(`Found ${products.length} products to process`, 'info');
    
    // Track detailed statistics for reporting
    let totalEntriesRemoved = 0;
    let productsUpdated = 0;
    
    // Create detailed report object
    const report = {
      timestamp: new Date(),
      totalProductsProcessed: products.length,
      productsUpdated: 0,
      totalEntriesRemoved: 0,
      details: []
    };
    
    // Process each product
    for (const product of products) {
      let productModified = false;
      let entriesRemoved = 0;
      
      // Create product report entry
      const productReport = {
        productId: product._id.toString(),
        productName: product.name || 'Unknown Product',
        priceEntriesRemoved: [],
        availabilityEntriesRemoved: [],
        competitors: []
      };
      
      // Map of dates to remove (as string keys for easy lookup)
      const datesToRemove = new Map();
      
      // First identify all price entries with 0 value
      const originalPriceCount = product.priceHistory.length;
      const removedPriceEntries = [];
      
      product.priceHistory = product.priceHistory.filter(entry => {
        if (entry.price === 0) {
          // Store this date for potentially removing corresponding availability entry
          const dateStr = entry.date.toISOString();
          datesToRemove.set(dateStr, true);
          
          // Add to removed entries for reporting
          removedPriceEntries.push({
            price: entry.price,
            date: entry.date,
            id: entry._id ? entry._id.toString() : 'unknown'
          });
          
          return false; // Remove this entry
        }
        return true; // Keep entries with non-zero prices
      });
      
      // Store removed price entries in report
      productReport.priceEntriesRemoved = removedPriceEntries.map(entry => ({
        id: entry.id,
        price: entry.price,
        date: formatDate(entry.date)
      }));
      
      // Count how many price entries were removed
      const priceEntriesRemoved = originalPriceCount - product.priceHistory.length;
      entriesRemoved += priceEntriesRemoved;
      
      if (priceEntriesRemoved > 0) {
        log(`Removed ${priceEntriesRemoved} price entries with value 0 from product ${product.name}`, 'info');
        productModified = true;
        
        // Now filter availability history to remove entries with same timestamp and quantity=0
        const originalAvailCount = product.availabilityHistory.length;
        const removedAvailEntries = [];
        
        product.availabilityHistory = product.availabilityHistory.filter(entry => {
          const dateStr = entry.date.toISOString();
          // Only remove if this date was marked for removal AND quantity is 0
          const shouldRemove = datesToRemove.has(dateStr) && entry.quantity === 0;
          
          if (shouldRemove) {
            removedAvailEntries.push({
              quantity: entry.quantity,
              date: entry.date,
              id: entry._id ? entry._id.toString() : 'unknown'
            });
          }
          
          return !shouldRemove;
        });
        
        // Store removed availability entries in report
        productReport.availabilityEntriesRemoved = removedAvailEntries.map(entry => ({
          id: entry.id,
          quantity: entry.quantity,
          date: formatDate(entry.date)
        }));
        
        const availEntriesRemoved = originalAvailCount - product.availabilityHistory.length;
        entriesRemoved += availEntriesRemoved;
        
        if (availEntriesRemoved > 0) {
          log(`Removed ${availEntriesRemoved} corresponding availability entries from product ${product.name}`, 'info');
        }
      }
      
      // Process competitors for this product
      if (product.competitors && product.competitors.length > 0) {
        for (let i = 0; i < product.competitors.length; i++) {
          const competitor = product.competitors[i];
          const competitorDateToRemove = new Map();
          
          // Prepare competitor report
          const competitorReport = {
            index: i,
            name: competitor.name || 'Unknown Competitor',
            priceEntriesRemoved: [],
            availabilityEntriesRemoved: []
          };
          
          // Filter competitor price history
          const originalCompPriceCount = competitor.priceHistory.length;
          const removedCompPriceEntries = [];
          
          competitor.priceHistory = competitor.priceHistory.filter(entry => {
            if (entry.price === 0) {
              const dateStr = entry.date.toISOString();
              competitorDateToRemove.set(dateStr, true);
              
              removedCompPriceEntries.push({
                price: entry.price,
                date: entry.date,
                id: entry._id ? entry._id.toString() : 'unknown'
              });
              
              return false;
            }
            return true;
          });
          
          // Store removed competitor price entries
          competitorReport.priceEntriesRemoved = removedCompPriceEntries.map(entry => ({
            id: entry.id,
            price: entry.price,
            date: formatDate(entry.date)
          }));
          
          const compPriceEntriesRemoved = originalCompPriceCount - competitor.priceHistory.length;
          entriesRemoved += compPriceEntriesRemoved;
          
          if (compPriceEntriesRemoved > 0) {
            log(`Removed ${compPriceEntriesRemoved} price entries with value 0 from competitor "${competitor.name}"`, 'info');
            productModified = true;
            
            // Filter competitor availability history
            const originalCompAvailCount = competitor.availabilityHistory.length;
            const removedCompAvailEntries = [];
            
            competitor.availabilityHistory = competitor.availabilityHistory.filter(entry => {
              const dateStr = entry.date.toISOString();
              const shouldRemove = competitorDateToRemove.has(dateStr) && entry.quantity === 0;
              
              if (shouldRemove) {
                removedCompAvailEntries.push({
                  quantity: entry.quantity,
                  date: entry.date,
                  id: entry._id ? entry._id.toString() : 'unknown'
                });
              }
              
              return !shouldRemove;
            });
            
            // Store removed competitor availability entries
            competitorReport.availabilityEntriesRemoved = removedCompAvailEntries.map(entry => ({
              id: entry.id,
              quantity: entry.quantity,
              date: formatDate(entry.date)
            }));
            
            const compAvailEntriesRemoved = originalCompAvailCount - competitor.availabilityHistory.length;
            entriesRemoved += compAvailEntriesRemoved;
            
            if (compAvailEntriesRemoved > 0) {
              log(`Removed ${compAvailEntriesRemoved} corresponding availability entries from competitor "${competitor.name}"`, 'info');
            }
          }
          
          // Only add competitor to report if entries were removed
          if (competitorReport.priceEntriesRemoved.length > 0 || 
              competitorReport.availabilityEntriesRemoved.length > 0) {
            productReport.competitors.push(competitorReport);
          }
        }
      }
      
      // Save product if modified
      if (productModified) {
        await product.save();
        productsUpdated++;
        totalEntriesRemoved += entriesRemoved;
        log(`Product "${product.name}" updated and saved`, 'success');
        
        // Only add to report if something was actually removed
        report.details.push(productReport);
      }
    }
    
    // Update report totals
    report.productsUpdated = productsUpdated;
    report.totalEntriesRemoved = totalEntriesRemoved;
    
    log(`Cleanup completed! Removed ${totalEntriesRemoved} entries from ${productsUpdated} products`, 'success');
    
    // Generate detailed report file
    const reportPath = path.join(__dirname, 'cleanup_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log(`Detailed report saved to: ${reportPath}`, 'info');
    
    // Print summary report to console
    printSummaryReport(report);
    
    // Close database connection
    await closeDatabaseConnection();
    
  } catch (error) {
    log(`Error in cleanup process: ${error.message}`, 'error');
    console.error(error);
    
    // Ensure DB connection is closed
    if (isDatabaseConnected()) {
      await closeDatabaseConnection();
    }
  }
}

/**
 * Prints a summary report of what was removed
 * @param {Object} report - The detailed report object
 */
function printSummaryReport(report) {
  console.log('\n');
  log('════════════════════════ CLEANUP SUMMARY ════════════════════════', 'info');
  log(`Timestamp: ${formatDate(report.timestamp)}`, 'info');
  log(`Total Products Processed: ${report.totalProductsProcessed}`, 'info');
  log(`Products Updated: ${report.productsUpdated}`, 'info');
  log(`Total Entries Removed: ${report.totalEntriesRemoved}`, 'info');
  log('────────────────────────────────────────────────────────────────', 'info');
  
  // Details for each modified product
  if (report.details.length > 0) {
    report.details.forEach(product => {
      const mainPriceCount = product.priceEntriesRemoved.length;
      const mainAvailCount = product.availabilityEntriesRemoved.length;
      
      // Calculate competitor stats
      let compPriceCount = 0;
      let compAvailCount = 0;
      product.competitors.forEach(comp => {
        compPriceCount += comp.priceEntriesRemoved.length;
        compAvailCount += comp.availabilityEntriesRemoved.length;
      });
      
      // Only show product details if something was removed
      if (mainPriceCount > 0 || mainAvailCount > 0 || compPriceCount > 0 || compAvailCount > 0) {
        log(`Product: ${product.productName} (${product.productId})`, 'info');
        
        if (mainPriceCount > 0) {
          log(`  • Removed ${mainPriceCount} price entries with value 0`, 'info');
          product.priceEntriesRemoved.forEach(entry => {
            log(`    - ${entry.date}: price = ${entry.price}`, 'debug');
          });
        }
        
        if (mainAvailCount > 0) {
          log(`  • Removed ${mainAvailCount} availability entries with quantity 0`, 'info');
          product.availabilityEntriesRemoved.forEach(entry => {
            log(`    - ${entry.date}: quantity = ${entry.quantity}`, 'debug');
          });
        }
        
        if (product.competitors.length > 0) {
          log(`  • Processed ${product.competitors.length} competitors:`, 'info');
          
          product.competitors.forEach(comp => {
            const compName = comp.name || `Competitor #${comp.index}`;
            log(`    ◦ ${compName}:`, 'info');
            
            if (comp.priceEntriesRemoved.length > 0) {
              log(`      - Removed ${comp.priceEntriesRemoved.length} price entries`, 'info');
            }
            
            if (comp.availabilityEntriesRemoved.length > 0) {
              log(`      - Removed ${comp.availabilityEntriesRemoved.length} availability entries`, 'info');
            }
          });
        }
        
        log('────────────────────────────────────────────────────────────────', 'info');
      }
    });
  } else {
    log('No invalid entries found that needed removal', 'info');
  }
  
  log('═══════════════════ END OF CLEANUP SUMMARY ═══════════════════', 'info');
  console.log('\n');
}

// Run the cleanup function
cleanupPriceAndAvailabilityHistory().then(() => {
  log('Cleanup script execution completed', 'info');
}).catch(error => {
  log(`Fatal error: ${error.message}`, 'error');
  process.exit(1);
});
