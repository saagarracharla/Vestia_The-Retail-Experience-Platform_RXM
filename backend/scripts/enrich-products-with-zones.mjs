/**
 * Enriches product catalog with store zone/location data
 * Maps product categories to logical retail zones with coordinates
 * Output: {productId, name, ..., zoneId, zoneName, zoneCoordinates}
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Store layout zones - typical retail configuration
// Coordinates are normalized (0-10 scale for flexibility)
const ZONE_MAP = {
  // Entrance area - impulse buys
  entrance_accessories: {
    zoneId: 'Z1',
    zoneName: 'Entrance - Accessories & Watches',
    x: 1,
    y: 1,
    width: 2,
    height: 2,
    categories: ['Accessories/Watches', 'Accessories/Belts'],
  },
  // Men's apparel - main floor
  mens_topwear: {
    zoneId: 'Z2_T',
    zoneName: 'Men\'s Topwear',
    x: 0,
    y: 3,
    width: 3,
    height: 3,
    categories: ['Apparel/Topwear'],
    genders: ['Men'],
    articleTypes: ['Shirts', 'Tshirts', 'Tops', 'Polos', 'Sweaters'],
  },
  mens_bottomwear: {
    zoneId: 'Z2_B',
    zoneName: 'Men\'s Bottomwear',
    x: 3,
    y: 3,
    width: 2,
    height: 3,
    categories: ['Apparel/Bottomwear'],
    genders: ['Men'],
  },
  womens_topwear: {
    zoneId: 'Z3_T',
    zoneName: 'Women\'s Topwear',
    x: 5,
    y: 3,
    width: 3,
    height: 3,
    categories: ['Apparel/Topwear'],
    genders: ['Women'],
    articleTypes: ['Shirts', 'Tshirts', 'Tops', 'Tunics', 'Bra'],
  },
  womens_bottomwear: {
    zoneId: 'Z3_B',
    zoneName: 'Women\'s Bottomwear',
    x: 8,
    y: 3,
    width: 2,
    height: 3,
    categories: ['Apparel/Bottomwear'],
    genders: ['Women'],
  },
  // Kids area
  kids_apparel: {
    zoneId: 'Z4',
    zoneName: 'Kids & Teens',
    x: 5,
    y: 0,
    width: 3,
    height: 2,
    categories: ['Apparel/Topwear', 'Apparel/Bottomwear'],
    genders: ['Boys', 'Girls'],
  },
  // Footwear - usually separate section
  footwear: {
    zoneId: 'Z5',
    zoneName: 'Footwear',
    x: 8,
    y: 0,
    width: 2,
    height: 2,
    categories: ['Footwear/Shoes', 'Footwear/Flip Flops'],
  },
  // Accessories & bags
  accessories_main: {
    zoneId: 'Z6',
    zoneName: 'Accessories & Bags',
    x: 0,
    y: 0,
    width: 2,
    height: 2,
    categories: ['Accessories/Bags', 'Accessories/Socks', 'Accessories/Watches'],
  },
};

function assignZone(product) {
  const category = `${product.masterCategory || product.category}/${product.subCategory || product.articleType}`;
  const gender = product.gender;
  const articleType = product.articleType;

  // Try to find matching zone with all criteria
  for (const [key, zone] of Object.entries(ZONE_MAP)) {
    const categoryMatch = zone.categories.some(c => category.includes(c));
    const genderMatch = !zone.genders || zone.genders.includes(gender);
    const typeMatch = !zone.articleTypes || zone.articleTypes.includes(articleType);

    if (categoryMatch && genderMatch && typeMatch) {
      return {
        zoneId: zone.zoneId,
        zoneName: zone.zoneName,
        zoneX: zone.x,
        zoneY: zone.y,
        zoneWidth: zone.width,
        zoneHeight: zone.height,
        // Add some randomness within the zone for visual scatter
        displayX: zone.x + Math.random() * (zone.width - 0.5),
        displayY: zone.y + Math.random() * (zone.height - 0.5),
      };
    }
  }

  // Default fallback
  return {
    zoneId: 'Z0',
    zoneName: 'General',
    zoneX: 5,
    zoneY: 5,
    zoneWidth: 2,
    zoneHeight: 2,
    displayX: 5,
    displayY: 5,
  };
}

async function enrichProducts(inputFile, outputFile) {
  try {
    const data = fs.readFileSync(inputFile, 'utf-8');
    const lines = data.split('\n');
    const headers = lines[0].split(',');
    
    const enrichedLines = [
      headers.join(',') + ',zoneId,zoneName,zoneX,zoneY,zoneWidth,zoneHeight,displayX,displayY',
    ];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const values = lines[i].split(',');
      const product = {};
      headers.forEach((h, idx) => {
        product[h.trim()] = values[idx]?.trim();
      });

      const zone = assignZone(product);
      const enrichedLine = [
        lines[i],
        zone.zoneId,
        `"${zone.zoneName}"`,
        zone.zoneX,
        zone.zoneY,
        zone.zoneWidth,
        zone.zoneHeight,
        zone.displayX,
        zone.displayY,
      ].join(',');

      enrichedLines.push(enrichedLine);
    }

    fs.writeFileSync(outputFile, enrichedLines.join('\n'));
    console.log(`✓ Enriched ${enrichedLines.length - 1} products`);
    console.log(`✓ Output: ${outputFile}`);
  } catch (error) {
    console.error('Error enriching products:', error);
  }
}

// Run enrichment
const inputPath = path.join(__dirname, '../context/product_catalog_normalized_again.csv');
const outputPath = path.join(__dirname, '../context/product_catalog_with_zones.csv');

enrichProducts(inputPath, outputPath);
