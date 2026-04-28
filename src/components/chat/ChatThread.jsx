import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Send, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';

/**
 * Reusable chat thread.
 * Props:
 *   messages        – sorted array of Message records
 *   currentUserName – display name for the current user
 *   isCustomerSide  – true = customer portal, false = broker side
 *   onSend(content) – called after successful send (parent should refresh)
 *   sending         – bool, disable input while mutating
 *   referenceLabel  – optional label shown at the top (e.g. "Vertrag: KVG – Helsana")
 */
export default function ChatThread({ messages = [], isCustomerSide, onSend, sending, referenceLabel }) {
  const [text, setText] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {referenceLabel && (
        <div className="px-4 py-2 bg-primary/5 border-b border-border text-xs text-primary font-medium flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          {referenceLabel}
        </div>
      )}

      <ScrollArea className="flex-1 px-4 py-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-16 text-muted-foreground">
            <MessageSquare className="w-10 h-10 opacity-20 mb-2" />
            <p className="text-sm">Noch keine Nachrichten</p>
            <p className="text-xs mt-1">Schreiben Sie die erste Nachricht.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => {
              const fromSelf = isCustomerSide ? m.is_from_customer : !m.is_from_customer;
              return (
                <div key={m.id} className={`flex ${fromSelf ? 'justify-end' : 'justify-start'}`}>
                  {!fromSelf && (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold mr-2 flex-shrink-0 mt-1">
                      {isCustomerSide ? 'B' : (m.sender_name?.[0] || 'K')}
                    </div>
                  )}
                  <div className="max-w-[75%] space-y-0.5">
                    {!fromSelf && (
                      <p className="text-xs text-muted-foreground ml-1">
                        {isCustomerSide ? 'Ihr Broker' : (m.sender_name || 'Kunde')}
                      </p>
                    )}
                    <div className={`rounded-2xl px-4 py-2.5 ${fromSelf
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-white border border-slate-200 rounded-tl-sm text-foreground'
                    }`}>
                      <p className="text-sm leading-relaxed whitespace-pre-line">{m.content}</p>
                    </div>
                    <p className={`text-xs text-muted-foreground ${fromSelf ? 'text-right' : 'ml-1'}`}>
                      {format(new Date(m.created_date), 'dd.MM. · HH:mm')}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      <div className="border-t border-border p-3">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nachricht schreiben… (Enter zum Senden)"
            className="flex-1 resize-none min-h-[40px] max-h-32 text-sm"
            rows={1}
          />
          <Button type="submit" size="icon" disabled={!text.trim() || sending}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}