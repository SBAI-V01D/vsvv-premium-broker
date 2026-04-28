import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, TrendingUp, DollarSign, Target, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import PageHeader from '../components/shared/PageHeader';
import DealCard from '../components/pipeline/DealCard';
import DealForm from '../components/pipeline/DealForm';

const STAGES = [
  { id: 'erstkontakt', label: 'Erstkontakt', color: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  { id: 'bedarfsanalyse', label: 'Bedarfsanalyse', color: 'bg-blue-50 text-blue-700', dot: 'bg-blue-400' },
  { id: 'angebot_versendet', label: 'Angebot versendet', color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400' },
  { id: 'verhandlung', label: 'Verhandlung', color: 'bg-purple-50 text-purple-700', dot: 'bg-purple-400' },
  { id: 'abschluss', label: 'Abschluss ✓', color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  { id: 'verloren', label: 'Verloren', color: 'bg-red-50 text-red-700', dot: 'bg-red-400' },
];

export default function Pipeline() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [defaultStage, setDefaultStage] = useState('erstkontakt');

  const { data: deals = [] } = useQuery({
    queryKey: ['deals'],
    queryFn: () => base44.entities.Deal.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Deal.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['deals'] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Deal.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['deals'] }); setEditingDeal(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Deal.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deals'] }),
  });

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStage = destination.droppableId;
    const deal = deals.find(d => d.id === draggableId);
    if (deal && deal.stage !== newStage) {
      updateMutation.mutate({ id: draggableId, data: { stage: newStage } });
    }
  };

  const openNew = (stageId) => {
    setDefaultStage(stageId);
    setEditingDeal(null);
    setShowForm(true);
  };

  // Stats
  const activeDeals = deals.filter(d => d.stage !== 'verloren');
  const totalPipelineValue = activeDeals.reduce((s, d) => s + (d.estimated_premium || 0), 0);
  const weightedValue = activeDeals.reduce((s, d) => s + (d.estimated_premium || 0) * ((d.probability || 0) / 100), 0);
  const closedDeals = deals.filter(d => d.stage === 'abschluss');
  const closedValue = closedDeals.reduce((s, d) => s + (d.estimated_premium || 0), 0);

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Verkaufs-Pipeline" subtitle="Kanban-Board für laufende Angebote und Interessenten">
        <Button onClick={() => openNew('erstkontakt')} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Neuer Deal
        </Button>
      </PageHeader>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Deals in Pipeline', value: activeDeals.length, sub: `${deals.length} total`, Icon: Target, color: 'text-primary' },
          { label: 'Pipeline-Wert', value: `CHF ${totalPipelineValue.toLocaleString('de-CH')}`, sub: 'Jahresprämien', Icon: TrendingUp, color: 'text-blue-500' },
          { label: 'Gewichteter Wert', value: `CHF ${Math.round(weightedValue).toLocaleString('de-CH')}`, sub: 'nach Wahrscheinlichkeit', Icon: DollarSign, color: 'text-amber-500' },
          { label: 'Abgeschlossen', value: closedDeals.length, sub: `CHF ${closedValue.toLocaleString('de-CH')}`, Icon: CheckCircle2, color: 'text-emerald-500' },
        ].map(({ label, value, sub, Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-bold text-sm leading-tight">{value}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto pb-6">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-3 min-w-max">
            {STAGES.map(stage => {
              const stageDeals = deals.filter(d => d.stage === stage.id);
              const stageValue = stageDeals.reduce((s, d) => s + (d.estimated_premium || 0), 0);

              return (
                <div key={stage.id} className="w-[280px] flex flex-col">
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${stage.dot}`} />
                      <span className="text-sm font-semibold text-foreground">{stage.label}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${stage.color}`}>
                        {stageDeals.length}
                      </span>
                    </div>
                    <button onClick={() => openNew(stage.id)}
                      className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {stageValue > 0 && (
                    <p className="text-xs text-muted-foreground px-1 mb-2">
                      CHF {stageValue.toLocaleString('de-CH')} / Jahr
                    </p>
                  )}

                  {/* Droppable Column */}
                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 min-h-[200px] rounded-xl p-2 space-y-2 transition-colors ${
                          snapshot.isDraggingOver ? 'bg-primary/5 border-2 border-dashed border-primary/30' : 'bg-slate-50/80 border border-border'
                        }`}
                      >
                        {stageDeals.map((deal, index) => (
                          <Draggable key={deal.id} draggableId={deal.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                              >
                                <DealCard
                                  deal={deal}
                                  dragging={snapshot.isDragging}
                                  onEdit={(d) => setEditingDeal(d)}
                                  onDelete={(id) => deleteMutation.mutate(id)}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}

                        {stageDeals.length === 0 && !snapshot.isDraggingOver && (
                          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground/50">
                            Hier ablegen
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {/* New Deal Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Neuer Deal</DialogTitle></DialogHeader>
          <DealForm
            deal={{ stage: defaultStage }}
            onSave={(data) => createMutation.mutate(data)}
            onCancel={() => setShowForm(false)}
            saving={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Deal Dialog */}
      <Dialog open={!!editingDeal} onOpenChange={(o) => !o && setEditingDeal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Deal bearbeiten</DialogTitle></DialogHeader>
          {editingDeal && (
            <DealForm
              deal={editingDeal}
              onSave={(data) => updateMutation.mutate({ id: editingDeal.id, data })}
              onCancel={() => setEditingDeal(null)}
              saving={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}