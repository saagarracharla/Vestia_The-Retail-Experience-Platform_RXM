const API_BASE_URL = "https://993toyh3x5.execute-api.ca-central-1.amazonaws.com";
const IMAGE_BASE_URL = "https://vestia-product-images.s3.ca-central-1.amazonaws.com/full/";

// Helper to construct image URL from SKU
function getImageUrl(sku: string): string {
  return `${IMAGE_BASE_URL}${sku}.jpg`;
}

// Customer profile types
export interface PurchaseRecord {
  productId: string;
  name: string;
  articleType: string;
  color: string;
  price: number;
  purchasedAt: string;
}

export interface CustomerProfile {
  customerId: string;
  gender?: string;
  preferredSizes?: Record<string, string>; // { top: "M", bottom: "32", shoes: "10" }
  preferredColors?: string[];
  preferredStyles?: string[];
  purchaseHistory?: PurchaseRecord[];
  visitCount?: number;
  lastVisitAt?: string;
  createdAt?: string;
  updatedAt?: string;
  // Derived from purchase history by the Lambda
  derivedStyle?: {
    topColors: string[];       // most-bought colors
    topArticles: string[];     // most-bought article types
    avgPrice: number;          // average purchase price
    dominantStyle: string;     // casual / formal / sports / ethnic
  };
}

export interface SessionPreferences {
  preferredSizes?: Record<string, string>;
  preferredColors?: string[];
  preferredStyles?: string[];
}

// Types based on AWS Lambda responses
export interface RecommendationItem {
  productId: string;
  name: string;
  category: string;
  articleType: string;
  color: string;
  price: number;
  score: number;
  imageUrl?: string;
}

export interface OutfitResult {
  outfit: Record<string, RecommendationItem[]>; // category → top-2 recommendations
  baseProductIds: string[];
}

export interface SavedOutfitItem {
  productId: string;
  name: string;
  category: string;
  color: string;
  price: number;
  imageUrl?: string;
  source: "room" | "recommended";
}

export interface SavedOutfit {
  outfitId: string;
  shareCode: string;
  sessionId?: string;
  customerId?: string;
  items: SavedOutfitItem[];
  createdAt: string;
}

export interface AnalyticsData {
  period: { days: number; from: string; to: string };
  totalSessions: number;
  totalScans: number;
  totalRequests: number;
  avgItemsPerSession: number;
  avgSessionDurationSeconds: number;
  avgFulfillmentSeconds: number;
  avgRequestToPickupSeconds: number;
  avgPickupToDeliverySeconds: number;
  requestToPickupCount: number;
  pickupToDeliveryCount: number;
  requestFulfillmentRate: number;
  requestStatusBreakdown: Record<string, number>;
  topItems: { sku: string; count: number }[];
  topSizes: { size: string; count: number }[];
  topColors: { color: string; count: number }[];
  // All individual scans with zone data (for heatmap)
  allScans?: Array<{
    sku: string;
    zoneId: string;
    sessionId?: string;
    createdAt?: string;
    productName?: string;
  }>;
}

// Types for normalized event schema
export interface SessionItem {
  // SCAN event fields
  entityType: "SCAN" | "REQUEST";
  sku: string;
  createdAt: string;
  
  // REQUEST event fields (only present if entityType === "REQUEST")
  requestId?: string;
  sessionId?: string;
  storeId?: string;
  kioskId?: string;
  requestType?: "size_change" | "color_change" | "size_color_change" | "general";
  requestedSize?: string | null;
  requestedColor?: string | null;
  status?: "QUEUED" | "CLAIMED" | "DELIVERED" | "CANCELLED";
  updatedAt?: string;
  
  // Source field for SCAN events
  source?: string;
}

// Product metadata (separate from session events)
export interface ProductData {
  productId: string;
  name: string;
  category: string;
  articleType: string;
  color: string;
  price: number;
  gender: string;
  season?: string;
  usage?: string;
  imageUrl?: string; // Dynamically constructed from SKU
}

// Combined type for UI rendering
export interface ItemWithProduct extends SessionItem {
  product?: ProductData;
  derivedSize?: string | null;
  derivedColor?: string | null;
  isDelivered?: boolean;
}

export interface SessionData {
  sessionId: string;
  items: SessionItem[];
}

// API Client
export class VestiaAPI {
  private static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Only log unexpected errors — not 404s which are handled by callers
      if (response.status !== 404) {
        console.error(`API Error: ${response.status} ${response.statusText}`, errorText);
      }
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  }

  // Product API
  static async getProduct(sku: string): Promise<ProductData> {
    const product = await this.request<ProductData>(`/product/${sku}`);
    return {
      ...product,
      imageUrl: getImageUrl(sku)
    };
  }
  static async getRecommendations(
    productId: string,
    targetCategory: "top" | "bottom" | "shoes" | "accessory",
    gender?: string,
    sessionId?: string,
    customerId?: string,
    sessionPreferences?: SessionPreferences
  ): Promise<RecommendationItem[]> {
    const payload: Record<string, unknown> = { productId, targetCategory };
    if (gender) payload.gender = gender;
    if (sessionId) payload.sessionId = sessionId;
    if (customerId) payload.customerId = customerId;
    if (sessionPreferences) payload.sessionPreferences = sessionPreferences;

    const recommendations = await this.request<RecommendationItem[]>("/recommend", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return recommendations.map(rec => ({
      ...rec,
      imageUrl: getImageUrl(rec.productId),
    }));
  }

  static async getOutfitRecommendations(
    productIds: string[],
    sessionId?: string,
    customerId?: string,
    sessionPreferences?: SessionPreferences
  ): Promise<OutfitResult> {
    const payload: Record<string, unknown> = { productIds };
    if (sessionId) payload.sessionId = sessionId;
    if (customerId) payload.customerId = customerId;
    if (sessionPreferences) payload.sessionPreferences = sessionPreferences;

    const result = await this.request<OutfitResult>("/recommend", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // Attach image URLs to each recommendation
    const outfit: Record<string, RecommendationItem[]> = {};
    for (const [cat, items] of Object.entries(result.outfit)) {
      outfit[cat] = items.map(item => ({ ...item, imageUrl: getImageUrl(item.productId) }));
    }
    return { outfit, baseProductIds: result.baseProductIds };
  }

  // Outfit Save & Share API
  static async saveOutfit(data: {
    sessionId?: string;
    customerId?: string;
    items: SavedOutfitItem[];
  }): Promise<{ outfitId: string; shareCode: string }> {
    return this.request<{ outfitId: string; shareCode: string }>("/outfit", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  static async getOutfit(shareCode: string): Promise<SavedOutfit> {
    return this.request<SavedOutfit>(`/outfit/${shareCode}`);
  }

  // Customer Profile API
  static async getCustomerProfile(customerId: string): Promise<CustomerProfile | null> {
    // Use direct fetch so 404 (new customer) doesn't log a console error
    const url = `${API_BASE_URL}/customer/${encodeURIComponent(customerId)}`;
    const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to fetch profile: ${res.status}`);
    return res.json();
  }

  static async upsertCustomerProfile(customerId: string, updates: Partial<CustomerProfile> & { incrementVisit?: boolean }): Promise<CustomerProfile> {
    const result = await this.request<{ profile: CustomerProfile }>(`/customer/${customerId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    return result.profile;
  }

  // Session Preferences API
  static async saveSessionPreferences(sessionId: string, prefs: SessionPreferences): Promise<void> {
    await this.request<void>("/session/preferences", {
      method: "POST",
      body: JSON.stringify({ sessionId, ...prefs }),
    });
  }

  static async getAnalytics(days = 30): Promise<AnalyticsData> {
    return this.request<AnalyticsData>(`/analytics?days=${days}`);
  }

  static async submitSessionFeedback(sessionId: string, feedback: {
    overallRating?: number;
    overallComment?: string;
    itemFeedback?: object[];
    experienceRating?: number;
    experienceComment?: string;
    wouldReturn?: boolean;
  }): Promise<{ feedbackId: string }> {
    return this.request<{ feedbackId: string }>("/session/feedback", {
      method: "POST",
      body: JSON.stringify({ sessionId, ...feedback }),
    });
  }

  // Session API
  static async getSession(sessionId: string): Promise<SessionData> {
    return this.request<SessionData>(`/session/${sessionId}`);
  }

  static async scanItem(sessionId: string, sku: string, kioskId: string): Promise<void> {
    return this.request<void>("/session/scan", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        sku,
        kioskId,
      }),
    });
  }

  // Request API
  static async createRequest(request: {
    sessionId: string;
    sku: string;
    requestedSize?: string;
    requestedColor?: string;
  }): Promise<{ requestId: string }> {
    return this.request<{ requestId: string }>("/request", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  static async updateRequest(requestId: string, updates: {
    status?: string;
    action?: string;
  }): Promise<void> {
    return this.request<void>(`/request/${requestId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  static async cancelRequest(requestId: string): Promise<void> {
    await this.updateRequest(requestId, { status: "CANCELLED" });
  }

  static async pickupRequest(requestId: string): Promise<void> {
    await this.updateRequest(requestId, { status: "CLAIMED" });
  }

  static async deliverRequest(requestId: string): Promise<void> {
    await this.updateRequest(requestId, { action: "delivered" });
  }

  static async claimRequest(requestId: string, employeeId: string): Promise<void> {
    return this.request<void>(`/request/${requestId}/claim`, {
      method: "PATCH",
      body: JSON.stringify({ employeeId }),
    });
  }

  static async getStoreRequests(storeId: string): Promise<any[]> {
    return this.request<any[]>(`/store/${storeId}/request`);
  }

  // Helper to get session with product data
  static async getSessionWithProducts(sessionId: string): Promise<ItemWithProduct[]> {
    const sessionData = await this.getSession(sessionId);
    
    // Filter to only SCAN events and sort by createdAt ASC
    const scanEvents = sessionData.items
      .filter(item => item.entityType === "SCAN")
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    // Get all REQUEST events for attribute derivation
    const requestEvents = sessionData.items
      .filter(item => item.entityType === "REQUEST" && item.status === "DELIVERED");
    
    const uniqueSkus = [...new Set(scanEvents.map(item => item.sku))];
    
    const productPromises = uniqueSkus.map(sku => 
      this.getProduct(sku).catch(err => {
        console.error(`Failed to fetch product ${sku}:`, err);
        return null;
      })
    );
    
    const products = await Promise.all(productPromises);
    const productMap = new Map<string, ProductData>();
    
    products.forEach((product, index) => {
      if (product) {
        productMap.set(uniqueSkus[index], product);
      }
    });
    
    return scanEvents.map(scanItem => {
      // Find matching delivered request for this SCAN
      const matchingRequest = requestEvents.find(req => 
        req.sessionId === scanItem.sessionId &&
        req.sku === scanItem.sku &&
        new Date(req.createdAt).getTime() <= new Date(scanItem.createdAt).getTime()
      );
      
      return {
        ...scanItem,
        product: productMap.get(scanItem.sku),
        // Add derived attributes from matching request
        derivedSize: matchingRequest?.requestedSize || null,
        derivedColor: matchingRequest?.requestedColor || null,
        isDelivered: scanItem.source === "staff"
      };
    });
  }

  // Helper to infer session gender from first scanned item
  static async getSessionGender(sessionId: string): Promise<string | null> {
    try {
      const sessionData = await this.getSession(sessionId);
      
      // Find the first SCAN event (earliest timestamp)
      const firstScan = sessionData.items
        .filter(item => item.entityType === "SCAN")
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
      
      if (!firstScan) return null;
      
      // Get product metadata for the first scanned item
      const product = await this.getProduct(firstScan.sku);
      return product.gender || null;
    } catch (err) {
      console.error("Failed to infer session gender:", err);
      return null;
    }
  }

  // Helper to get all session events with product data (for admin/analytics)
  static async getAllSessionEventsWithProducts(sessionId: string): Promise<ItemWithProduct[]> {
    const sessionData = await this.getSession(sessionId);
    const uniqueSkus = [...new Set(sessionData.items.map(item => item.sku))];
    
    const productPromises = uniqueSkus.map(sku => 
      this.getProduct(sku).catch(err => {
        console.error(`Failed to fetch product ${sku}:`, err);
        return null;
      })
    );
    
    const products = await Promise.all(productPromises);
    const productMap = new Map<string, ProductData>();
    
    products.forEach((product, index) => {
      if (product) {
        productMap.set(uniqueSkus[index], product);
      }
    });
    
    return sessionData.items.map(item => ({
      ...item,
      product: productMap.get(item.sku)
    }));
  }
}
