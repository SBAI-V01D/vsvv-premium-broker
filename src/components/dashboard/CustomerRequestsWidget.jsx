import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Inbox, MapPin, FileText, CheckCircle2, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

const REQUEST_ICONS = {
  'Adressänderungsantrag': MapPin,
  'dokument': FileText,
};

const STATUS_STYLES = {
  offen: 'bg-amber-50 text-amber-700 border-amber-200',
  in_bearbeitung: 'bg-blue-50 text-blue-700 border-blue-200',
  erledigt: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const STATUS_LABELS = {
  offen: 'Offen',
  in_bearbeitung: 'In Bearbeitung',
  erledigt: 'Erledigt',
};

function RequestRow({ request }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const updateStatus = useMutation({
    mutationFn: (newStatus) => base44.entities.Interaction.update(request.id, { request_status: newStatus }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer-requests'] }),
  });

  const Icon = REQUEST_ICONS[request.subject] || Inbox;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{request.subject}</p>
          <p className="text-xs text-muted-foreground">
            {request.customer_name}
            {request.date && <> · {format(new Date(request.date), 'dd.MM.yyyy')}</>}
          </p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-md border flex-shrink-0 ${STATUS_STYLES[request.request_status || 'offen']}`}>
          {STATUS_LABELS[request.request_status || 'offen']}
        </span>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-border bg-slate-50 px-4 py-3 space-y-3">
          {request.content && (
            <p className="text-sm text-foreground bg-white border border-border rounded-lg px-3 py-2 whitespace-pre-line">
              {request.content}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <Link to={`/kunden/${request.customer_id}`} className="text-xs text-primary hover:underline">
              Kundenprofil öffnen →
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status:</span>
              <Select
                value={request.request_status || 'offen'}
                onValueChange={(v) => updateStatus.mutate(v)}
                disabled={updateStatus.isPending}
              >
                <SelectTrigger className="h-7 text-xs w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="offen">Offen</SelectItem>
                  <SelectItem value="in_bearbeitung">In Bearbeitung</SelectItem>
                  <SelectItem value="erledigt">Erledigt</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CustomerRequestsWidget() {
  const [showAll, setShowAll] = useState(false);

  const { data: interactions = [], isLoading } = useQuery({
    queryKey: ['customer-requests'],
    queryFn: () => base44.entities.Interaction.filter({ is_customer_request: true }, '-created_date', 50),
  });

  const openRequests = interactions.filter(i => (i.request_status || 'offen') !== 'erledigt');
  const displayed = showAll ? interactions : openRequests.slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Inbox className="w-4 h-4 text-primary" />
          Kundenanliegen
          {openRequests.length > 0 && (
            <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {openRequests.length} offen
            </span>
          )}
        </CardTitle>
        <button
          onClick={() => setShowAll(s => !s)}
          className="text-xs text-primary font-medium hover:underline"
        >
          {showAll ? 'Nur offene' : `Alle anzeigen (${interactions.length})`}
        </button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-14 bg-slate-100 animate-pulse rounded-xl" />)}
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
            <CheckCircle2 className="w-8 h-8 opacity-30" />
            <p className="text-sm">Keine offenen Kundenanliegen</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map(r => <RequestRow key={r.id} request={r} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}