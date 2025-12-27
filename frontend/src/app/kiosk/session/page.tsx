"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Modal from "@/components/Modal";
import SessionTimer from "@/components/SessionTimer";
import Notification from "@/components/Notification";
import { VestiaAPI, RecommendationItem, ItemWithProduct } from "@/lib/api";

type Item = ItemWithProduct;

type CategoryFilter = "top" | "bottom" | "shoes" | "accessory" | "all";

export default function SessionKioskPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [sku, setSku] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [selectedMainIndex, setSelectedMainIndex] = useState<number>(-1);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  // Modal states
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [requestedSize, setRequestedSize] = useState("");
  const [requestedColor, setRequestedColor] = useState("");
  const [feedbackRating, setFeedbackRating] = useState("5");
  const [feedbackComment, setFeedbackComment] = useState("");

  // Notification state
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [pendingRequests, setPendingRequests] = useState<{
    id: string;
    itemName: string;
    size: string;
    color: string;
  }[]>([]); // Track request details

  // Recommendations state
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");

  // Restore session or redirect to welcome
  useEffect(() => {
    const savedSessionId = localStorage.getItem("sessionId");
    const savedStartTime = localStorage.getItem("sessionStartTime");

    if (savedSessionId && savedStartTime) {
      setSessionId(savedSessionId);
      setSessionStartTime(new Date(savedStartTime));
      loadSession(savedSessionId);
    } else {
      router.push("/");
    }
  }, [router]);

  // Listen for notifications from admin panel via localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'kioskNotification' && e.newValue) {
        try {
          const notificationData = JSON.parse(e.newValue);
          console.log("Received notification from admin:", notificationData);
          
          // Find the pending request
          const pendingRequest = pendingRequests.find(req => req.id === notificationData.requestId.toString());
          
          if (pendingRequest) {
            console.log("Found matching pending request:", pendingRequest);
            
            if (notificationData.status === "PickedUp") {
              console.log("Showing SUCCESS notification for pickup");
              setNotification({
                message: `${pendingRequest.itemName} (${pendingRequest.color}, Size ${pendingRequest.size}) - Store associate picked it up and is on the way`,
                type: "success"
              });
            } else if (notificationData.status === "Cancelled") {
              console.log("Showing ERROR notification for cancellation");
              setNotification({
                message: `${pendingRequest.itemName} (${pendingRequest.color}, Size ${pendingRequest.size}) - Employee is unable to fulfill request and cancelling`,
                type: "error"
              });
            }
            
            // Remove from pending requests
            setPendingRequests(prev => prev.filter(req => req.id !== pendingRequest.id));
            
            // Clear the notification from localStorage
            localStorage.removeItem('kioskNotification');
          }
        } catch (err) {
          console.error("Error processing notification:", err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [pendingRequests]);

  // Mock system removed - notifications will work when backend implements /api/requests/status endpoint

  // TODO: Implement delivered items polling when AWS endpoint is available
  // useEffect(() => {
  //   if (!sessionId) return;
  //   const pollDelivered = setInterval(async () => {
  //     // Poll for delivered items
  //   }, 3000);
  //   return () => clearInterval(pollDelivered);
  // }, [sessionId, items]);

  async function loadSession(id: string) {
    try {
      const loadedItems = await VestiaAPI.getSessionWithProducts(id);
      setItems(loadedItems);
      setSelectedMainIndex(loadedItems.length > 0 ? loadedItems.length - 1 : -1);
    } catch (err) {
      console.error("Failed to load session:", err);
    }
  }

  async function handleScan() {
    setMessage("");
    if (!sku) {
      setMessage("SKU is required.");
      setMessageType("error");
      return;
    }

    try {
      // Send only SKU to backend
      console.log("Scanning SKU:", sku, "for session:", sessionId || "demo_session");
      await VestiaAPI.scanItem(sessionId || "demo_session", sku, "KIOSK-001");
      
      // Fetch updated session data with product metadata
      console.log("Fetching session data...");
      const itemsWithProducts = await VestiaAPI.getSessionWithProducts(sessionId || "demo_session");
      console.log("Session data received:", itemsWithProducts);
      setItems(itemsWithProducts || []);
      
      // Select the newly added item
      setTimeout(() => setSelectedMainIndex((itemsWithProducts || []).length - 1), 0);
      
      setMessage("Item scanned successfully!");
      setMessageType("success");
      setSku("");
    } catch (err) {
      console.error("Failed to scan item:", err);
      setMessage(`Failed to scan item: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setMessageType("error");
    }
  }

  function handleRequestSize(item: Item) {
    setSelectedItem(item);
    setRequestedSize("");
    setRequestedColor("");
    setIsRequestModalOpen(true);
  }

  async function submitRequest() {
    if (!selectedItem) return;

    setMessage("");
    try {
      const data = await VestiaAPI.createRequest({
        sessionId: sessionId || "demo_session",
        sku: selectedItem.sku,
        requestedSize,
        requestedColor,
      });

      setMessage("Request sent successfully!");
      setMessageType("success");
      setIsRequestModalOpen(false);
      setSelectedItem(null);
      setRequestedSize("");
      setRequestedColor("");
      
      // Add request details to pending requests for status tracking
      if (data.requestId) {
        setPendingRequests(prev => [...prev, {
          id: data.requestId.toString(),
          itemName: selectedItem.product?.name || 'Unknown Product',
          size: requestedSize || 'Unknown',
          color: requestedColor || "Default"
        }]);
      }
    } catch (err) {
      console.error(err);
      setMessage("Network error while sending request.");
      setMessageType("error");
    }
  }

  function handleLeaveFeedback(item: Item) {
    setSelectedItem(item);
    setFeedbackRating("5");
    setFeedbackComment("");
    setIsFeedbackModalOpen(true);
  }

  async function submitFeedback() {
    if (!sessionId) return;

    setMessage("");
    try {
      // TODO: Implement feedback endpoint in AWS
      // For now, just show success message
      console.log("Feedback submitted:", {
        sessionId,
        rating: Number(feedbackRating),
        comment: feedbackComment,
      });

      setMessage("Thank you for your feedback!");
      setMessageType("success");
      setIsFeedbackModalOpen(false);
      setSelectedItem(null);
      setFeedbackComment("");
      setFeedbackRating("5");
    } catch (err) {
      console.error(err);
      setMessage("Network error while submitting feedback.");
      setMessageType("error");
    }
  }

  // Map frontend SKU to backend productId
  function getProductIdForSku(sku: string): string {
    const skuMap: { [key: string]: string } = {
      "111": "119704139_1", // T-shirt
      "222": "120556789_1", // Shorts
      "333": "121445678_1", // Sneakers
      "444": "122334455_1"  // Jacket
    };
    return skuMap[sku] || sku;
  }

  // Get image URL for recommendation items
  function getImageUrlForRecommendation(productId: string): string {
    // Map backend catalog productIds to frontend images
    const imageMap: { [key: string]: string } = {
      "119704139_1": "/images/items/Classic Blue Slim-Fit Oxford Shirt.jpg",
      "119704139_2": "/images/items/Navy Blue Crew Neck T-Shirt h&m.jpeg",
      "120556789_1": "/images/items/Slim-Fit Khaki Chinos levis.jpeg",
      "120556789_2": "/images/items/Black Skinny Jeans levis.jpeg",
      "120556789_3": "/images/items/Grey Dress Pants zara.jpg",
      "121445678_1": "/images/items/White Leather Sneakers Nike.jpeg",
      "121445678_2": "/images/items/Black Running Shoes adidas.jpg",
      "121445678_3": "/images/items/Brown Leather Loafers clarks.jpeg",
      "122334455_1": "/images/items/Navy Blazer zara.jpg",
    };
    return imageMap[productId] || "/images/items/tshirt.png"; // Default fallback
  }

  // Fetch recommendations from new AWS API
  async function fetchRecommendations(itemSku: string, category: CategoryFilter = "all") {
    if (!itemSku || loadingRecommendations || category === "all") return;
    
    setLoadingRecommendations(true);
    try {
      const productId = getProductIdForSku(itemSku);
      const recommendations = await VestiaAPI.getRecommendations(productId, category);
      
      // Add image URLs to recommendations
      const recommendationsWithImages = recommendations.map(rec => ({
        ...rec,
        image: getImageUrlForRecommendation(rec.productId)
      }));
      
      setRecommendations(recommendationsWithImages);
    } catch (err) {
      console.error("Error fetching recommendations:", err);
      setRecommendations([]);
    } finally {
      setLoadingRecommendations(false);
    }
  }

  // Handle category filter change
  function handleCategoryFilter(category: CategoryFilter) {
    setActiveCategory(category);
    if (category === "all") {
      setRecommendations([]);
      return;
    }
    
    if (mainItem) {
      fetchRecommendations(mainItem.sku, category);
    }
  }

  // Get items for display: selected item as main, others as smaller cards
  const mainItem = items.length > 0 && selectedMainIndex >= 0 ? items[selectedMainIndex] : null;

  // Auto-fetch recommendations when main item changes (default to "top")
  useEffect(() => {
    if (items.length > 0 && selectedMainIndex >= 0 && selectedMainIndex < items.length) {
      const currentMainItem = items[selectedMainIndex];
      if (currentMainItem && currentMainItem.sku) {
        // Default to showing "top" recommendations
        setActiveCategory("top");
        fetchRecommendations(currentMainItem.sku, "top");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMainIndex, items.length]);
  const previousItems = items.length > 1 
    ? items.filter((_, index) => index !== selectedMainIndex).reverse()
    : [];

  if (!sessionId) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F5E9DA]">
      {/* Top Bar */}
      <div className="bg-[#FDF7EF] border-b border-[#E5D5C8] px-8 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#3B2A21]">Vestia</h1>
          <div className="flex items-center gap-6 text-[#3B2A21]">
            <a href="/" className="font-medium hover:underline">Kiosk</a>
            <a href="/admin" className="font-medium hover:underline">Requests</a>
            <a href="/analytics" className="font-medium hover:underline">Analytics</a>
            <span className="font-medium">Room 7</span>
            {sessionStartTime && <SessionTimer startTime={sessionStartTime} />}
            <button className="font-medium hover:underline">Log In</button>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex gap-8 p-8 w-full max-w-none" style={{ height: "calc(100vh - 80px)" }}>
        {/* Left Column - 55% */}
        <div className="flex flex-col space-y-4 overflow-hidden" style={{ flexBasis: "55%", width: "55%", maxWidth: "55%" }}>
          {/* Scan Item Banner - Compact */}
          <div className="bg-[#FDF7EF] rounded-xl p-4 border border-[#E5D5C8]">
            <h2 className="text-lg font-semibold text-[#3B2A21] mb-3">Enter SKU</h2>
            <div className="flex gap-3 mb-3">
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Enter SKU (111, 222, 333, or 444)"
                className="flex-1 bg-white border border-[#E5D5C8] rounded-md px-3 py-2 text-[#3B2A21] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#4A3A2E] text-sm"
              />
              <button
                onClick={handleScan}
                className="px-6 py-2 bg-[#4A3A2E] hover:bg-[#3B2A21] text-[#FDF7EF] font-medium rounded-md transition-all text-sm"
              >
                Scan Item
              </button>
            </div>
          </div>

          {/* Your Items Section - Maximized */}
          <div className="flex-1">
            <h2 className="text-3xl font-semibold text-[#3B2A21] mb-6">Your Items ({items.length})</h2>
            
            {items.length === 0 ? (
              <div className="bg-[#FDF7EF] rounded-2xl p-12 border border-[#E5D5C8] text-center">
                <div className="w-20 h-20 bg-[#E5D5C8] rounded-full mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-10 h-10 text-[#3B2A21]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <p className="text-[#3B2A21] font-medium">No items scanned yet. Scan an item to get started.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Main Item Card - Larger */}
                {mainItem && (
                  <div className="bg-[#FDF7EF] rounded-2xl p-8 border border-[#E5D5C8]">
                    <div className="flex gap-8">
                      <div className="w-40 h-56 bg-[#E5D5C8] rounded-xl overflow-hidden">
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-[#3B2A21] text-lg">Image</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-3xl font-semibold text-[#3B2A21] mb-4">{mainItem.product?.name || 'Unknown Product'}</h3>
                        <div className="flex gap-3 mb-6">
                          <span className="px-4 py-2 bg-[#E5D5C8] text-[#3B2A21] text-base rounded-full">{mainItem.product?.color}</span>
                          <span className="px-4 py-2 bg-[#E5D5C8] text-[#3B2A21] text-base rounded-full">Size N/A</span>
                          <span className="px-4 py-2 bg-[#E5D5C8] text-[#3B2A21] text-base rounded-full">${mainItem.product?.price || 75}</span>
                        </div>
                        <div className="flex flex-col gap-3">
                          <button
                            onClick={() => handleRequestSize(mainItem)}
                            className="px-6 py-4 bg-[#4A3A2E] text-[#FDF7EF] rounded-xl font-medium hover:bg-[#3B2A21] transition-all text-left"
                          >
                            <div className="text-base font-semibold">Request different size/colour for this item</div>
                            <div className="text-sm opacity-90">Associate will bring your requested size to Room 7.</div>
                          </button>
                          <button
                            onClick={() => handleLeaveFeedback(mainItem)}
                            className="px-6 py-4 border border-[#4A3A2E] text-[#4A3A2E] rounded-xl font-medium hover:bg-[#4A3A2E] hover:text-[#FDF7EF] transition-all text-left"
                          >
                            <div className="text-base font-semibold">☆ Save / Share + Add Notes</div>
                            <div className="text-sm opacity-90">Your notes help us personalize your experience.</div>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Previous Items - Scrollable Carousel with Arrows */}
                {previousItems.length > 0 && (
                  <div className="relative h-32 w-full max-w-full overflow-hidden">
                    <div 
                      className="flex gap-4 overflow-x-auto scrollbar-hide drag-scroll h-full snap-x snap-mandatory"
                      style={{ scrollBehavior: 'smooth' }}
                      onMouseDown={(e) => {
                        const container = e.currentTarget;
                        const startX = e.pageX - container.offsetLeft;
                        const scrollLeft = container.scrollLeft;
                        
                        const handleMouseMove = (e: MouseEvent) => {
                          const x = e.pageX - container.offsetLeft;
                          const walk = (x - startX) * 2;
                          container.scrollLeft = scrollLeft - walk;
                        };
                        
                        const handleMouseUp = () => {
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                        };
                        
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                    >
                      {previousItems.map((item, index) => {
                        const originalIndex = items.findIndex(i => i === item);
                        return (
                          <div 
                            key={`${item.sku}-${index}`} 
                            onClick={() => setSelectedMainIndex(originalIndex)}
                            className="bg-[#FDF7EF] rounded-xl p-4 border border-[#E5D5C8] cursor-pointer hover:bg-[#F5E9DA] transition-all flex-shrink-0 clickable snap-start"
                            style={{ minWidth: 'calc(50% - 8px)' }}
                          >
                            <div className="flex gap-3 h-full">
                              <div className="w-20 h-24 bg-[#E5D5C8] rounded-lg overflow-hidden flex-shrink-0">
                                  <div className="w-full h-full flex items-center justify-center">
                                    <span className="text-[#3B2A21] text-sm">Img</span>
                                  </div>
                              </div>
                              <div className="flex-1 min-w-0 flex flex-col justify-between">
                                <div>
                                  <h4 className="font-semibold text-[#3B2A21] text-base mb-2 truncate">{item.product?.name || 'Unknown Product'}</h4>
                                  <p className="text-[#3B2A21] text-sm mb-2">SKU: {item.sku}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <span className="px-3 py-1 bg-[#E5D5C8] text-[#3B2A21] text-sm rounded-full">{item.product?.color}</span>
                                  <span className="px-3 py-1 bg-[#E5D5C8] text-[#3B2A21] text-sm rounded-full">Size N/A</span>
                                  <span className="px-3 py-1 bg-[#E5D5C8] text-[#3B2A21] text-sm rounded-full">${item.product?.price || 75}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - 45% */}
        <div className="relative h-full overflow-hidden" style={{ flexBasis: "45%", width: "45%", maxWidth: "45%" }}>
          <div className="absolute inset-0 flex flex-col bg-[#FDF7EF] rounded-2xl border border-[#E5D5C8] p-6">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h2 className="text-3xl font-semibold text-[#3B2A21]">Recommended for this item</h2>
            </div>
            
            {/* Category Filter Pills */}
            {mainItem && (
              <div className="flex gap-2 mb-6 flex-shrink-0">
                {(["top", "bottom", "shoes", "accessory"] as const).map((category) => (
                  <button
                    key={category}
                    onClick={() => handleCategoryFilter(category)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      activeCategory === category
                        ? "bg-[#4A3A2E] text-[#FDF7EF]"
                        : "bg-white text-[#3B2A21] border border-[#E5D5C8] hover:bg-[#F5E9DA]"
                    }`}
                  >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                    {category === "accessory" ? "ies" : "s"}
                  </button>
                ))}
              </div>
            )}
            
            {!mainItem ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[#3B2A21]">Scan an item to see outfit recommendations</p>
              </div>
            ) : loadingRecommendations ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[#3B2A21]">Loading recommendations...</p>
              </div>
            ) : activeCategory === "all" ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[#3B2A21]">Select a category to see recommendations</p>
              </div>
            ) : recommendations.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[#3B2A21]">No recommendations found for {activeCategory}</p>
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-4 overflow-y-auto">
                {recommendations.slice(0, 4).map((rec) => {
                  const imageUrl = getImageUrlForRecommendation(rec.productId);
                  
                  return (
                    <div key={rec.productId} className="bg-white rounded-xl p-4 border border-[#E5D5C8] flex flex-col">
                      <div className="flex gap-3 flex-1">
                        <div className="w-20 h-20 bg-[#E5D5C8] rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt={rec.name}
                              width={80}
                              height={80}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <span className="text-[#3B2A21] text-xs">Img</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col">
                          <h4 className="font-medium text-[#3B2A21] text-sm mb-2 truncate">{rec.name}</h4>
                          <div className="text-xs text-[#8C6A4B] mb-2">{rec.category} • ${rec.price}</div>
                          <div className="flex flex-col gap-1 flex-1 mb-2">
                            <span className="px-2 py-1 bg-[#E5D5C8] text-[#3B2A21] text-xs rounded-full w-fit">{rec.color}</span>
                            {rec.score > 0 && (
                              <span className="text-xs text-emerald-600 font-semibold">
                                Match: {Math.round(rec.score * 100)}%
                              </span>
                            )}
                          </div>
                          
                          <div className="flex flex-col gap-2 mt-auto">
                            <button 
                              onClick={() => handleRequestSize({
                                sku: rec.productId,
                                entityType: 'SCAN' as const,
                                sessionId: sessionId || 'demo_session',
                                createdAt: new Date().toISOString(),
                                product: {
                                  productId: rec.productId,
                                  name: rec.name,
                                  color: rec.color,
                                  category: rec.category,
                                  price: rec.price,
                                  articleType: rec.articleType,
                                  gender: 'unisex'
                                }
                              })}
                              className="text-xs border border-[#4A3A2E] text-[#4A3A2E] rounded-md py-1 hover:bg-[#4A3A2E] hover:text-[#FDF7EF] transition-all"
                            >
                              Request
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Existing Modals - Keep as-is */}
      <Modal
        isOpen={isRequestModalOpen}
        onClose={() => {
          setIsRequestModalOpen(false);
          setSelectedItem(null);
        }}
        title="Request Different Size or Color"
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Current Item</p>
              <p className="font-medium text-gray-900">{selectedItem.product?.name || 'Unknown Product'}</p>
              <p className="text-sm text-gray-600">
                {selectedItem.product?.color} • Size N/A
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Requested Size
              </label>
              <select
                value={requestedSize}
                onChange={(e) => setRequestedSize(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent transition-all"
              >
                <option value="">Select size</option>
                <option value="XS">XS</option>
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
                <option value="2XL">2XL</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Requested Color
              </label>
              <select
                value={requestedColor}
                onChange={(e) => setRequestedColor(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent transition-all"
              >
                <option value="">Select color</option>
                <option value="Black">Black</option>
                <option value="White">White</option>
                <option value="Red">Red</option>
                <option value="Blue">Blue</option>
                <option value="Green">Green</option>
                <option value="Yellow">Yellow</option>
                <option value="Purple">Purple</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setIsRequestModalOpen(false);
                  setSelectedItem(null);
                }}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={submitRequest}
                className="flex-1 px-4 py-2.5 bg-[#0066CC] hover:bg-[#0052A3] text-white font-semibold rounded-lg transition-all duration-200"
              >
                Send Request
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isFeedbackModalOpen}
        onClose={() => {
          setIsFeedbackModalOpen(false);
          setSelectedItem(null);
        }}
        title="Leave Feedback"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rating
            </label>
            <select
              value={feedbackRating}
              onChange={(e) => setFeedbackRating(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent transition-all"
            >
              <option value="5">5 - Loved it</option>
              <option value="4">4 - Good</option>
              <option value="3">3 - Okay</option>
              <option value="2">2 - Not great</option>
              <option value="1">1 - Terrible</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comments (optional)
            </label>
            <textarea
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              placeholder="Tell us about fit, comfort, staff, etc."
              rows={4}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent transition-all resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setIsFeedbackModalOpen(false);
                setSelectedItem(null);
              }}
              className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={submitFeedback}
              className="flex-1 px-4 py-2.5 bg-[#0066CC] hover:bg-[#0052A3] text-white font-semibold rounded-lg transition-all duration-200"
            >
              Submit Feedback
            </button>
          </div>
        </div>
      </Modal>

      {/* Notification */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}
