import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const RESULTADO_LABELS: Record<string, string> = {
  rastreador_trocado: 'Rastreador trocado',
  fiacao_reparada: 'Fiação reparada',
  chip_substituido: 'Chip substituído',
  violacao_corrigida: 'Violação corrigida',
  sem_problema_rastreador: 'Sem problema no rastreador',
  resolvido_remotamente: 'Resolvido remotamente',
};

interface CardEncerramentoVisitaProps {
  tratativa: any;
  tecnicoNome: string;
  onAbrirNovaTratativa?: () => void;
}

export default function CardEncerramentoVisita({ tratativa, tecnicoNome, onAbrirNovaTratativa }: CardEncerramentoVisitaProps) {
  const voltouPontuar = tratativa.voltou_pontuar;
  const isSuccess = voltouPontuar === 'sim';
  const bgClass = isSuccess ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200';
  const titleColor = isSuccess ? 'text-green-800' : 'text-orange-800';

  const descTruncated = (tratativa.visita_descricao || '').slice(0, 120) +
    ((tratativa.visita_descricao || '').length > 120 ? '...' : '');

  return (
    <Card className={`border ${bgClass}`}>
      <CardContent className="p-4 space-y-3">
        <h3 className={`font-semibold text-sm ${titleColor}`}>
          {isSuccess ? 'Manutenção concluída ✅' : 'Acompanhamento necessário 🔄'}
        </h3>

        <div className="space-y-1 text-xs">
          <p><span className="font-medium">Data da visita:</span>{' '}
            {tratativa.visita_data_hora
              ? format(new Date(tratativa.visita_data_hora), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
              : '—'}
          </p>
          <p><span className="font-medium">Técnico:</span> {tecnicoNome || 'Não identificado'}</p>
          <p><span className="font-medium">Resultado:</span> {RESULTADO_LABELS[tratativa.visita_resultado] || tratativa.visita_resultado}</p>
          <p><span className="font-medium">Descrição:</span> {descTruncated || '—'}</p>

          {tratativa.rastreador_trocado && (
            <div className="mt-1 p-2 rounded bg-muted/50 text-xs space-y-0.5">
              <p><span className="font-medium">IMEI novo:</span> {tratativa.imei_novo}</p>
              <p><span className="font-medium">IMEI retirado:</span> {tratativa.imei_retirado}</p>
            </div>
          )}

          {tratativa.taxa_visita_aplicar && (
            <div className="mt-1 flex gap-1 items-start text-yellow-800">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
              <span>Taxa de R$ 50,00 registrada para o financeiro — {tratativa.taxa_visita_observacao}</span>
            </div>
          )}

          <p className="mt-1">
            <span className="font-medium">Rastreador:</span>{' '}
            {voltouPontuar === 'sim' ? '✅ Voltou a pontuar' : voltouPontuar === 'nao' ? '❌ Não pontuou' : '⏳ Aguardando confirmação'}
          </p>
        </div>

        {!isSuccess && onAbrirNovaTratativa && (
          <Button size="sm" variant="outline" className="w-full mt-2" onClick={onAbrirNovaTratativa}>
            <RefreshCw className="h-3 w-3 mr-2" /> Abrir nova tratativa
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
