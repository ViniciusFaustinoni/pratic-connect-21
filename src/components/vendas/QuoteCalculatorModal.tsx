import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Calculator,
  Car,
  MapPin,
  Fuel,
  Tag,
  Percent,
  MessageSquare,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  Shield,
  Star,
  Crown,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  calcularCotacao,
  formatarMoeda,
  ADICIONAIS,
  type Categoria,
  type ResultadoCotacao,
} from '@/config/pricing';
import { useCotacaoAvancada, type DadosCotacaoAvancada } from '@/hooks/useCotacaoAvancada';

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
  const [categoria, setCategoria] = useState<Categoria>('PREMIUM');
  const [usoAplicativo, setUsoAplicativo] = useState(false);
  const [linhaPreco] = useState<'SELECT' | 'SELECT_ONE'>('SELECT');
  const [desagio, setDesagio] = useState(0);
  const [copied, setCopied] = useState(false);

  // Adicionais
  const [adicionais, setAdicionais] = useState({
    vidros: false,
    carroReserva: false,
    guinchoIlimitado: false,
    rastreamento: false,
  });

  // ========== EFEITOS ==========
  useEffect(() => {
    if (lead?.valor_fipe) setValorFipe(lead.valor_fipe);
    if (lead?.cidade) setCidade(lead.cidade);
    if (lead?.veiculo_combustivel) setCombustivel(lead.veiculo_combustivel);
  }, [lead]);

  // ========== CÁLCULO ==========
  const cotacao = useMemo((): ResultadoCotacao | null => {
    if (!valorFipe || valorFipe <= 0) return null;

    return calcularCotacao({
      valorFipe,
      cidade,
      combustivel,
      categoria,
      usoAplicativo,
      linhaPreco,
      desagio,
      adicionaisSelecionados: adicionais,
    });
  }, [valorFipe, cidade, combustivel, categoria, usoAplicativo, linhaPreco, desagio, adicionais]);

  // ========== DADOS PARA SALVAR ==========
  const getDadosCotacao = (): DadosCotacaoAvancada => ({
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
    categoria,
    usoAplicativo,
    linhaPreco,
    desagio,
    adicionais,
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

  const veiculoLabel = [lead?.veiculo_marca, lead?.veiculo_modelo, lead?.veiculo_ano]
    .filter(Boolean)
    .join(' ') || 'Veículo não informado';

  // ========== RENDER ==========
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <DialogTitle>Calculadora de Cotação</DialogTitle>
          </div>
          {lead?.nome && (
            <p className="text-sm text-muted-foreground">
              Cliente: {lead.nome}
            </p>
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
                  {/* Veículo (readonly) */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Veículo</Label>
                    <Input value={veiculoLabel} disabled className="bg-muted" />
                  </div>

                  {/* Valor FIPE */}
                  <div className="space-y-1">
                    <Label htmlFor="valorFipe">Valor FIPE *</Label>
                    <Input
                      id="valorFipe"
                      type="number"
                      value={valorFipe || ''}
                      onChange={(e) => setValorFipe(Number(e.target.value))}
                      placeholder="Ex: 45000"
                    />
                    {cotacao && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Tag className="h-3 w-3" />
                        {cotacao.detalhes.labelFaixaFipe}
                      </div>
                    )}
                  </div>

                  {/* Cidade */}
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
                    {cotacao && (
                      <Badge variant="secondary" className="text-xs">
                        Região: {cotacao.regiao}
                      </Badge>
                    )}
                  </div>

                  {/* Combustível */}
                  <div className="space-y-1">
                    <Label className="flex items-center gap-1">
                      <Fuel className="h-3 w-3" />
                      Combustível
                    </Label>
                    <Select value={combustivel} onValueChange={setCombustivel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
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
                    {cotacao?.combustivel === 'DIESEL' && (
                      <Alert className="py-2">
                        <AlertTriangle className="h-3 w-3" />
                        <AlertDescription className="text-xs">
                          Veículos diesel têm valores diferenciados (+20%)
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* Uso para Aplicativo */}
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

                  {usoAplicativo && (
                    <Alert className="py-2">
                      <AlertTriangle className="h-3 w-3" />
                      <AlertDescription className="text-xs">
                        Veículos de aplicativo têm valores diferenciados (+40%)
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Card: Categoria/Plano */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Plano
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={categoria}
                    onValueChange={(v) => setCategoria(v as Categoria)}
                    className="space-y-2"
                  >
                    {/* Basic */}
                    <label
                      className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        categoria === 'BASIC' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setCategoria('BASIC')}
                    >
                      <RadioGroupItem value="BASIC" className="mt-0.5" />
                      <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">Basic</p>
                        <p className="text-xs text-muted-foreground">
                          Proteção essencial: Colisão, Roubo e Furto
                        </p>
                      </div>
                    </label>

                    {/* Premium */}
                    <label
                      className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        categoria === 'PREMIUM' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setCategoria('PREMIUM')}
                    >
                      <RadioGroupItem value="PREMIUM" className="mt-0.5" />
                      <Star className="h-5 w-5 text-yellow-500 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">Premium</p>
                          <Badge variant="default" className="text-[10px] h-4">
                            Recomendado
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Completo: Basic + Vidros + Assistência 24h + App
                        </p>
                      </div>
                    </label>

                    {/* Exclusive */}
                    <label
                      className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        categoria === 'EXCLUSIVE' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setCategoria('EXCLUSIVE')}
                    >
                      <RadioGroupItem value="EXCLUSIVE" className="mt-0.5" />
                      <Crown className="h-5 w-5 text-purple-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">Exclusive</p>
                        <p className="text-xs text-muted-foreground">
                          Máxima: Premium + Carro Reserva + Guincho Ilimitado
                        </p>
                      </div>
                    </label>
                  </RadioGroup>
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
                        <Badge variant="secondary" className="text-xs">
                          -{desagio}%
                        </Badge>
                      )}
                    </div>
                    <Slider
                      value={[desagio]}
                      onValueChange={(v) => setDesagio(v[0])}
                      max={30}
                      step={5}
                    />
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
                  <CardTitle className="text-sm font-medium">
                    Resultado da Cotação
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {!cotacao ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calculator className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Preencha os dados para calcular</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Detalhes */}
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Região:</span>
                          <Badge variant="outline">{cotacao.regiao}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Faixa:</span>
                          <Badge variant="outline">{cotacao.faixaFipe}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Combustível:</span>
                          <Badge variant="outline">{cotacao.combustivel}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Plano:</span>
                          <Badge variant="outline">{cotacao.categoria}</Badge>
                        </div>
                      </div>

                      <Separator />

                      {/* Valores originais */}
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

                      {/* Desconto */}
                      {desagio > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Desconto aplicado:</span>
                          <span>-{desagio}%</span>
                        </div>
                      )}

                      {/* Adicionais */}
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
              {cotacao && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">
                      Adicionais (Opcional)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Object.entries(ADICIONAIS).map(([key, adicional]) => (
                      <div key={key} className="flex items-start justify-between">
                        <div className="flex items-start gap-2">
                          <Checkbox
                            id={key}
                            checked={adicionais[key as keyof typeof adicionais]}
                            onCheckedChange={(c) =>
                              setAdicionais((a) => ({ ...a, [key]: c === true }))
                            }
                          />
                          <div>
                            <Label htmlFor={key} className="text-sm cursor-pointer">
                              {adicional.nome}
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              {adicional.descricao}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          +{formatarMoeda(adicional.valorMensal)}/mês
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

          <Button
            variant="outline"
            onClick={handleCopiarLink}
            disabled={isLoading || !cotacao}
          >
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
