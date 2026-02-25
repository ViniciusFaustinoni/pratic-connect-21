import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Wrench, Package, Search, Settings } from 'lucide-react';

interface Props {
  terceiro: {
    status: string;
    oficina_nome?: string;
    oficina_endereco?: string;
    oficina_telefone?: string;
    oficina_tipo?: string;
  };
}

const ETAPAS_REPARO = [
  { key: 'regulagem', label: 'Regulagem', icon: Search },
  { key: 'orcamento', label: 'Orçamento', icon: Settings },
  { key: 'pecas', label: 'Peças', icon: Package },
  { key: 'em_reparo', label: 'Em Reparo', icon: Wrench },
  { key: 'concluido', label: 'Concluído', icon: CheckCircle },
];

export function TerceiroAcompanhamento({ terceiro }: Props) {
  const statusOrder = ETAPAS_REPARO.map(e => e.key);
  const currentIdx = statusOrder.indexOf(terceiro.status);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          🔧 Acompanhamento do Reparo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pipeline */}
        <div className="flex items-center justify-between">
          {ETAPAS_REPARO.map((etapa, idx) => {
            const Icon = etapa.icon;
            const isConcluida = idx < currentIdx;
            const isAtual = idx === currentIdx;
            const isFutura = idx > currentIdx;

            return (
              <div key={etapa.key} className="flex flex-col items-center gap-1 flex-1">
                <div className={`rounded-full p-2 ${
                  isConcluida ? 'bg-green-100 text-green-700' :
                  isAtual ? 'bg-blue-100 text-blue-700' :
                  'bg-muted text-muted-foreground'
                }`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className={`text-[10px] text-center ${
                  isConcluida ? 'text-green-700 font-medium' :
                  isAtual ? 'text-blue-700 font-medium' :
                  'text-muted-foreground'
                }`}>
                  {etapa.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Oficina info */}
        {terceiro.oficina_nome && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <p className="text-sm font-medium">Oficina: {terceiro.oficina_nome}</p>
            {terceiro.oficina_endereco && (
              <p className="text-xs text-muted-foreground">{terceiro.oficina_endereco}</p>
            )}
            {terceiro.oficina_telefone && (
              <p className="text-xs text-muted-foreground">📞 {terceiro.oficina_telefone}</p>
            )}
          </div>
        )}

        <div className="text-center">
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Última atualização: agora
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
