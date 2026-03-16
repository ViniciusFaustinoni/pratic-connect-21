import { useNavigate } from 'react-router-dom';
import {
  FileText, FilePlus, Download, Clock, CheckCircle, XCircle, Plus, Scale
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EventoLinkCard } from '@/components/eventos/EventoLinkCard';
import { CardVidrosDetalhe } from '@/components/sinistros/CardVidrosDetalhe';
import { CardAnaliseIncendio } from '@/components/sinistros/CardAnaliseIncendio';
import { CardAnaliseAlagamento } from '@/components/sinistros/CardAnaliseAlagamento';
import { PrazoRessarcimento } from '@/components/sinistros/PrazoRessarcimento';
import { useConfiguracaoNumero } from '@/hooks/useConteudosSistema';

const documentoStatusConfig: Record<string, { label: string; class: string; icon: React.ComponentType<{ className?: string }> }> = {
  pendente: { label: 'Pendente', class: 'bg-yellow-100 text-yellow-800', icon: Clock },
  aprovado: { label: 'Aprovado', class: 'bg-green-100 text-green-800', icon: CheckCircle },
  reprovado: { label: 'Reprovado', class: 'bg-red-100 text-red-800', icon: XCircle },
};

interface SinistroDetalheDocsProps {
  sinistro: any;
  documentos: any[] | undefined;
  processosVinculados: any[];
  onSolicitarDocs: () => void;
  onVincularProcesso: () => void;
}

export function SinistroDetalheDocs({
  sinistro, documentos, processosVinculados, onSolicitarDocs, onVincularProcesso,
}: SinistroDetalheDocsProps) {
  const navigate = useNavigate();
  const { data: prazoSinistro } = useConfiguracaoNumero('operacional_prazo_sinistro', 60);

  return (
    <div className="space-y-6">
      {/* Documentos */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-primary" /> Documentos
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onSolicitarDocs}>
            <FilePlus className="h-4 w-4 mr-2" /> Solicitar
          </Button>
        </CardHeader>
        <CardContent>
          {documentos && documentos.length > 0 ? (
            <div className="space-y-3">
              {documentos.map((doc) => {
                const docStatus = documentoStatusConfig[doc.status || 'pendente'];
                const DocIcon = docStatus?.icon || Clock;
                return (
                  <div key={doc.id} className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{doc.nome_arquivo || doc.tipo}</p>
                        <Badge className={`${docStatus?.class} text-xs`}>
                          <DocIcon className="h-3 w-3 mr-1" />{docStatus?.label}
                        </Badge>
                      </div>
                    </div>
                    {doc.arquivo_url && (
                      <Button variant="ghost" size="icon" asChild>
                        <a href={doc.arquivo_url} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" /></a>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum documento anexado</p>
          )}
        </CardContent>
      </Card>

      {/* Prazo */}
      <PrazoRessarcimento
        sinistroId={sinistro.id}
        dataInicio={sinistro.prazo_ressarcimento_inicio || sinistro.created_at}
        prazoSuspenso={sinistro.prazo_suspenso}
        prazoSuspensoEm={sinistro.prazo_suspenso_em}
        motivoSuspensao={sinistro.prazo_motivo_suspensao}
        prazoTotal={prazoSinistro}
      />

      {/* Link do Evento */}
      <EventoLinkCard
        sinistroId={sinistro.id}
        sinistroProtocolo={sinistro.protocolo}
        associadoWhatsapp={sinistro.associado?.whatsapp || sinistro.associado?.telefone}
        associadoNome={sinistro.associado?.nome}
        sinistroTipo={sinistro.tipo}
      />

      {/* Cards específicos por tipo */}
      {sinistro.tipo === 'vidros' && <CardVidrosDetalhe sinistro={sinistro} />}
      {sinistro.tipo === 'incendio' && <CardAnaliseIncendio sinistro={sinistro} associadoId={sinistro.associado_id} />}
      {sinistro.tipo === 'fenomeno_natural' && <CardAnaliseAlagamento sinistro={sinistro} associadoId={sinistro.associado_id} />}

      {/* Processos Jurídicos */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-5 w-5 text-primary" /> Processos Jurídicos
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onVincularProcesso}>
            <Plus className="h-4 w-4 mr-2" /> Vincular
          </Button>
        </CardHeader>
        <CardContent>
          {processosVinculados.length > 0 ? (
            <div className="space-y-3">
              {processosVinculados.map((processo) => (
                <div
                  key={processo.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/juridico/processos/${processo.id}`)}
                >
                  <div>
                    <p className="font-medium">{processo.numero_processo || processo.numero || 'Sem número'}</p>
                    <p className="text-sm text-muted-foreground">{processo.tipo} • {processo.vara || 'Vara não definida'}</p>
                  </div>
                  <Badge variant="outline">{processo.status || 'Ativo'}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Scale className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum processo vinculado</p>
              <Button variant="link" size="sm" className="mt-2" onClick={onVincularProcesso}>
                <Plus className="h-4 w-4 mr-1" /> Vincular Processo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
