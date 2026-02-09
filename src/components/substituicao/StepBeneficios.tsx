import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import type { DadosNovoVeiculo } from '@/types/substituicao';

interface BeneficioConfig {
  id: string;
  nome: string;
  preco: number;
  info?: string;
  soApp?: boolean;
}

const BENEFICIOS: BeneficioConfig[] = [
  { id: 'cobertura_vidros', nome: 'Proteção para Vidros e Faróis', preco: 9.90, info: 'Carência: 120 dias | Cobertura: 60% Pratic / 40% Associado' },
  { id: 'reboque_1000km', nome: '1000km de Reboque', preco: 2.90 },
  { id: 'reboque_excedente', nome: 'Reboque Excedente', preco: 2.90 },
  { id: 'kit_gas', nome: 'Proteção Kit Gás', preco: 9.90 },
  { id: 'carro_reserva_7', nome: 'Carro Reserva 7 dias', preco: 7.90 },
  { id: 'carro_reserva_15', nome: 'Carro Reserva 15 dias', preco: 15.90 },
  { id: 'carro_reserva_30', nome: 'Carro Reserva 30 dias', preco: 35.90 },
  { id: 'rastreador_adicional', nome: 'Rastreador (adicional)', preco: 30.00 },
  { id: 'fipe_100_app', nome: '100% FIPE para APP + 30 dias reserva', preco: 35.90, soApp: true },
];

const FAIXAS_TERCEIROS = [
  { id: '15000', nome: 'R$ 15.000', preco: 12.90 },
  { id: '40000', nome: 'R$ 40.000', preco: 0 },
  { id: '70000', nome: 'R$ 70.000', preco: 20.00 },
  { id: '100000', nome: 'R$ 100.000', preco: 40.00 },
];

interface VeiculoAntigo {
  cobertura_vidros?: boolean;
  cobertura_terceiros?: string | null;
  cobertura_assistencia?: string | null;
  mensalidade?: number;
}

interface StepBeneficiosProps {
  veiculoAntigo: VeiculoAntigo;
  dadosNovoVeiculo: Partial<DadosNovoVeiculo>;
  beneficiosSelecionados: Record<string, boolean | string>;
  setBeneficiosSelecionados: (b: Record<string, boolean | string>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepBeneficios({
  veiculoAntigo,
  dadosNovoVeiculo,
  beneficiosSelecionados,
  setBeneficiosSelecionados,
  onNext,
  onBack,
}: StepBeneficiosProps) {
  const toggleBeneficio = (id: string) => {
    setBeneficiosSelecionados({
      ...beneficiosSelecionados,
      [id]: !beneficiosSelecionados[id],
    });
  };

  const setTerceiros = (faixaId: string) => {
    setBeneficiosSelecionados({
      ...beneficiosSelecionados,
      cobertura_terceiros: faixaId,
    });
  };

  // Calcular mensalidade base (simplificada: 0.45% do valor FIPE)
  const mensalidadeBase = useMemo(() => {
    const fipe = dadosNovoVeiculo.valor_fipe || 0;
    return fipe * 0.0045;
  }, [dadosNovoVeiculo.valor_fipe]);

  // Total adicionais
  const totalAdicionais = useMemo(() => {
    let total = 0;
    BENEFICIOS.forEach((b) => {
      if (beneficiosSelecionados[b.id]) total += b.preco;
    });
    const faixaTerceiros = beneficiosSelecionados.cobertura_terceiros as string;
    if (faixaTerceiros) {
      const faixa = FAIXAS_TERCEIROS.find((f) => f.id === faixaTerceiros);
      if (faixa) total += faixa.preco;
    }
    return total;
  }, [beneficiosSelecionados]);

  const totalMensal = mensalidadeBase + totalAdicionais;
  const mensalidadeAnterior = veiculoAntigo.mensalidade || 0;
  const diferencaMensalidade = totalMensal - mensalidadeAnterior;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const antigoBeneficios = [
    veiculoAntigo.cobertura_vidros && 'Proteção Vidros',
    veiculoAntigo.cobertura_terceiros && `Danos Terceiros (${veiculoAntigo.cobertura_terceiros})`,
    veiculoAntigo.cobertura_assistencia && `Assistência (${veiculoAntigo.cobertura_assistencia})`,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Todos os benefícios terão carência de 120 dias a partir da efetivação.
        </AlertDescription>
      </Alert>

      {/* Benefícios do veículo antigo */}
      {antigoBeneficios.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Benefícios do Veículo Antigo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {antigoBeneficios.map((b, i) => (
                <Badge key={i} variant="secondary">{b}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Benefícios do novo veículo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Benefícios do Novo Veículo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {BENEFICIOS.filter((b) => !b.soApp || dadosNovoVeiculo.uso_aplicativo).map((beneficio) => {
            const antigoTinha = beneficio.id === 'cobertura_vidros' && veiculoAntigo.cobertura_vidros;
            return (
              <label
                key={beneficio.id}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={!!beneficiosSelecionados[beneficio.id]}
                  onCheckedChange={() => toggleBeneficio(beneficio.id)}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{beneficio.nome}</span>
                    {antigoTinha ? (
                      <Badge variant="outline" className="text-[10px]">Renovação</Badge>
                    ) : beneficiosSelecionados[beneficio.id] ? (
                      <Badge className="text-[10px] bg-blue-600">Novo</Badge>
                    ) : null}
                  </div>
                  {beneficio.info && (
                    <p className="text-xs text-muted-foreground">{beneficio.info}</p>
                  )}
                </div>
                <span className="text-sm font-semibold text-muted-foreground">
                  {formatCurrency(beneficio.preco)}/mês
                </span>
              </label>
            );
          })}

          {/* Danos a Terceiros */}
          <div className="p-3 rounded-lg border space-y-2">
            <Label className="text-sm font-medium">Danos a Terceiros</Label>
            <Select
              value={(beneficiosSelecionados.cobertura_terceiros as string) || ''}
              onValueChange={setTerceiros}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a faixa" />
              </SelectTrigger>
              <SelectContent>
                {FAIXAS_TERCEIROS.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome} — {f.preco === 0 ? 'Incluído' : `${formatCurrency(f.preco)}/mês`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Resumo financeiro */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo Financeiro Estimado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mensalidade base (FIPE)</span>
              <span>{formatCurrency(mensalidadeBase)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Adicionais selecionados</span>
              <span>{formatCurrency(totalAdicionais)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t font-semibold">
              <span>Total mensal estimado</span>
              <span className="text-primary">{formatCurrency(totalMensal)}</span>
            </div>
            {mensalidadeAnterior > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Diferença da mensalidade anterior</span>
                <span className={diferencaMensalidade > 0 ? 'text-red-600' : 'text-green-600'}>
                  {diferencaMensalidade > 0 ? '+' : ''}{formatCurrency(diferencaMensalidade)}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Voltar</Button>
        <Button onClick={onNext}>Próximo</Button>
      </div>
    </div>
  );
}
