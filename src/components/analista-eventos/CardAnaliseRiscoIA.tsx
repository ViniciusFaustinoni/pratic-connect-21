import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Brain, RefreshCw, AlertTriangle, CheckCircle, Info, Loader2, ShieldAlert } from 'lucide-react';

interface Fator {
  nome: string;
  valor: string;
  impacto: string; // 'positivo' | 'neutro' | 'negativo'
  detalhe: string;
}

interface AnaliseRisco {
  pontuacao_risco: number;
  nivel: 'baixo' | 'medio' | 'alto' | 'critico';
  resumo: string;
  fatores: Fator[];
  recomendacao: string;
}

interface CardAnaliseRiscoIAProps {
  sinistroId: string;
}

const nivelConfig = {
  baixo: { color: 'bg-green-100 text-green-800 border-green-200', barColor: 'bg-green-500', label: 'BAIXO' },
  medio: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', barColor: 'bg-yellow-500', label: 'MÉDIO' },
  alto: { color: 'bg-orange-100 text-orange-800 border-orange-200', barColor: 'bg-orange-500', label: 'ALTO' },
  critico: { color: 'bg-red-100 text-red-800 border-red-200', barColor: 'bg-red-500', label: 'CRÍTICO' },
};

function getBarColor(score: number): string {
  if (score <= 3) return 'bg-green-500';
  if (score <= 6) return 'bg-yellow-500';
  if (score <= 8) return 'bg-orange-500';
  return 'bg-red-500';
}

function ImpactoIcon({ impacto }: { impacto: string }) {
  if (impacto === 'negativo') return <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />;
  if (impacto === 'positivo') return <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />;
  return <Info className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />;
}

export function CardAnaliseRiscoIA({ sinistroId }: CardAnaliseRiscoIAProps) {
  const [analise, setAnalise] = useState<AnaliseRisco | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [jaAnalisou, setJaAnalisou] = useState(false);

  const executarAnalise = async () => {
    setLoading(true);
    setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke('analise-risco-ia', {
        body: { sinistro_id: sinistroId },
      });

      if (error) throw new Error(error.message || 'Erro ao chamar análise de IA');
      if (data?.error) throw new Error(data.error);

      setAnalise(data as AnaliseRisco);
      setJaAnalisou(true);
    } catch (err: any) {
      console.error('Erro na análise de risco:', err);
      setErro(err.message || 'Erro ao processar análise');
      toast.error('Erro na análise de risco: ' + (err.message || 'Tente novamente'));
    } finally {
      setLoading(false);
    }
  };

  // Estado inicial: botão para iniciar análise
  if (!jaAnalisou && !loading) {
    return (
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50/50 to-indigo-50/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Brain className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Análise de Risco com IA</h3>
                <p className="text-xs text-muted-foreground">Avaliação automatizada de risco de fraude</p>
              </div>
            </div>
            <Button size="sm" onClick={executarAnalise} className="bg-purple-600 hover:bg-purple-700">
              <Brain className="h-3.5 w-3.5 mr-1.5" />
              Analisar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading
  if (loading) {
    return (
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50/50 to-indigo-50/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 text-purple-600 animate-spin" />
            <CardTitle className="text-sm">Analisando com IA...</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="space-y-2 pt-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Erro
  if (erro) {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-red-500" />
              <div>
                <h3 className="text-sm font-semibold text-red-800">Erro na análise</h3>
                <p className="text-xs text-red-600">{erro}</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={executarAnalise}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analise) return null;

  const config = nivelConfig[analise.nivel] || nivelConfig.medio;
  const barWidth = (analise.pontuacao_risco / 10) * 100;

  return (
    <Card className={`border-2 ${analise.pontuacao_risco <= 3 ? 'border-green-200' : analise.pontuacao_risco <= 6 ? 'border-yellow-200' : analise.pontuacao_risco <= 8 ? 'border-orange-200' : 'border-red-200'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-sm">Análise de Risco — Inteligência Artificial</CardTitle>
          </div>
          <Button size="sm" variant="ghost" onClick={executarAnalise} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pontuação e barra */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold">{analise.pontuacao_risco}</div>
            <div className="text-xs text-muted-foreground">/10</div>
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Risco de fraude</span>
              <Badge className={config.color} variant="outline">{config.label}</Badge>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getBarColor(analise.pontuacao_risco)}`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>
        </div>

        {/* Fatores */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fatores analisados</h4>
          {analise.fatores.map((fator, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 p-2 rounded-md text-xs ${
                fator.impacto === 'negativo'
                  ? 'bg-red-50 border border-red-100'
                  : fator.impacto === 'positivo'
                  ? 'bg-green-50 border border-green-100'
                  : 'bg-muted/50 border border-muted'
              }`}
            >
              <ImpactoIcon impacto={fator.impacto} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{fator.nome}</span>
                  <span className="text-muted-foreground flex-shrink-0">{fator.valor}</span>
                </div>
                <p className="text-muted-foreground mt-0.5">{fator.detalhe}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Resumo */}
        <div className="p-3 rounded-md bg-muted/50 border">
          <h4 className="text-xs font-semibold mb-1">📝 Resumo</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">{analise.resumo}</p>
        </div>

        {/* Recomendação */}
        <div className={`p-3 rounded-md border ${
          analise.pontuacao_risco >= 7
            ? 'bg-red-50 border-red-200'
            : analise.pontuacao_risco >= 4
            ? 'bg-amber-50 border-amber-200'
            : 'bg-green-50 border-green-200'
        }`}>
          <h4 className="text-xs font-semibold mb-1">💡 Recomendação</h4>
          <p className="text-xs leading-relaxed">{analise.recomendacao}</p>
        </div>
      </CardContent>
    </Card>
  );
}
