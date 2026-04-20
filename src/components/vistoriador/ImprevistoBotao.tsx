import { useState } from 'react';
import { AlertTriangle, Loader2, User, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { DuploCheckImprevisto } from './DuploCheckImprevisto';

interface ImprevistoBotaoProps {
  tarefaId: string;
  clienteNome: string;
  clienteTelefone: string;
  clienteWhatsapp?: string | null;
}

type OrigemImprevisto = 'instalador' | 'associado';

export function ImprevistoBotao({ tarefaId, clienteNome, clienteTelefone, clienteWhatsapp }: ImprevistoBotaoProps) {
  const [open, setOpen] = useState(false);
  const [origem, setOrigem] = useState<OrigemImprevisto | null>(null);
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [showDuploCheck, setShowDuploCheck] = useState(false);
  const [podeContinuar, setPodeContinuar] = useState<boolean | null>(null);
  const queryClient = useQueryClient();

  const motivoLabel = origem === 'instalador' ? 'Imprevisto do técnico' : origem === 'associado' ? 'Imprevisto do associado' : '';

  const handleRegistrar = async () => {
    if (!origem) {
      toast.error('Selecione o tipo do imprevisto');
      return;
    }

    if (origem === 'instalador' && podeContinuar === null) {
      toast.error('Informe se consegue continuar a rota');
      return;
    }

    setSalvando(true);
    try {
      const motivoCompleto = observacoes
        ? `${motivoLabel} - ${observacoes}`
        : motivoLabel;

      const now = new Date().toISOString();

      // Buscar referências de origem (instalacao/vistoria) para espelhar a liberação
      const { data: servicoAtual } = await supabase
        .from('servicos')
        .select('instalacao_origem_id, vistoria_origem_id')
        .eq('id', tarefaId)
        .maybeSingle();

      // Atualização principal do serviço: libera técnico imediatamente
      const { error } = await supabase
        .from('servicos')
        .update({
          imprevisto_registrado_em: now,
          imprevisto_motivo: motivoCompleto,
          imprevisto_origem: origem,
          status: 'imprevisto_pendente',
          profissional_id: null,
          updated_at: now,
        } as any)
        .eq('id', tarefaId);

      if (error) throw error;

      // Espelhar liberação nas tabelas de origem (instalacoes / vistorias)
      if (servicoAtual?.instalacao_origem_id) {
        await supabase
          .from('instalacoes')
          .update({
            instalador_responsavel_id: null,
            rota_id: null,
            status: 'agendada',
            updated_at: now,
          } as any)
          .eq('id', servicoAtual.instalacao_origem_id);
      }
      if (servicoAtual?.vistoria_origem_id) {
        await supabase
          .from('vistorias')
          .update({
            vistoriador_id: null,
            rota_id: null,
            status: 'agendada',
            updated_at: now,
          } as any)
          .eq('id', servicoAtual.vistoria_origem_id);
      }

      // Se imprevisto do instalador e NÃO pode continuar, marcar indisponível no dia
      if (origem === 'instalador' && podeContinuar === false) {
        const hoje = new Date().toISOString().split('T')[0];
        await supabase
          .from('turnos_profissionais')
          .update({
            status: 'encerrado',
            fim_turno: now,
          } as any)
          .eq('data', hoje)
          .eq('status', 'ativo');
      }

      // Disparar link de reagendamento com retry (não bloqueia o fluxo)
      const triggerLink = async (tentativa: number) => {
        const { error: linkErr } = await supabase.functions.invoke('enviar-link-reagendamento', {
          body: { servico_id: tarefaId },
        });
        if (linkErr) {
          console.warn(`[ImprevistoBotao] Erro tentativa ${tentativa}:`, linkErr);
          if (tentativa < 2) {
            await new Promise(r => setTimeout(r, 3000));
            return triggerLink(tentativa + 1);
          }
        } else {
          console.log('[ImprevistoBotao] Link de reagendamento disparado');
        }
      };
      triggerLink(1).catch(e => console.warn('[ImprevistoBotao] Falha final:', e));

      toast.success('Imprevisto registrado');
      setOpen(false);
      setShowDuploCheck(true);
      // Invalidar todas as queries afetadas para liberar o card imediatamente
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes-calendario'] });
      queryClient.invalidateQueries({ queryKey: ['profissional-em-servico'] });
    } catch (error: any) {
      console.error('Erro ao registrar imprevisto:', error);
      toast.error('Erro ao registrar imprevisto');
    } finally {
      setSalvando(false);
    }
  };

  const handleOpen = () => {
    setOrigem(null);
    setObservacoes('');
    setPodeContinuar(null);
    setOpen(true);
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={handleOpen}
        className="w-full gap-2 border-amber-500/50 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-950"
      >
        <AlertTriangle className="h-4 w-4" />
        Comunicar Imprevisto
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Registrar Imprevisto
            </DialogTitle>
            <DialogDescription>
              Selecione o tipo de imprevisto que ocorreu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Seleção de tipo */}
            <div className="space-y-2">
              <Label>Tipo do imprevisto *</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setOrigem('instalador'); setPodeContinuar(null); }}
                  className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${
                    origem === 'instalador'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                      : 'border-muted hover:border-blue-300'
                  }`}
                >
                  <Wrench className={`h-6 w-6 ${origem === 'instalador' ? 'text-blue-600' : 'text-muted-foreground'}`} />
                  <span className={`text-sm font-medium ${origem === 'instalador' ? 'text-blue-700 dark:text-blue-300' : 'text-foreground'}`}>
                    Imprevisto do Técnico
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => { setOrigem('associado'); setPodeContinuar(null); }}
                  className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${
                    origem === 'associado'
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/40'
                      : 'border-muted hover:border-orange-300'
                  }`}
                >
                  <User className={`h-6 w-6 ${origem === 'associado' ? 'text-orange-600' : 'text-muted-foreground'}`} />
                  <span className={`text-sm font-medium ${origem === 'associado' ? 'text-orange-700 dark:text-orange-300' : 'text-foreground'}`}>
                    Imprevisto do Associado
                  </span>
                </button>
              </div>
            </div>

            {/* Pergunta extra para imprevistos do instalador */}
            {origem === 'instalador' && (
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/50">
                <Label className="text-sm font-medium">Você consegue continuar a rota?</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={podeContinuar === true ? 'default' : 'outline'}
                    onClick={() => setPodeContinuar(true)}
                    className="flex-1"
                  >
                    Sim, consigo
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={podeContinuar === false ? 'destructive' : 'outline'}
                    onClick={() => setPodeContinuar(false)}
                    className="flex-1"
                  >
                    Não, preciso parar
                  </Button>
                </div>
                {podeContinuar === false && (
                  <p className="text-xs text-destructive">
                    Suas tarefas restantes serão redistribuídas para outros profissionais.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Detalhes adicionais sobre o imprevisto..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button
              onClick={handleRegistrar}
              disabled={salvando || !origem || (origem === 'instalador' && podeContinuar === null)}
            >
              {salvando ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</>
              ) : (
                'Registrar Imprevisto'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DuploCheckImprevisto
        open={showDuploCheck}
        onOpenChange={setShowDuploCheck}
        tarefaId={tarefaId}
        clienteNome={clienteNome}
        clienteTelefone={clienteTelefone}
        clienteWhatsapp={clienteWhatsapp}
      />
    </>
  );
}
