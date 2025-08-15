import mongoose from 'mongoose';
import { config } from '@/config';
import { TaxRate } from '@/models';

async function updateTaxRates() {
  try {
    await mongoose.connect(config.database.url, {
      dbName: config.database.name
    });

    console.log('Connected to database for tax rate update');

    // Here you would implement logic to:
    // 1. Fetch latest tax rates from Avalara/TaxJar APIs
    // 2. Compare with existing rates
    // 3. Update changed rates
    // 4. Mark old rates as inactive

    console.log('Tax rate update completed');
  } catch (error) {
    console.error('Error updating tax rates:', error);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  updateTaxRates();
}

export { updateTaxRates };