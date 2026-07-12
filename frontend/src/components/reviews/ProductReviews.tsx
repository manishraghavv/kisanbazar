"use client";

import { useEffect, useState } from "react";
import { useReviewStore } from "@/stores/reviewStore";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import { Star, ThumbsUp, Trash2, Loader2, CheckCircle2 } from "lucide-react";

function StarRating({
  value,
  onChange,
  size = 20,
  readonly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readonly?: boolean;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange?.(i)}
          onMouseEnter={() => !readonly && setHovered(i)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={readonly ? "cursor-default" : "cursor-pointer"}
        >
          <Star
            size={size}
            className={
              (hovered || value) >= i
                ? "text-amber-400 fill-amber-400"
                : "text-gray-300 dark:text-gray-600 fill-none"
            }
          />
        </button>
      ))}
    </div>
  );
}

export function StarDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            size={size}
            className={
              rating >= i
                ? "text-amber-400 fill-amber-400"
                : rating >= i - 0.5
                ? "text-amber-400 fill-amber-200"
                : "text-gray-300 dark:text-gray-600 fill-none"
            }
          />
        ))}
      </div>
    </div>
  );
}

export default function ProductReviews({ productId }: { productId: string }) {
  const { user } = useAuthStore();
  const {
    reviews,
    totals,
    avgRatings,
    isLoading,
    isSaving,
    fetchReviews,
    createReview,
    markHelpful,
    deleteReview,
  } = useReviewStore();

  const productReviews = reviews[productId] ?? [];
  const total = totals[productId] ?? 0;
  const avgRating = avgRatings[productId] ?? 0;

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [showForm, setShowForm] = useState(false);
  const hasReviewed = user
    ? productReviews.some((r) => r.userId === user.id)
    : false;

  useEffect(() => {
    fetchReviews(productId).catch(() => {});
  }, [productId, fetchReviews]);

  async function handleSubmit() {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }
    try {
      await createReview(productId, { rating, comment: comment.trim() || undefined });
      toast.success("Review submitted");
      setRating(0);
      setComment("");
      setShowForm(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? "Failed to submit review");
    }
  }

  async function handleDelete(reviewId: string) {
    try {
      await deleteReview(reviewId, productId);
      toast.success("Review deleted");
    } catch {
      toast.error("Failed to delete review");
    }
  }

  async function handleHelpful(reviewId: string) {
    try {
      await markHelpful(reviewId, productId);
    } catch {
      toast.error("Failed to mark helpful");
    }
  }

  const ratingBreakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: productReviews.filter((r) => r.rating === star).length,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Reviews <span className="text-gray-400 dark:text-gray-500 font-normal text-base">({total})</span>
        </h2>
        {user && !hasReviewed && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors"
          >
            Write a Review
          </button>
        )}
      </div>

      {/* Summary */}
      {total > 0 && (
        <div className="flex flex-col sm:flex-row gap-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-5">
          <div className="flex flex-col items-center justify-center min-w-[100px]">
            <p className="text-4xl font-bold text-gray-900 dark:text-gray-100">
              {avgRating.toFixed(1)}
            </p>
            <StarDisplay rating={avgRating} size={16} />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{total} reviews</p>
          </div>
          <div className="flex-1 space-y-1.5">
            {ratingBreakdown.map(({ star, count }) => (
              <div key={star} className="flex items-center gap-2 text-sm">
                <span className="w-3 text-right text-gray-500 dark:text-gray-400">{star}</span>
                <Star size={12} className="text-amber-400 fill-amber-400 shrink-0" />
                <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all"
                    style={{ width: total > 0 ? `${(count / total) * 100}%` : "0%" }}
                  />
                </div>
                <span className="w-6 text-right text-gray-500 dark:text-gray-400">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Write review form */}
      {showForm && user && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-900/10 p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Your Review</h3>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Rating *</p>
            <StarRating value={rating} onChange={setRating} size={24} />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Comment</p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Share your experience..."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setShowForm(false); setRating(0); setComment(""); }}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSaving || rating === 0}
              className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
              Submit Review
            </button>
          </div>
        </div>
      )}

      {/* Review list */}
      {isLoading && productReviews.length === 0 ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-emerald-700 dark:text-emerald-400" />
        </div>
      ) : productReviews.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 py-10 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">No reviews yet. Be the first to review!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {productReviews.map((review) => (
            <div
              key={review.id}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {review.user.fullName}
                    </p>
                    {review.isVerifiedBuyer && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 size={10} /> Verified
                      </span>
                    )}
                  </div>
                  <StarDisplay rating={review.rating} size={12} />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(review.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>
                  {user?.id === review.userId && (
                    <button
                      onClick={() => handleDelete(review.id)}
                      className="ml-1 rounded p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
              {review.comment && (
                <p className="text-sm text-gray-700 dark:text-gray-300">{review.comment}</p>
              )}
              <button
                onClick={() => handleHelpful(review.id)}
                className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                <ThumbsUp size={12} />
                Helpful ({review.helpfulCount})
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
