/**
 * Store zone mapping utility for heatmap visualization
 * Maps product SKUs/categories to store zones and heat intensity
 */

export interface StoreZone {
  zoneId: string;
  zoneName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  displayX?: number;
  displayY?: number;
  scanCount: number;
  heatIntensity: number; // 0-1 scale
  color: string; // Generated from heat intensity
}

export interface ProductLocation {
  sku: string;
  zoneName: string;
  zoneId: string;
  category: string;
  articleType: string;
  scanCount?: number;
}

// Zone definitions for store layout
export const STORE_ZONES = {
  Z1: { name: 'Entrance - Accessories', color: '#E5D5C8', x: 1, y: 1, width: 2, height: 2 },
  Z2_T: { name: 'Men\'s Topwear', color: '#D4C5B9', x: 0, y: 3, width: 3, height: 3 },
  Z2_B: { name: 'Men\'s Bottomwear', color: '#D4C5B9', x: 3, y: 3, width: 2, height: 3 },
  Z3_T: { name: 'Women\'s Topwear', color: '#D4C5B9', x: 5, y: 3, width: 3, height: 3 },
  Z3_B: { name: 'Women\'s Bottomwear', color: '#D4C5B9', x: 8, y: 3, width: 2, height: 3 },
  Z4: { name: 'Kids & Teens', color: '#E5D5C8', x: 5, y: 0, width: 3, height: 2 },
  Z5: { name: 'Footwear', color: '#D4C5B9', x: 8, y: 0, width: 2, height: 2 },
  Z6: { name: 'Accessories & Bags', color: '#E5D5C8', x: 0, y: 0, width: 2, height: 2 },
};

/**
 * Get heatmap color gradient based on intensity (0-1)
 * Green (low) → Yellow (medium) → Orange → Red (high)
 */
export function getHeatColor(intensity: number): string {
  // Clamp between 0 and 1
  intensity = Math.max(0, Math.min(1, intensity));

  if (intensity < 0.25) {
    // Green to Yellow
    const t = intensity / 0.25;
    const r = Math.round(144 + (255 - 144) * t);
    const g = Math.round(238 + (255 - 238) * t);
    const b = Math.round(144 + (0 - 144) * t);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (intensity < 0.5) {
    // Yellow to Orange
    const t = (intensity - 0.25) / 0.25;
    const r = 255;
    const g = Math.round(255 - (255 - 165) * t);
    const b = 0;
    return `rgb(${r}, ${g}, ${b})`;
  } else if (intensity < 0.75) {
    // Orange to Red-Orange
    const t = (intensity - 0.5) / 0.25;
    const r = 255;
    const g = Math.round(165 - (165 - 69) * t);
    const b = Math.round(0 + (0 - 0) * t);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Red
    return `rgb(220, 20, 60)`; // Crimson for highest intensity
  }
}

/**
 * Calculate heat intensity as normalized percentage
 * Used to scale colors across zones
 */
export function calculateHeatIntensity(
  zoneCount: number,
  maxCount: number
): number {
  if (maxCount === 0) return 0;
  return zoneCount / maxCount;
}

/**
 * Group scan/request counts by zone
 * Input: array of items with zoneId
 * Output: map of zoneId -> count
 */
export function groupByZone(items: Array<{ zoneId?: string }>): Record<string, number> {
  const grouped: Record<string, number> = {};

  for (const item of items) {
    const zoneId = item.zoneId || 'Z0';
    grouped[zoneId] = (grouped[zoneId] || 0) + 1;
  }

  return grouped;
}

/**
 * Generate heatmap data for visualization
 * Takes scan counts per zone and returns styled zones
 */
export function generateHeatmapData(
  zoneScans: Record<string, number>
): Array<StoreZone & { color: string; intensity: number }> {
  const maxCount = Math.max(...Object.values(zoneScans), 1);

  return Object.entries(STORE_ZONES).map(([zoneId, zone]) => {
    const scanCount = zoneScans[zoneId] || 0;
    const intensity = calculateHeatIntensity(scanCount, maxCount);
    const color = getHeatColor(intensity);

    return {
      zoneId,
      zoneName: zone.name,
      x: zone.x,
      y: zone.y,
      width: zone.width,
      height: zone.height,
      scanCount,
      heatIntensity: intensity,
      color,
    };
  });
}

/**
 * Generate SVG heatmap for store layout
 * Returns SVG string ready to render
 */
export function generateSVGHeatmap(
  heatmapData: Array<StoreZone & { color: string; intensity: number }>,
  width: number = 800,
  height: number = 600
): string {
  const storeWidthUnits = 10;
  const storeHeightUnits = 6;
  const scaleX = width / storeWidthUnits;
  const scaleY = height / storeHeightUnits;

  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${storeWidthUnits} ${storeHeightUnits}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect width="${storeWidthUnits}" height="${storeHeightUnits}" fill="#F5F1ED"/>`; // Store background

  for (const zone of heatmapData) {
    const opacity = 0.3 + zone.heatIntensity * 0.7; // 30-100% opacity based on intensity
    svg += `<rect 
      x="${zone.x}" y="${zone.y}" 
      width="${zone.width}" height="${zone.height}" 
      fill="${zone.color}" 
      opacity="${opacity}" 
      stroke="#8C6A4B" 
      stroke-width="0.1"
    />`;
    
    // Add zone label
    svg += `<text 
      x="${zone.x + zone.width / 2}" y="${zone.y + zone.height / 2}" 
      text-anchor="middle" dominant-baseline="middle"
      font-size="0.3" fill="#1C1007" font-weight="bold"
    >${zone.zoneName}</text>`;

    // Add count badge
    if (zone.scanCount > 0) {
      svg += `<text 
        x="${zone.x + zone.width - 0.3}" y="${zone.y + 0.3}" 
        text-anchor="end" font-size="0.25" fill="#1C1007" font-weight="bold"
      >${zone.scanCount}</text>`;
    }
  }

  svg += '</svg>';
  return svg;
}

/**
 * Normalize product data and assign zones
 * Useful when receiving products without pre-computed zone data
 */
export function assignProductZone(product: {
  gender?: string;
  masterCategory?: string;
  subCategory?: string;
  category?: string;
  articleType?: string;
}): string {
  const category = product.masterCategory || product.category || '';
  const subCategory = product.subCategory || '';
  const articleType = product.articleType || '';
  const gender = product.gender || '';

  // Men's apparel
  if (gender === 'Men' && (category === 'Apparel' || subCategory === 'Topwear' || articleType.match(/shirt|tshirt|top|polo|sweater/i))) {
    return 'Z2_T';
  }
  if (gender === 'Men' && (subCategory === 'Bottomwear' || articleType.match(/jeans|pants|shorts/i))) {
    return 'Z2_B';
  }

  // Women's apparel
  if (gender === 'Women' && (category === 'Apparel' || subCategory === 'Topwear' || articleType.match(/shirt|tshirt|top|bra|tunic/i))) {
    return 'Z3_T';
  }
  if (gender === 'Women' && (subCategory === 'Bottomwear' || articleType.match(/jeans|pants|shorts|skirt/i))) {
    return 'Z3_B';
  }

  // Kids
  if ((gender === 'Boys' || gender === 'Girls') && category === 'Apparel') {
    return 'Z4';
  }

  // Footwear
  if (category === 'Footwear' || articleType.match(/shoes|flips|slippers|flip flops/i)) {
    return 'Z5';
  }

  // Accessories
  if (category === 'Accessories' || articleType.match(/watches|belts|bags|socks/i)) {
    return articleType.match(/watches|belts/i) ? 'Z1' : 'Z6';
  }

  return 'Z0'; // Default
}
