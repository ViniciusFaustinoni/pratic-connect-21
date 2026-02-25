import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Car, Users, ExternalLink, FileText, FileSignature, Wrench,
  DollarSign, CheckCircle, Clock, AlertTriangle, Search,
  Package, Settings, MessageCircle, Loader2,
} from 'lucide-react';
import { useTerceiros, useTerceiroDocumentos, useLimiteCobertura } from '@/hooks/useTerceiros';
import { useAtualizarStatusTerceiro } from '@/hooks/useTerceiroActions';
import { ValidarDocumentosTerceiroDialog } from './ValidarDocumentosTerceiroDialog';
import { ProporAcordoModal } from './ProporAcordoModal';
import { CardLimitesTerceiros } from './CardLimitesTerceiros';
import {
  CULPA_LABELS, CULPA_COLORS, STATUS_TERCEIRO_LABELS, STATUS_TERCEIRO_COLORS,
} from '@/types/terceiros';
import type { SinistroTerceiro } from '@/types/terceiros';

interface Props {
  terceiro: SinistroTerceiro;
  sinistroId: string;
  associadoId: string;
}

const PIPELINE_STEPS = [
  { key: 'documentacao', label: 'Docs', icon: FileText },
  { key: 'termo', label: 'Termo', icon: FileSignature },
  { key: 'oficina', label: 'Oficina', icon: Wrench },
  { key: 'regulagem', label: 'Regulagem', icon: Search },
  { key: 'orcamento', label: 'Orçamento', icon: Settings },
  { key: 'pecas', label: 'Peças', icon: Package },
  { key: 'em_reparo', label: 'Reparo', icon: Wrench },
  { key: 'concluido', label: 'Entrega', icon: CheckCircle },
];

function getStepIndex(status: string): number {
  const map: Record<string, number> = {
    cadastrado: 0, documentacao_pendente: 0, documentacao_enviada: 0,
    termo_pendente: 1, termo_assinado: 1,
    oficina_pendente: 2, oficina_definida: 2,
    acordo_proposto: 3, acordo_aceito: -1, acordo_recusado: 3,
    regulagem: 3, orcamento: 4, pecas: 5, em_reparo: 6, concluido: 7,
    arquivado: 8,
  };
  return map[status] ?? 0;
}

export function AbaTerceiroReparo({ terceiro, sinistroId, associadoId }: Props) {
  const [docsDialogOpen, setDocsDialogOpen] = useState(false);
  const [acordoModalOpen, setAcordoModalOpen] = useState(false);
  const { data: documentos = [] } = useTerceiroDocumentos(terceiro.id);
  const { data: limite } = useLimiteCobertura(associadoId, sinistroId);
  const atualizarStatus = useAtualizarStatusTerceiro();

  const portalUrl = `${window.location.origin}/terceiro/${terceiro.token}`;

  // Terceiro culpado - sem pipeline
  if (terceiro.culpa === 'terceiro_culpado') {
    return (
      <div className="space-y-4">
        <HeaderTerceiro terceiro={terceiro} />
        <Card className="bg-muted/50 border-muted">
          <CardContent className="pt-6 text-center space-y-2">
            <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="font-medium">Terceiro é o culpado</p>
            <p className="text-sm text-muted-foreground">
              Não há cobertura. Será feito regresso (cobrança) pós-evento.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Culpa a definir - bloqueado
  if (terceiro.culpa === 'a_definir') {
    return (
      <div className="space-y-4">
        <HeaderTerceiro terceiro={terceiro} />
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="pt-6 text-center space-y-2">
            <Clock className="h-8 w-8 mx-auto text-amber-600" />
            <p className="font-medium text-amber-800">Culpa ainda não definida</p>
            <p className="text-sm text-amber-700">
              O fluxo de reparo só inicia após definição de culpa na análise.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStep = getStepIndex(terceiro.status);

  return (
    <div className="space-y-4">
      <HeaderTerceiro terceiro={terceiro} />

      {/* Limites de cobertura */}
      <CardLimitesTerceiros limite={limite} sinistroId={sinistroId} />

      {/* Pipeline visual */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            {PIPELINE_STEPS.map((step, idx) => {
              const Icon = step.icon;
              const done = idx < currentStep;
              const active = idx === currentStep;
              return (
                <div key={step.key} className="flex flex-col items-center gap-1 flex-1">
                  <div className={`rounded-full p-1.5 ${
                    done ? 'bg-green-100 text-green-700' :
                    active ? 'bg-blue-100 text-blue-700' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className={`text-[9px] text-center leading-tight ${
                    done ? 'text-green-700' : active ? 'text-blue-700 font-medium' : 'text-muted-foreground'
                  }`}>{step.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Ações do analista */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Ações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => setDocsDialogOpen(true)}>
              <FileText className="h-3.5 w-3.5 mr-1" />
              Documentos ({documentos.length})
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAcordoModalOpen(true)}>
              <DollarSign className="h-3.5 w-3.5 mr-1" />
              Propor Acordo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(portalUrl);
                import('sonner').then(({ toast }) => toast.success('Link copiado!'));
              }}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Link Portal
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const phone = terceiro.whatsapp || terceiro.telefone;
                const cleaned = phone.replace(/\D/g, '');
                const msg = encodeURIComponent(`Olá ${terceiro.nome}, acompanhe seu processo pelo link: ${portalUrl}`);
                window.open(`https://wa.me/55${cleaned}?text=${msg}`, '_blank');
              }}
            >
              <MessageCircle className="h-3.5 w-3.5 mr-1" />
              WhatsApp
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ValidarDocumentosTerceiroDialog
        open={docsDialogOpen}
        onOpenChange={setDocsDialogOpen}
        terceiro={terceiro}
        documentos={documentos}
      />

      <ProporAcordoModal
        open={acordoModalOpen}
        onOpenChange={setAcordoModalOpen}
        terceiro={terceiro}
        sinistroId={sinistroId}
      />
    </div>
  );
}

function HeaderTerceiro({ terceiro }: { terceiro: SinistroTerceiro }) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{terceiro.nome}</span>
          </div>
          <div className="flex items-center gap-1">
            <Badge className={`text-xs ${CULPA_COLORS[terceiro.culpa]}`}>
              {CULPA_LABELS[terceiro.culpa]}
            </Badge>
            <Badge className={`text-xs ${STATUS_TERCEIRO_COLORS[terceiro.status]}`}>
              {STATUS_TERCEIRO_LABELS[terceiro.status]}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {terceiro.veiculo_marca} {terceiro.veiculo_modelo} — {terceiro.veiculo_placa}
        </p>
      </CardContent>
    </Card>
  );
}
