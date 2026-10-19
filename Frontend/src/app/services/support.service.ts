import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateTicket, SupportTicket, TicketCounts, TicketStatus } from '../models/support-ticket';
import { PagedResult } from '../models/paged-result';
import { API_BASE_URL } from './api-config';

@Injectable({ providedIn: 'root' })
export class SupportService {
  private http = inject(HttpClient);
  private baseUrl = `${API_BASE_URL}/SupportTickets`;
  private adminBaseUrl = `${API_BASE_URL}/Admin/SupportTickets`;

  // Customer
  getMyTickets(): Observable<SupportTicket[]> {
    return this.http.get<SupportTicket[]>(this.baseUrl);
  }

  getTicket(id: number): Observable<SupportTicket> {
    return this.http.get<SupportTicket>(`${this.baseUrl}/${id}`);
  }

  createTicket(ticket: CreateTicket): Observable<SupportTicket> {
    const form = new FormData();
    if (ticket.orderId) {
      form.append('orderId', String(ticket.orderId));
    }
    form.append('category', ticket.category);
    form.append('subject', ticket.subject);
    form.append('message', ticket.message);
    ticket.files?.forEach(file => form.append('files', file));
    return this.http.post<SupportTicket>(this.baseUrl, form);
  }

  reply(id: number, message: string, files: File[] = []): Observable<SupportTicket> {
    return this.http.post<SupportTicket>(`${this.baseUrl}/${id}/messages`, this.replyForm(message, files));
  }

  markResolved(id: number): Observable<SupportTicket> {
    return this.http.put<SupportTicket>(`${this.baseUrl}/${id}/resolve`, {});
  }

  rate(id: number, rating: number, comment?: string): Observable<SupportTicket> {
    return this.http.put<SupportTicket>(`${this.baseUrl}/${id}/rate`, { rating, comment });
  }

  // Admin
  // status: a TicketStatus, 'Active' (Open + AwaitingCustomer) or '' for all.
  // search: ticket reference ("ZC-12"), order number, subject, customer name or email.
  getTicketsAdminPaged(pageNumber: number, pageSize: number, status?: string, category?: string, search?: string): Observable<PagedResult<SupportTicket>> {
    let params = new HttpParams().set('pageNumber', pageNumber).set('pageSize', pageSize);
    if (status) {
      params = params.set('status', status);
    }
    if (category) {
      params = params.set('category', category);
    }
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<PagedResult<SupportTicket>>(`${this.adminBaseUrl}/paged`, { params });
  }

  getCountsAdmin(): Observable<TicketCounts> {
    return this.http.get<TicketCounts>(`${this.adminBaseUrl}/counts`);
  }

  getTicketAdmin(id: number): Observable<SupportTicket> {
    return this.http.get<SupportTicket>(`${this.adminBaseUrl}/${id}`);
  }

  // status: what a public reply moves the ticket to (default AwaitingCustomer, or Resolved).
  replyAdmin(id: number, message: string, options: { isInternal?: boolean; status?: TicketStatus; files?: File[] } = {}): Observable<SupportTicket> {
    const form = this.replyForm(message, options.files ?? []);
    form.append('isInternal', String(!!options.isInternal));
    if (options.status) {
      form.append('status', options.status);
    }
    return this.http.post<SupportTicket>(`${this.adminBaseUrl}/${id}/messages`, form);
  }

  editMessageAdmin(id: number, messageId: number, message: string): Observable<SupportTicket> {
    return this.http.put<SupportTicket>(`${this.adminBaseUrl}/${id}/messages/${messageId}`, { message });
  }

  deleteMessageAdmin(id: number, messageId: number): Observable<SupportTicket> {
    return this.http.delete<SupportTicket>(`${this.adminBaseUrl}/${id}/messages/${messageId}`);
  }

  updateStatusAdmin(id: number, status: TicketStatus): Observable<SupportTicket> {
    return this.http.put<SupportTicket>(`${this.adminBaseUrl}/${id}/status`, { status });
  }

  private replyForm(message: string, files: File[]): FormData {
    const form = new FormData();
    form.append('message', message);
    files.forEach(file => form.append('files', file));
    return form;
  }
}
