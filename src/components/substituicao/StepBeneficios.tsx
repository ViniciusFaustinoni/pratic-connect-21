import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react';
import { useBeneficiosSeparados } from '@/hooks/useBeneficiosAdicionaisCotacao';
import type { DadosNovoVeiculo } from '@/types/substituicao';

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
  const { beneficios, faixasTerceiros, precosMap, terceirosMap, isLoading } = useBeneficiosSeparados();

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

  // Mapear benefícios do banco para formato do componente
  const beneficiosUI = useMemo(() => {
    return beneficios.map(b => {
      const chave = Object.entries(precosMap).find(([, v]) => v.nome === b.nome)?.[0] || b.codigo.toLowerCase();
      return {
        id: chave,
        nome: b.nome,
        preco: b.preco,
        info: b.descricao || undefined,
        soApp: b.codigo === 'COMBO_APP_CARRO',
      };
    });
  }, [beneficios, precosMap]);

  const faixasTerceirosUI = useMemo(() => {
    return Object.entries(terceirosMap).map(([id, info]) => ({
      id,
      nome: info.nome,
      preco: info.preco,
    })).sort((a, b) => parseInt(a.id) - parseInt(b.id));
  }, [terceirosMap]);

  // Mensalidade base — usa valor FIPE (a taxa real viria de tabelas_preco mas os dados estão zerados)
  const mensalidadeBase = useMemo(() => {
    const fipe = dadosNovoVeiculo.valor_fipe || 0;
    return fipe * 0.0045;
  }, [dadosNovoVeiculo.valor_fipe]);

  // Total adicionais
  const totalAdicionais = useMemo(() => {
    let total = 0;
    beneficiosUI.forEach((b) => {
      if (beneficiosSelecionados[b.id]) total += b.preco;
    });
    const faixaTerceiros = beneficiosSelecionados.cobertura_terceiros as string;
    if (faixaTerceiros && terceirosMap[faixaTerceiros]) {
      total += terceirosMap[faixaTerceiros].preco;
    }
    return total;
  }, [beneficiosSelecionados, beneficiosUI, terceirosMap]);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
          {beneficiosUI.filter((b) => !b.soApp || dadosNovoVeiculo.uso_aplicativo).map((beneficio) => {
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
                {faixasTerceirosUI.map((f) => (
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
