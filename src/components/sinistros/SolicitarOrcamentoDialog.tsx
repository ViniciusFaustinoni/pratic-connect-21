import { useState } from 'react';
import { useConfiguracaoNumero } from '@/hooks/useConteudosSistema';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Loader2, Send, Car, Store, MapPin, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAutoCenters } from '@/hooks/useAutoCenters';
import { useQueryClient } from '@tanstack/react-query';

interface ItemPeca {
  descricao: string;
  quantidade: number;
  tipo: string;
  [key: string]: any;
}

interface SolicitarOrcamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sinistroId: string;
  veiculo: {
    marca?: string;
    modelo?: string;
    ano_modelo?: string | number;
    placa?: string;
  };
  itensPecas: ItemPeca[];
  onSuccess?: () => void;
}

export function SolicitarOrcamentoDialog({
  open,
  onOpenChange,
  sinistroId,
  veiculo,
  itensPecas,
  onSuccess,
}: SolicitarOrcamentoDialogProps) {
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const { data: prazoCotacao = 24 } = useConfiguracaoNumero('prazo_cotacao_fornecedor_horas', 24);

  const { data: autoCenters = [], isLoading: loadingAC } = useAutoCenters({
    marca: veiculo?.marca || undefined,
  });

  // Filtrar: ativos com whatsapp
  const autoCentersAtivos = autoCenters.filter(
    (ac) => ac.status === 'ativo' && ac.whatsapp
  );

  // Agrupar por tipo
  const grupos = autoCentersAtivos.reduce((acc, ac) => {
    const tipo = ac.tipo || 'Outros';
    if (!acc[tipo]) acc[tipo] = [];
    acc[tipo].push(ac);
    return acc;
  }, {} as Record<string, typeof autoCentersAtivos>);

  const tipoLabels: Record<string, string> = {
    auto_center: '🔧 Auto Centers',
    ferro_velho: '♻️ Ferro Velhos / Desmontes',
    montadora: '🏭 Montadoras / Concessionárias',
  };

  const toggleAC = (id: string) => {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSolicitar = async () => {
    if (selecionados.length === 0) {
      toast.error('Selecione pelo menos um estabelecimento.');
      return;
    }
    setLoading(true);
    try {
      for (const acId of selecionados) {
        const prazo = new Date();
        prazo.setHours(prazo.getHours() + prazoCotacao);

        const { data: cotacao, error: cotError } = await supabase
          .from('evento_cotacoes_pecas')
          .insert({
            sinistro_id: sinistroId,
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

        try {
          await supabase.functions.invoke('enviar-cotacao-pecas', {
            body: {
              sinistro_id: sinistroId,
              auto_center_id: acId,
              itens: itensPecas,
              cotacao_id: cotacao.id,
            },
          });
        } catch (err) {
          console.error('Erro ao enviar cotação WhatsApp:', err);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['sinistro-analise', sinistroId] });
      toast.success(`Cotações enviadas para ${selecionados.length} estabelecimento(s)!`);
      setSelecionados([]);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Erro ao solicitar orçamentos:', error);
      toast.error('Erro ao solicitar orçamentos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Solicitar Orçamentos de Peças
          </DialogTitle>
          <DialogDescription>
            Selecione os estabelecimentos que receberão a cotação via WhatsApp
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-4">
            {/* Veículo */}
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted text-sm">
              <Car className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {veiculo?.marca} {veiculo?.modelo} {veiculo?.ano_modelo} — Placa: {veiculo?.placa || '---'}
              </span>
            </div>

            {/* Peças para cotação */}
            <div>
              <p className="text-sm font-semibold mb-2">📋 Peças para cotação ({itensPecas.length})</p>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="text-left p-2 font-medium">Descrição</th>
                      <th className="text-center p-2 font-medium">Qtd</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itensPecas.map((item, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{item.descricao}</td>
                        <td className="p-2 text-center">{item.quantidade || 1}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Separator />

            {/* Lista de Auto Centers */}
            <div>
              <p className="text-sm font-semibold mb-2">
                🏪 Estabelecimentos compatíveis ({autoCentersAtivos.length})
              </p>
              {loadingAC ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : autoCentersAtivos.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhum estabelecimento encontrado para a marca {veiculo?.marca || 'do veículo'}.
                </p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(grupos).map(([tipo, lista]) => (
                    <div key={tipo}>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        {tipoLabels[tipo] || tipo}
                      </p>
                      <div className="space-y-2">
                        {lista.map((ac) => (
                          <label
                            key={ac.id}
                            className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                              selecionados.includes(ac.id)
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:bg-muted/50'
                            }`}
                          >
                            <Checkbox
                              checked={selecionados.includes(ac.id)}
                              onCheckedChange={() => toggleAC(ac.id)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">
                                {ac.nome_fantasia || ac.razao_social || ac.nome}
                              </p>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                {ac.cidade && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {ac.cidade}/{ac.estado}
                                  </span>
                                )}
                                {ac.whatsapp && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {ac.whatsapp}
                                  </span>
                                )}
                              </div>
                              {ac.especialidades && ac.especialidades.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {ac.especialidades.slice(0, 3).map((esp, i) => (
                                    <Badge key={i} variant="outline" className="text-xs">
                                      {esp}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSolicitar} disabled={loading || selecionados.length === 0}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Solicitar Orçamentos ({selecionados.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
