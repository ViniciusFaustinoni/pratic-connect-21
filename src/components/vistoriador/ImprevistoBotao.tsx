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
  const queryClient = useQueryClient();

  const handleRegistrar = async () => {
    if (!motivo) {
      toast.error('Selecione o motivo do imprevisto');
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
          status: 'imprevisto_pendente',
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', tarefaId);

      if (error) throw error;

      // PONTO A: Disparar link de reagendamento em background (não bloqueia o fluxo)
      supabase.functions.invoke('enviar-link-reagendamento', {
        body: { servico_id: tarefaId },
      }).then(({ error: linkErr }) => {
        if (linkErr) console.warn('[ImprevistoBotao] Erro ao enviar link (Ponto A, não crítico):', linkErr);
        else console.log('[ImprevistoBotao] Link de reagendamento disparado (Ponto A)');
      }).catch(e => console.warn('[ImprevistoBotao] Falha no Ponto A:', e));

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
              <Select value={motivo} onValueChange={setMotivo}>
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
            <Button onClick={handleRegistrar} disabled={salvando || !motivo}>
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
