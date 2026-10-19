import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ReviewService } from '../../services/review.service';
import { AdminReview, AdminReviewPhoto, ReviewPhotoFilter, ReviewStatus } from '../../models/admin-review';
import { PhotoLightbox } from '../../components/photo-lightbox/photo-lightbox';
import { blobErrorMessage, downloadBlob } from '../../utils/download.util';
import { AdminNav } from '../admin-nav/admin-nav';
import { Spinner } from '../../components/spinner/spinner';
import { Pager } from '../../components/pager/pager';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { debounced } from '../../utils/debounce.util';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationService } from '../../services/notification.service';

const PAGE_SIZE = 20;
const STATUSES: ReviewStatus[] = ['Approved', 'Rejected'];

@Component({
  selector: 'app-admin-reviews',
  standalone: true,
  imports: [Spinner, DatePipe, FormsModule, AdminNav, Pager, PhotoLightbox],
  templateUrl: './reviews.html',
  styleUrls: ['../admin-shared.css', './reviews.css']
})
export class AdminReviews implements OnInit {
  private reviewService = inject(ReviewService);
  private confirmDialog = inject(ConfirmDialogService);
  private toast = inject(ToastService);

  statuses = STATUSES;

  reviews = signal<AdminReview[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');
  deletingReviewId = signal<number | null>(null);
  updatingStatusId = signal<number | null>(null);

  page = signal(1);
  totalPages = signal(1);
  totalCount = signal(0);
  searchTerm = signal('');
  minRating = signal<number | null>(null);
  statusFilter = signal<ReviewStatus | null>(null);
  photoFilter = signal<ReviewPhotoFilter>('');
  hasFilters = computed(
    () => !!this.searchTerm().trim() || this.minRating() !== null || !!this.statusFilter() || !!this.photoFilter()
  );

  isExporting = signal(false);
  updatingPhotoId = signal<number | null>(null);
  photoViewer = signal<{ urls: string[]; index: number; caption: string } | null>(null);

  selectedIds = signal<Set<number>>(new Set());
  bulkStatus = signal<ReviewStatus | ''>('');
  isBulkUpdating = signal(false);

  replyingReviewId = signal<number | null>(null);
  replyDraft = signal('');
  isSavingReply = signal(false);

  private loadSubscription?: Subscription;
  // Typing searches once the admin pauses, instead of on every keystroke.
  onSearchInput = debounced((term: string) => this.onSearchChange(term));

  constructor() {
    // A customer posted or deleted a review (SignalR) - reload the list.
    inject(NotificationService).adminDataChanged
      .pipe(takeUntilDestroyed())
      .subscribe(event => {
        if (event.kind === 'review') {
          this.loadReviews();
        }
      });
  }

  ngOnInit(): void {
    this.loadReviews();
  }

  getStars(rating: number): string {
    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }

  onSearchChange(term: string): void {
    this.onSearchInput.cancel();
    this.searchTerm.set(term);
    this.page.set(1);
    this.loadReviews();
  }
  
  onMinRatingChange(value: string): void {
    this.minRating.set(value ? Number(value) : null);
    this.page.set(1);
    this.loadReviews();
  }

  onStatusFilterChange(value: string): void {
    this.statusFilter.set((value as ReviewStatus) || null);
    this.page.set(1);
    this.loadReviews();
  }

  onPhotoFilterChange(value: string): void {
    this.photoFilter.set(value as ReviewPhotoFilter);
    this.page.set(1);
    this.loadReviews();
  }

  clearFilters(): void {
    // Sets every filter signal first, then reloads once - calling each
    // on*Change() method individually would fire 3 separate requests with
    // different partial filter states, and a slower one resolving after
    // the last could overwrite the correct (cleared) result.
    this.onSearchInput.cancel();
    this.searchTerm.set('');
    this.minRating.set(null);
    this.statusFilter.set(null);
    this.photoFilter.set('');
    this.page.set(1);
    this.loadReviews();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.loadReviews();
  }                                    

  loadReviews(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.selectedIds.set(new Set());

    // A newer load (next page, new search) replaces any request still in flight.
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.reviewService
      .getReviewsAdminPaged(
        this.page(),
        PAGE_SIZE,
        this.searchTerm().trim() || undefined,
        this.minRating(),
        this.statusFilter(),
        this.photoFilter()
      )
      .subscribe({
        next: result => {
          // Removing the last row on the last page leaves it empty; step back a page.
          if (result.items.length === 0 && this.page() > 1) {
            this.page.set(Math.max(1, result.totalPages));
            this.loadReviews();
            return;
          }
          this.reviews.set(result.items);
          this.totalPages.set(result.totalPages || 1);
          this.totalCount.set(result.totalCount);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load reviews.');
          this.isLoading.set(false);
        }
      });
  }

  isSelected(review: AdminReview): boolean {
    return this.selectedIds().has(review.reviewId);
  }

  toggleSelected(review: AdminReview): void {
    this.selectedIds.update(ids => {
      const next = new Set(ids);
      if (next.has(review.reviewId)) {
        next.delete(review.reviewId);
      } else {
        next.add(review.reviewId);
      }
      return next;
    });
  }

  isAllSelected(): boolean {
    const items = this.reviews();
    return items.length > 0 && items.every(r => this.selectedIds().has(r.reviewId));
  }

  toggleSelectAll(): void {
    if (this.isAllSelected()) {
      this.selectedIds.set(new Set());
    } else {
      this.selectedIds.set(new Set(this.reviews().map(r => r.reviewId)));
    }
  }

  updateStatus(review: AdminReview, status: ReviewStatus, select?: HTMLSelectElement): void {
    if (status === review.status) {
      return;
    }

    this.updatingStatusId.set(review.reviewId);

    this.reviewService.updateStatus(review.reviewId, status).subscribe({
      next: () => {
        this.updatingStatusId.set(null);
        this.reviews.update(items =>
          items.map(r => (r.reviewId === review.reviewId ? { ...r, status } : r))
        );
        this.toast.success(`Review marked as ${status}.`);
      },
      error: (error: HttpErrorResponse) => {
        this.updatingStatusId.set(null);
        // The bound value never changed, so Angular won't redraw it - put the saved status back by hand.
        if (select) {
          select.value = review.status;
        }
        this.toast.error(error.error?.message || 'Unable to update review status.');
      }
    });
  }

  applyBulkStatus(): void {
    const status = this.bulkStatus();
    const ids = Array.from(this.selectedIds());

    if (!status || ids.length === 0) {
      return;
    }

    this.isBulkUpdating.set(true);

    this.reviewService.bulkUpdateStatus(ids, status).subscribe({
      next: () => {
        this.isBulkUpdating.set(false);
        this.reviews.update(items =>
          items.map(r => (ids.includes(r.reviewId) ? { ...r, status } : r))
        );
        this.selectedIds.set(new Set());
        this.bulkStatus.set('');
        this.toast.success(`${ids.length} review(s) marked as ${status}.`);
      },
      error: (error: HttpErrorResponse) => {
        this.isBulkUpdating.set(false);
        this.toast.error(error.error?.message || 'Unable to update selected reviews.');
      }
    });
  }

  startReply(review: AdminReview): void {
    this.replyingReviewId.set(review.reviewId);
    this.replyDraft.set(review.adminReply || '');
  }

  cancelReply(): void {
    this.replyingReviewId.set(null);
    this.replyDraft.set('');
  }

  saveReply(review: AdminReview): void {
    const reply = this.replyDraft().trim();
    this.isSavingReply.set(true);

    this.reviewService.updateReply(review.reviewId, reply).subscribe({
      next: () => {
        this.isSavingReply.set(false);
        this.replyingReviewId.set(null);
        this.reviews.update(items =>
          items.map(r =>
            r.reviewId === review.reviewId
              ? { ...r, adminReply: reply || undefined, adminReplyAt: reply ? new Date().toISOString() : undefined }
              : r
          )
        );
        this.toast.success(reply ? 'Reply saved.' : 'Reply removed.');
      },
      error: (error: HttpErrorResponse) => {
        this.isSavingReply.set(false);
        this.toast.error(error.error?.message || 'Unable to save reply.');
      }
    });
  }

  // Exports every review matching the current filters (not just this page).
  exportCsv(): void {
    if (this.isExporting()) {
      return;
    }

    this.isExporting.set(true);

    this.reviewService
      .exportReviewsCsv(this.searchTerm().trim() || undefined, this.minRating(), this.statusFilter(), this.photoFilter())
      .subscribe({
        next: blob => {
          this.isExporting.set(false);
          downloadBlob(blob, 'reviews-export.csv');
        },
        error: (err: unknown) => {
          this.isExporting.set(false);
          blobErrorMessage(err, 'Unable to export reviews.').then(message => this.toast.error(message));
        }
      });
  }

  openPhotos(review: AdminReview, index: number): void {
    this.photoViewer.set({
      urls: review.images.map(photo => photo.imageUrl),
      index,
      caption: `${review.userName} · ${review.productName}`
    });
  }

  pendingPhotoCount(review: AdminReview): number {
    return review.images.filter(photo => photo.status === 'Pending').length;
  }

  setPhotoStatus(review: AdminReview, photo: AdminReviewPhoto, status: 'Approved' | 'Rejected'): void {
    if (photo.status === status || this.updatingPhotoId() !== null) {
      return;
    }

    this.updatingPhotoId.set(photo.reviewImageId);

    this.reviewService.updatePhotoStatus(photo.reviewImageId, status).subscribe({
      next: () => {
        this.updatingPhotoId.set(null);
        this.reviews.update(items =>
          items.map(r =>
            r.reviewId === review.reviewId
              ? { ...r, images: r.images.map(i => (i.reviewImageId === photo.reviewImageId ? { ...i, status } : i)) }
              : r
          )
        );
        this.toast.success(status === 'Approved' ? 'Photo approved - it is now on the product page.' : 'Photo rejected.');
      },
      error: (error: HttpErrorResponse) => {
        this.updatingPhotoId.set(null);
        this.toast.error(error.error?.message || 'Unable to update this photo.');
      }
    });
  }

  // Approves every pending photo on a review, one request after another.
  approveAllPhotos(review: AdminReview): void {
    const next = review.images.find(photo => photo.status === 'Pending');
    if (!next || this.updatingPhotoId() !== null) {
      return;
    }

    this.updatingPhotoId.set(next.reviewImageId);
    this.reviewService.updatePhotoStatus(next.reviewImageId, 'Approved').subscribe({
      next: () => {
        this.updatingPhotoId.set(null);
        const updated: AdminReview = {
          ...review,
          images: review.images.map(i => (i.reviewImageId === next.reviewImageId ? { ...i, status: 'Approved' } : i))
        };
        this.reviews.update(items => items.map(r => (r.reviewId === review.reviewId ? updated : r)));

        if (updated.images.some(photo => photo.status === 'Pending')) {
          this.approveAllPhotos(updated);
        } else {
          this.toast.success('All photos approved - they are now on the product page.');
        }
      },
      error: (error: HttpErrorResponse) => {
        this.updatingPhotoId.set(null);
        this.toast.error(error.error?.message || 'Unable to approve the photos.');
      }
    });
  }

  async deleteReview(review: AdminReview): Promise<void> {
    const confirmed = await this.confirmDialog.confirm(
      `Delete this review by "${review.userName}" for "${review.productName}"?`,
      { confirmLabel: 'Delete', danger: true }
    );

    if (!confirmed) {
      return;
    }

    this.deletingReviewId.set(review.reviewId);

    this.reviewService.deleteReviewAdmin(review.reviewId).subscribe({
      next: () => {
        this.deletingReviewId.set(null);
        this.reviews.update(items => items.filter(r => r.reviewId !== review.reviewId));
        this.toast.success('Review deleted.');
      },
      error: (error: HttpErrorResponse) => {
        this.deletingReviewId.set(null);
        const message = error.error?.message || 'Unable to delete this review.';
        this.toast.error(message);
      }
    });
  }
}