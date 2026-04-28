import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { User, Search, MessageSquare, Shield, Inbox } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import PageHeader from '../components/shared/PageHeader';
import ChatThread from '../components/chat/ChatThread';

const THREAD_TYPE_ICON = { general: MessageSquare, contract: Shield, interaction: Inbox };
const THREAD_TYPE_LABEL = { general: 'Allgemein', contract: 'Vertrag', interaction: 'Anfrage' };
const THREAD_TYPE_COLOR = {
  general: 'bg-primary/10 text-primary',
  contract: 'bg-emerald-50 text-emerald-600',
  interaction: 'bg-amber-50 text-amber-600',
};

export default function Messages() {
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedThread, setSelectedThread] = useState({ type: 'general', id: 'general', label: 'Allgemein' });
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['messages'],
    queryFn: () => base44.entities.Message.list('-created_date'),
    refetchInterval: 10000,
  });

  const sendMutation = useMutation({
    mutationFn: (data) => base44.entities.Message.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages'] }),
  });

  // Customers who have messages or all customers
  const customerIds = [...new Set(messages.map(m => m.customer_id))];
  const customersWithMessages = customers.filter(c => customerIds.includes(c.id));
  const rest = customers.filter(c => !customerIds.includes(c.id));
  const allCustomers = [...customersWithMessages, ...rest];
  const filteredCustomers = allCustomers.filter(c =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  // Threads for selected customer
  const customerMessages = selectedCustomer
    ? messages.filter(m => m.customer_id === selectedCustomer.id)
    : [];

  const getThreads = () => {
    if (!selectedCustomer) return [];
    const threadMap = {};
    customerMessages.forEach(m => {
      const type = m.reference_type || 'general';
      const id = (type !== 'general' && m.reference_id) ? m.reference_id : 'general';
      const key = `${type}-${id}`;
      if (!threadMap[key]) threadMap[key] = { type, id, label: m.reference_title || THREAD_TYPE_LABEL[type] || 'Allgemein', count: 0 };
      if (m.is_from_customer && !m.read) threadMap[key].count++;
    });
    // Always include general
    if (!threadMap['general-general']) threadMap['general-general'] = { type: 'general', id: 'general', label: 'Allgemein', count: 0 };
    return Object.values(threadMap);
  };

  const threads = getThreads();

  const threadMessages = selectedCustomer
    ? customerMessages.filter(m => {
        if (selectedThread.type === 'general') return !m.reference_id || m.reference_type === 'general' || !m.reference_type;
        return m.reference_id === selectedThread.id && m.reference_type === selectedThread.type;
      }).sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
    : [];

  const unreadTotal = (customerId) =>
    messages.filter(m => m.customer_id === customerId && m.is_from_customer && !m.read).length;

  const handleSelectCustomer = (c) => {
    setSelectedCustomer(c);
    setSelectedThread({ type: 'general', id: 'general', label: 'Allgemein' });
  };

  const handleSend = (content) => {
    if (!selectedCustomer) return;
    sendMutation.mutate({
      customer_id: selectedCustomer.id,
      content,
      sender_name: 'Broker',
      sender_email: '',
      is_from_customer: false,
      read: true,
      reference_id: selectedThread.type !== 'general' ? selectedThread.id : null,
      reference_type: selectedThread.type,
      reference_title: selectedThread.label,
    });
  };

  return (
    <div>
      <PageHeader title="Nachrichten" subtitle="Kundenkommunikation" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-12rem)]">
        {/* Customer list */}
        <Card className="lg:col-span-1 flex flex-col overflow-hidden">
          <CardHeader className="pb-2 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Kunde suchen…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
          </CardHeader>
          <ScrollArea className="flex-1">
            {filteredCustomers.map(c => {
              const unread = unreadTotal(c.id);
              const lastMsg = messages.filter(m => m.customer_id === c.id).sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
              return (
                <button key={c.id} onClick={() => handleSelectCustomer(c)}
                  className={`w-full text-left px-4 py-3 border-b border-border hover:bg-muted/50 transition-colors ${selectedCustomer?.id === c.id ? 'bg-muted' : ''}`}>
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
        </Card>

        {/* Thread list */}
        <Card className="lg:col-span-1 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex-shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name} – Themen` : 'Themen'}
            </p>
          </div>
          <ScrollArea className="flex-1">
            {!selectedCustomer ? (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                Kunden auswählen
              </div>
            ) : threads.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                Keine Themen
              </div>
            ) : (
              threads.map(t => {
                const Icon = THREAD_TYPE_ICON[t.type] || MessageSquare;
                const isActive = selectedThread.id === t.id && selectedThread.type === t.type;
                return (
                  <button key={`${t.type}-${t.id}`} onClick={() => setSelectedThread(t)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-3 border-b border-border transition-colors ${isActive ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-slate-50'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${THREAD_TYPE_COLOR[t.type]}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{THREAD_TYPE_LABEL[t.type]}</p>
                    </div>
                    {t.count > 0 && <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">{t.count}</span>}
                  </button>
                );
              })
            )}
          </ScrollArea>
        </Card>

        {/* Chat */}
        <Card className="lg:col-span-2 flex flex-col overflow-hidden">
          {selectedCustomer ? (
            <ChatThread
              messages={threadMessages}
              isCustomerSide={false}
              onSend={handleSend}
              sending={sendMutation.isPending}
              referenceLabel={`${selectedCustomer.first_name} ${selectedCustomer.last_name} · ${selectedThread.label}`}
            />
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <User className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Kunden auswählen</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}