"use client";

import { useState } from "react";
import Modal from "./Modal";

interface EndSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEndSession: (feedback: SessionFeedback) => Promise<void>;
  items: Array<{
    sku: string;
    product?: {
      name: string;
      productId: string;
    };
  }>;
  sessionId: string;
}

export interface SessionFeedback {
  overallRating: number;
  overallComment?: string;
  itemFeedback: Array<{
    sku: string;
    purchased: boolean;
    rating?: number;
    comment?: string;
    fit?: "perfect" | "too_small" | "too_large" | "just_right";
    color?: "as_expected" | "different" | "better";
  }>;
  experienceRating: number;
  experienceComment?: string;
  wouldReturn: boolean;
}

export default function EndSessionModal({
  isOpen,
  onClose,
  onEndSession,
  items,
  sessionId,
}: EndSessionModalProps) {
  const [step, setStep] = useState<"overall" | "items" | "experience" | "summary">("overall");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Overall feedback
  const [overallRating, setOverallRating] = useState(5);
  const [overallComment, setOverallComment] = useState("");
  
  // Item feedback
  const [itemFeedback, setItemFeedback] = useState<SessionFeedback["itemFeedback"]>(
    items.map(item => ({
      sku: item.sku,
      purchased: false,
      rating: 5,
      comment: "",
    }))
  );
  
  // Experience feedback
  const [experienceRating, setExperienceRating] = useState(5);
  const [experienceComment, setExperienceComment] = useState("");
  const [wouldReturn, setWouldReturn] = useState(true);

  const handleItemFeedbackChange = (sku: string, field: keyof SessionFeedback["itemFeedback"][0], value: any) => {
    setItemFeedback(prev =>
      prev.map(item =>
        item.sku === sku ? { ...item, [field]: value } : item
      )
    );
  };

  const handleNext = () => {
    if (step === "overall") setStep("items");
    else if (step === "items") setStep("experience");
    else if (step === "experience") setStep("summary");
  };

  const handleBack = () => {
    if (step === "summary") setStep("experience");
    else if (step === "experience") setStep("items");
    else if (step === "items") setStep("overall");
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const feedback: SessionFeedback = {
        overallRating,
        overallComment: overallComment || undefined,
        itemFeedback,
        experienceRating,
        experienceComment: experienceComment || undefined,
        wouldReturn,
      };
      
      await onEndSession(feedback);
      // Modal will close via parent component
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      // Error handling can be added here
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    // Submit minimal feedback if user skips
    const minimalFeedback: SessionFeedback = {
      overallRating: 3,
      itemFeedback: items.map(item => ({
        sku: item.sku,
        purchased: false,
      })),
      experienceRating: 3,
      wouldReturn: false,
    };
    
    setIsSubmitting(true);
    try {
      await onEndSession(minimalFeedback);
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = step === "overall" ? 25 : step === "items" ? 50 : step === "experience" ? 75 : 100;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="End Session - Share Your Feedback">
      <div className="space-y-6">
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-[#4A3A2E] h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>

        {/* Step 1: Overall Rating */}
        {step === "overall" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                How was your overall experience?
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Your feedback helps us improve the fitting room experience
              </p>
            </div>
            
            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  onClick={() => setOverallRating(rating)}
                  className={`w-12 h-12 rounded-full text-xl font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#4A3A2E] focus:ring-offset-2 ${
                    overallRating >= rating
                      ? "bg-[#4A3A2E] text-white"
                      : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                  }`}
                  aria-label={`Rate ${rating} out of 5`}
                >
                  ★
                </button>
              ))}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional comments (optional)
              </label>
              <textarea
                value={overallComment}
                onChange={(e) => setOverallComment(e.target.value)}
                placeholder="Tell us what you liked or what we can improve..."
                rows={3}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4A3A2E] focus:border-transparent transition-all resize-none"
              />
            </div>
          </div>
        )}

        {/* Step 2: Item Feedback */}
        {step === "items" && (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Tell us about the items you tried
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Did you purchase any items? How was the fit?
              </p>
            </div>
            
            {items.map((item, index) => {
              const feedback = itemFeedback.find(f => f.sku === item.sku);
              if (!feedback) return null;
              
              return (
                <div
                  key={item.sku}
                  className="border border-gray-200 rounded-lg p-4 space-y-3"
                >
                  <h4 className="font-medium text-gray-900">
                    {item.product?.name || `Item ${index + 1}`}
                  </h4>
                  
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={feedback.purchased}
                        onChange={(e) =>
                          handleItemFeedbackChange(item.sku, "purchased", e.target.checked)
                        }
                        className="w-4 h-4 text-[#4A3A2E] border-gray-300 rounded focus:ring-[#4A3A2E]"
                      />
                      <span className="text-sm text-gray-700">Purchased</span>
                    </label>
                  </div>
                  
                  {feedback.purchased && (
                    <div className="space-y-2 pl-6 border-l-2 border-[#4A3A2E]">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Rating
                        </label>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <button
                              key={rating}
                              onClick={() =>
                                handleItemFeedbackChange(item.sku, "rating", rating)
                              }
                              className={`w-8 h-8 rounded text-sm ${
                                (feedback.rating || 0) >= rating
                                  ? "bg-[#4A3A2E] text-white"
                                  : "bg-gray-100 text-gray-400"
                              }`}
                              aria-label={`Rate ${rating} out of 5`}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Fit
                        </label>
                        <select
                          value={feedback.fit || ""}
                          onChange={(e) =>
                            handleItemFeedbackChange(item.sku, "fit", e.target.value as any)
                          }
                          className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#4A3A2E]"
                        >
                          <option value="">Select fit</option>
                          <option value="perfect">Perfect</option>
                          <option value="too_small">Too Small</option>
                          <option value="too_large">Too Large</option>
                          <option value="just_right">Just Right</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Comments
                        </label>
                        <textarea
                          value={feedback.comment || ""}
                          onChange={(e) =>
                            handleItemFeedbackChange(item.sku, "comment", e.target.value)
                          }
                          placeholder="Any additional notes..."
                          rows={2}
                          className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#4A3A2E] resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Step 3: Experience Feedback */}
        {step === "experience" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                How was the fitting room experience?
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Help us understand how we can improve
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Overall experience rating
              </label>
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => setExperienceRating(rating)}
                    className={`w-12 h-12 rounded-full text-xl font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#4A3A2E] focus:ring-offset-2 ${
                      experienceRating >= rating
                        ? "bg-[#4A3A2E] text-white"
                        : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                    }`}
                    aria-label={`Rate ${rating} out of 5`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comments about the experience
              </label>
              <textarea
                value={experienceComment}
                onChange={(e) => setExperienceComment(e.target.value)}
                placeholder="Was the staff helpful? How was the technology? Any suggestions?"
                rows={4}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4A3A2E] focus:border-transparent transition-all resize-none"
              />
            </div>
            
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wouldReturn}
                  onChange={(e) => setWouldReturn(e.target.checked)}
                  className="w-4 h-4 text-[#4A3A2E] border-gray-300 rounded focus:ring-[#4A3A2E]"
                />
                <span className="text-sm text-gray-700">
                  I would use this fitting room system again
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Step 4: Summary */}
        {step === "summary" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Review Your Feedback
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Please review before submitting
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div>
                <span className="font-medium">Overall Rating: </span>
                <span>{overallRating}/5</span>
              </div>
              <div>
                <span className="font-medium">Items Purchased: </span>
                <span>{itemFeedback.filter(f => f.purchased).length} of {items.length}</span>
              </div>
              <div>
                <span className="font-medium">Experience Rating: </span>
                <span>{experienceRating}/5</span>
              </div>
              <div>
                <span className="font-medium">Would Return: </span>
                <span>{wouldReturn ? "Yes" : "No"}</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          {step !== "overall" && (
            <button
              onClick={handleBack}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
            >
              Back
            </button>
          )}
          
          {step !== "summary" ? (
            <button
              onClick={handleNext}
              className="flex-1 px-4 py-2.5 bg-[#4A3A2E] hover:bg-[#3B2A21] text-white font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#4A3A2E] focus:ring-offset-2"
            >
              Next
            </button>
          ) : (
            <>
              <button
                onClick={handleSkip}
                disabled={isSubmitting}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
              >
                Skip
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2.5 bg-[#4A3A2E] hover:bg-[#3B2A21] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#4A3A2E] focus:ring-offset-2"
              >
                {isSubmitting ? "Submitting..." : "Submit Feedback"}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

