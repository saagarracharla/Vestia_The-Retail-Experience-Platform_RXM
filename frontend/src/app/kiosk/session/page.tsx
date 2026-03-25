"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Modal from "@/components/Modal";
import SessionTimer from "@/components/SessionTimer";
import Notification from "@/components/Notification";
import EndSessionModal, { SessionFeedback } from "@/components/EndSessionModal";
import LoadingSpinner from "@/components/LoadingSpinner";
import { VestiaAPI, RecommendationItem, ItemWithProduct, SessionPreferences, CustomerProfile, OutfitResult, SavedOutfitItem } from "@/lib/api";

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

  // Loading states
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // Request deduplication - track submitted requests to prevent duplicates
  const submittedRequestsRef = useRef<Set<string>>(new Set());
  const scanDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const requestInProgressRef = useRef(false);

  // Cache session gender to avoid repeated API calls
  const [sessionGender, setSessionGender] = useState<string | null>(null);

  // Modal states
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isEndSessionModalOpen, setIsEndSessionModalOpen] = useState(false);
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

  // Customer profile + session preferences
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [sessionPreferences, setSessionPreferences] = useState<SessionPreferences | null>(null);

  // Preferences popup (shown after first scan if no preferences set)
  const [isPrefsModalOpen, setIsPrefsModalOpen] = useState(false);
  const prefShownRef = useRef(false);

  // Customer login popup (optional — customer can enter phone/email)
  const [isCustomerLoginOpen, setIsCustomerLoginOpen] = useState(false);
  const [customerIdInput, setCustomerIdInput] = useState("");

  // Pref form state
  const [prefTopSize, setPrefTopSize] = useState("");
  const [prefBottomSize, setPrefBottomSize] = useState("");
  const [prefShoesSize, setPrefShoesSize] = useState("");
  const [prefColors, setPrefColors] = useState<string[]>([]);
  const [prefStyles, setPrefStyles] = useState<string[]>([]);

  // Mix & Match state
  const [mixMatchMode, setMixMatchMode] = useState(false);
  const [outfitSelections, setOutfitSelections] = useState<Set<string>>(new Set());
  const [outfitResult, setOutfitResult] = useState<OutfitResult | null>(null);
  const [loadingOutfit, setLoadingOutfit] = useState(false);

  // Save & Share state
  const [savingOutfit, setSavingOutfit] = useState(false);
  const [savedShareCode, setSavedShareCode] = useState<string | null>(null);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (scanDebounceTimerRef.current) {
        clearTimeout(scanDebounceTimerRef.current);
      }
    };
  }, []);

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

  // Poll for delivered items every 5 seconds (reduced from 3)
  useEffect(() => {
    if (!sessionId) return;
    
    const pollDelivered = setInterval(async () => {
      try {
        const itemsWithProducts = await VestiaAPI.getSessionWithProducts(sessionId);
        setItems(itemsWithProducts);
        // Update selected index if new items were added
        if (itemsWithProducts.length > items.length) {
          setSelectedMainIndex(itemsWithProducts.length - 1);
        }
      } catch (err) {
        console.error("Failed to poll for delivered items:", err);
      }
    }, 5000); // Increased from 3000ms to 5000ms
    
    return () => clearInterval(pollDelivered);
  }, [sessionId, items.length]);

  async function loadSession(id: string) {
    try {
      const loadedItems = await VestiaAPI.getSessionWithProducts(id);
      setItems(loadedItems);
      setSelectedMainIndex(loadedItems.length > 0 ? loadedItems.length - 1 : -1);
      
      // Cache session gender on first load
      if (!sessionGender && loadedItems.length > 0) {
        const gender = await VestiaAPI.getSessionGender(id);
        setSessionGender(gender);
      }
    } catch (err) {
      console.error("Failed to load session:", err);
    }
  }

  async function handleScan() {
    setMessage("");
    if (!sku || !sku.trim()) {
      setMessage("SKU is required.");
      setMessageType("error");
      return;
    }

    // Prevent multiple simultaneous scans
    if (isScanning || requestInProgressRef.current) {
      return;
    }

    const skuToScan = sku.trim();
    const currentSessionId = sessionId || "demo_session";

    // Check if this SKU was just scanned (prevent duplicate scans)
    const recentScanKey = `${currentSessionId}-${skuToScan}`;
    if (submittedRequestsRef.current.has(recentScanKey)) {
      setMessage("This item was just scanned. Please wait a moment.");
      setMessageType("error");
      return;
    }

    setIsScanning(true);
    requestInProgressRef.current = true;
    submittedRequestsRef.current.add(recentScanKey);

    try {
      // Send only SKU to backend
      console.log("Scanning SKU:", skuToScan, "for session:", currentSessionId);
      await VestiaAPI.scanItem(currentSessionId, skuToScan, "KIOSK-001");
      
      // Fetch updated session data with product metadata
      console.log("Fetching session data...");
      const itemsWithProducts = await VestiaAPI.getSessionWithProducts(currentSessionId);
      console.log("Session data received:", itemsWithProducts);
      setItems(itemsWithProducts || []);
      
      // Select the newly added item
      setTimeout(() => setSelectedMainIndex((itemsWithProducts || []).length - 1), 0);
      
      setMessage("Item scanned successfully!");
      setMessageType("success");
      setSku("");

      // Show preferences popup on first scan (once per session)
      if (!prefShownRef.current && !sessionPreferences) {
        prefShownRef.current = true;
        setTimeout(() => setIsPrefsModalOpen(true), 600);
      }
      
      // Remove from deduplication set after 2 seconds (allow re-scanning after delay)
      setTimeout(() => {
        submittedRequestsRef.current.delete(recentScanKey);
      }, 2000);
    } catch (err) {
      console.error("Failed to scan item:", err);
      setMessage(`Failed to scan item: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setMessageType("error");
      // Remove from deduplication set on error so user can retry
      submittedRequestsRef.current.delete(recentScanKey);
    } finally {
      setIsScanning(false);
      requestInProgressRef.current = false;
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

    // CRITICAL FIX: Check loading state at the start to prevent duplicate submissions
    if (isSubmittingRequest || requestInProgressRef.current) {
      console.log("Request already in progress, ignoring duplicate click");
      return;
    }

    // Create unique request key for deduplication
    const requestKey = `${sessionId || "demo_session"}-${selectedItem.sku}-${requestedSize}-${requestedColor}-${Date.now()}`;
    
    // Check if this exact request was just submitted
    if (submittedRequestsRef.current.has(requestKey)) {
      console.log("Duplicate request detected, ignoring");
      return;
    }

    setIsSubmittingRequest(true);
    requestInProgressRef.current = true;
    submittedRequestsRef.current.add(requestKey);

    // Store values before async operations
    const currentSessionId = sessionId || "demo_session";
    const currentSku = selectedItem.sku;
    const currentSize = requestedSize;
    const currentColor = requestedColor;
    const currentItemName = selectedItem.product?.name || 'Unknown Product';

    setMessage("");

    try {
      const data = await VestiaAPI.createRequest({
        sessionId: currentSessionId,
        sku: currentSku,
        requestedSize: currentSize || undefined,
        requestedColor: currentColor || undefined,
      });

      // Close modal immediately for better UX (optimistic update)
      setIsRequestModalOpen(false);
      setSelectedItem(null);
      setRequestedSize("");
      setRequestedColor("");

      // Add request details to pending requests for status tracking
      if (data.requestId) {
        setPendingRequests(prev => [...prev, {
          id: data.requestId.toString(),
          itemName: currentItemName,
          size: currentSize || 'Unknown',
          color: currentColor || "Default"
        }]);
      }

      // Show success message
      setMessage("Request sent successfully!");
      setMessageType("success");

      // Note: Removed unnecessary session refresh - it's already polled every 5 seconds
      // This reduces API calls and improves performance

      // Remove from deduplication set after 3 seconds
      setTimeout(() => {
        submittedRequestsRef.current.delete(requestKey);
      }, 3000);
    } catch (err) {
      console.error("Request submission error:", err);
      setMessage("Network error while sending request.");
      setMessageType("error");
      // Remove from deduplication set on error so user can retry
      submittedRequestsRef.current.delete(requestKey);
      // Re-open modal on error so user can try again
      setIsRequestModalOpen(true);
    } finally {
      setIsSubmittingRequest(false);
      requestInProgressRef.current = false;
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
      await VestiaAPI.submitSessionFeedback(sessionId, {
        overallRating: Number(feedbackRating),
        overallComment: feedbackComment || undefined,
        itemFeedback: selectedItem ? [{ sku: selectedItem.sku, rating: Number(feedbackRating), comment: feedbackComment }] : [],
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

  async function handleEndSession(feedback: SessionFeedback) {
    if (!sessionId) return;

    try {
      await VestiaAPI.submitSessionFeedback(sessionId, {
        overallRating: feedback.overallRating,
        overallComment: feedback.overallComment,
        itemFeedback: feedback.itemFeedback,
        experienceRating: feedback.experienceRating,
        experienceComment: feedback.experienceComment,
        wouldReturn: feedback.wouldReturn,
      });

      // Clear session data
      localStorage.removeItem("sessionId");
      localStorage.removeItem("sessionStartTime");
      
      // Show success notification
      setNotification({
        message: "Thank you for your feedback! Your session has ended.",
        type: "success"
      });

      // Redirect to welcome screen after a delay
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err) {
      console.error("Failed to end session:", err);
      setNotification({
        message: "Failed to submit feedback. Please try again.",
        type: "error"
      });
      throw err; // Re-throw to let modal handle it
    }
  }

  async function handleSavePreferences() {
    const prefs: SessionPreferences = {
      preferredSizes: {
        ...(prefTopSize    ? { top:    prefTopSize    } : {}),
        ...(prefBottomSize ? { bottom: prefBottomSize } : {}),
        ...(prefShoesSize  ? { shoes:  prefShoesSize  } : {}),
      },
      preferredColors: prefColors,
      preferredStyles: prefStyles,
    };
    setSessionPreferences(prefs);
    setIsPrefsModalOpen(false);

    if (sessionId) {
      try { await VestiaAPI.saveSessionPreferences(sessionId, prefs); } catch { /* non-critical */ }
    }

    // If customer is logged in, persist to their profile too
    if (customerId) {
      try { await VestiaAPI.upsertCustomerProfile(customerId, { preferredSizes: prefs.preferredSizes, preferredColors: prefs.preferredColors, preferredStyles: prefs.preferredStyles }); } catch { /* non-critical */ }
    }

    // Re-fetch recommendations with new prefs for the currently selected item
    if (mainItem) fetchRecommendations(mainItem.sku, activeCategory === "all" ? "bottom" : activeCategory);
  }

  async function handleCustomerLogin() {
    if (!customerIdInput.trim()) return;
    const id = customerIdInput.trim();
    try {
      const profile = await VestiaAPI.getCustomerProfile(id);
      if (profile) {
        setCustomerId(id);
        setCustomerProfile(profile);
        // Pre-fill pref form from profile (including history-derived colours)
        if (profile.preferredSizes) {
          setPrefTopSize(profile.preferredSizes.top || "");
          setPrefBottomSize(profile.preferredSizes.bottom || "");
          setPrefShoesSize(profile.preferredSizes.shoes || "");
        }
        const allColors = [
          ...(profile.preferredColors || []),
          ...(profile.derivedStyle?.topColors || []),
        ].filter((c, i, a) => a.indexOf(c) === i);
        if (allColors.length) setPrefColors(allColors);
        if (profile.preferredStyles?.length) setPrefStyles(profile.preferredStyles);
        await VestiaAPI.upsertCustomerProfile(id, { incrementVisit: true });
      } else {
        await VestiaAPI.upsertCustomerProfile(id, { incrementVisit: true });
        setCustomerId(id);
      }
    } catch { /* non-critical */ }
    // Re-fetch recommendations with customer profile data
    if (mainItem) {
      setTimeout(() => fetchRecommendations(mainItem.sku, activeCategory === "all" ? "bottom" : activeCategory), 300);
    }
    setIsCustomerLoginOpen(false);
    setCustomerIdInput("");
  }

  function togglePrefColor(color: string) {
    setPrefColors(prev => prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]);
  }

  function togglePrefStyle(style: string) {
    setPrefStyles(prev => prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]);
  }

  // ── Mix & Match ────────────────────────────────────────────────────────────

  function enterMixMatchMode() {
    setMixMatchMode(true);
    setOutfitResult(null);
    // Pre-select the currently displayed item
    setOutfitSelections(mainItem ? new Set([mainItem.sku]) : new Set());
  }

  function exitMixMatchMode() {
    setMixMatchMode(false);
    setOutfitResult(null);
    setOutfitSelections(new Set());
  }

  function toggleOutfitSelection(sku: string) {
    setOutfitSelections(prev => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku); else next.add(sku);
      return next;
    });
  }

  async function handleBuildOutfit() {
    if (outfitSelections.size === 0) return;
    setLoadingOutfit(true);
    try {
      const result = await VestiaAPI.getOutfitRecommendations(
        Array.from(outfitSelections),
        sessionId || undefined,
        customerId || undefined,
        sessionPreferences || undefined
      );
      setOutfitResult(result);
    } catch (err) {
      console.error("Failed to build outfit:", err);
    } finally {
      setLoadingOutfit(false);
    }
  }

  async function handleSaveOutfit() {
    if (!outfitResult) return;
    setSavingOutfit(true);
    try {
      const outfitItems: SavedOutfitItem[] = [];

      // In-room items (already scanned)
      for (const sku of outfitSelections) {
        const item = items.find(i => i.sku === sku);
        if (item?.product) {
          outfitItems.push({
            productId: item.sku,
            name: item.product.name,
            category: item.product.category,
            color: item.product.color,
            price: item.product.price,
            imageUrl: item.product.imageUrl,
            source: "room",
          });
        }
      }

      // AI-recommended completions (top pick per missing category)
      for (const [, recs] of Object.entries(outfitResult.outfit)) {
        const rec = recs[0];
        if (!rec) continue;
        const alreadyCovered = outfitItems.some(i => i.category === rec.category);
        if (!alreadyCovered) {
          outfitItems.push({
            productId: rec.productId,
            name: rec.name,
            category: rec.category,
            color: rec.color,
            price: rec.price,
            imageUrl: rec.imageUrl,
            source: "recommended",
          });
        }
      }

      const { shareCode } = await VestiaAPI.saveOutfit({
        sessionId: sessionId || undefined,
        customerId: customerId || undefined,
        items: outfitItems,
      });
      setSavedShareCode(shareCode);
    } catch (err) {
      console.error("Failed to save outfit:", err);
    } finally {
      setSavingOutfit(false);
    }
  }

  // Map frontend SKU to backend productId
  function getProductIdForSku(sku: string): string {
    // Use SKU directly as productId since ProductCatalog uses SKU as productId
    return sku;
  }


  // Fetch recommendations from new AWS API
  async function fetchRecommendations(itemSku: string, category: CategoryFilter = "all") {
    if (!itemSku || loadingRecommendations || category === "all") return;
    
    setLoadingRecommendations(true);
    try {
      const productId = getProductIdForSku(itemSku);
      
      // Use cached session gender or fetch if not available
      let gender = sessionGender;
      if (!gender && sessionId) {
        gender = await VestiaAPI.getSessionGender(sessionId);
        setSessionGender(gender);
      }
      
      const recommendations = await VestiaAPI.getRecommendations(
        productId,
        category,
        gender || undefined,
        sessionId || undefined,
        customerId || undefined,
        sessionPreferences || undefined
      );
      
      setRecommendations(recommendations);
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

  // Keyboard shortcuts for accessibility
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Ctrl/Cmd + Enter: Scan item (if SKU is entered)
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && sku) {
        e.preventDefault();
        handleScan();
      }

      // Ctrl/Cmd + R: Request size/color for selected item
      if ((e.ctrlKey || e.metaKey) && e.key === "r" && mainItem) {
        e.preventDefault();
        handleRequestSize(mainItem);
      }

      // Ctrl/Cmd + E: End session
      if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        setIsEndSessionModalOpen(true);
      }

      // Arrow keys: Navigate between items (when not in input)
      if (e.key === "ArrowLeft" && items.length > 0) {
        e.preventDefault();
        setSelectedMainIndex((prev) => Math.max(0, prev - 1));
      }
      if (e.key === "ArrowRight" && items.length > 0) {
        e.preventDefault();
        setSelectedMainIndex((prev) => Math.min(items.length - 1, prev + 1));
      }

      // Escape: Close modals
      if (e.key === "Escape") {
        if (isRequestModalOpen) {
          setIsRequestModalOpen(false);
          setSelectedItem(null);
        }
        if (isFeedbackModalOpen) {
          setIsFeedbackModalOpen(false);
          setSelectedItem(null);
        }
        if (isEndSessionModalOpen) {
          setIsEndSessionModalOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [sku, mainItem, items.length, isRequestModalOpen, isFeedbackModalOpen, isEndSessionModalOpen]);
  const previousItems = items.length > 1 
    ? items.filter((_, index) => index !== selectedMainIndex).reverse()
    : [];

  if (!sessionId) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F5E9DA]">
      {/* Customer-Facing Top Bar */}
      <div className="bg-[#FDF7EF] border-b border-[#E5D5C8] px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12">
              <Image
                src="/images/Logo.png"
                alt="Vestia Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <h1 className="text-2xl font-bold text-[#3B2A21]">Vestia</h1>
          </div>
          <div className="flex items-center gap-6 text-[#3B2A21]">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/60 rounded-full border border-[#E5D5C8]">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="font-semibold text-sm">Room 7</span>
            </div>
            {sessionStartTime && (
              <div className="px-4 py-2 bg-white/60 rounded-full border border-[#E5D5C8]">
                <SessionTimer startTime={sessionStartTime} />
              </div>
            )}
            {/* Preferences indicator / trigger */}
            <button
              onClick={() => setIsPrefsModalOpen(true)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${sessionPreferences || customerId ? "bg-[#4A3A2E] text-white border-[#4A3A2E]" : "bg-white/60 border-[#E5D5C8] text-[#3B2A21] hover:bg-white"}`}
            >
              {customerId ? `Hi, ${customerId.split("@")[0]}` : sessionPreferences ? "Preferences set" : "My Preferences"}
            </button>
            <button
              onClick={() => setIsEndSessionModalOpen(true)}
              className="px-5 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 font-semibold rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-red-300 shadow-sm hover:shadow-md"
            >
              End Session
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex gap-4 p-4 w-full max-w-none" style={{ height: "calc(100vh - 80px)" }}>
        {/* Left Column - 55% */}
        <div className="relative h-full overflow-hidden" style={{ flexBasis: "55%", width: "55%", maxWidth: "55%" }}>
          <div className="absolute inset-0 flex flex-col bg-white rounded-2xl border border-[#E5D5C8] shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#E5D5C8]/30 flex-shrink-0">
              <div>
                <h1 className="text-2xl font-medium text-[#3B2A21]">
                  {mixMatchMode ? "Build Your Outfit" : "Your Items"}
                </h1>
                <p className="text-sm text-[#8C6A4B] mt-1">
                  {mixMatchMode
                    ? `${outfitSelections.size} item${outfitSelections.size !== 1 ? "s" : ""} selected — tap to include`
                    : `${items.length} item${items.length !== 1 ? "s" : ""} scanned`}
                </p>
              </div>
              <div className="flex gap-3">
                {items.length >= 1 && !mixMatchMode && (
                  <button
                    onClick={enterMixMatchMode}
                    className="px-4 py-2 bg-[#F5E9DA] border border-[#4A3A2E]/30 text-[#4A3A2E] rounded-xl font-medium text-sm hover:bg-[#EDD9C8] transition-all duration-200"
                  >
                    Mix & Match
                  </button>
                )}
                {mixMatchMode && (
                  <button
                    onClick={exitMixMatchMode}
                    className="px-4 py-2 border border-[#E5D5C8] text-[#3B2A21] rounded-xl text-sm hover:bg-[#F5E9DA] transition-all duration-200"
                  >
                    Cancel
                  </button>
                )}
                {!mixMatchMode && (
                  <button
                    onClick={() => setIsEndSessionModalOpen(true)}
                    className="px-4 py-2 border border-[#E5D5C8] text-[#3B2A21] rounded-xl hover:bg-[#F5E9DA] transition-all duration-200 transform hover:scale-105 active:scale-95"
                  >
                    End Session
                  </button>
                )}
                <SessionTimer startTime={sessionStartTime} />
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col p-4 min-h-0">
              {items.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-[#E5D5C8]/30 rounded-full flex items-center justify-center mx-auto mb-6">
                      <span className="text-3xl">📱</span>
                    </div>
                    <h2 className="text-xl font-medium text-[#3B2A21] mb-2">Ready to scan</h2>
                    <p className="text-[#8C6A4B] mb-6">Scan the barcode on any item to get started</p>
                    <div className="flex gap-3 justify-center">
                      <input
                        type="text"
                        value={sku}
                        onChange={(e) => {
                          const newSku = e.target.value;
                          setSku(newSku);
                          
                          // Clear any existing debounce timer
                          if (scanDebounceTimerRef.current) {
                            clearTimeout(scanDebounceTimerRef.current);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && sku.trim() && !isScanning && !requestInProgressRef.current) {
                            e.preventDefault();
                            // Clear debounce timer if user presses Enter
                            if (scanDebounceTimerRef.current) {
                              clearTimeout(scanDebounceTimerRef.current);
                              scanDebounceTimerRef.current = null;
                            }
                            handleScan();
                          }
                        }}
                        placeholder="Enter SKU (111, 222, 333, or 444)"
                        className="px-4 py-3 border border-[#E5D5C8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A3A2E] focus:border-transparent"
                        autoFocus
                        disabled={isScanning}
                      />
                      <button
                        onClick={handleScan}
                        disabled={isScanning || !sku.trim()}
                        className="px-6 py-3 bg-[#4A3A2E] text-[#FDF7EF] rounded-xl font-medium hover:bg-[#3B2A21] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg flex items-center gap-2"
                      >
                        {isScanning ? (
                          <>
                            <LoadingSpinner size="sm" />
                            <span>Scanning...</span>
                          </>
                        ) : (
                          "Scan Item"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Hero Item Display */}
                  {mainItem && (
                    <div className="flex-shrink-0 mb-4">
                      <div
                        className={`relative bg-gradient-to-br from-[#FDF7EF] to-[#F5E9DA] rounded-2xl p-6 border-2 transition-all duration-200 ${mixMatchMode ? "cursor-pointer " + (outfitSelections.has(mainItem.sku) ? "border-[#4A3A2E] shadow-md" : "border-[#E5D5C8] hover:border-[#4A3A2E]/40") : "border-[#E5D5C8]"}`}
                        onClick={() => mixMatchMode && toggleOutfitSelection(mainItem.sku)}
                      >
                        {mixMatchMode && (
                          <div className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${outfitSelections.has(mainItem.sku) ? "bg-[#4A3A2E] border-[#4A3A2E]" : "bg-white border-[#C0A898]"}`}>
                            {outfitSelections.has(mainItem.sku) && <span className="text-white text-xs font-bold">✓</span>}
                          </div>
                        )}
                        <div className="flex gap-6">
                          <div className="w-52 h-72 bg-white rounded-xl shadow-sm flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#E5D5C8]/30">
                            {mainItem.product?.imageUrl ? (
                              <img
                                src={mainItem.product.imageUrl}
                                alt={mainItem.product.name || 'Product'}
                                loading="lazy"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <div className={`w-full h-full flex items-center justify-center ${mainItem.product?.imageUrl ? 'hidden' : ''}`}>
                              <span className="text-[#3B2A21] text-xl">Image</span>
                            </div>
                          </div>
                          <div className="flex-1 flex flex-col justify-between">
                            <div>
                              <h3 className="text-3xl font-semibold text-[#3B2A21] mb-3">{mainItem.product?.name || 'Unknown Product'}</h3>
                              <div className="flex flex-wrap gap-2 mb-4">
                                <span className="px-4 py-2 bg-white text-[#3B2A21] text-base rounded-full border border-[#E5D5C8]/50 shadow-sm">{mainItem.derivedColor || mainItem.product?.color || 'Unknown Color'}</span>
                                <span className="px-4 py-2 bg-white text-[#3B2A21] text-base rounded-full border border-[#E5D5C8]/50 shadow-sm">{mainItem.derivedSize ? `Size ${mainItem.derivedSize}` : 'Size N/A'}</span>
                                <span className="px-4 py-2 bg-white text-[#3B2A21] text-base rounded-full border border-[#E5D5C8]/50 shadow-sm font-medium">${mainItem.product?.price || 75}</span>
                                {mainItem.isDelivered && (
                                  <span className="px-4 py-2 bg-emerald-100 text-emerald-700 text-base rounded-full font-medium border border-emerald-200">✓ Delivered</span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => handleRequestSize(mainItem)}
                                className="px-6 py-4 bg-[#4A3A2E] text-[#FDF7EF] rounded-xl font-medium hover:bg-[#3B2A21] transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-md hover:shadow-lg text-left"
                              >
                                <div className="text-base font-semibold">Request different size/color</div>
                                <div className="text-sm opacity-90">Associate will bring to your fitting room</div>
                              </button>
                              <button
                                onClick={() => handleLeaveFeedback(mainItem)}
                                className="px-6 py-4 border border-[#4A3A2E] text-[#4A3A2E] rounded-xl font-medium hover:bg-[#4A3A2E] hover:text-[#FDF7EF] transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] text-left"
                              >
                                <div className="text-base font-semibold">⭐ Save & add notes</div>
                                <div className="text-sm opacity-90">Help us personalize your experience</div>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      {mixMatchMode && (
                        <p className="text-xs text-center text-[#8C6A4B] mt-2">
                          {outfitSelections.has(mainItem.sku) ? "Selected for outfit" : "Tap to add to outfit"}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Item Timeline - Horizontal Carousel */}
                  {previousItems.length > 0 && (
                    <div className="flex-shrink-0">
                      <h3 className="text-sm font-medium text-[#3B2A21]/80 mb-2 tracking-wide uppercase">Previously Scanned</h3>
                      <div className="relative">
                        <div 
                          className="flex gap-3 overflow-x-auto overflow-y-hidden scrollbar-hide"
                          style={{ scrollBehavior: 'smooth' }}
                        >
                          {previousItems.map((item, index) => {
                            const originalIndex = items.findIndex(i => i === item);
                            const isSelectedForOutfit = outfitSelections.has(item.sku);
                            return (
                              <div
                                key={`${item.sku}-${index}`}
                                onClick={() => mixMatchMode ? toggleOutfitSelection(item.sku) : setSelectedMainIndex(originalIndex)}
                                className={`relative bg-white rounded-xl p-4 border-2 cursor-pointer transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex-shrink-0 ${mixMatchMode ? (isSelectedForOutfit ? "border-[#4A3A2E] shadow-md" : "border-[#E5D5C8] hover:border-[#4A3A2E]/40") : "border-[#E5D5C8] hover:shadow-md hover:border-[#4A3A2E]/20"}`}
                                style={{ minWidth: '280px', height: '160px' }}
                              >
                                {mixMatchMode && (
                                  <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center z-10 ${isSelectedForOutfit ? "bg-[#4A3A2E] border-[#4A3A2E]" : "bg-white border-[#C0A898]"}`}>
                                    {isSelectedForOutfit && <span className="text-white text-xs font-bold">✓</span>}
                                  </div>
                                )}
                                <div className="flex gap-4 h-full">
                                  <div className="w-20 h-full bg-[#E5D5C8] rounded-xl overflow-hidden flex-shrink-0">
                                    {item.product?.imageUrl ? (
                                      <img
                                        src={item.product.imageUrl}
                                        alt={item.product.name || 'Product'}
                                        loading="lazy"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                        }}
                                      />
                                    ) : null}
                                    <div className={`w-full h-full flex items-center justify-center ${item.product?.imageUrl ? 'hidden' : ''}`}>
                                      <span className="text-[#3B2A21] text-sm font-medium">IMG</span>
                                    </div>
                                  </div>
                                  <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                                    <div className="space-y-2">
                                      <h4 className="font-semibold text-[#3B2A21] text-base leading-tight truncate">{item.product?.name || 'Unknown Product'}</h4>
                                      <p className="text-[#8C6A4B] text-sm">
                                        SKU: {item.sku} 
                                        {item.isDelivered && <span className="text-emerald-600 font-semibold ml-1">• Delivered</span>}
                                      </p>
                                    </div>
                                    <div className="space-y-2">
                                      <div className="flex flex-wrap gap-2">
                                        <span className="px-3 py-1.5 bg-[#E5D5C8] text-[#3B2A21] text-sm font-medium rounded-full">{item.derivedColor || item.product?.color || 'Unknown'}</span>
                                        <span className="px-3 py-1.5 bg-[#E5D5C8] text-[#3B2A21] text-sm font-medium rounded-full">{item.derivedSize ? `Size ${item.derivedSize}` : 'Size N/A'}</span>
                                        <span className="px-3 py-1.5 bg-[#E5D5C8] text-[#3B2A21] text-sm font-bold rounded-full">${item.product?.price || 75}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Scan New Item */}
                  <div className="flex-shrink-0 mt-2 pt-2 border-t border-[#E5D5C8]/30">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={sku}
                        onChange={(e) => {
                          const newSku = e.target.value;
                          setSku(newSku);
                          
                          // Clear any existing debounce timer
                          if (scanDebounceTimerRef.current) {
                            clearTimeout(scanDebounceTimerRef.current);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && sku.trim() && !isScanning && !requestInProgressRef.current) {
                            e.preventDefault();
                            // Clear debounce timer if user presses Enter
                            if (scanDebounceTimerRef.current) {
                              clearTimeout(scanDebounceTimerRef.current);
                              scanDebounceTimerRef.current = null;
                            }
                            handleScan();
                          }
                        }}
                        placeholder="Scan or enter SKU"
                        className="flex-1 px-4 py-3 border border-[#E5D5C8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A3A2E] focus:border-transparent"
                        autoFocus
                        disabled={isScanning}
                      />
                      <button
                        onClick={handleScan}
                        disabled={isScanning || !sku.trim()}
                        className="px-6 py-3 bg-[#4A3A2E] text-[#FDF7EF] rounded-xl font-medium hover:bg-[#3B2A21] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg flex items-center gap-2"
                      >
                        {isScanning ? (
                          <>
                            <LoadingSpinner size="sm" />
                            <span>Scanning...</span>
                          </>
                        ) : (
                          "Add Item"
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - 45% */}
        <div className="relative h-full overflow-hidden" style={{ flexBasis: "45%", width: "45%", maxWidth: "45%" }}>
          <div className="absolute inset-0 flex flex-col bg-[#FDF7EF] rounded-2xl border border-[#E5D5C8] p-4">

            {/* ── Mix & Match Outfit Board ───────────────────────────────── */}
            {mixMatchMode ? (
              <>
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                  <div>
                    <h2 className="text-2xl font-medium text-[#3B2A21]">
                      {outfitResult ? "Your Outfit" : "Select Items"}
                    </h2>
                    <p className="text-sm text-[#8C6A4B]">
                      {outfitResult ? "AI-curated complete look" : `${outfitSelections.size} item${outfitSelections.size !== 1 ? "s" : ""} selected`}
                    </p>
                  </div>
                </div>

                {!outfitResult && !loadingOutfit ? (
                  <div className="flex-1 flex flex-col">
                    <p className="text-sm text-[#8C6A4B] mb-4">
                      Tap items on the left to include them in your outfit. We&apos;ll find what&apos;s missing.
                    </p>
                    <div className="flex-1" />
                    <button
                      onClick={handleBuildOutfit}
                      disabled={outfitSelections.size === 0}
                      className="w-full py-4 bg-[#4A3A2E] text-white rounded-xl font-semibold text-lg hover:bg-[#3B2A21] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md"
                    >
                      Build Outfit
                    </button>
                  </div>
                ) : loadingOutfit ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-8 h-8 border-2 border-[#4A3A2E]/20 border-t-[#4A3A2E] rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-[#3B2A21]/70">Building your perfect outfit...</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto premium-scroll flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      {(["top", "bottom", "shoes", "accessory"] as const).map(cat => {
                        const inRoomItem = items.find(item =>
                          outfitSelections.has(item.sku) &&
                          (item.product?.category || "").toLowerCase() === cat
                        );
                        const recommended = outfitResult?.outfit?.[cat]?.[0];
                        const catLabel = cat === "accessory" ? "Accessory" : cat.charAt(0).toUpperCase() + cat.slice(1);

                        if (inRoomItem) {
                          return (
                            <div key={cat} className="bg-white rounded-xl border-2 border-emerald-400 p-3 flex flex-col">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-[#3B2A21]/50 uppercase tracking-wide">{catLabel}</span>
                                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">In Room</span>
                              </div>
                              <div className="w-full h-24 bg-[#E5D5C8] rounded-lg overflow-hidden mb-2">
                                {inRoomItem.product?.imageUrl && (
                                  <img src={inRoomItem.product.imageUrl} alt={inRoomItem.product.name || ""} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = "none"; }} />
                                )}
                              </div>
                              <p className="text-xs font-medium text-[#3B2A21] truncate">{inRoomItem.product?.name || "Unknown"}</p>
                              <p className="text-xs text-[#8C6A4B]">${inRoomItem.product?.price || ""}</p>
                            </div>
                          );
                        }

                        if (recommended) {
                          return (
                            <div key={cat} className="bg-white rounded-xl border border-[#E5D5C8] p-3 flex flex-col">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-[#3B2A21]/50 uppercase tracking-wide">{catLabel}</span>
                                {recommended.score > 0 && (
                                  <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">{Math.round(recommended.score * 100)}%</span>
                                )}
                              </div>
                              <div className="w-full h-24 bg-[#E5D5C8] rounded-lg overflow-hidden mb-2">
                                {recommended.imageUrl && (
                                  <img src={recommended.imageUrl} alt={recommended.name} loading="lazy" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = "none"; }} />
                                )}
                              </div>
                              <p className="text-xs font-medium text-[#3B2A21] truncate mb-0.5">{recommended.name}</p>
                              <p className="text-xs text-[#8C6A4B] mb-2">${recommended.price}</p>
                              <button
                                onClick={() => handleRequestSize({
                                  sku: recommended.productId,
                                  entityType: "SCAN" as const,
                                  sessionId: sessionId || "demo_session",
                                  createdAt: new Date().toISOString(),
                                  product: { productId: recommended.productId, name: recommended.name, color: recommended.color, category: recommended.category, price: recommended.price, articleType: recommended.articleType, gender: "unisex" }
                                })}
                                className="w-full text-xs border border-[#4A3A2E] text-[#4A3A2E] rounded-lg py-1.5 hover:bg-[#4A3A2E] hover:text-[#FDF7EF] transition-all"
                              >
                                Request
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div key={cat} className="bg-[#F5E9DA]/60 rounded-xl border border-dashed border-[#E5D5C8] p-3 flex flex-col items-center justify-center min-h-40">
                            <span className="text-xs font-semibold text-[#3B2A21]/30 uppercase tracking-wide">{catLabel}</span>
                            <span className="text-xs text-[#8C6A4B]/50 mt-1">Not found</span>
                          </div>
                        );
                      })}
                    </div>
                    {/* Save & Share */}
                    {!savedShareCode ? (
                      <button
                        onClick={handleSaveOutfit}
                        disabled={savingOutfit}
                        className="w-full mt-2 py-3 bg-[#4A3A2E] text-white rounded-xl font-semibold hover:bg-[#3B2A21] disabled:opacity-50 transition-all shadow-md flex items-center justify-center gap-2"
                      >
                        {savingOutfit ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : "Save & Share Outfit"}
                      </button>
                    ) : (
                      <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col gap-2">
                        <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Outfit Saved!</p>
                        <p className="text-sm text-[#3B2A21]">Open on your phone:</p>
                        <div className="bg-white rounded-lg px-4 py-3 border border-emerald-200 text-center">
                          <span className="text-3xl font-bold tracking-[0.3em] text-[#4A3A2E]">{savedShareCode}</span>
                        </div>
                        <p className="text-xs text-[#8C6A4B] text-center break-all">
                          {typeof window !== "undefined" ? `${window.location.origin}/outfit/${savedShareCode}` : ""}
                        </p>
                        <button
                          onClick={() => {
                            if (typeof window !== "undefined") {
                              navigator.clipboard?.writeText(`${window.location.origin}/outfit/${savedShareCode}`);
                            }
                          }}
                          className="w-full py-2 border border-[#4A3A2E] text-[#4A3A2E] text-sm rounded-lg hover:bg-[#4A3A2E] hover:text-white transition-all"
                        >
                          Copy Link
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => { setOutfitResult(null); setSavedShareCode(null); }}
                      className="w-full mt-2 py-2.5 border border-[#E5D5C8] text-[#3B2A21] text-sm rounded-xl hover:bg-[#F5E9DA] transition-all"
                    >
                      Rebuild Outfit
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* ── Normal Recommendations View ───────────────────────────── */
              <>
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h2 className="text-2xl font-medium text-[#3B2A21]">Complete Your Look</h2>
            </div>

            {/* Category Filter Pills - More Subtle */}
            {mainItem && (
              <div className="flex gap-2 mb-4 flex-shrink-0">
                {(["top", "bottom", "shoes", "accessory"] as const).map((category) => (
                  <button
                    key={category}
                    onClick={() => handleCategoryFilter(category)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                      activeCategory === category
                        ? "bg-[#4A3A2E] text-[#FDF7EF] shadow-lg"
                        : "bg-white/60 text-[#3B2A21] border border-[#E5D5C8]/50 hover:bg-white hover:shadow-md"
                    }`}
                  >
                    {category === "accessory" 
                      ? "Accessories" 
                      : category === "shoes"
                      ? "Shoes"
                      : category.charAt(0).toUpperCase() + category.slice(1) + "s"}
                  </button>
                ))}
              </div>
            )}
            
            {!mainItem ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-[#E5D5C8]/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">👕</span>
                  </div>
                  <p className="text-[#3B2A21]/70 text-lg">Scan an item to discover your perfect look</p>
                </div>
              </div>
            ) : loadingRecommendations ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-[#4A3A2E]/20 border-t-[#4A3A2E] rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-[#3B2A21]/70">Curating recommendations...</p>
                </div>
              </div>
            ) : activeCategory === "all" ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[#3B2A21]/70">Select a category to see recommendations</p>
              </div>
            ) : recommendations.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[#3B2A21]/70">No recommendations found for {activeCategory}</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-6 overflow-y-auto premium-scroll pr-2">
                {/* Perfect Match - Hero Card */}
                {recommendations[0] && (
                  <div className="flex-shrink-0">
                    <h3 className="text-sm font-medium text-[#3B2A21]/80 mb-3 tracking-wide uppercase">Perfect Match</h3>
                    <div className="bg-white rounded-2xl p-6 border border-[#E5D5C8] shadow-sm hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]">
                      <div className="flex gap-4">
                        <div className="w-24 h-24 bg-[#E5D5C8] rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {recommendations[0].imageUrl ? (
                            <img
                              src={recommendations[0].imageUrl}
                              alt={recommendations[0].name}
                              loading="lazy"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`w-full h-full flex items-center justify-center ${recommendations[0].imageUrl ? 'hidden' : ''}`}>
                            <span className="text-[#3B2A21] text-sm">IMG</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col">
                          <h4 className="font-semibold text-[#3B2A21] text-base mb-1">{recommendations[0].name}</h4>
                          <div className="text-sm text-[#8C6A4B] mb-3">${recommendations[0].price}</div>
                          <div className="flex items-center gap-2 mb-4">
                            <span className="px-3 py-1 bg-[#E5D5C8] text-[#3B2A21] text-xs rounded-full">{recommendations[0].color}</span>
                            {recommendations[0].score > 0 && (
                              <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded-full">
                                {Math.round(recommendations[0].score * 100)}% Match
                              </span>
                            )}
                          </div>
                          <button 
                            onClick={() => handleRequestSize({
                              sku: recommendations[0].productId,
                              entityType: 'SCAN' as const,
                              sessionId: sessionId || 'demo_session',
                              createdAt: new Date().toISOString(),
                              product: {
                                productId: recommendations[0].productId,
                                name: recommendations[0].name,
                                color: recommendations[0].color,
                                category: recommendations[0].category,
                                price: recommendations[0].price,
                                articleType: recommendations[0].articleType,
                                gender: 'unisex'
                              }
                            })}
                            className="bg-[#4A3A2E] text-[#FDF7EF] rounded-xl py-2 px-4 text-sm font-medium hover:bg-[#3B2A21] transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
                          >
                            Request This Item
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Complete the Look - 2 Items */}
                {recommendations.length > 1 && (
                  <div className="flex-shrink-0">
                    <h3 className="text-sm font-medium text-[#3B2A21]/80 mb-3 tracking-wide uppercase">Complete the Look</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {recommendations.slice(1, 3).map((rec) => (
                        <div key={rec.productId} className="bg-white rounded-xl p-4 border border-[#E5D5C8] hover:shadow-md transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]">
                          <div className="w-16 h-16 bg-[#E5D5C8] rounded-lg flex items-center justify-center mx-auto mb-3 overflow-hidden">
                            {rec.imageUrl ? (
                              <img
                                src={rec.imageUrl}
                                alt={rec.name}
                                loading="lazy"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <div className={`w-full h-full flex items-center justify-center ${rec.imageUrl ? 'hidden' : ''}`}>
                              <span className="text-[#3B2A21] text-xs">IMG</span>
                            </div>
                          </div>
                          <h4 className="font-medium text-[#3B2A21] text-sm mb-1 text-center truncate">{rec.name}</h4>
                          <div className="text-xs text-[#8C6A4B] text-center mb-2">${rec.price}</div>
                          <div className="flex justify-center mb-3">
                            <span className="px-2 py-1 bg-[#E5D5C8] text-[#3B2A21] text-xs rounded-full">{rec.color}</span>
                          </div>
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
                            className="w-full text-xs border border-[#4A3A2E] text-[#4A3A2E] rounded-lg py-2 hover:bg-[#4A3A2E] hover:text-[#FDF7EF] transition-all duration-200 transform hover:scale-105 active:scale-95"
                          >
                            Request
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* You Might Also Like - Remaining Items */}
                {recommendations.length > 3 && (
                  <div className="flex-1 min-h-0">
                    <h3 className="text-sm font-medium text-[#3B2A21]/80 mb-3 tracking-wide uppercase">You Might Also Like</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {recommendations.slice(3, 5).map((rec) => (
                        <div key={rec.productId} className="bg-white rounded-xl p-3 border border-[#E5D5C8] hover:shadow-md transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]">
                          <div className="w-12 h-12 bg-[#E5D5C8] rounded-lg flex items-center justify-center mx-auto mb-2 overflow-hidden">
                            {rec.imageUrl ? (
                              <img
                                src={rec.imageUrl}
                                alt={rec.name}
                                loading="lazy"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <div className={`w-full h-full flex items-center justify-center ${rec.imageUrl ? 'hidden' : ''}`}>
                              <span className="text-[#3B2A21] text-xs">IMG</span>
                            </div>
                          </div>
                          <h4 className="font-medium text-[#3B2A21] text-xs mb-1 text-center truncate">{rec.name}</h4>
                          <div className="text-xs text-[#8C6A4B] text-center mb-2">${rec.price}</div>
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
                            className="w-full text-xs border border-[#4A3A2E] text-[#4A3A2E] rounded-lg py-1.5 hover:bg-[#4A3A2E] hover:text-[#FDF7EF] transition-all duration-200 transform hover:scale-105 active:scale-95"
                          >
                            Request
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Existing Modals - Keep as-is */}
      <Modal
        isOpen={isRequestModalOpen}
        onClose={() => {
          if (!isSubmittingRequest) {
            setIsRequestModalOpen(false);
            setSelectedItem(null);
          }
        }}
        title="Request Different Size or Color"
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Current Item</p>
              <p className="font-medium text-gray-900">{selectedItem.product?.name || 'Unknown Product'}</p>
              <p className="text-sm text-gray-600">
                {selectedItem.derivedColor || selectedItem.product?.color || 'Unknown'} • {selectedItem.derivedSize ? `Size ${selectedItem.derivedSize}` : 'Size N/A'}
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
                  if (!isSubmittingRequest) {
                    setIsRequestModalOpen(false);
                    setSelectedItem(null);
                  }
                }}
                disabled={isSubmittingRequest}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed text-gray-700 font-medium rounded-lg transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={submitRequest}
                disabled={isSubmittingRequest}
                className="flex-1 px-4 py-2.5 bg-[#0066CC] hover:bg-[#0052A3] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
              >
                {isSubmittingRequest ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>Sending...</span>
                  </>
                ) : (
                  "Send Request"
                )}
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

      {/* End Session Modal */}
      <EndSessionModal
        isOpen={isEndSessionModalOpen}
        onClose={() => setIsEndSessionModalOpen(false)}
        onEndSession={handleEndSession}
        items={items.map(item => ({
          sku: item.sku,
          product: item.product ? {
            name: item.product.name,
            productId: item.product.productId,
          } : undefined,
        }))}
        sessionId={sessionId || ""}
      />

      {/* Notification */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      {/* ── In-Session Preferences Modal ─────────────────────────────────── */}
      {isPrefsModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 flex flex-col gap-6">
            <div>
              <h2 className="text-2xl font-bold text-[#3B2A21] mb-1">Personalise Your Experience</h2>
              <p className="text-sm text-[#8C6A4B]">Help us recommend the perfect outfit for you.</p>
            </div>

            {/* Sizes */}
            <div>
              <p className="text-sm font-semibold text-[#3B2A21] mb-3 uppercase tracking-wide">Your Sizes</p>
              <div className="grid grid-cols-3 gap-3">
                {(["XS","S","M","L","XL","XXL"] as const).map(s => (
                  <button key={`top-${s}`} onClick={() => setPrefTopSize(prefTopSize === s ? "" : s)}
                    className={`py-2 rounded-xl text-sm font-medium border transition-all ${prefTopSize === s ? "bg-[#4A3A2E] text-white border-[#4A3A2E]" : "border-[#E5D5C8] text-[#3B2A21] hover:border-[#4A3A2E]"}`}>
                    Top {s}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-3 mt-2">
                {(["28","30","32","34","36","38","40","42"] as const).map(s => (
                  <button key={`bot-${s}`} onClick={() => setPrefBottomSize(prefBottomSize === s ? "" : s)}
                    className={`py-2 rounded-xl text-sm font-medium border transition-all ${prefBottomSize === s ? "bg-[#4A3A2E] text-white border-[#4A3A2E]" : "border-[#E5D5C8] text-[#3B2A21] hover:border-[#4A3A2E]"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Colour preferences */}
            <div>
              <p className="text-sm font-semibold text-[#3B2A21] mb-3 uppercase tracking-wide">Preferred Colours <span className="font-normal normal-case text-[#8C6A4B]">(pick any)</span></p>
              <div className="flex flex-wrap gap-2">
                {["black","white","navy","grey","beige","brown","green","red","pink","blue","denim","olive"].map(c => (
                  <button key={c} onClick={() => togglePrefColor(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border capitalize transition-all ${prefColors.includes(c) ? "bg-[#4A3A2E] text-white border-[#4A3A2E]" : "border-[#E5D5C8] text-[#3B2A21] hover:border-[#4A3A2E]"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Style preferences */}
            <div>
              <p className="text-sm font-semibold text-[#3B2A21] mb-3 uppercase tracking-wide">Your Style</p>
              <div className="flex flex-wrap gap-2">
                {["casual","formal","sports","ethnic","party","smart casual"].map(s => (
                  <button key={s} onClick={() => togglePrefStyle(s)}
                    className={`px-4 py-2 rounded-full text-sm font-medium border capitalize transition-all ${prefStyles.includes(s) ? "bg-[#4A3A2E] text-white border-[#4A3A2E]" : "border-[#E5D5C8] text-[#3B2A21] hover:border-[#4A3A2E]"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setIsPrefsModalOpen(false)}
                className="flex-1 py-3 border border-[#E5D5C8] text-[#3B2A21] rounded-xl font-medium hover:bg-[#F5E9DA] transition-all">
                Skip
              </button>
              <button onClick={handleSavePreferences}
                className="flex-1 py-3 bg-[#4A3A2E] text-white rounded-xl font-semibold hover:bg-[#3B2A21] transition-all shadow-md">
                Save Preferences
              </button>
            </div>

            {/* Optional: link a loyalty account */}
            <p className="text-center text-xs text-[#8C6A4B]">
              Have a loyalty account?{" "}
              <button onClick={() => { setIsPrefsModalOpen(false); setIsCustomerLoginOpen(true); }}
                className="underline font-medium text-[#4A3A2E]">
                Link it for personalised recommendations
              </button>
            </p>
          </div>
        </div>
      )}

      {/* ── Customer Login Modal ─────────────────────────────────────────── */}
      {isCustomerLoginOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 flex flex-col gap-5">

            {/* If already linked — show profile summary */}
            {customerId && customerProfile ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#4A3A2E] flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                    {customerId[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-[#3B2A21] text-lg">Welcome back!</p>
                    <p className="text-sm text-[#8C6A4B]">{customerId} · {customerProfile.visitCount || 1} visit{(customerProfile.visitCount || 1) !== 1 ? "s" : ""}</p>
                  </div>
                </div>

                {/* Derived style summary */}
                {customerProfile.derivedStyle && (
                  <div className="bg-[#F5E9DA] rounded-2xl p-4 flex flex-col gap-3">
                    <p className="text-xs font-semibold text-[#3B2A21] uppercase tracking-wide">Your Style Profile</p>
                    <div className="flex flex-wrap gap-1.5">
                      {customerProfile.derivedStyle.topColors.map(c => (
                        <span key={c} className="px-2.5 py-1 bg-white rounded-full text-xs font-medium text-[#3B2A21] border border-[#E5D5C8] capitalize">{c}</span>
                      ))}
                      <span className="px-2.5 py-1 bg-[#4A3A2E] text-white rounded-full text-xs font-medium capitalize">{customerProfile.derivedStyle.dominantStyle}</span>
                      <span className="px-2.5 py-1 bg-white rounded-full text-xs font-medium text-[#3B2A21] border border-[#E5D5C8]">avg ${customerProfile.derivedStyle.avgPrice}</span>
                    </div>
                  </div>
                )}

                {/* Past purchases */}
                {customerProfile.purchaseHistory && customerProfile.purchaseHistory.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[#3B2A21] uppercase tracking-wide mb-2">Recent Purchases</p>
                    <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                      {customerProfile.purchaseHistory.slice(-5).reverse().map((p, i) => (
                        <div key={i} className="flex items-center justify-between bg-[#F5E9DA] rounded-xl px-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-[#3B2A21]">{p.name}</p>
                            <p className="text-xs text-[#8C6A4B] capitalize">{p.color} · {p.articleType}</p>
                          </div>
                          <p className="text-sm font-semibold text-[#3B2A21]">${p.price}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-[#8C6A4B] text-center">Recommendations are now personalised based on your purchase history.</p>
                <button onClick={() => setIsCustomerLoginOpen(false)}
                  className="w-full py-3 bg-[#4A3A2E] text-white rounded-xl font-semibold hover:bg-[#3B2A21] transition-all shadow-md">
                  Continue Shopping
                </button>
              </>
            ) : (
              /* Not yet linked — show login form */
              <>
                <div>
                  <h2 className="text-2xl font-bold text-[#3B2A21] mb-1">Link Loyalty Account</h2>
                  <p className="text-sm text-[#8C6A4B]">Enter your phone number or email to load your profile and get personalised recommendations.</p>
                </div>
                <input
                  type="text"
                  value={customerIdInput}
                  onChange={e => setCustomerIdInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCustomerLogin()}
                  placeholder="Phone number or email"
                  className="px-4 py-3 border border-[#E5D5C8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A3A2E] text-[#3B2A21]"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button onClick={() => setIsCustomerLoginOpen(false)}
                    className="flex-1 py-3 border border-[#E5D5C8] text-[#3B2A21] rounded-xl font-medium hover:bg-[#F5E9DA] transition-all">
                    Cancel
                  </button>
                  <button onClick={handleCustomerLogin} disabled={!customerIdInput.trim()}
                    className="flex-1 py-3 bg-[#4A3A2E] text-white rounded-xl font-semibold hover:bg-[#3B2A21] disabled:opacity-50 transition-all shadow-md">
                    Link Account
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
