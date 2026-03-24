import { useState, useRef, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Users, Search, MessageSquare, CheckCircle, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useVistoriadoresPrestadores, VistoriadorPrestador } from '@/hooks/useVistoriadoresPrestadores';
import { useEnviarWhatsApp } from '@/hooks/useEnviarWhatsApp';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatarMoeda } from '@/utils/format';
import { CoberturaVistoria } from '@/hooks/useCoberturaCidade';
import type { TipoCobertura } from '@/hooks/useCoberturaInstalacao';

interface PainelAtribuicaoPrestadorProps {
  instalacao: any;
  tipoCobertura: TipoCobertura;
  cobertura?: CoberturaVistoria;
}

const PERIODO_LABELS: Record<string, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  integral: 'Integral',
};

export function PainelAtribuicaoPrestador({ instalacao, tipoCobertura, cobertura }: PainelAtribuicaoPrestadorProps) {
  const jaAtribuido = !!(instalacao as any).vistoriador_prestador_id;

  if (jaAtribuido) {
    return <EstadoAtribuido instalacao={instalacao} />;
  }

  return (
    <EstadoSelecao
      instalacao={instalacao}
      tipoCobertura={tipoCobertura}
      cobertura={cobertura}
    />
  );
}

/* ── Estado pós-confirmação ── */
function EstadoAtribuido({ instalacao }: { instalacao: any }) {
  const { data: prestadores } = useVistoriadoresPrestadores();
  const [reenviando, setReenviando] = useState(false);

  const prestador = useMemo(() => {
    if (!prestadores) return null;
    return prestadores.find((p) => p.id === (instalacao as any).vistoriador_prestador_id) ?? null;
  }, [prestadores, instalacao]);

  const handleReenviar = async () => {
    if (!prestador) return;
    setReenviando(true);
    try {
      const { data, error } = await supabase.functions.invoke('gerar-link-vistoriador-prestador', {
        body: {
          instalacao_id: instalacao.id,
          vistoriador_prestador_id: prestador.id,
          reenviar: true,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao reenviar');
      toast.success(data.whatsapp_enviado ? 'Link reenviado via WhatsApp!' : 'Link gerado, mas houve falha no envio do WhatsApp');
    } catch (e: any) {
      toast.error('Erro ao reenviar: ' + e.message);
    } finally {
      setReenviando(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle className="h-4 w-4 text-primary" />
        <span className="font-medium">{prestador?.nome ?? 'Prestador'}</span>
      </div>
      <Separator />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Valor acordado</p>
          <p className="font-semibold text-lg">{formatarMoeda((instalacao as any).valor_prestador ?? 0)}</p>
        </div>
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
          Aguardando execução
        </Badge>
      </div>
      <Button variant="outline" size="sm" className="w-full" onClick={handleReenviar}>
        <RefreshCw className="mr-2 h-4 w-4" /> Reenviar link por WhatsApp
      </Button>
    </div>
  );
}

/* ── Estado de seleção ── */
function EstadoSelecao({
  instalacao,
  tipoCobertura,
  cobertura,
}: {
  instalacao: any;
  tipoCobertura: TipoCobertura;
  cobertura?: CoberturaVistoria;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [valor, setValor] = useState<number>(0);
  const [confirmarOpen, setConfirmarOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState('');
  const valorRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { abrirWhatsAppWeb } = useEnviarWhatsApp();

  // All prestadores for Cenário C search
  const { data: todosPrestadores } = useVistoriadoresPrestadores();

  // Build list of available prestadores
  const prestadoresDisponiveis: VistoriadorPrestador[] = useMemo(() => {
    if (tipoCobertura === 'area_prestador' && cobertura?.prestadores) {
      // Match cobertura prestadores with full data
      if (!todosPrestadores) return [];
      const ids = new Set(cobertura.prestadores.map((p) => p.id));
      return todosPrestadores.filter((p) => ids.has(p.id) && p.ativo);
    }
    // Cenário C: all active prestadores, filtered by search
    if (!todosPrestadores) return [];
    const ativos = todosPrestadores.filter((p) => p.ativo);
    if (!busca.trim()) return ativos;
    const term = busca.toLowerCase();
    return ativos.filter((p) => p.nome.toLowerCase().includes(term));
  }, [tipoCobertura, cobertura, todosPrestadores, busca]);

  const selectedPrestador = useMemo(
    () => prestadoresDisponiveis.find((p) => p.id === selectedId) ?? null,
    [prestadoresDisponiveis, selectedId],
  );

  // Autofocus valor field when a prestador is selected
  useEffect(() => {
    if (selectedId && valorRef.current) {
      setTimeout(() => valorRef.current?.focus(), 100);
    }
  }, [selectedId]);

  const handleConfirmar = async () => {
    if (!selectedPrestador || valor <= 0) return;
    setSalvando(true);
    try {
      const { error } = await (supabase as any)
        .from('instalacoes')
        .update({
          vistoriador_prestador_id: selectedPrestador.id,
          valor_prestador: valor,
          prestador_atribuido_em: new Date().toISOString(),
        })
        .eq('id', instalacao.id);
      if (error) throw error;

      // Notificar via WhatsApp
      if (selectedPrestador.telefone) {
        const msg = `Olá ${selectedPrestador.nome}, você foi atribuído a uma instalação em ${instalacao.cidade}/${instalacao.uf} no dia ${new Date(instalacao.data_agendada + 'T12:00:00').toLocaleDateString('pt-BR')}. Valor: ${formatarMoeda(valor)}.`;
        abrirWhatsAppWeb(selectedPrestador.telefone, msg);
      }

      toast.success('Prestador atribuído com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['instalacao', instalacao.id] });
      setConfirmarOpen(false);
    } catch (e: any) {
      toast.error('Erro ao atribuir: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  const displayValor = useMemo(() => {
    if (!valor || valor === 0) return '';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  }, [valor]);

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 8);
    setValor(parseInt(raw || '0', 10) / 100);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Users className="h-4 w-4" /> Atribuição — Vistoriador Prestador
        </h3>
        <Badge
          className={
            tipoCobertura === 'area_prestador'
              ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
          }
        >
          {tipoCobertura === 'area_prestador'
            ? '🟠 Fora da área de vistoriadores comuns'
            : '🔴 Cidade sem cobertura cadastrada'}
        </Badge>
      </div>

      <Separator />

      {/* Search field for Cenário C */}
      {tipoCobertura === 'fora_cobertura' && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar prestador por nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Prestador cards */}
      {prestadoresDisponiveis.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum prestador disponível{tipoCobertura === 'fora_cobertura' && busca ? ' para esta busca' : ''}.
        </p>
      ) : (
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
          {prestadoresDisponiveis.map((p) => {
            const isSelected = selectedId === p.id;
            return (
              <div key={p.id}>
                <div
                  className={cn(
                    'border rounded-lg p-3 transition-all',
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : selectedId
                        ? 'opacity-50 border-border'
                        : 'border-border hover:border-primary/50',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{p.nome}</p>
                      {p.telefone && (
                        <p className="text-xs text-muted-foreground">{p.telefone}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={isSelected ? 'default' : 'outline'}
                      onClick={() => setSelectedId(isSelected ? null : p.id)}
                    >
                      {isSelected ? 'Selecionado' : 'Selecionar'}
                    </Button>
                  </div>
                </div>

                {/* Valor field appears right below selected card */}
                {isSelected && (
                  <div className="mt-2 ml-2 p-3 border rounded-lg bg-muted/30 space-y-2">
                    <Label htmlFor="valor-prestador" className="text-sm font-medium">
                      Valor desta tarefa (R$)
                    </Label>
                    <Input
                      id="valor-prestador"
                      ref={valorRef}
                      value={displayValor}
                      onChange={handleValorChange}
                      placeholder="R$ 0,00"
                    />
                    <p className="text-xs text-muted-foreground">
                      Este valor será lançado nos gastos do financeiro
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm button */}
      {selectedId && (
        <Button
          className="w-full"
          disabled={valor <= 0}
          onClick={() => setConfirmarOpen(true)}
        >
          <MessageSquare className="mr-2 h-4 w-4" /> Atribuir e Notificar via WhatsApp
        </Button>
      )}

      {/* Confirmation modal */}
      <AlertDialog open={confirmarOpen} onOpenChange={setConfirmarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Atribuição</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-muted-foreground">Prestador</p>
                    <p className="font-medium text-foreground">{selectedPrestador?.nome}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cidade</p>
                    <p className="font-medium text-foreground">{instalacao.cidade}/{instalacao.uf}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Data</p>
                    <p className="font-medium text-foreground">
                      {new Date(instalacao.data_agendada + 'T12:00:00').toLocaleDateString('pt-BR')}
                      {' • '}
                      {PERIODO_LABELS[instalacao.periodo] ?? instalacao.periodo}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Associado</p>
                    <p className="font-medium text-foreground">{instalacao.associado_nome ?? '—'}</p>
                  </div>
                </div>
                <Separator />
                <div className="text-center">
                  <p className="text-muted-foreground text-xs">Valor acordado</p>
                  <p className="text-xl font-bold text-foreground">{formatarMoeda(valor)}</p>
                </div>
                <p className="text-xs text-muted-foreground border-l-2 border-primary pl-2">
                  Ao confirmar, o prestador receberá os dados da tarefa via WhatsApp com um link único de acesso.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={salvando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmar} disabled={salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Atribuição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
