import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuditLog } from '../models/audit-log';
import { PagedResult } from '../models/paged-result';
import { API_BASE_URL } from './api-config';

// from/to are ISO instants (to is exclusive), matching the UTC CreatedAt column.
export interface AuditLogFilters {
  search?: string;
  action?: string;
  from?: string;
  to?: string;
}

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private http = inject(HttpClient);
  private baseUrl = `${API_BASE_URL}/Admin/AuditLogs`;

  getPaged(pageNumber: number, pageSize: number, filters: AuditLogFilters = {}): Observable<PagedResult<AuditLog>> {
    const params = this.filterParams(filters)
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);

    return this.http.get<PagedResult<AuditLog>>(`${this.baseUrl}/paged`, { params });
  }

  // Every action name that has been logged, for the filter dropdown.
  getActions(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/actions`);
  }

  exportCsv(filters: AuditLogFilters = {}): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/export`, { params: this.filterParams(filters), responseType: 'blob' });
  }

  private filterParams(filters: AuditLogFilters): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) {
        params = params.set(key, value);
      }
    }
    return params;
  }
}
