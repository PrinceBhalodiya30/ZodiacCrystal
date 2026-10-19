import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CategoryService } from '../../services/category.service';
import { Category } from '../../models/category';
import { AdminNav } from '../admin-nav/admin-nav';
import { Spinner } from '../../components/spinner/spinner';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { Pager } from '../../components/pager/pager';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [Spinner, FormsModule, AdminNav, Pager],
  templateUrl: './categories.html',
  styleUrls: ['../admin-shared.css', './categories.css']
})
export class AdminCategories implements OnInit {
  private categoryService = inject(CategoryService);
  private confirmDialog = inject(ConfirmDialogService);
  private toast = inject(ToastService);

  categories = signal<Category[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');

  // Products per category, counting sub-categories too (same rule as the
  // shop's category cards). Null until loaded, or if products fail to load.
  productCounts = signal<Map<number, number> | null>(null);

  // Searched, filtered and paged in the browser: the full list is loaded
  // anyway, because the parent dropdown and parent-name column need it.
  searchTerm = signal('');
  statusFilter = signal<'all' | 'active' | 'inactive'>('all');
  filteredCategories = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    return this.categories().filter(c =>
      (!term || c.name.toLowerCase().includes(term) || (c.description ?? '').toLowerCase().includes(term)) &&
      (status === 'all' || (status === 'active') === c.isActive)
    );
  });

  page = signal(1);
  totalCount = computed(() => this.filteredCategories().length);
  totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / PAGE_SIZE)));
  pagedCategories = computed(() => {
    // Deleting the last row on the last page: show the new last page instead.
    const page = Math.min(this.page(), this.totalPages());
    return this.filteredCategories().slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  });
  hasFilters = computed(() => !!this.searchTerm().trim() || this.statusFilter() !== 'all');

  formMode = signal<'closed' | 'create' | 'edit'>('closed');
  editingCategoryId = signal<number | null>(null);
  isSubmitting = signal(false);
  formError = signal('');

  formName = '';
  formDescription = '';
  formParentCategoryId: number | null = null;
  formIsActive = true;

  ngOnInit(): void {
    this.loadCategories();
  }

  parentOptions(): Category[] {
    const editingId = this.editingCategoryId();
    return this.categories().filter(c => c.categoryId !== editingId);
  }

  loadCategories(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.categoryService.getCategories().subscribe({
      next: categories => {
        this.categories.set(categories);
        this.page.update(p => Math.min(p, this.totalPages()));
        this.isLoading.set(false);
        this.loadProductCounts();
      },
      error: () => {
        this.errorMessage.set('Unable to load categories.');
        this.isLoading.set(false);
      }
    });
  }

  private loadProductCounts(): void {
    this.categoryService.getProductCounts().subscribe({
      next: direct => {
        const categories = this.categories();
        const counts = new Map<number, number>();
        for (const category of categories) {
          // The category plus all its sub-categories, any depth.
          const ids = new Set([category.categoryId]);
          let added = true;
          while (added) {
            added = false;
            for (const c of categories) {
              if (c.parentCategoryId && ids.has(c.parentCategoryId) && !ids.has(c.categoryId)) {
                ids.add(c.categoryId);
                added = true;
              }
            }
          }
          counts.set(category.categoryId, [...ids].reduce((sum, id) => sum + (direct[id] ?? 0), 0));
        }
        this.productCounts.set(counts);
      },
      // The column just shows "—"; the rest of the page still works.
      error: () => this.productCounts.set(null)
    });
  }

  onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.page.set(1);
  }

  onStatusChange(status: 'all' | 'active' | 'inactive'): void {
    this.statusFilter.set(status);
    this.page.set(1);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set('all');
    this.page.set(1);
  }

  onPageChange(page: number): void {
    this.page.set(page);
  }

  categoryName(id?: number): string {
    if (!id) {
      return '—';
    }
    return this.categories().find(c => c.categoryId === id)?.name ?? '—';
  }

  startCreate(): void {
    this.formMode.set('create');
    this.editingCategoryId.set(null);
    this.formName = '';
    this.formDescription = '';
    this.formParentCategoryId = null;
    this.formIsActive = true;
    this.formError.set('');
  }

  startEdit(category: Category): void {
    this.formMode.set('edit');
    this.editingCategoryId.set(category.categoryId);
    this.formName = category.name;
    this.formDescription = category.description ?? '';
    this.formParentCategoryId = category.parentCategoryId ?? null;
    this.formIsActive = category.isActive;
    this.formError.set('');
  }

  // Escape closes the form via the same path as the overlay click. Ignored while
  // a confirm dialog is on top so only the topmost layer closes.
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.formMode() === 'closed' || this.confirmDialog.request()) {
      return;
    }
    this.cancelForm();
  }

  cancelForm(): void {
    this.formMode.set('closed');
    this.editingCategoryId.set(null);
  }

  submitForm(): void {
    this.isSubmitting.set(true);
    this.formError.set('');

    const request = {
      name: this.formName,
      description: this.formDescription || undefined,
      parentCategoryId: this.formParentCategoryId,
      isActive: this.formIsActive
    };

    const editingId = this.editingCategoryId();

    if (editingId) {
      this.categoryService.updateCategory(editingId, request).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.formMode.set('closed');
          this.toast.success(`"${request.name}" updated.`);
          this.loadCategories();
        },
        error: (error: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          this.formError.set(error.error?.message || 'Unable to save this category.');
        }
      });
    } else {
      this.categoryService.createCategory(request).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.formMode.set('closed');
          this.toast.success(`"${request.name}" added.`);
          this.loadCategories();
        },
        error: (error: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          this.formError.set(error.error?.message || 'Unable to save this category.');
        }
      });
    }
  }

  async deleteCategory(category: Category): Promise<void> {
    const confirmed = await this.confirmDialog.confirm(
      `Delete "${category.name}"? This cannot be undone.`,
      { confirmLabel: 'Delete', danger: true }
    );

    if (!confirmed) {
      return;
    }

    this.categoryService.deleteCategory(category.categoryId).subscribe({
      next: () => {
        this.categories.update(items => items.filter(c => c.categoryId !== category.categoryId));
        this.toast.success(`"${category.name}" deleted.`);
      },
      error: (error: HttpErrorResponse) => {
        const message = error.error?.message || `Unable to delete "${category.name}".`;
        this.toast.error(message);
      }
    });
  }
}
