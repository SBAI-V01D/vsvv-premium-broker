import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Send, User, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import PageHeader from '../components/shared/PageHeader';

export default function Messages() {
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['messages'],
    queryFn: () => base44.entities.Message.list('-created_date'),
  });

  const sendMutation = useMutation({
    mutationFn: (data) => base44.entities.Message.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['messages'] }); setNewMessage(''); },
  });

  // Get unique customer IDs from messages
  const customerIds = [...new Set(messages.map(m => m.customer_id))];
  const customersWithMessages = customers.filter(c => customerIds.includes(c.id));
  const allCustomers = [...customersWithMessages, ...customers.filter(c => !customerIds.includes(c.id))];

  const filteredCustomers = allCustomers.filter(c =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const customerMessages = selectedCustomer
    ? messages.filter(m => m.customer_id === selectedCustomer.id).sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
    : [];

  const handleSend = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedCustomer) return;
    sendMutation.mutate({
      customer_id: selectedCustomer.id,
      content: newMessage,
      sender_name: 'Broker',
      is_from_customer: false,
    });
  };

  return (
    <div>
      <PageHeader title="Nachrichten" subtitle="Kundenkommunikation" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-12rem)]">
        {/* Customer List */}
        <Card className="lg:col-span-1 flex flex-col">
          <CardHeader className="pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Kunde suchen..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-full">
              {filteredCustomers.map(c => {
                const lastMsg = messages.filter(m => m.customer_id === c.id).sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
                const unread = messages.filter(m => m.customer_id === c.id && m.is_from_customer && !m.read).length;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCustomer(c)}
                    className={`w-full text-left px-4 py-3 border-b border-border hover:bg-muted/50 transition-colors ${selectedCustomer?.id === c.id ? 'bg-muted' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
                        {c.first_name?.[0]}{c.last_name?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <p className="text-sm font-medium truncate">{c.first_name} {c.last_name}</p>
                          {unread > 0 && <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">{unread}</span>}
                        </div>
                        {lastMsg && <p className="text-xs text-muted-foreground truncate">{lastMsg.content}</p>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat */}
        <Card className="lg:col-span-2 flex flex-col">
          {selectedCustomer ? (
            <>
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-base">{selectedCustomer.first_name} {selectedCustomer.last_name}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-4 overflow-hidden flex flex-col">
                <ScrollArea className="flex-1 mb-4">
                  <div className="space-y-3">
                    {customerMessages.map(m => (
                      <div key={m.id} className={`flex ${m.is_from_customer ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${m.is_from_customer ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
                          <p className="text-sm">{m.content}</p>
                          <p className={`text-xs mt-1 ${m.is_from_customer ? 'text-muted-foreground' : 'text-primary-foreground/70'}`}>
                            {format(new Date(m.created_date), 'dd.MM. HH:mm')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <form onSubmit={handleSend} className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Nachricht schreiben..."
                    className="flex-1"
                  />
                  <Button type="submit" size="icon" disabled={sendMutation.isPending || !newMessage.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <User className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Wählen Sie einen Kunden aus</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}