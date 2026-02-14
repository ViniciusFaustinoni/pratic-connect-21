import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Scale, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EncaminharJuridicoEventoModal } from './EncaminharJuridicoEventoModal';
import { notificarAguardandoDiretoria } from './NotificacaoHelper';

interface BannerAguardandoDiretoriaProps {
  sinistro: any;
}

export function BannerAguardandoDiretoria({ sinistro }: BannerAguardandoDiretoriaProps) {
  const { profile } = useAuth();
  const { isDiretor, isAdminMaster, isDesenvolvedor } = usePermissions();
  const queryClient = useQueryClient();
  const canDecide = isDiretor || isAdminMaster || isDesenvolvedor;

  const [dialogType, setDialogType] = useState<'aprovar' | 'negar' | 'reabrir' | null>(null);
  const [juridicoOpen, setJuridicoOpen] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const [prazoDias, setPrazoDias] = useState('30');
  const [responsavelId, setResponsavelId] = useState('');

  // Data da última mudança para aguardando_diretoria
  const { data: dataInconclusivo } = useQuery({
    queryKey: ['data-inconclusivo', sinistro.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('sinistro_historico')
        .select('created_at')
        .eq('sinistro_id', sinistro.id)
        .eq('status_novo', 'aguardando_diretoria')
        .order('created_at', { ascending: false })
        .limit(1);
      return data?.[0]?.created_at || null;
    },
  });

  // Responsáveis para reabrir sindicância
  const { data: sindicantes = [] } = useQuery({
    queryKey: ['sindicantes-banner'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, nome').eq('ativo', true).eq('tipo', 'funcionario').order('nome');
      return data || [];
    },
    enabled: dialogType === 'reabrir',
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['sinistro', sinistro.id] });
    queryClient.invalidateQueries({ queryKey: ['sinistro-historico', sinistro.id] });
    queryClient.invalidateQueries({ queryKey: ['sinistros'] });
  };

  const closeDialog = () => {
    setDialogType(null);
    setJustificativa('');
    setPrazoDias('30');
    setResponsavelId('');
  };

  // Aprovar
  const aprovarMutation = useMutation({
    mutationFn: async () => {
      if (!justificativa.trim()) throw new Error('Justificativa obrigatória');
      await supabase.from('sinistros').update({
        status: 'em_analise' as any,
        prazo_suspenso: false,
        prazo_motivo_suspensao: null,
        updated_at: new Date().toISOString(),
      }).eq('id', sinistro.id);

      // Fechar suspensão de prazo
      await supabase.from('sinistro_suspensoes_prazo')
        .update({ fim: new Date().toISOString() })
        .eq('sinistro_id', sinistro.id)
        .is('fim', null);

      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistro.id,
        status_anterior: 'aguardando_diretoria',
        status_novo: 'em_analise',
        usuario_id: profile?.id,
        observacao: `Aprovado pela diretoria: ${justificativa}`,
      });
    },
    onSuccess: () => { toast.success('Evento aprovado pela diretoria'); invalidateAll(); closeDialog(); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Negar
  const negarMutation = useMutation({
    mutationFn: async () => {
      if (!justificativa.trim()) throw new Error('Motivo obrigatório');
      await supabase.from('sinistros').update({
        status: 'negado' as any,
        justificativa_negacao: justificativa,
        updated_at: new Date().toISOString(),
      }).eq('id', sinistro.id);

      await supabase.from('sinistro_suspensoes_prazo')
        .update({ fim: new Date().toISOString() })
        .eq('sinistro_id', sinistro.id)
        .is('fim', null);

      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistro.id,
        status_anterior: 'aguardando_diretoria',
        status_novo: 'negado',
        usuario_id: profile?.id,
        observacao: `Negado pela diretoria: ${justificativa}`,
      });
    },
    onSuccess: () => { toast.success('Evento negado pela diretoria'); invalidateAll(); closeDialog(); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Reabrir sindicância
  const reabrirMutation = useMutation({
    mutationFn: async () => {
      if (!justificativa.trim()) throw new Error('Motivo obrigatório');
      if (!responsavelId) throw new Error('Selecione um responsável');
      const prazoFim = format(addDays(new Date(), Number(prazoDias)), 'yyyy-MM-dd');

      await supabase.from('sinistros').update({
        status: 'em_sindicancia' as any,
        sindicante_id: responsavelId,
        sindicancia_prazo_fim: prazoFim,
        resultado_sindicancia: null,
        parecer_sindicancia: null,
        updated_at: new Date().toISOString(),
      }).eq('id', sinistro.id);

      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistro.id,
        status_anterior: 'aguardando_diretoria',
        status_novo: 'em_sindicancia',
        usuario_id: profile?.id,
        observacao: `Sindicância reaberta pela diretoria. Motivo: ${justificativa}. Novo prazo: ${prazoDias} dias.`,
      });
    },
    onSuccess: () => { toast.success('Sindicância reaberta'); invalidateAll(); closeDialog(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      {/* Banner */}
      <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-800">Este evento aguarda decisão da diretoria</p>
            <p className="text-sm text-amber-700">
              Sindicância concluída como inconclusiva
              {dataInconclusivo && ` em ${format(new Date(dataInconclusivo), 'dd/MM/yyyy')}`}.
            </p>
          </div>
        </div>

        {canDecide && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setDialogType('aprovar')}>
              <CheckCircle className="h-4 w-4 mr-1" /> Aprovar Evento
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setDialogType('negar')}>
              <XCircle className="h-4 w-4 mr-1" /> Negar Evento
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDialogType('reabrir')}>
              <RefreshCw className="h-4 w-4 mr-1" /> Reabrir Sindicância
            </Button>
            <Button size="sm" variant="outline" onClick={() => setJuridicoOpen(true)}>
              <Scale className="h-4 w-4 mr-1" /> Encaminhar para Jurídico
            </Button>
          </div>
        )}
      </div>

      {/* Dialog Aprovar */}
      <Dialog open={dialogType === 'aprovar'} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar Evento</DialogTitle>
            <DialogDescription>O evento retornará ao fluxo normal de análise.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Justificativa *</Label>
            <Textarea value={justificativa} onChange={e => setJustificativa(e.target.value)} placeholder="Motivo da aprovação..." rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => aprovarMutation.mutate()} disabled={aprovarMutation.isPending || !justificativa.trim()}>
              {aprovarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Negar */}
      <Dialog open={dialogType === 'negar'} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Negar Evento</DialogTitle>
            <DialogDescription>O evento será negado definitivamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Motivo da negação *</Label>
            <Textarea value={justificativa} onChange={e => setJustificativa(e.target.value)} placeholder="Motivo..." rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button variant="destructive" onClick={() => negarMutation.mutate()} disabled={negarMutation.isPending || !justificativa.trim()}>
              {negarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Negação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Reabrir */}
      <Dialog open={dialogType === 'reabrir'} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir Sindicância</DialogTitle>
            <DialogDescription>Uma nova sindicância será aberta para este evento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Motivo *</Label>
              <Textarea value={justificativa} onChange={e => setJustificativa(e.target.value)} placeholder="Por que reabrir..." rows={3} />
            </div>
            <div>
              <Label>Novo prazo (dias)</Label>
              <Select value={prazoDias} onValueChange={setPrazoDias}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['15', '30', '45', '60'].map(d => (
                    <SelectItem key={d} value={d}>{d} dias</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Novo responsável *</Label>
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {sindicantes.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => reabrirMutation.mutate()} disabled={reabrirMutation.isPending || !justificativa.trim() || !responsavelId}>
              {reabrirMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reabrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Jurídico */}
      <EncaminharJuridicoEventoModal
        open={juridicoOpen}
        onClose={() => setJuridicoOpen(false)}
        sinistroId={sinistro.id}
        protocolo={sinistro.protocolo}
        associadoId={sinistro.associado_id}
        associadoNome={sinistro.associado?.nome}
      />
    </>
  );
}
