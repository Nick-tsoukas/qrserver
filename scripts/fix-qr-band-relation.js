'use strict';

/**
 * Fix QR Band Relation
 * 
 * This script directly updates the QR record to link it to a band.
 * Run with: node scripts/fix-qr-band-relation.js
 * 
 * For production, you'll need to run this against the production database
 * or use the Strapi admin API with proper authentication.
 */

const Strapi = require('@strapi/strapi');

async function main() {
  console.log('🚀 Starting QR band relation fix...\n');

  // Bootstrap Strapi
  const strapi = await Strapi().load();
  
  const QR_ID = 33;
  const BAND_ID = 5;

  try {
    // First, check current state
    const qr = await strapi.entityService.findOne('api::qr.qr', QR_ID, {
      populate: ['band'],
    });

    console.log(`📋 Current QR ${QR_ID} state:`);
    console.log(`   - Name: ${qr?.name || 'N/A'}`);
    console.log(`   - q_type: ${qr?.q_type || 'N/A'}`);
    console.log(`   - Band ID: ${qr?.band?.id || 'NULL'}`);

    if (qr?.band?.id === BAND_ID) {
      console.log('\n✅ Band relation is already correct!');
      await strapi.destroy();
      return;
    }

    // Update the QR with the band relation
    console.log(`\n🔧 Updating QR ${QR_ID} to link to Band ${BAND_ID}...`);
    
    const updated = await strapi.entityService.update('api::qr.qr', QR_ID, {
      data: {
        band: BAND_ID,
      },
      populate: ['band'],
    });

    console.log(`\n✅ Updated QR ${QR_ID}:`);
    console.log(`   - Band ID: ${updated?.band?.id || 'NULL'}`);
    console.log(`   - Band slug: ${updated?.band?.slug || 'N/A'}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  await strapi.destroy();
  console.log('\n🏁 Done!');
}

main();
