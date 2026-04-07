import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, MessageSquare, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PERIODO_LABELS: Record<string, string> = {
  manha: 'Manhã (08h–12h)',
  tarde: 'Tarde (13h–17h)',
  integral: 'Integral (08h–17h)',
};

const TIPO_LABELS: Record<string, string> = {
  troca_rastreador: 'Troca de rastreador',
  reparacao_fiacao: 'Reparação de fiação',
  problema_chip_sinal: 'Problema de chip / sinal',
  violacao_terceiros: 'Violação por terceiros',
  diagnostico: 'Diagnóstico',
};

interface CardConfirmacaoProps {
  tratativa: {
    data_agendamento?: string | null;
    periodo_agendamento?: string | null;
    endereco_tipo?: string | null;
    endereco_texto?: string | null;
    endereco_referencia?: string | null;
    tipos_ocorrencia?: string[] | null;
    observacoes_tecnico?: string | null;
    taxa_visita_aplicar?: boolean | null;
  };
  tecnicoNome: string;
  associadoNome: string;
  associadoTelefone: string;
  placa: string;
  enderecoResumido: string;
  onReagendar: () => void;
}

export default function CardConfirmacaoAgendamento({
  tratativa,
  tecnicoNome,
  associadoNome,
  associadoTelefone,
  placa,
  enderecoResumido,
  onReagendar,
}: CardConfirmacaoProps) {
  const dataFormatada = tratativa.data_agendamento
    ? format(new Date(tratativa.data_agendamento), 'dd/MM/yyyy', { locale: ptBR })
    : '—';
  const periodoLabel = PERIODO_LABELS[tratativa.periodo_agendamento || ''] || '—';

  const handleWhatsApp = () => {
    const tel = (associadoTelefone || '').replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Olá ${associadoNome}, sua visita técnica de manutenção do rastreador está agendada para ${dataFormatada} no período da ${periodoLabel} no endereço: ${enderecoResumido}. Em caso de dúvidas, entre em contato conosco.`
    );
    window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank');
  };

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-blue-600" />
          <h4 className="font-semibold text-sm text-blue-900">Visita técnica agendada ✅</h4>
        </div>

        <div className="space-y-1 text-xs text-blue-800">
          <p><strong>Data:</strong> {dataFormatada} — {periodoLabel}</p>
          <p><strong>Técnico:</strong> {tecnicoNome}</p>
          <p><strong>Endereço:</strong> {enderecoResumido}</p>
          {tratativa.endereco_referencia && <p><strong>Referência:</strong> {tratativa.endereco_referencia}</p>}
          <p><strong>Verificações:</strong> {(tratativa.tipos_ocorrencia || []).map(t => TIPO_LABELS[t] || t).join(', ')}</p>
          {tratativa.observacoes_tecnico && <p><strong>Obs:</strong> {tratativa.observacoes_tecnico}</p>}
          {tratativa.taxa_visita_aplicar && (
            <p className="text-yellow-700 font-medium">⚠️ Taxa de visita técnica aplicável (R$ 50,00)</p>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" className="text-xs" onClick={handleWhatsApp}>
            <MessageSquare className="h-3 w-3 mr-1" /> Notificar via WhatsApp
          </Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={onReagendar}>
            <RefreshCw className="h-3 w-3 mr-1" /> Reagendar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
