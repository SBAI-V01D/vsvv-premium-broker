import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { MessageSquare, Shield, Inbox, Plus, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PortalPageHeader from '../../components/portal/PortalPageHeader';
import ChatThread from '../../components/chat/ChatThread';

function ThreadItem({ label, icon: Icon, iconBg, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 px-4 py-3 border-b border-border transition-colors ${active ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-slate-50'}`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{label}</p>
      </div>
      {count > 0 && (
        <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center flex-shrink-0">{count}</span>
      )}
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </button>
  );
}

export default function PortalMessages() {
  const { user } = useOutletContext();
  const queryClient = useQueryClient();

  const [activeThread, setActiveThread] = useState({ id: 'general', type: 'general', label: 'Allgemeiner Chat' });
  const [showNewThread, setShowNewThread] = useState(false);
  const [newThreadType, setNewThreadType] = useState('contract');
  const [newThreadRef, setNewThreadRef] = useState('');
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const { data: contracts = [] } = useQuery({
    queryKey: ['portal-contracts', user?.id],
    queryFn: () => base44.entities.Contract.filter({ customer_id: user?.id }),
    enabled: !!user?.id,
  });

  const { data: interactions = [] } = useQuery({
    queryKey: ['customer-interactions', user?.id],
    queryFn: () => base44.entities.Interaction.filter({ customer_id: user?.id, is_customer_request: true }, '-created_date'),
    enabled: !!user?.id,
  });

  const { data: allMessages = [] } = useQuery({
    queryKey: ['portal-messages', user?.id],
    queryFn: () => base44.entities.Message.filter({ customer_id: user?.id }),
    enabled: !!user?.id,
    refetchInterval: 8000,
  });

  const sendMutation = useMutation({
    mutationFn: (data) => base44.entities.Message.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portal-messages', user?.id] }),
  });

  const getThreadMessages = (thread) => {
    const msgs = allMessages.filter(m => {
      if (thread.type === 'general') return !m.reference_id || m.reference_type === 'general';
      return m.reference_id === thread.id && m.reference_type === thread.type;
    });
    return [...msgs].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
  };

  const unreadCount = (thread) =>
    getThreadMessages(thread).filter(m => m.is_from_customer === false && !m.read).length;

  const handleSend = (content) => {
    sendMutation.mutate({
      customer_id: user.id,
      content,
      sender_name: user.full_name || user.email,
      sender_email: user.email,
      is_from_customer: true,
      read: false,
      reference_id: activeThread.type !== 'general' ? activeThread.id : null,
      reference_type: activeThread.type,
      reference_title: activeThread.label,
    });
  };

  const handleNewThread = () => {
    if (!newThreadRef) return;
    let label = '';
    if (newThreadType === 'contract') {
      const c = contracts.find(c => c.id === newThreadRef);
      label = c ? `${c.insurance_type} – ${c.provider}` : 'Vertrag';
    } else {
      const i = interactions.find(i => i.id === newThreadRef);
      label = i ? i.subject : 'Anfrage';
    }
    setActiveThread({ id: newThreadRef, type: newThreadType, label });
    setShowNewThread(false);
    setNewThreadRef('');
    setMobileShowChat(true);
  };

  const selectThread = (thread) => {
    setActiveThread(thread);
    setMobileShowChat(true);
  };

  const threads = [
    { id: 'general', type: 'general', label: 'Allgemeiner Chat' },
    ...contracts.map(c => ({ id: c.id, type: 'contract', label: `${c.insurance_type} – ${c.provider}` })),
    ...interactions.map(i => ({ id: i.id, type: 'interaction', label: i.subject })),
  ];

  // Deduplicate: only show threads that have messages OR are the active one
  const threadsWithMessages = threads.filter(t =>
    t.id === activeThread.id || getThreadMessages(t).length > 0 || t.type === 'general'
  );

  const activeMessages = getThreadMessages(activeThread);

  return (
    <div>
      <PortalPageHeader
        icon={<MessageSquare className="w-5 h-5 text-primary" />}
        title="Nachrichten"
        subtitle="Chat mit Ihrem Broker"
        action={
          <Button size="sm" variant="outline" onClick={() => setShowNewThread(true)}>
            <Plus className="w-4 h-4 mr-1" /> Neues Thema
          </Button>
        }
      />

      <Card className="overflow-hidden" style={{ height: 'calc(100vh - 22rem)', minHeight: '480px' }}>
        <div className="flex h-full">
          {/* Thread list – always visible on desktop, toggleable on mobile */}
          <div className={`flex-col w-full md:w-64 border-r border-border flex-shrink-0 ${mobileShowChat ? 'hidden md:flex' : 'flex'}`}>
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Themen</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {threadsWithMessages.map(t => (
                <ThreadItem
                  key={`${t.type}-${t.id}`}
                  label={t.label}
                  icon={t.type === 'general' ? MessageSquare : t.type === 'contract' ? Shield : Inbox}
                  iconBg={t.type === 'general' ? 'bg-primary/10 text-primary' : t.type === 'contract' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}
                  count={unreadCount(t)}
                  active={activeThread.id === t.id && activeThread.type === t.type}
                  onClick={() => selectThread(t)}
                />
              ))}
            </div>
          </div>

          {/* Chat area */}
          <div className={`flex-1 flex flex-col ${!mobileShowChat ? 'hidden md:flex' : 'flex'}`}>
            {/* Mobile back button */}
            <div className="md:hidden px-4 py-2 border-b border-border">
              <button onClick={() => setMobileShowChat(false)} className="text-xs text-primary font-medium">
                ← Themen
              </button>
            </div>
            <ChatThread
              messages={activeMessages}
              isCustomerSide={true}
              onSend={handleSend}
              sending={sendMutation.isPending}
              referenceLabel={activeThread.label}
            />
          </div>
        </div>
      </Card>

      {/* New thread dialog */}
      <Dialog open={showNewThread} onOpenChange={setShowNewThread}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Neues Gesprächsthema</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-3">Wählen Sie einen Bezug für das neue Gespräch:</p>
              <Select value={newThreadType} onValueChange={v => { setNewThreadType(v); setNewThreadRef(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contract">Zu einem Vertrag</SelectItem>
                  <SelectItem value="interaction">Zu einer Anfrage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={newThreadRef} onValueChange={setNewThreadRef}>
                <SelectTrigger><SelectValue placeholder="Auswählen…" /></SelectTrigger>
                <SelectContent>
                  {newThreadType === 'contract'
                    ? contracts.map(c => <SelectItem key={c.id} value={c.id}>{c.insurance_type} – {c.provider}</SelectItem>)
                    : interactions.map(i => <SelectItem key={i.id} value={i.id}>{i.subject}</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewThread(false)}>Abbrechen</Button>
              <Button onClick={handleNewThread} disabled={!newThreadRef}>Thema öffnen</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}