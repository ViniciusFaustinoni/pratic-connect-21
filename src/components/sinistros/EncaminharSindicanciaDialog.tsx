import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Search, AlertTriangle, Info, CalendarIcon } from 'lucide-react';
import { notificarSindicanciaAberta } from '@/components/sinistros/NotificacaoHelper';
import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { MOTIVOS_PADRONIZADOS, ESPECIALIDADES_LABELS } from '@/types/sindicancia';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';

interface EncaminharSindicanciaDialogProps {
  open: boolean;
  onClose: () => void;
  sinistroId: string;
  protocolo: string;
  tipoEvento?: string;
  onSuccess?: () => void;
}

export function EncaminharSindicanciaDialog({
  open, onClose, sinistroId, protocolo, tipoEvento, onSuccess,
}: EncaminharSindicanciaDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [motivosSelecionados, setMotivosSelecionados] = useState<string[]>([]);
  const [descricao, setDescricao] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [dataLimite, setDataLimite] = useState<Date>(addDays(new Date(), 30));
  const [erroSindicanciaAtiva, setErroSindicanciaAtiva] = useState('');

  const minDate = addDays(new Date(), 7);
  const maxDate = addDays(new Date(), 60);

  // Check for existing active sindicancia
  const { data: sindicanciaAtiva } = useQuery({
    queryKey: ['sindicancia-ativa', sinistroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sindicancias')
        .select('numero, status')
        .eq('sinistro_id', sinistroId)
        .not('status', 'in', '("encerrado","cancelado")')
        .limit(1);
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: open,
  });

  useEffect(() => {
    if (sindicanciaAtiva) {
      setErroSindicanciaAtiva(`Já existe sindicância ativa para este evento: ${sindicanciaAtiva.numero}`);
    } else {
      setErroSindicanciaAtiva('');
    }
  }, [sindicanciaAtiva]);

  // Fetch active empresas de sindicância with active case counts
  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-sindicancia-ativas'],
    queryFn: async () => {
      const { data: emps, error } = await supabase
        .from('empresas_sindicancia')
        .select('id, nome_fantasia, razao_social, especialidades, profile_id')
        .eq('ativo', true)
        .order('nome_fantasia');
      if (error) throw error;

      // Get active case counts
      const { data: counts } = await supabase
        .from('sindicancias')
        .select('empresa_sindicancia_id')
        .in('status', ['atribuido', 'em_andamento']);

      const countMap: Record<string, number> = {};
      (counts || []).forEach(c => {
        if (c.empresa_sindicancia_id) {
          countMap[c.empresa_sindicancia_id] = (countMap[c.empresa_sindicancia_id] || 0) + 1;
        }
      });

      return (emps || []).map(e => ({
        ...e,
        casosAtivos: countMap[e.id] || 0,
      }));
    },
    enabled: open,
  });

  const toggleMotivo = (value: string) => {
    setMotivosSelecionados(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const empresaSelecionada = empresas.find(e => e.id === empresaId);
  const diasPrazo = Math.round((dataLimite.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  const motivosLabels = motivosSelecionados.map(v => MOTIVOS_PADRONIZADOS.find(m => m.value === v)?.label).filter(Boolean);

  const isValid = motivosSelecionados.length > 0 && descricao.length >= 50 && !erroSindicanciaAtiva;

  const abrirMutation = useMutation({
    mutationFn: async () => {
      if (!isValid) throw new Error('Preencha todos os campos obrigatórios');

      const status = empresaId ? 'atribuido' : 'aguardando_atribuicao';
      const profileId = empresaSelecionada?.profile_id || null;

      // 1. Insert sindicancia
      const { data: sindicancia, error: insertError } = await supabase
        .from('sindicancias')
        .insert({
          sinistro_id: sinistroId,
          motivo: descricao,
          motivos_padronizados: motivosSelecionados,
          empresa_sindicancia_id: empresaId || null,
          sindicante_profile_id: profileId,
          data_limite: format(dataLimite, 'yyyy-MM-dd'),
          status: status as any,
          data_atribuicao: empresaId ? new Date().toISOString() : null,
          aberto_por: user?.id || null,
        })
        .select('id, numero')
        .single();
      if (insertError) throw insertError;

      // 2. Update sinistro status
      const { error: updateError } = await supabase.from('sinistros').update({
        status: 'em_sindicancia' as any,
        prazo_suspenso: true,
        prazo_suspenso_em: new Date().toISOString(),
        prazo_motivo_suspensao: 'sindicancia',
        updated_at: new Date().toISOString(),
      }).eq('id', sinistroId);
      if (updateError) throw updateError;

      // 3. Register prazo suspension
      await supabase.from('sinistro_suspensoes_prazo').insert({
        sinistro_id: sinistroId,
        motivo: 'sindicancia',
        inicio: new Date().toISOString(),
      });

      // 4. Insert history
      const motivosResumo = motivosLabels.join(', ');
      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistroId,
        status_novo: 'em_sindicancia',
        usuario_id: user?.id,
        observacao: `Sindicância aberta (${sindicancia.numero}) — Motivo: ${motivosResumo}`,
      });

      // 5. Notify sindicante if assigned
      if (profileId) {
        notificarSindicanciaAberta(sinistroId, protocolo, profileId, format(dataLimite, 'dd/MM/yyyy'));
      }

      return sindicancia;
    },
    onSuccess: (sindicancia) => {
      toast.success(`Sindicância ${sindicancia.numero} aberta com sucesso`);
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-analise', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-historico', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      queryClient.invalidateQueries({ queryKey: ['sindicancias'] });
      handleClose();
      onSuccess?.();
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao abrir sindicância'),
  });

  const handleClose = () => {
    setMotivosSelecionados([]);
    setDescricao('');
    setEmpresaId('');
    setDataLimite(addDays(new Date(), 30));
    setErroSindicanciaAtiva('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-destructive" />
            Abrir Sindicância — Evento #{protocolo}
          </DialogTitle>
          <DialogDescription>
            Documentar a abertura de investigação formal para este evento.
          </DialogDescription>
        </DialogHeader>

        {erroSindicanciaAtiva && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{erroSindicanciaAtiva}</span>
          </div>
        )}

        <div className="space-y-6 py-2">
          {/* Seção 1: Motivos */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">1. Motivo da Sindicância</Label>
            <p className="text-sm text-muted-foreground">Selecione os motivos que justificam a abertura (pelo menos 1):</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MOTIVOS_PADRONIZADOS.map((m) => (
                <div key={m.value} className="flex items-start gap-2">
                  <Checkbox
                    id={`motivo-${m.value}`}
                    checked={motivosSelecionados.includes(m.value)}
                    onCheckedChange={() => toggleMotivo(m.value)}
                    disabled={!!erroSindicanciaAtiva}
                  />
                  <Label htmlFor={`motivo-${m.value}`} className="font-normal text-sm cursor-pointer leading-tight">
                    {m.label}
                  </Label>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2">
              <Label>Descrição detalhada do motivo *</Label>
              <Textarea
                placeholder="Descreva com detalhes o que motivou a abertura desta sindicância. O sindicante usará esta informação para direcionar a investigação..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={4}
                disabled={!!erroSindicanciaAtiva}
              />
              <p className={cn('text-xs', descricao.length < 50 ? 'text-destructive' : 'text-muted-foreground')}>
                {descricao.length}/50 caracteres mínimos
              </p>
            </div>
          </div>

          {/* Seção 2: Sindicante */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">2. Atribuir Sindicante</Label>
            <Select value={empresaId} onValueChange={setEmpresaId} disabled={!!erroSindicanciaAtiva}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar empresa de sindicância (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    <span className="flex items-center gap-2 flex-wrap">
                      {e.nome_fantasia || e.razao_social}
                      {(e.especialidades || []).slice(0, 2).map(esp => (
                        <Badge key={esp} variant="secondary" className="text-[10px] px-1 py-0">
                          {ESPECIALIDADES_LABELS[esp] || esp}
                        </Badge>
                      ))}
                      <span className="text-muted-foreground text-xs">— {e.casosAtivos} caso(s) ativo(s)</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!empresaId && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-sm">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Você pode atribuir o sindicante depois. O caso ficará como "Aguardando Atribuição" até ser designado.</span>
              </div>
            )}
          </div>

          {/* Seção 3: Prazo */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">3. Prazo</Label>
            <p className="text-sm text-muted-foreground">Data limite para conclusão da sindicância (7 a 60 dias)</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full sm:w-[280px] justify-start text-left font-normal',
                    !dataLimite && 'text-muted-foreground'
                  )}
                  disabled={!!erroSindicanciaAtiva}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dataLimite, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  <span className="ml-auto text-muted-foreground text-xs">({diasPrazo} dias)</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataLimite}
                  onSelect={(date) => date && setDataLimite(date)}
                  disabled={(date) => date < minDate || date > maxDate}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Seção 4: Resumo */}
          {isValid && (
            <Card className="bg-muted/50 border-muted">
              <CardContent className="p-4 space-y-2 text-sm">
                <p className="font-semibold">Resumo</p>
                <p><span className="text-muted-foreground">Evento:</span> #{protocolo}{tipoEvento ? ` — ${tipoEvento}` : ''}</p>
                <p><span className="text-muted-foreground">Motivos:</span> {motivosLabels.join(', ')}</p>
                <p>
                  <span className="text-muted-foreground">Sindicante:</span>{' '}
                  {empresaSelecionada ? (empresaSelecionada.nome_fantasia || empresaSelecionada.razao_social) : 'Não atribuído — ficará aguardando'}
                </p>
                <p><span className="text-muted-foreground">Prazo:</span> {format(dataLimite, 'dd/MM/yyyy')} ({diasPrazo} dias)</p>
                <div className="flex items-start gap-2 pt-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="text-xs">O evento ficará suspenso durante a sindicância. Nenhuma outra ação poderá ser tomada até o sindicante concluir a investigação.</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={abrirMutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => abrirMutation.mutate()}
            disabled={abrirMutation.isPending || !isValid}
          >
            {abrirMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Abrir Sindicância
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
