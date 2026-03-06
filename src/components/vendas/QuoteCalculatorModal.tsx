import { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Calculator, Car, MapPin, Fuel, Percent, MessageSquare,
  Copy, Check, AlertTriangle, Loader2, Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatarMoeda } from '@/utils/format';
import {
  useCotacaoAvancada,
  usePlanosParaCotacao,
  useAdicionaisDisponiveis,
  calcularCotacaoDinamica,
  type DadosCotacaoAvancada,
  type ResultadoCotacaoDinamica,
} from '@/hooks/useCotacaoAvancada';

// ============================================
// TIPOS
// ============================================

interface LeadData {
  id?: string;
  nome: string;
  telefone: string;
  email?: string;
  veiculo_marca?: string;
  veiculo_modelo?: string;
  veiculo_ano?: number;
  veiculo_placa?: string;
  veiculo_combustivel?: string;
  valor_fipe?: number;
  cidade?: string;
}

interface QuoteCalculatorModalProps {
  open: boolean;
  onClose: () => void;
  lead?: LeadData;
  onSuccess?: (result: { id: string; linkPublico: string }) => void;
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function QuoteCalculatorModal({
  open,
  onClose,
  lead,
  onSuccess,
}: QuoteCalculatorModalProps) {
  const { abrirWhatsApp, copiarLink, isLoading } = useCotacaoAvancada();

  // ========== ESTADOS ==========
  const [valorFipe, setValorFipe] = useState(lead?.valor_fipe || 0);
  const [cidade, setCidade] = useState(lead?.cidade || '');
  const [combustivel, setCombustivel] = useState(lead?.veiculo_combustivel || 'Gasolina');
  const [usoAplicativo, setUsoAplicativo] = useState(false);
  const [desagio, setDesagio] = useState(0);
  const [copied, setCopied] = useState(false);
  const [planoSelecionadoId, setPlanoSelecionadoId] = useState<string>('');
  const [adicionaisSelecionados, setAdicionaisSelecionados] = useState<string[]>([]);

  // ========== DADOS DO BANCO ==========
  const { data: planos = [], isLoading: loadingPlanos } = usePlanosParaCotacao(valorFipe, usoAplicativo);
  const { data: adicionais = [] } = useAdicionaisDisponiveis();

  // ========== EFEITOS ==========
  useEffect(() => {
    if (lead?.valor_fipe) setValorFipe(lead.valor_fipe);
    if (lead?.cidade) setCidade(lead.cidade);
    if (lead?.veiculo_combustivel) setCombustivel(lead.veiculo_combustivel);
  }, [lead]);

  // Auto-selecionar primeiro plano quando lista muda
  useEffect(() => {
    if (planos.length > 0 && !planos.find(p => p.id === planoSelecionadoId)) {
      setPlanoSelecionadoId(planos[0].id);
    }
  }, [planos, planoSelecionadoId]);

  // ========== CÁLCULO ==========
  const planoSelecionado = planos.find(p => p.id === planoSelecionadoId);

  const cotacao = useMemo((): ResultadoCotacaoDinamica | null => {
    if (!planoSelecionado || !valorFipe || valorFipe <= 0) return null;
    return calcularCotacaoDinamica(planoSelecionado, adicionais, adicionaisSelecionados, desagio);
  }, [planoSelecionado, adicionais, adicionaisSelecionados, desagio, valorFipe]);

  // ========== DADOS PARA SALVAR ==========
  const getDadosCotacao = (): DadosCotacaoAvancada & { cotacao: ResultadoCotacaoDinamica } => ({
    leadId: lead?.id,
    clienteNome: lead?.nome || '',
    clienteTelefone: lead?.telefone || '',
    clienteEmail: lead?.email,
    veiculoMarca: lead?.veiculo_marca,
    veiculoModelo: lead?.veiculo_modelo,
    veiculoAno: lead?.veiculo_ano,
    veiculoPlaca: lead?.veiculo_placa,
    veiculoCombustivel: combustivel,
    valorFipe,
    cidade,
    planoId: planoSelecionadoId,
    usoAplicativo,
    desagio,
    adicionaisSelecionados,
    cotacao: cotacao!,
  });

  // ========== HANDLERS ==========
  const handleEnviarWhatsApp = async () => {
    if (!cotacao) {
      toast.error('Preencha os dados para calcular a cotação');
      return;
    }
    try {
      const result = await abrirWhatsApp(getDadosCotacao());
      onSuccess?.({ id: result.id, linkPublico: result.linkPublico });
      onClose();
    } catch (error) {
      console.error('Erro ao enviar WhatsApp:', error);
    }
  };

  const handleCopiarLink = async () => {
    if (!cotacao) {
      toast.error('Preencha os dados para calcular a cotação');
      return;
    }
    try {
      const result = await copiarLink(getDadosCotacao());
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
      onSuccess?.({ id: result.id, linkPublico: result.linkPublico });
    } catch (error) {
      console.error('Erro ao copiar link:', error);
    }
  };

  const toggleAdicional = (id: string) => {
    setAdicionaisSelecionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const veiculoLabel = [lead?.veiculo_marca, lead?.veiculo_modelo, lead?.veiculo_ano]
    .filter(Boolean)
    .join(' ') || 'Veículo não informado';

  const isDiesel = combustivel.toLowerCase().includes('diesel');

  // ========== RENDER ==========
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <DialogTitle>Calculadora de Cotação</DialogTitle>
          </div>
          {lead?.nome && (
            <p className="text-sm text-muted-foreground">Cliente: {lead.nome}</p>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-6 py-4">
            {/* ========== COLUNA ESQUERDA ========== */}
            <div className="space-y-4">
              {/* Card: Dados do Veículo */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    Dados do Veículo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Veículo</Label>
                    <Input value={veiculoLabel} disabled className="bg-muted" />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="valorFipe">Valor FIPE *</Label>
                    <Input
                      id="valorFipe"
                      type="number"
                      value={valorFipe || ''}
                      onChange={(e) => setValorFipe(Number(e.target.value))}
                      placeholder="Ex: 45000"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="cidade" className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Cidade
                    </Label>
                    <Input
                      id="cidade"
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      placeholder="Ex: Rio de Janeiro"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="flex items-center gap-1">
                      <Fuel className="h-3 w-3" />
                      Combustível
                    </Label>
                    <Select value={combustivel} onValueChange={setCombustivel}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Gasolina">Gasolina</SelectItem>
                        <SelectItem value="Flex">Flex</SelectItem>
                        <SelectItem value="Etanol">Etanol</SelectItem>
                        <SelectItem value="Diesel">Diesel</SelectItem>
                        <SelectItem value="GNV">GNV</SelectItem>
                        <SelectItem value="Elétrico">Elétrico</SelectItem>
                        <SelectItem value="Híbrido">Híbrido</SelectItem>
                      </SelectContent>
                    </Select>
                    {isDiesel && (
                      <Alert className="py-2">
                        <AlertTriangle className="h-3 w-3" />
                        <AlertDescription className="text-xs">
                          Veículos diesel podem ter valores diferenciados
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="usoAplicativo"
                      checked={usoAplicativo}
                      onCheckedChange={(checked) => setUsoAplicativo(checked === true)}
                    />
                    <Label htmlFor="usoAplicativo" className="text-sm cursor-pointer">
                      Uso para aplicativo (Uber, 99, etc)
                    </Label>
                  </div>
                </CardContent>
              </Card>

              {/* Card: Plano */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Plano
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingPlanos ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                      Carregando planos...
                    </div>
                  ) : planos.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      {valorFipe > 0
                        ? 'Nenhum plano disponível para este valor FIPE'
                        : 'Informe o valor FIPE para ver os planos'}
                    </div>
                  ) : (
                    <RadioGroup
                      value={planoSelecionadoId}
                      onValueChange={setPlanoSelecionadoId}
                      className="space-y-2"
                    >
                      {planos.map((plano) => (
                        <label
                          key={plano.id}
                          className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                            planoSelecionadoId === plano.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                          }`}
                          onClick={() => setPlanoSelecionadoId(plano.id)}
                        >
                          <RadioGroupItem value={plano.id} className="mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{plano.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              Mensalidade: {formatarMoeda(plano.mensalidade_total)}
                            </p>
                          </div>
                        </label>
                      ))}
                    </RadioGroup>
                  )}
                </CardContent>
              </Card>

              {/* Card: Deságio */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    Desconto (Deságio)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Desconto: {desagio}%</span>
                      {desagio > 0 && (
                        <Badge variant="secondary" className="text-xs">-{desagio}%</Badge>
                      )}
                    </div>
                    <Slider value={[desagio]} onValueChange={(v) => setDesagio(v[0])} max={30} step={5} />
                    <p className="text-xs text-muted-foreground">
                      Máximo 30%. Acima de 15% pode requerer aprovação.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ========== COLUNA DIREITA ========== */}
            <div className="space-y-4">
              {/* Card: Resultado */}
              <Card className="border-primary/50">
                <CardHeader className="py-3 bg-primary/5">
                  <CardTitle className="text-sm font-medium">Resultado da Cotação</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {!cotacao ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calculator className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Preencha os dados para calcular</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Plano:</span>
                          <Badge variant="outline">{cotacao.plano.nome}</Badge>
                        </div>
                      </div>

                      <Separator />

                      {/* Composição */}
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Cota:</span>
                          <span>{formatarMoeda(cotacao.plano.valor_cota)}</span>
                        </div>
                        {cotacao.plano.taxa_administrativa > 0 && (
                          <div className="flex justify-between">
                            <span>Taxa administrativa:</span>
                            <span>{formatarMoeda(cotacao.plano.taxa_administrativa)}</span>
                          </div>
                        )}
                        {cotacao.plano.valor_assistencia > 0 && (
                          <div className="flex justify-between">
                            <span>Assistência:</span>
                            <span>{formatarMoeda(cotacao.plano.valor_assistencia)}</span>
                          </div>
                        )}
                        {cotacao.plano.valor_rastreamento > 0 && (
                          <div className="flex justify-between">
                            <span>Rastreamento:</span>
                            <span>{formatarMoeda(cotacao.plano.valor_rastreamento)}</span>
                          </div>
                        )}
                      </div>

                      <Separator />

                      {/* Valores base */}
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Adesão (tabela):</span>
                          <span className={desagio > 0 ? 'line-through text-muted-foreground' : ''}>
                            {formatarMoeda(cotacao.precoBase.adesao)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Mensal (tabela):</span>
                          <span className={desagio > 0 ? 'line-through text-muted-foreground' : ''}>
                            {formatarMoeda(cotacao.precoBase.mensal)}
                          </span>
                        </div>
                      </div>

                      {(desagio > 0 || cotacao.valorAdicionais > 0) && <Separator />}

                      {desagio > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Desconto aplicado:</span>
                          <span>-{desagio}%</span>
                        </div>
                      )}

                      {cotacao.valorAdicionais > 0 && (
                        <div className="flex justify-between text-sm text-blue-600">
                          <span>Adicionais:</span>
                          <span>+{formatarMoeda(cotacao.valorAdicionais)}/mês</span>
                        </div>
                      )}

                      <Separator />

                      {/* Valores Finais */}
                      <div className="space-y-2 bg-primary/5 p-3 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">ADESÃO:</span>
                          <span className="text-xl font-bold text-primary">
                            {formatarMoeda(cotacao.precoFinal.adesao)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">MENSALIDADE:</span>
                          <span className="text-xl font-bold text-primary">
                            {formatarMoeda(cotacao.precoFinal.mensal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Card: Adicionais */}
              {cotacao && adicionais.length > 0 && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">Adicionais (Opcional)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {adicionais.map((adicional) => (
                      <div key={adicional.id} className="flex items-start justify-between">
                        <div className="flex items-start gap-2">
                          <Checkbox
                            id={adicional.id}
                            checked={adicionaisSelecionados.includes(adicional.id)}
                            onCheckedChange={() => toggleAdicional(adicional.id)}
                          />
                          <div>
                            <Label htmlFor={adicional.id} className="text-sm cursor-pointer">
                              {adicional.nome}
                            </Label>
                            <p className="text-xs text-muted-foreground">{adicional.descricao}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          +{formatarMoeda(adicional.preco)}/mês
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </ScrollArea>

        <Separator />

        <DialogFooter className="px-6 py-4 gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={handleCopiarLink} disabled={isLoading || !cotacao}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : copied ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            {copied ? 'Link Copiado!' : 'Copiar Link'}
          </Button>
          <Button onClick={handleEnviarWhatsApp} disabled={isLoading || !cotacao}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <MessageSquare className="h-4 w-4 mr-2" />
            )}
            Enviar por WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
