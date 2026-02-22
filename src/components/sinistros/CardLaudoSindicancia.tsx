import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Download, ChevronDown, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import {
  CONCLUSAO_LAUDO_LABELS,
  RECOMENDACAO_LABELS,
  TIPO_DILIGENCIA_LABELS,
  type ConclusaoLaudo,
  type RecomendacaoLaudo,
  type TipoDiligencia,
} from '@/types/sindicancia';

const CONCLUSAO_STYLES: Record<string, string> = {
  regular: 'bg-green-100 text-green-800 border-green-300',
  irregular_comprovada: 'bg-red-100 text-red-800 border-red-300',
  irregular_suspeita: 'bg-orange-100 text-orange-800 border-orange-300',
  inconclusivo: 'bg-yellow-100 text-yellow-800 border-yellow-300',
};

const CONCLUSAO_ICONS: Record<string, string> = {
  regular: '✅',
  irregular_comprovada: '🚫',
  irregular_suspeita: '⚠️',
  inconclusivo: '❓',
};

interface CardLaudoSindicanciaProps {
  sindicancia: {
    id: string;
    numero: string;
    laudo_conclusao: string | null;
    laudo_resumo: string | null;
    laudo_irregularidades: string | null;
    laudo_recomendacao: string | null;
    laudo_arquivo_url: string | null;
    data_laudo: string | null;
    empresa_sindicancia_id: string | null;
  };
  empresaNome?: string | null;
}

export function CardLaudoSindicancia({ sindicancia, empresaNome }: CardLaudoSindicanciaProps) {
  const [diligenciasOpen, setDiligenciasOpen] = useState(false);

  const { data: diligencias = [] } = useQuery({
    queryKey: ['sindicancia-diligencias-laudo', sindicancia.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sindicancia_diligencias')
        .select('*')
        .eq('sindicancia_id', sindicancia.id)
        .order('data_diligencia', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const conclusao = sindicancia.laudo_conclusao;
  if (!conclusao) return null;

  const isIrregular = conclusao === 'irregular_comprovada' || conclusao === 'irregular_suspeita';

  const diasInvestigacao = diligencias.length >= 2
    ? differenceInDays(
        new Date(diligencias[diligencias.length - 1].data_diligencia),
        new Date(diligencias[0].data_diligencia)
      ) + 1
    : diligencias.length;

  return (
    <Card className="border-2 border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          📋 Laudo de Sindicância — {sindicancia.numero}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Emitido em {sindicancia.data_laudo ? format(new Date(sindicancia.data_laudo), "dd/MM/yyyy", { locale: ptBR }) : '---'}
          {empresaNome && ` por ${empresaNome}`}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Badge de Conclusão */}
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-base font-semibold ${CONCLUSAO_STYLES[conclusao] || ''}`}>
          <span className="text-lg">{CONCLUSAO_ICONS[conclusao] || ''}</span>
          {conclusao === 'regular' && 'REGULAR — Evento legítimo'}
          {conclusao === 'irregular_comprovada' && 'IRREGULAR — FRAUDE COMPROVADA'}
          {conclusao === 'irregular_suspeita' && 'IRREGULAR — FRAUDE SUSPEITA'}
          {conclusao === 'inconclusivo' && 'INCONCLUSIVO'}
        </div>

        {/* Resumo Executivo */}
        <div>
          <p className="text-sm font-semibold mb-2">Resumo Executivo</p>
          <p className="text-sm text-foreground whitespace-pre-wrap bg-background p-3 rounded-md border">
            {sindicancia.laudo_resumo || '---'}
          </p>
        </div>

        {/* Irregularidades */}
        {isIrregular && sindicancia.laudo_irregularidades && (
          <div className="border-2 border-red-300 rounded-lg p-4 bg-red-50/50">
            <p className="text-sm font-semibold text-red-800 mb-2">🚨 Irregularidades Encontradas</p>
            <p className="text-sm text-red-900 whitespace-pre-wrap">{sindicancia.laudo_irregularidades}</p>
          </div>
        )}

        {/* Recomendação */}
        {sindicancia.laudo_recomendacao && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">O sindicante recomenda:</span>
            <Badge variant="secondary" className="text-sm">
              {RECOMENDACAO_LABELS[sindicancia.laudo_recomendacao] || sindicancia.laudo_recomendacao}
            </Badge>
          </div>
        )}

        <Separator />

        {/* Diligências */}
        {diligencias.length > 0 && (
          <Collapsible open={diligenciasOpen} onOpenChange={setDiligenciasOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors w-full">
              <ChevronDown className={`h-4 w-4 transition-transform ${diligenciasOpen ? 'rotate-180' : ''}`} />
              {diligencias.length} diligência(s) realizada(s) em {diasInvestigacao} dia(s)
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-2">
              {diligencias.map((d: any) => (
                <div key={d.id} className="flex items-start gap-2 p-2 rounded-md bg-background border text-sm">
                  <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <span className="font-medium">
                      {format(new Date(d.data_diligencia), 'dd/MM', { locale: ptBR })}
                    </span>
                    {' — '}
                    <span className="text-muted-foreground">
                      {TIPO_DILIGENCIA_LABELS[d.tipo as TipoDiligencia] || d.tipo}
                    </span>
                    {d.descricao && (
                      <span className="text-muted-foreground"> — {d.descricao.substring(0, 120)}{d.descricao.length > 120 ? '...' : ''}</span>
                    )}
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* PDF */}
        {sindicancia.laudo_arquivo_url && (
          <Button
            variant="outline"
            onClick={() => window.open(sindicancia.laudo_arquivo_url!, '_blank')}
          >
            <Download className="h-4 w-4 mr-2" />
            Baixar Laudo Formal (PDF)
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
