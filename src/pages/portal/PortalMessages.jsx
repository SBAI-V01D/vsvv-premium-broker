import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Send, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import PortalPageHeader from '../../components/portal/PortalPageHeader';

export default function PortalMessages() {
  const { user } = useOutletContext();
  const [newMessage, setNewMessage] = useState('');
  const queryClient = useQueryClient();

  const { data: messages = [] } = useQuery({
    queryKey: ['portal-messages', user?.id],
    queryFn: () => base44.entities.Message.filter({ customer_id: user?.id }),
    enabled: !!user?.id,
    refetchInterval: 10000,
  });

  const sortedMessages = [...messages].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

  const sendMutation = useMutation({
    mutationFn: (data) => base44.entities.Message.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-messages', user?.id] });
      setNewMessage('');
    },
  });

  const handleSend = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendMutation.mutate({
      customer_id: user.id,
      content: newMessage,
      sender_name: user.full_name || user.email,
      sender_email: user.email,
      is_from_customer: true,
      read: false,
    });
  };

  return (
    <div>
      <PortalPageHeader
        icon={<MessageSquare className="w-5 h-5 text-primary" />}
        title="Nachrichten"
        subtitle="Direktkanal zu Ihrem Broker"
      />

      <Card className="flex flex-col" style={{ height: 'calc(100vh - 22rem)' }}>
        <ScrollArea className="flex-1 p-4 md:p-6">
          {sortedMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <MessageSquare className="w-12 h-12 text-slate-200 mb-3" />
              <p className="font-medium text-foreground">Noch keine Nachrichten</p>
              <p className="text-sm text-muted-foreground mt-1">Stellen Sie Ihrem Broker eine Frage.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedMessages.map(m => {
                const isCustomer = m.is_from_customer;
                return (
                  <div key={m.id} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                    {!isCustomer && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold mr-2 flex-shrink-0 mt-1">
                        B
                      </div>
                    )}
                    <div className={`max-w-[75%] space-y-1`}>
                      {!isCustomer && (
                        <p className="text-xs text-muted-foreground ml-1">Ihr Broker</p>
                      )}
                      <div className={`rounded-2xl px-4 py-3 ${isCustomer
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : 'bg-white border border-slate-200 rounded-tl-sm'
                      }`}>
                        <p className="text-sm leading-relaxed">{m.content}</p>
                      </div>
                      <p className={`text-xs text-muted-foreground ${isCustomer ? 'text-right' : 'ml-1'}`}>
                        {format(new Date(m.created_date), 'dd.MM. · HH:mm')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="border-t border-border p-4">
          <form onSubmit={handleSend} className="flex gap-2">
            <Input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Nachricht an Ihren Broker..."
              className="flex-1 bg-slate-50"
            />
            <Button type="submit" disabled={!newMessage.trim() || sendMutation.isPending}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Ihr Broker antwortet in der Regel innerhalb von 1–2 Werktagen
          </p>
        </div>
      </Card>
    </div>
  );
}