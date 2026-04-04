import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Car, Image, FileText, X, ChevronDown, ChevronRight,
  CheckCircle, Clock, XCircle, ExternalLink, Camera,
  Wifi, WifiOff, Eye, User, DollarSign, MapPin,
  AlertTriangle, History, Phone, Mail, Shield
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import {
  useVeiculoCompleto,
  useEventosVeiculo,
  useFotosVistoriaPorVeiculo,
  useDocumentosAssociadoCompleto,
  agruparFotosVeiculo,
  formatarTipoFotoVeiculo,
  type FotoVistoriaVeiculo
} from '@/hooks/useVeiculoDetalhes';
import { useCobrancasAssociado } from '@/hooks/useDocumentosCotacao';
import { useAssociadoHistoricoCompleto } from '@/hooks/useAssociadoHistoricoCompleto';
import { MapaRastreador } from '@/components/rastreadores/MapaRastreador';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================
interface VeiculoDetalhesModalProps {
  open: boolean;
  onClose: () => void;
  veiculoId: string | null;
}

// ============================================
// HELPERS
// ============================================
const formatCurrency = (v: number | null | undefined) =>
  v ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : 'R$ 0,00';

const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('pt-BR') : '—';

const formatDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('pt-BR') : '—';

const statusBadge = (status: string | null) => {
  const colors: Record<string, string> = {
    ativo: 'bg-green-500/15 text-green-700 border-green-500/30',
    pago: 'bg-green-500/15 text-green-700 border-green-500/30',
    confirmado: 'bg-green-500/15 text-green-700 border-green-500/30',
    pendente: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30',
    aberto: 'bg-blue-500/15 text-blue-700 border-blue-500/30',
    em_analise: 'bg-blue-500/15 text-blue-700 border-blue-500/30',
    cancelado: 'bg-red-500/15 text-red-700 border-red-500/30',
    vencido: 'bg-red-500/15 text-red-700 border-red-500/30',
    encerrado: 'bg-muted text-muted-foreground border-border',
  };
  const s = (status || 'pendente').toLowerCase();
  const cls = colors[s] || 'bg-muted text-muted-foreground border-border';
  return <Badge variant="outline" className={cls}>{status || 'N/A'}</Badge>;
};

const TIPO_DOCUMENTO_LABELS: Record<string, string> = {
  cnh: 'CNH', crlv: 'CRLV', comprovante_residencia: 'Comprovante de Residência',
  selfie: 'Selfie com Documento', contrato: 'Contrato', outros: 'Outros',
};

// ============================================
// MAIN COMPONENT
// ============================================
export function VeiculoDetalhesModal({ open, onClose, veiculoId }: VeiculoDetalhesModalProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('resumo');
  const [fotoPreview, setFotoPreview] = useState<{ url: string; tipo: string } | null>(null);
  
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    identificacao: true, exterior: true, interior: false, outros: false,
  });

  // Data
  const { data: completo, isLoading } = useVeiculoCompleto(open ? veiculoId || undefined : undefined);
  const { data: eventos, isLoading: loadingEventos } = useEventosVeiculo(open ? veiculoId || undefined : undefined);
  const { data: fotos, isLoading: loadingFotos } = useFotosVistoriaPorVeiculo(open ? veiculoId || undefined : undefined);
  const { data: cobrancas, isLoading: loadingCob } = useCobrancasAssociado(open ? completo?.associado?.id : undefined);
  const { data: documentosData, isLoading: loadingDocs } = useDocumentosAssociadoCompleto(open ? completo?.associado?.id : undefined);
  const { data: historico, isLoading: loadingHist } = useAssociadoHistoricoCompleto(open ? completo?.associado?.id : undefined);

  const fotosAgrupadas = fotos ? agruparFotosVeiculo(fotos) : null;
  const totalFotos = fotos?.length || 0;
  const todosDocumentos = [
    ...(documentosData?.documentos || []).map((d: any) => ({ ...d, fonte: 'documentos' })),
    ...(documentosData?.documentosCotacao || []).map((d: any) => ({ ...d, fonte: 'cotacao' })),
  ];
  const totalEventos = (eventos?.sinistros?.length || 0) + (eventos?.assistencias?.length || 0);

  const veiculo = completo?.veiculo;
  const associado = completo?.associado;
  const rastreador = completo?.rastreador;
  const contrato = completo?.contrato;

  if (!veiculoId) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-5xl max-h-[92vh] p-0 gap-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-3">
                <Car className="h-5 w-5 text-primary" />
                <span>Detalhes do Veículo</span>
                {veiculo && (
                  <Badge variant="outline" className="font-mono text-base">{veiculo.placa}</Badge>
                )}
              </DialogTitle>
              {associado && (
                <Button variant="outline" size="sm" onClick={() => { onClose(); navigate(`/cadastro/associados/${associado.id}`); }}>
                  <User className="h-4 w-4 mr-2" /> Ver Associado
                </Button>
              )}
            </div>
          </DialogHeader>

          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : !veiculo ? (
            <div className="p-6 text-center text-muted-foreground">Veículo não encontrado</div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
              <div className="px-6 border-b overflow-x-auto">
                <TabsList className="h-12 bg-transparent p-0 gap-2">
                  {[
                    { v: 'resumo', icon: Car, label: 'Resumo' },
                    { v: 'financeiro', icon: DollarSign, label: 'Financeiro', count: (cobrancas as any)?.faturas?.length },
                    { v: 'rastreador', icon: MapPin, label: 'Rastreador' },
                    { v: 'eventos', icon: AlertTriangle, label: 'Eventos', count: totalEventos },
                    { v: 'fotos', icon: Image, label: 'Fotos/Docs', count: totalFotos + todosDocumentos.length },
                    { v: 'historico', icon: History, label: 'Histórico' },
                  ].map(tab => (
                    <TabsTrigger
                      key={tab.v}
                      value={tab.v}
                      className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3 px-3"
                    >
                      <tab.icon className="h-4 w-4 mr-1.5" />
                      {tab.label}
                      {tab.count !== undefined && tab.count > 0 && (
                        <Badge variant="secondary" className="ml-1.5 text-xs">{tab.count}</Badge>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <ScrollArea className="h-[62vh]">
                {/* ===== RESUMO ===== */}
                <TabsContent value="resumo" className="p-6 m-0 space-y-6">
                  {/* Veículo */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Veículo</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <InfoItem label="Marca" value={veiculo.marca} />
                      <InfoItem label="Modelo" value={veiculo.modelo} />
                      <InfoItem label="Ano" value={`${veiculo.ano_fabricacao || '?'}/${veiculo.ano_modelo || '?'}`} />
                      <InfoItem label="Cor" value={veiculo.cor} />
                      <InfoItem label="Placa" value={veiculo.placa} mono />
                      <InfoItem label="Chassi" value={veiculo.chassi} mono />
                      <InfoItem label="Renavam" value={veiculo.renavam} />
                      <InfoItem label="Combustível" value={veiculo.combustivel} />
                      <InfoItem label="Valor FIPE" value={formatCurrency(veiculo.valor_fipe)} highlight />
                      <InfoItem label="Status" value={veiculo.status} />
                      <InfoItem label="Uso App" value={veiculo.uso_aplicativo ? `Sim - ${veiculo.plataforma_app || ''}` : 'Não'} />
                    </div>
                  </div>

                  <Separator />

                  {/* Associado */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Associado</h3>
                    {associado ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <InfoItem label="Nome" value={associado.nome} />
                        <InfoItem label="CPF" value={associado.cpf} mono />
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Telefone</p>
                          <p className="font-medium flex items-center gap-1"><Phone className="h-3 w-3" /> {associado.telefone || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Email</p>
                          <p className="font-medium flex items-center gap-1 text-sm truncate"><Mail className="h-3 w-3" /> {associado.email || '—'}</p>
                        </div>
                        <InfoItem label="Cidade/UF" value={[associado.cidade, associado.estado].filter(Boolean).join('/') || '—'} />
                        <InfoItem label="Status" value={associado.status} />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum associado vinculado</p>
                    )}
                  </div>

                  <Separator />

                  {/* Contrato */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Shield className="h-4 w-4" /> Contrato
                    </h3>
                    {contrato ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <InfoItem label="Número" value={contrato.numero} mono />
                        <InfoItem label="Plano" value={contrato.plano_nome} />
                        <InfoItem label="Valor Mensal" value={formatCurrency(contrato.valor_mensal)} highlight />
                        <InfoItem label="Status" value={contrato.status} />
                        <InfoItem label="Início" value={formatDate(contrato.data_inicio)} />
                        <InfoItem label="Fim" value={formatDate(contrato.data_fim)} />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum contrato encontrado</p>
                    )}
                  </div>

                  {/* Rastreador resumo */}
                  <Separator />
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      {rastreador ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}
                      Rastreador
                    </h4>
                    {rastreador ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <InfoItem label="Código" value={rastreador.codigo} mono />
                        <InfoItem label="IMEI" value={rastreador.imei} mono />
                        <InfoItem label="Plataforma" value={rastreador.plataforma} />
                        <InfoItem label="Status" value={rastreador.status} />
                        <InfoItem label="Último Sinal" value={formatDateTime(rastreador.ultimo_sinal)} />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum rastreador instalado</p>
                    )}
                  </div>
                </TabsContent>

                {/* ===== FINANCEIRO ===== */}
                <TabsContent value="financeiro" className="p-6 m-0">
                  {loadingCob ? (
                    <LoadingSkeleton />
                  ) : !cobrancas || !(cobrancas as any)?.faturas?.length ? (
                    <EmptyState icon={DollarSign} text="Nenhuma cobrança encontrada" />
                  ) : (
                    <div className="space-y-2">
                      {((cobrancas as any).faturas as any[]).slice(0, 50).map((cob: any) => (
                        <div key={cob.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                          <div className="flex items-center gap-3">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{cob.referencia || cob.tipo || 'Cobrança'}</p>
                              <p className="text-xs text-muted-foreground">Venc: {formatDate(cob.data_vencimento)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-sm">{formatCurrency(cob.valor)}</span>
                            {statusBadge(cob.status)}
                            {cob.boleto_url && (
                              <Button size="sm" variant="ghost" onClick={() => window.open(cob.boleto_url, '_blank')}>
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* ===== RASTREADOR ===== */}
                <TabsContent value="rastreador" className="p-6 m-0 space-y-4">
                  {rastreador ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <InfoItem label="Código" value={rastreador.codigo} mono />
                        <InfoItem label="IMEI" value={rastreador.imei} mono />
                        <InfoItem label="Nº Série" value={rastreador.numero_serie} mono />
                        <InfoItem label="Plataforma" value={rastreador.plataforma} />
                        <InfoItem label="Status" value={rastreador.status} />
                        <InfoItem label="Último Sinal" value={formatDateTime(rastreador.ultimo_sinal)} />
                      </div>
                      <Separator />
                      <div>
                        <Button variant="outline" onClick={() => setShowMapa(!showMapa)}>
                          <MapPin className="h-4 w-4 mr-2" />
                          {showMapa ? 'Ocultar Mapa' : 'Ver no Mapa'}
                        </Button>
                        {showMapa && (
                          <div className="mt-4 rounded-lg overflow-hidden border">
                            <MapaRastreador rastreadorId={rastreador.id} altura="400px" />
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <EmptyState icon={WifiOff} text="Nenhum rastreador instalado neste veículo" />
                  )}
                </TabsContent>

                {/* ===== EVENTOS ===== */}
                <TabsContent value="eventos" className="p-6 m-0 space-y-6">
                  {loadingEventos ? (
                    <LoadingSkeleton />
                  ) : totalEventos === 0 ? (
                    <EmptyState icon={AlertTriangle} text="Nenhum evento registrado" />
                  ) : (
                    <>
                      {(eventos?.sinistros?.length || 0) > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Sinistros</h3>
                          <div className="space-y-2">
                            {eventos!.sinistros.map((s: any) => (
                              <div key={s.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div>
                                  <p className="font-medium text-sm font-mono">{s.protocolo || s.id.slice(0, 8)}</p>
                                  <p className="text-xs text-muted-foreground">{s.tipo} • {formatDate(s.data_ocorrencia || s.created_at)}</p>
                                </div>
                                {statusBadge(s.status)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {(eventos?.assistencias?.length || 0) > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Assistências</h3>
                          <div className="space-y-2">
                            {eventos!.assistencias.map((a: any) => (
                              <div key={a.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div>
                                  <p className="font-medium text-sm font-mono">{a.protocolo || a.id.slice(0, 8)}</p>
                                  <p className="text-xs text-muted-foreground">{a.tipo_servico} • {formatDate(a.created_at)}</p>
                                </div>
                                {statusBadge(a.status)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>

                {/* ===== FOTOS/DOCS ===== */}
                <TabsContent value="fotos" className="p-6 m-0 space-y-6">
                  {/* Fotos */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Fotos da Vistoria</h3>
                    {loadingFotos ? (
                      <LoadingSkeleton />
                    ) : totalFotos === 0 ? (
                      <EmptyState icon={Camera} text="Nenhuma foto de vistoria" small />
                    ) : (
                      <div className="space-y-3">
                        {['identificacao', 'exterior', 'interior', 'outros'].map(cat => {
                          const catFotos = fotosAgrupadas?.[cat as keyof typeof fotosAgrupadas] || [];
                          if (catFotos.length === 0) return null;
                          return (
                            <FotoCategoriaSection
                              key={cat}
                              title={cat.charAt(0).toUpperCase() + cat.slice(1)}
                              fotos={catFotos}
                              isOpen={openCategories[cat] ?? false}
                              onToggle={() => setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }))}
                              onViewFoto={setFotoPreview}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <Separator />
                  {/* Documentos */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Documentos</h3>
                    {loadingDocs ? (
                      <LoadingSkeleton />
                    ) : todosDocumentos.length === 0 ? (
                      <EmptyState icon={FileText} text="Nenhum documento anexado" small />
                    ) : (
                      <div className="space-y-2">
                        {todosDocumentos.map((doc: any) => (
                          <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                            <div className="flex items-center gap-3">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-sm">{TIPO_DOCUMENTO_LABELS[doc.tipo] || doc.tipo}</p>
                                <p className="text-xs text-muted-foreground">{formatDate(doc.created_at)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {statusBadge(doc.status)}
                              {doc.arquivo_url && (
                                <Button size="sm" variant="ghost" onClick={() => window.open(doc.arquivo_url, '_blank')}>
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* ===== HISTÓRICO ===== */}
                <TabsContent value="historico" className="p-6 m-0">
                  {loadingHist ? (
                    <LoadingSkeleton />
                  ) : !historico || (historico as any[]).length === 0 ? (
                    <EmptyState icon={History} text="Nenhum registro de histórico" />
                  ) : (
                    <div className="space-y-3">
                      {(historico as any[]).slice(0, 100).map((item: any, idx: number) => (
                        <div key={item.id || idx} className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                          <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{item.descricao || item.acao}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(item.created_at)} {item.usuario_nome && `• ${item.usuario_nome}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview de Foto */}
      <Dialog open={!!fotoPreview} onOpenChange={() => setFotoPreview(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <div className="relative bg-black">
            <Button
              variant="ghost" size="icon"
              className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => setFotoPreview(null)}
            >
              <X className="h-5 w-5" />
            </Button>
            <div className="flex items-center justify-center min-h-[60vh] p-4">
              <img src={fotoPreview?.url} alt={fotoPreview?.tipo || 'Foto'} className="max-w-full max-h-[80vh] object-contain" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-3 text-center">
              {fotoPreview?.tipo && formatarTipoFotoVeiculo(fotoPreview.tipo)}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================
function InfoItem({ label, value, mono, highlight }: { label: string; value?: string | null; mono?: boolean; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn(
        "font-medium",
        mono && "font-mono text-sm",
        highlight && "text-primary text-lg",
        !value && "text-muted-foreground"
      )}>{value || '—'}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, text, small }: { icon: any; text: string; small?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", small ? "py-6" : "py-12")}>
      <Icon className={cn("text-muted-foreground/50", small ? "h-8 w-8" : "h-12 w-12")} />
      <p className="mt-3 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

function FotoCategoriaSection({ title, fotos, isOpen, onToggle, onViewFoto }: {
  title: string; fotos: FotoVistoriaVeiculo[]; isOpen: boolean;
  onToggle: () => void; onViewFoto: (f: { url: string; tipo: string }) => void;
}) {
  if (fotos.length === 0) return null;
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-medium">{title}</span>
          <Badge variant="secondary">{fotos.length}</Badge>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {fotos.map((foto) => (
            <div
              key={foto.id}
              className="group relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer border hover:border-primary transition-colors"
              onClick={() => onViewFoto({ url: foto.arquivo_url, tipo: foto.tipo })}
            >
              <img src={foto.arquivo_url} alt={formatarTipoFotoVeiculo(foto.tipo)} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1.5 text-center truncate">
                {formatarTipoFotoVeiculo(foto.tipo)}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
