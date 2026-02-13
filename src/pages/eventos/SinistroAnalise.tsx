import { useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  XCircle,
  FileText,
  User,
  Car,
  MapPin,
  Calendar,
  DollarSign,
  AlertTriangle,
  Phone,
  Mail,
  Clock,
  Shield,
  FileCheck,
  Image,
  History,
  Navigation,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useSinistroAnalise, useSinistrosPendentes } from '@/hooks/useSinistroAnalise';
import { usePermissions } from '@/hooks/usePermissions';
import { AprovarSinistroDialog } from '@/components/sinistros/AprovarSinistroDialog';
import { ReprovarSinistroDialog } from '@/components/sinistros/ReprovarSinistroDialog';
import { SolicitarDocumentosSinistroDialog } from '@/components/sinistros/SolicitarDocumentosSinistroDialog';
import { TrajetoSinistroCard } from '@/components/sinistros/TrajetoSinistroCard';
import { ComparacaoPosicoes } from '@/components/sinistros/ComparacaoPosicoes';
import { cn } from '@/lib/utils';

// ============================================
// CONFIGURAÇÕES
// ============================================

const statusConfig: Record<string, { label: string; class: string }> = {
  comunicado: { label: 'Comunicado', class: 'bg-warning/20 text-warning border-warning' },
  em_analise: { label: 'Em Análise', class: 'bg-info/20 text-info border-info' },
  documentacao_pendente: { label: 'Doc. Pendente', class: 'bg-orange-100 text-orange-800' },
  aprovado: { label: 'Aprovado', class: 'bg-success/20 text-success border-success' },
  negado: { label: 'Negado', class: 'bg-destructive/20 text-destructive border-destructive' },
};

const tipoConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  colisao: { label: 'Colisão', icon: Car },
  roubo: { label: 'Roubo', icon: Shield },
  furto: { label: 'Furto', icon: Shield },
  incendio: { label: 'Incêndio', icon: AlertTriangle },
  fenomeno_natural: { label: 'Fenômeno Natural', icon: AlertTriangle },
  vidros: { label: 'Vidros', icon: Car },
  outro: { label: 'Outro', icon: FileText },
};

// ============================================
// HELPERS
// ============================================

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return 'R$ ---';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(date: string | null): string {
  if (!date) return '---';
  return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
}

function formatDateTime(date: string | null): string {
  if (!date) return '---';
  return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

function maskCPF(cpf: string | null): string {
  if (!cpf) return '---';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return `***.${clean.slice(3, 6)}.***-${clean.slice(9)}`;
}

function resolverUrl(url: string | null): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return supabase.storage.from('sinistros').getPublicUrl(url).data.publicUrl;
}

// ============================================
// INFO ITEM COMPONENT
// ============================================

function InfoItem({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn("text-foreground", highlight && "font-semibold text-lg")}>
          {value || '---'}
        </p>
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function SinistroAnalise() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDiretor } = usePermissions();

  const [showAprovar, setShowAprovar] = useState(false);
  const [showReprovar, setShowReprovar] = useState(false);
  const [showSolicitarDocs, setShowSolicitarDocs] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);

  const {
    sinistro,
    documentos,
    historicoSinistro,
    rastreador,
    temRastreadorAtivo,
    sinistrosAnteriores,
    contratoAtivo,
    veiculoHistorico,
    isLoading,
  } = useSinistroAnalise(id);

  const { data: pendentes } = useSinistrosPendentes();

  // Navegação entre sinistros
  const currentIndex = pendentes?.findIndex((p) => p.id === id) ?? -1;
  const nextSinistro = currentIndex >= 0 && pendentes ? pendentes[currentIndex + 1] : null;

  const handleActionSuccess = () => {
    if (nextSinistro) {
      navigate(`/eventos/sinistros/${nextSinistro.id}/analisar`);
    } else {
      navigate('/eventos/sinistros');
    }
  };

  // Verificar acesso
  if (!isDiretor) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-warning" />
        <h2 className="text-xl font-semibold text-foreground">Acesso Restrito</h2>
        <p className="text-muted-foreground mt-2">
          Apenas diretores podem analisar sinistros.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/eventos/sinistros')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 bg-muted" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full bg-muted" />
            <Skeleton className="h-64 w-full bg-muted" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full bg-muted" />
            <Skeleton className="h-48 w-full bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!sinistro) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-warning" />
        <h2 className="text-xl font-semibold text-foreground">Sinistro não encontrado</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/eventos/sinistros')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
    );
  }

  const associado = sinistro.associado as any;
  const veiculo = sinistro.veiculo as any;
  const TipoIcon = tipoConfig[sinistro.tipo]?.icon || FileText;
  const statusInfo = statusConfig[sinistro.status] || { label: sinistro.status, class: '' };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/dashboard">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/eventos/sinistros">Sinistros</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Análise - {sinistro.protocolo}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/eventos/sinistros')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Análise de Sinistro</h1>
            <p className="text-muted-foreground">
              {sinistro.protocolo} • {pendentes && `${currentIndex + 1} de ${pendentes.length}`}
            </p>
          </div>
          <Badge className={cn("text-sm px-3 py-1", statusInfo.class)}>
            {statusInfo.label}
          </Badge>
          {sinistro.alerta_recem_ativado && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
              <AlertTriangle className="h-4 w-4 mr-1" />
              Recém-ativado
            </Badge>
          )}
        </div>

        {/* Navegação */}
        {nextSinistro && (
          <Button
            variant="outline"
            onClick={() => navigate(`/eventos/sinistros/${nextSinistro.id}/analisar`)}
          >
            Próximo
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Alerta de Recém-Ativado */}
      {sinistro.alerta_recem_ativado && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">⚠️ Alerta: Associado Recém-Ativado</p>
              <p className="text-sm text-amber-700">
                Este associado foi ativado recentemente. Requer análise criteriosa.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Coluna Esquerda - 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dados do Associado */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Dados do Associado
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <InfoItem icon={User} label="Nome" value={associado?.nome} />
              <InfoItem icon={FileText} label="CPF" value={maskCPF(associado?.cpf)} />
              <InfoItem icon={Phone} label="Telefone" value={associado?.telefone} />
              <InfoItem icon={Mail} label="Email" value={associado?.email} />
              <InfoItem
                icon={MapPin}
                label="Endereço"
                value={associado ? `${associado.logradouro || ''}, ${associado.numero || ''} - ${associado.bairro || ''}, ${associado.cidade || ''}/${associado.uf || ''}` : null}
              />
              <InfoItem icon={Calendar} label="Data de Adesão" value={formatDate(associado?.data_adesao)} />
            </CardContent>
          </Card>

          {/* Dados do Veículo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Dados do Veículo
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <InfoItem icon={Car} label="Placa" value={veiculo?.placa} highlight />
              <InfoItem icon={Car} label="Marca/Modelo" value={`${veiculo?.marca || ''} ${veiculo?.modelo || ''}`} />
              <InfoItem icon={Calendar} label="Ano" value={veiculo?.ano_modelo?.toString()} />
              <InfoItem icon={Car} label="Cor" value={veiculo?.cor} />
              <InfoItem icon={FileText} label="Chassi" value={veiculo?.chassi} />
              <InfoItem icon={DollarSign} label="Valor FIPE" value={formatCurrency(veiculo?.valor_fipe)} highlight />
              <InfoItem icon={FileText} label="Código FIPE" value={veiculo?.codigo_fipe} />
            </CardContent>
          </Card>

          {/* Informações do Sinistro */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TipoIcon className="h-5 w-5" />
                Informações do Sinistro
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <InfoItem icon={TipoIcon} label="Tipo" value={tipoConfig[sinistro.tipo]?.label || sinistro.tipo} />
              <InfoItem icon={Calendar} label="Data da Ocorrência" value={formatDateTime(sinistro.data_ocorrencia)} />
              <InfoItem icon={MapPin} label="Local" value={sinistro.local_ocorrencia} />
              <InfoItem icon={MapPin} label="Cidade/UF" value={`${sinistro.cidade_ocorrencia || ''}/${sinistro.estado_ocorrencia || ''}`} />
              <InfoItem icon={FileText} label="Nº B.O." value={sinistro.bo_numero} />
              <InfoItem icon={Clock} label="Comunicado em" value={formatDateTime(sinistro.created_at)} />
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground mb-1">Descrição</p>
                <p className="text-foreground bg-muted p-3 rounded-md">{sinistro.descricao || '---'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Trajeto 24h - Se tiver rastreador */}
          {temRastreadorAtivo && (
            <TrajetoSinistroCard
              veiculoId={sinistro.veiculo_id}
              dataOcorrencia={sinistro.data_ocorrencia}
              localOcorrencia={sinistro.local_ocorrencia}
              sinistroId={sinistro.id}
              protocolo={sinistro.protocolo}
              veiculo={veiculo}
              associado={associado}
              latitudeInformada={sinistro.latitude_informada}
              longitudeInformada={sinistro.longitude_informada}
              rastreadorLat={rastreador?.ultima_posicao_lat}
              rastreadorLng={rastreador?.ultima_posicao_lng}
            />
          )}

          {/* Comparação GPS */}
          <ComparacaoPosicoes
            latitudeInformada={sinistro.latitude_informada}
            longitudeInformada={sinistro.longitude_informada}
            rastreadorLat={rastreador?.ultima_posicao_lat}
            rastreadorLng={rastreador?.ultima_posicao_lng}
            rastreadorCapturadoEm={rastreador?.ultima_comunicacao}
            localOcorrencia={sinistro.local_ocorrencia}
          />

          {/* Documentos Anexados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Documentos ({documentos.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documentos.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhum documento anexado
                </p>
              ) : (
                <div className="grid gap-2">
                  {documentos.map((doc) => {
                    const docUrl = resolverUrl(doc.arquivo_url);
                    const isEnviado = doc.status === 'enviado' && docUrl;
                    const isImage = docUrl && /\.(jpg|jpeg|png|webp|gif)$/i.test(docUrl);
                    const isPdf = docUrl && /\.pdf$/i.test(docUrl);
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center gap-3 p-3 rounded-md bg-muted"
                      >
                        {/* Thumbnail */}
                        {isEnviado && isImage ? (
                          <img
                            src={docUrl}
                            alt={doc.nome_arquivo || doc.tipo}
                            className="h-14 w-14 rounded-md object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity border"
                            onClick={() => setPreviewDoc(doc)}
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-md bg-background border flex items-center justify-center flex-shrink-0">
                            <FileText className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate block">{doc.nome_arquivo || doc.tipo}</span>
                          <Badge variant={doc.status === 'enviado' ? 'default' : 'outline'} className="mt-1 text-xs">
                            {doc.status}
                          </Badge>
                        </div>

                        {/* Action */}
                        {isEnviado && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 text-xs flex-shrink-0"
                            onClick={() => setPreviewDoc(doc)}
                          >
                            Ampliar
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sinistros Anteriores */}
          {sinistrosAnteriores.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Sinistros Anteriores ({sinistrosAnteriores.length})
                </CardTitle>
                <CardDescription>Histórico de sinistros deste veículo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sinistrosAnteriores.map((ant) => (
                    <div
                      key={ant.id}
                      className="flex items-center justify-between p-3 rounded-md bg-muted"
                    >
                      <div>
                        <p className="text-sm font-medium">{ant.protocolo}</p>
                        <p className="text-xs text-muted-foreground">
                          {tipoConfig[ant.tipo]?.label || ant.tipo} • {formatDate(ant.data_ocorrencia)}
                        </p>
                      </div>
                      <Badge variant="outline">{ant.status}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Coluna Direita - 1/3 */}
        <div className="space-y-6">
          {/* Ações */}
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>🎬 Ações</CardTitle>
              <CardDescription>Decisão sobre o sinistro</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(() => {
                const docsPendentes = documentos.filter(doc => doc.status === 'pendente');
                const temDocsPendentes = docsPendentes.length > 0;
                return (
                  <>
                    {temDocsPendentes && (
                      <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                        <Clock className="h-4 w-4 flex-shrink-0" />
                        <span>Aguardando envio de {docsPendentes.length} documento(s) solicitado(s)</span>
                      </div>
                    )}
                    {!temDocsPendentes && (
                      <Button
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => setShowAprovar(true)}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Aprovar Sinistro
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => setShowReprovar(true)}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reprovar Sinistro
                    </Button>
                    {!temDocsPendentes && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowSolicitarDocs(true)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Solicitar Documentos
                      </Button>
                    )}
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* Checklist */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">📋 Checklist de Análise</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "h-4 w-4 rounded-full",
                  documentos.length > 0 ? "bg-green-500" : "bg-muted"
                )} />
                <span className="text-sm">Documentos anexados</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "h-4 w-4 rounded-full",
                  sinistro.bo_numero ? "bg-green-500" : "bg-muted"
                )} />
                <span className="text-sm">B.O. informado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "h-4 w-4 rounded-full",
                  sinistro.local_ocorrencia ? "bg-green-500" : "bg-muted"
                )} />
                <span className="text-sm">Local verificado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "h-4 w-4 rounded-full",
                  temRastreadorAtivo ? "bg-green-500" : "bg-amber-500"
                )} />
                <span className="text-sm">
                  {temRastreadorAtivo ? 'Rastreador ativo' : 'Sem rastreador'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Histórico do Sinistro */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">📜 Histórico</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {historicoSinistro.map((h) => (
                    <div key={h.id} className="border-l-2 border-muted pl-3 py-1">
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(h.created_at)}
                      </p>
                      <p className="text-sm">
                        <Badge variant="outline" className="text-xs mr-2">
                          {h.status_novo}
                        </Badge>
                      </p>
                      {h.observacao && (
                        <p className="text-xs text-muted-foreground mt-1">{h.observacao}</p>
                      )}
                      {h.usuario && (
                        <p className="text-xs text-muted-foreground">
                          por {(h.usuario as any).nome}
                        </p>
                      )}
                    </div>
                  ))}
                  {historicoSinistro.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum histórico
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <AprovarSinistroDialog
        open={showAprovar}
        onOpenChange={setShowAprovar}
        sinistroId={sinistro.id}
        protocolo={sinistro.protocolo}
        onSuccess={handleActionSuccess}
      />

      <ReprovarSinistroDialog
        open={showReprovar}
        onOpenChange={setShowReprovar}
        sinistroId={sinistro.id}
        protocolo={sinistro.protocolo}
        onSuccess={handleActionSuccess}
      />

      <SolicitarDocumentosSinistroDialog
        open={showSolicitarDocs}
        onOpenChange={setShowSolicitarDocs}
        sinistroId={sinistro.id}
        protocolo={sinistro.protocolo}
        statusAtual={sinistro.status}
        associadoId={sinistro.associado_id}
      />

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          {previewDoc?.arquivo_url && (() => {
            const previewUrl = resolverUrl(previewDoc.arquivo_url);
            return (
            <>
              {/\.(jpg|jpeg|png|webp|gif)$/i.test(previewUrl) ? (
                <img
                  src={previewUrl}
                  alt={previewDoc.nome_arquivo || previewDoc.tipo}
                  className="w-full h-auto max-h-[85vh] object-contain"
                />
              ) : /\.pdf$/i.test(previewUrl) ? (
                <iframe
                  src={previewUrl}
                  title={previewDoc.nome_arquivo || previewDoc.tipo}
                  className="w-full h-[85vh]"
                />
              ) : (
                <div className="p-8 text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="mb-4">{previewDoc.nome_arquivo || previewDoc.tipo}</p>
                  <Button onClick={() => window.open(previewUrl, '_blank')}>
                    Abrir em nova aba
                  </Button>
                </div>
              )}
            </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
