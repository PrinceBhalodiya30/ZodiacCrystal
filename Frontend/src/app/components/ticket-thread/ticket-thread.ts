import { Component, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TicketMessage } from '../../models/support-ticket';

// The message thread of a support ticket, shared by the customer's
// conversation page and the admin support inbox. forAdmin flips which side
// the bubbles sit on (your own messages on the right) and shows internal notes.
// In the admin inbox, messages with canModify get Edit / Delete.
@Component({
  selector: 'app-ticket-thread',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './ticket-thread.html',
  styleUrl: './ticket-thread.css'
})
export class TicketThread {
  messages = input.required<TicketMessage[]>();
  forAdmin = input(false);
  // Disables the edit/delete controls while the parent is saving.
  busy = input(false);

  editMessage = output<{ messageId: number; body: string }>();
  deleteMessage = output<TicketMessage>();

  editingId = signal<number | null>(null);
  editText = '';

  isMine(message: TicketMessage): boolean {
    return message.isFromAdmin === this.forAdmin();
  }

  startEdit(message: TicketMessage): void {
    this.editingId.set(message.ticketMessageId);
    this.editText = message.body;
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(message: TicketMessage): void {
    const body = this.editText.trim();
    if (!body) {
      return;
    }
    if (body !== message.body) {
      this.editMessage.emit({ messageId: message.ticketMessageId, body });
    }
    this.editingId.set(null);
  }
}
