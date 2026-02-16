import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOficinas } from '@/hooks/useOficinas';
import { usePrestadoresEvento } from '@/hooks/usePrestadoresEvento';
import { useAutoCenters } from '@/hooks/useAutoCenters';
import { useVistoriaEvento, ItemOrcamento } from '@/hooks/useVistoriaEvento';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Wrench,
  Loader2,
  Car,
  Building2,
  Package,
  MessageSquare,
  AlertTriangle,
  Users,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AtribuirFornecedoresDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sinistro: any;
  onSuccess?: () => void;
}

export function AtribuirFornecedoresDialog({
  open,
  onOpenChange,
  sinistro,
  onSuccess,
}: AtribuirFornecedoresDialogProps) {
  const [oficinaId, setOficinaId] = useState('');
  const [prestadoresSelecionados, setPrestadoresSelecionados] = useState<string[]>([]);
  const [autoCentersSelecionados, setAutoCentersSelecionados] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const veiculo = sinistro?.veiculo as any;
  const marcaVeiculo = veiculo?.marca || '';

  // Buscar vistoria para obter itens do orçamento
  const { data: vistoria } = useVistoriaEvento(sinistro?.id);

  const itensOrcamento = useMemo(() => {
    return (vistoria?.dados_vistoria?.itens_orcamento || []) as ItemOrcamento[];
  }, [vistoria]);

  const itensPecas = useMemo(() => {
    return itensOrcamento.filter((i) => i.tipo === 'peca');
  }, [itensOrcamento]);

  const etapasReparo = useMemo(() => {
    return (vistoria?.dados_vistoria?.etapas_reparo || [])
      .filter((e: any) => e.selecionada)
      .map((e: any) => e.nome);
  }, [vistoria]);

  // Buscar fornecedores filtrados por marca
  const { data: oficinas, isLoading: loadingOficinas } = useOficinas({
    status: 'ativo' as any,
    marca: marcaVeiculo,
  });

  const { data: prestadores, isLoading: loadingPrestadores } = usePrestadoresEvento({
    status: 'ativo',
    marca: marcaVeiculo,
  });

  const { data: autoCenters, isLoading: loadingAutoCenters } = useAutoCenters({
    marca: marcaVeiculo,
  });

  // Filtrar oficinas por especialidades compatíveis com etapas de reparo
  const oficinasCompativeis = useMemo(() => {
    if (!oficinas || etapasReparo.length === 0) return oficinas || [];
    return oficinas.filter((o: any) => {
      if (!o.especialidades?.length) return false;
      return etapasReparo.some((etapa: string) =>
        o.especialidades.some((esp: string) =>
          esp.toLowerCase().includes(etapa.toLowerCase()) ||
          etapa.toLowerCase().includes(esp.toLowerCase())
        )
      );
    });
  }, [oficinas, etapasReparo]);

  // Tipos de peça do orçamento para matching com auto centers
  const tiposPecaOrcamento = useMemo(() => {
    return itensPecas.map((p) => p.descricao.toLowerCase());
  }, [itensPecas]);

  // Filtrar auto centers ativos e ordenar por compatibilidade
  const autoCentersAtivos = useMemo(() => {
    const ativos = (autoCenters || []).filter((ac: any) => ac.status === 'ativo' && ac.whatsapp);
    // Ordenar: compatíveis primeiro
    return ativos.sort((a: any, b: any) => {
      const aMatch = a.especialidades?.some((esp: string) =>
        tiposPecaOrcamento.some((tipo) =>
          esp.toLowerCase().includes(tipo) || tipo.includes(esp.toLowerCase())
        )
      ) ? 1 : 0;
      const bMatch = b.especialidades?.some((esp: string) =>
        tiposPecaOrcamento.some((tipo) =>
          esp.toLowerCase().includes(tipo) || tipo.includes(esp.toLowerCase())
        )
      ) ? 1 : 0;
      return bMatch - aMatch;
    });
  }, [autoCenters, tiposPecaOrcamento]);

  // Oficina selecionada (para complementar prestadores)
  const oficinaSelecionada = useMemo(() => {
    return oficinas?.find((o) => o.id === oficinaId);
  }, [oficinas, oficinaId]);

  // Preview da mensagem
  const previewMensagem = useMemo(() => {
    if (itensPecas.length === 0) return '';
    const itensTexto = itensPecas
      .map((item, i) => `${i + 1}. ${item.descricao} — Qtd: ${item.quantidade || 1}`)
      .join('\n');
    return `Olá [Nome]! Aqui é a Pratic Car.\nPrecisamos de uma cotação de peças para:\n\n🚗 Veículo: ${veiculo?.marca || ''} ${veiculo?.modelo || ''} ${veiculo?.ano_modelo || ''} — Placa: ${veiculo?.placa || ''}\n\n📋 Itens para cotação:\n${itensTexto}\n\n⏰ Prazo para resposta: 24 horas\n📎 Referência: Evento #${sinistro?.protocolo || ''}\n\nPor favor, responda com o valor de cada item e o prazo de entrega. Obrigado!`;
  }, [itensPecas, veiculo, sinistro]);

  const handleTogglePrestador = (id: string) => {
    setPrestadoresSelecionados((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleToggleAutoCenter = (id: string) => {
    setAutoCentersSelecionados((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!oficinaId) {
      toast.error('Selecione uma oficina');
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .maybeSingle();

      // 1. Salvar oficina_id no sinistro e mudar status para pecas_em_cotacao
      const nomeOficina = oficinasCompativeis?.find((o) => o.id === oficinaId)?.nome_fantasia || oficinasCompativeis?.find((o) => o.id === oficinaId)?.razao_social || 'N/A';
      
      const { error: updateError } = await supabase
        .from('sinistros')
        .update({
          oficina_id: oficinaId,
          status: 'pecas_em_cotacao' as any,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sinistro.id);
      if (updateError) throw updateError;

      // 2. Registrar histórico
      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistro.id,
        status_anterior: sinistro.status,
        status_novo: 'pecas_em_cotacao',
        observacao: `Fornecedores atribuídos. Oficina: ${nomeOficina}. Peças em cotação.`,
        usuario_id: profile?.id,
      });

      // 5. Registrar prestadores selecionados
      if (prestadoresSelecionados.length > 0) {
        await supabase.from('sinistro_prestadores').insert(
          prestadoresSelecionados.map((prestadorId) => ({
            sinistro_id: sinistro.id,
            prestador_id: prestadorId,
          }))
        );
      }

      // 6. Para cada auto center: criar cotação e enviar WhatsApp
      for (const acId of autoCentersSelecionados) {
        const ac = autoCentersAtivos.find((a: any) => a.id === acId);
        if (!ac) continue;

        const prazo = new Date();
        prazo.setHours(prazo.getHours() + 24);

        // Criar registro da cotação
        const { data: cotacao, error: cotError } = await supabase
          .from('evento_cotacoes_pecas')
          .insert({
            sinistro_id: sinistro.id,
            auto_center_id: acId,
            itens: itensPecas as any,
            status: 'enviado',
            prazo_resposta: prazo.toISOString(),
          })
          .select()
          .single();

        if (cotError) {
          console.error('Erro ao criar cotação:', cotError);
          continue;
        }

        // Enviar WhatsApp via edge function
        try {
          await supabase.functions.invoke('enviar-cotacao-pecas', {
            body: {
              sinistro_id: sinistro.id,
              auto_center_id: acId,
              itens: itensPecas,
              cotacao_id: cotacao.id,
            },
          });
        } catch (err) {
          console.error('Erro ao enviar cotação WhatsApp:', err);
        }
      }

      toast.success('Fornecedores atribuídos com sucesso!');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Erro ao atribuir fornecedores:', error);
      toast.error('Erro ao atribuir fornecedores: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Atribuir Fornecedores
          </DialogTitle>
          <DialogDescription>
            Selecione oficina, prestadores e auto centers para o evento {sinistro?.protocolo}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-2">
            {/* Cabeçalho - Dados do Veículo */}
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted">
              <Car className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-semibold text-foreground">
                  {veiculo?.marca} {veiculo?.modelo} {veiculo?.ano_modelo}
                </p>
                <p className="text-sm text-muted-foreground">
                  Placa: {veiculo?.placa} • {itensOrcamento.length} itens no orçamento ({itensPecas.length} peças)
                </p>
              </div>
            </div>

            {/* Resumo do orçamento */}
            {itensOrcamento.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Resumo do Orçamento</p>
                <div className="grid gap-1">
                  {itensOrcamento.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm px-3 py-1.5 rounded bg-muted/50">
                      <span>{item.descricao}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {item.tipo === 'peca' ? 'Peça' : item.tipo === 'mao_de_obra' ? 'M.O.' : 'Serviço'}
                        </Badge>
                        <span className="text-muted-foreground">x{item.quantidade || 1}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* SEÇÃO 1 — OFICINA */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Selecionar Oficina para o Reparo</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Escolha a oficina credenciada onde o veículo será reparado
              </p>

              {loadingOficinas ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Carregando oficinas...</span>
                </div>
              ) : !oficinasCompativeis?.length ? (
                <div className="flex items-center gap-2 p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <p className="text-sm text-amber-800">
                    Nenhuma oficina compatível encontrada para a marca {marcaVeiculo}. Cadastre novas oficinas ou verifique fornecedores com atendimento GLOBAL.
                  </p>
                </div>
              ) : (
                <RadioGroup value={oficinaId} onValueChange={setOficinaId} className="space-y-2">
                  {oficinasCompativeis.map((oficina) => (
                    <label
                      key={oficina.id}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                        oficinaId === oficina.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      )}
                    >
                      <RadioGroupItem value={oficina.id} className="mt-1" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">
                          {oficina.nome_fantasia || oficina.razao_social}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {[oficina.logradouro, oficina.numero, oficina.bairro].filter(Boolean).join(', ')}
                          {oficina.cidade && ` — ${oficina.cidade}`}
                          {oficina.estado && `/${oficina.estado}`}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {oficina.especialidades?.map((e: string) => (
                            <Badge key={e} variant="secondary" className="text-xs">
                              {e}
                            </Badge>
                          ))}
                        </div>
                        {oficina.nota_media != null && (
                          <div className="flex items-center gap-1 mt-1">
                            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                            <span className="text-xs text-muted-foreground">
                              {Number(oficina.nota_media).toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              )}
            </div>

            <Separator />

            {/* SEÇÃO 2 — PRESTADORES */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Prestadores de Serviço (opcional)</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Se necessário, selecione prestadores especializados para serviços que a oficina não cobre
              </p>

              {loadingPrestadores ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Carregando prestadores...</span>
                </div>
              ) : !prestadores?.length ? (
                <p className="text-sm text-muted-foreground py-2">
                  Nenhum prestador encontrado para a marca {marcaVeiculo}.
                </p>
              ) : (
                <div className="space-y-2">
                  {prestadores.map((prest) => (
                    <label
                      key={prest.id}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                        prestadoresSelecionados.includes(prest.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      )}
                    >
                      <Checkbox
                        checked={prestadoresSelecionados.includes(prest.id)}
                        onCheckedChange={() => handleTogglePrestador(prest.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">
                          {prest.nome_fantasia || prest.razao_social}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {[prest.cidade, prest.estado].filter(Boolean).join(' - ')}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {prest.especialidades?.map((e: string) => (
                            <Badge key={e} variant="secondary" className="text-xs">
                              {e}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* SEÇÃO 3 — AUTO CENTERS */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Auto Centers para Cotação de Peças</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Selecione os auto centers que receberão o pedido de cotação de peças via WhatsApp. Recomendado mínimo 3 para comparação.
              </p>

              {itensPecas.length === 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <p className="text-sm text-amber-800">
                    Nenhuma peça identificada no orçamento. A cotação de auto centers requer itens do tipo "peça".
                  </p>
                </div>
              )}

              {loadingAutoCenters ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Carregando auto centers...</span>
                </div>
              ) : !autoCentersAtivos.length ? (
                <p className="text-sm text-muted-foreground py-2">
                  Nenhum auto center ativo com WhatsApp encontrado para a marca {marcaVeiculo}.
                </p>
              ) : (
                <div className="space-y-2">
                  {autoCentersAtivos.map((ac: any) => (
                    <label
                      key={ac.id}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                        autoCentersSelecionados.includes(ac.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      )}
                    >
                      <Checkbox
                        checked={autoCentersSelecionados.includes(ac.id)}
                        onCheckedChange={() => handleToggleAutoCenter(ac.id)}
                        className="mt-1"
                        disabled={itensPecas.length === 0}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">
                            {ac.nome_fantasia || ac.razao_social || ac.nome}
                          </p>
                          {ac.especialidades?.some((esp: string) =>
                            tiposPecaOrcamento.some((tipo: string) =>
                              esp.toLowerCase().includes(tipo) || tipo.includes(esp.toLowerCase())
                            )
                          ) && (
                            <Badge className="bg-green-100 text-green-800 border-green-300 text-[10px]">Compatível</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {[ac.cidade, ac.estado].filter(Boolean).join(' - ')}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <MessageSquare className="h-3 w-3 text-green-600" />
                          <span className="text-xs text-green-700">{ac.whatsapp}</span>
                        </div>
                        {ac.especialidades?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {ac.especialidades.map((e: string) => (
                              <Badge key={e} variant="secondary" className="text-xs">
                                {e}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* Preview da mensagem */}
              {autoCentersSelecionados.length > 0 && previewMensagem && (
                <div className="space-y-2 mt-4">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    Preview da mensagem de cotação
                  </p>
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm whitespace-pre-line text-green-900">
                    {previewMensagem}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Será enviada para {autoCentersSelecionados.length} auto center(s) selecionado(s)
                  </p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !oficinaId}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Wrench className="h-4 w-4 mr-2" />
            )}
            Confirmar Atribuição
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
