import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { DuploCheckImprevisto } from './DuploCheckImprevisto';

const MOTIVOS_IMPREVISTO = [
  'Associado ausente',
  'Endereço incorreto',
  'Problema no veículo',
  'Desistência do associado',
  'Outro',
];

// Classificação automática da origem do imprevisto
const ORIGEM_POR_MOTIVO: Record<string, 'associado' | 'instalador'> = {
  'Associado ausente': 'associado',
  'Endereço incorreto': 'associado',
  'Desistência do associado': 'associado',
  'Problema no veículo': 'instalador',
  'Outro': 'instalador',
};

interface ImprevistoBotaoProps {
  tarefaId: string;
  clienteNome: string;
  clienteTelefone: string;
  clienteWhatsapp?: string | null;
}

export function ImprevistoBotao({ tarefaId, clienteNome, clienteTelefone, clienteWhatsapp }: ImprevistoBotaoProps) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [showDuploCheck, setShowDuploCheck] = useState(false);
  const [podeContinuar, setPodeContinuar] = useState<boolean | null>(null);
  const queryClient = useQueryClient();

  const origemAtual = motivo ? ORIGEM_POR_MOTIVO[motivo] : null;
  const mostrarPerguntaContinuar = origemAtual === 'instalador';

  const handleRegistrar = async () => {
    if (!motivo) {
      toast.error('Selecione o motivo do imprevisto');
      return;
    }

    if (mostrarPerguntaContinuar && podeContinuar === null) {
      toast.error('Informe se consegue continuar a rota');
      return;
    }

    setSalvando(true);
    try {
      const motivoCompleto = observacoes 
        ? `${motivo} - ${observacoes}` 
        : motivo;

      const { error } = await supabase
        .from('servicos')
        .update({
          imprevisto_registrado_em: new Date().toISOString(),
          imprevisto_motivo: motivoCompleto,
          imprevisto_origem: origemAtual,
          status: 'imprevisto_pendente',
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', tarefaId);

      if (error) throw error;

      // Se imprevisto do instalador e NÃO pode continuar, marcar indisponível no dia
      if (origemAtual === 'instalador' && podeContinuar === false) {
        const hoje = new Date().toISOString().split('T')[0];
        await supabase
          .from('turnos_profissionais')
          .update({ 
            status: 'encerrado',
            fim_turno: new Date().toISOString(),
          } as any)
          .eq('data', hoje)
          .eq('status', 'ativo');
      }

      // PONTO A: Disparar link de reagendamento com retry (não bloqueia o fluxo)
      const triggerLink = async (tentativa: number) => {
        const { error: linkErr } = await supabase.functions.invoke('enviar-link-reagendamento', {
          body: { servico_id: tarefaId },
        });
        if (linkErr) {
          console.warn(`[ImprevistoBotao] Erro Ponto A tentativa ${tentativa}:`, linkErr);
          if (tentativa < 2) {
            await new Promise(r => setTimeout(r, 3000));
            return triggerLink(tentativa + 1);
          }
        } else {
          console.log('[ImprevistoBotao] Link de reagendamento disparado (Ponto A)');
        }
      };
      triggerLink(1).catch(e => console.warn('[ImprevistoBotao] Falha final Ponto A:', e));

      toast.success('Imprevisto registrado');
      setOpen(false);
      setShowDuploCheck(true);
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
    } catch (error: any) {
      console.error('Erro ao registrar imprevisto:', error);
      toast.error('Erro ao registrar imprevisto');
    } finally {
      setSalvando(false);
    }
  };

  const handleMotivoChange = (value: string) => {
    setMotivo(value);
    setPodeContinuar(null); // Reset ao trocar motivo
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-full gap-2 border-amber-500/50 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-950"
      >
        <AlertTriangle className="h-4 w-4" />
        Comunicar Imprevisto
      </Button>

      {/* Modal de registro do imprevisto */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Registrar Imprevisto
            </DialogTitle>
            <DialogDescription>
              Informe o motivo pelo qual não foi possível realizar o serviço.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Motivo do imprevisto *</Label>
              <Select value={motivo} onValueChange={handleMotivoChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS_IMPREVISTO.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pergunta extra para imprevistos do instalador */}
            {mostrarPerguntaContinuar && (
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
              <Label>Observações</Label>
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
              disabled={salvando || !motivo || (mostrarPerguntaContinuar && podeContinuar === null)}
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

      {/* Duplo Check */}
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
