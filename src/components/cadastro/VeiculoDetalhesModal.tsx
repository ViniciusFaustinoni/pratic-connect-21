import { useState } from 'react';
import { 
  Car, Image, FileText, X, ChevronDown, ChevronRight, 
  CheckCircle, Clock, XCircle, ExternalLink, Camera,
  Wifi, WifiOff, Eye
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
  useFotosVistoriaPorVeiculo, 
  useDocumentosAssociadoCompleto,
  agruparFotosVeiculo,
  formatarTipoFotoVeiculo,
  type FotoVistoriaVeiculo
} from '@/hooks/useVeiculoDetalhes';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================
interface Veiculo {
  id: string;
  placa: string;
  marca?: string | null;
  modelo?: string | null;
  ano_fabricacao?: number | null;
  ano_modelo?: number | null;
  cor?: string | null;
  chassi?: string | null;
  renavam?: string | null;
  combustivel?: string | null;
  valor_fipe?: number | null;
  uso_aplicativo?: boolean | null;
  rastreador?: {
    codigo?: string;
    numero_serie?: string;
  } | null;
  status?: string;
}

interface VeiculoDetalhesModalProps {
  open: boolean;
  onClose: () => void;
  veiculo: Veiculo | null;
  associadoId: string;
}

// ============================================
// HELPERS
// ============================================
const formatCurrency = (v: number | null | undefined) => 
  v ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : 'R$ 0,00';

const formatDate = (d: string | null | undefined) => 
  d ? new Date(d).toLocaleDateString('pt-BR') : '—';

const getStatusDocBadge = (status: string) => {
  switch (status) {
    case 'aprovado':
      return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" /> Aprovado</Badge>;
    case 'reprovado':
      return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" /> Reprovado</Badge>;
    default:
      return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
  }
};

const TIPO_DOCUMENTO_LABELS: Record<string, string> = {
  cnh: 'CNH',
  crlv: 'CRLV',
  comprovante_residencia: 'Comprovante de Residência',
  selfie: 'Selfie com Documento',
  contrato: 'Contrato',
  outros: 'Outros',
};

// ============================================
// COMPONENT
// ============================================
export function VeiculoDetalhesModal({ 
  open, 
  onClose, 
  veiculo, 
  associadoId 
}: VeiculoDetalhesModalProps) {
  const [activeTab, setActiveTab] = useState('info');
  const [fotoPreview, setFotoPreview] = useState<{ url: string; tipo: string } | null>(null);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    identificacao: true,
    exterior: true,
    interior: false,
    outros: false,
  });

  // Data fetching
  const { data: fotos, isLoading: isLoadingFotos } = useFotosVistoriaPorVeiculo(veiculo?.id);
  const { data: documentosData, isLoading: isLoadingDocs } = useDocumentosAssociadoCompleto(associadoId);

  const fotosAgrupadas = fotos ? agruparFotosVeiculo(fotos) : null;
  const totalFotos = fotos?.length || 0;

  // Combine documents
  const todosDocumentos = [
    ...(documentosData?.documentos || []).map(d => ({ ...d, fonte: 'documentos' as const })),
    ...(documentosData?.documentosCotacao || []).map(d => ({ ...d, fonte: 'cotacao' as const })),
  ];

  const toggleCategory = (cat: string) => {
    setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  if (!veiculo) return null;

  // ============================================
  // RENDER
  // ============================================
  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-3">
              <Car className="h-5 w-5 text-primary" />
              <span>Detalhes do Veículo</span>
              <Badge variant="outline" className="font-mono text-base">
                {veiculo.placa}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <div className="px-6 border-b">
              <TabsList className="h-12 bg-transparent p-0 gap-4">
                <TabsTrigger 
                  value="info" 
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3"
                >
                  <Car className="h-4 w-4 mr-2" /> Informações
                </TabsTrigger>
                <TabsTrigger 
                  value="fotos"
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3"
                >
                  <Image className="h-4 w-4 mr-2" /> 
                  Fotos da Vistoria
                  {totalFotos > 0 && (
                    <Badge variant="secondary" className="ml-2">{totalFotos}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="documentos"
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3"
                >
                  <FileText className="h-4 w-4 mr-2" /> 
                  Documentos
                  {todosDocumentos.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{todosDocumentos.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="h-[60vh]">
              {/* TAB: INFORMAÇÕES */}
              <TabsContent value="info" className="p-6 m-0">
                <div className="grid gap-6">
                  {/* Dados do Veículo */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <InfoItem label="Marca" value={veiculo.marca} />
                    <InfoItem label="Modelo" value={veiculo.modelo} />
                    <InfoItem label="Ano Fab." value={veiculo.ano_fabricacao?.toString()} />
                    <InfoItem label="Ano Mod." value={veiculo.ano_modelo?.toString()} />
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <InfoItem label="Placa" value={veiculo.placa} mono />
                    <InfoItem label="Chassi" value={veiculo.chassi} mono />
                    <InfoItem label="Renavam" value={veiculo.renavam} />
                    <InfoItem label="Cor" value={veiculo.cor} />
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <InfoItem label="Combustível" value={veiculo.combustivel} />
                    <InfoItem label="Valor FIPE" value={formatCurrency(veiculo.valor_fipe)} highlight />
                    <InfoItem label="Uso Aplicativo" value={veiculo.uso_aplicativo ? 'Sim' : 'Não'} />
                    <InfoItem label="Status" value={veiculo.status} />
                  </div>

                  <Separator />

                  {/* Rastreador */}
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      {veiculo.rastreador ? (
                        <Wifi className="h-4 w-4 text-green-500" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-muted-foreground" />
                      )}
                      Rastreador
                    </h4>
                    {veiculo.rastreador ? (
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Código:</span>
                          <span className="ml-2 font-mono">{veiculo.rastreador.codigo}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Nº Série:</span>
                          <span className="ml-2 font-mono">{veiculo.rastreador.numero_serie}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum rastreador instalado</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* TAB: FOTOS DA VISTORIA */}
              <TabsContent value="fotos" className="p-6 m-0">
                {isLoadingFotos ? (
                  <div className="space-y-4">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                ) : totalFotos === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Camera className="h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mt-4 font-semibold">Nenhuma foto de vistoria</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      As fotos aparecerão aqui após a realização da vistoria
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Categoria: Identificação */}
                    <FotoCategoriaSection
                      title="Identificação"
                      fotos={fotosAgrupadas?.identificacao || []}
                      isOpen={openCategories.identificacao}
                      onToggle={() => toggleCategory('identificacao')}
                      onViewFoto={setFotoPreview}
                    />

                    {/* Categoria: Exterior */}
                    <FotoCategoriaSection
                      title="Exterior"
                      fotos={fotosAgrupadas?.exterior || []}
                      isOpen={openCategories.exterior}
                      onToggle={() => toggleCategory('exterior')}
                      onViewFoto={setFotoPreview}
                    />

                    {/* Categoria: Interior */}
                    <FotoCategoriaSection
                      title="Interior"
                      fotos={fotosAgrupadas?.interior || []}
                      isOpen={openCategories.interior}
                      onToggle={() => toggleCategory('interior')}
                      onViewFoto={setFotoPreview}
                    />

                    {/* Categoria: Outros */}
                    {(fotosAgrupadas?.outros?.length || 0) > 0 && (
                      <FotoCategoriaSection
                        title="Outros"
                        fotos={fotosAgrupadas?.outros || []}
                        isOpen={openCategories.outros}
                        onToggle={() => toggleCategory('outros')}
                        onViewFoto={setFotoPreview}
                      />
                    )}
                  </div>
                )}
              </TabsContent>

              {/* TAB: DOCUMENTOS */}
              <TabsContent value="documentos" className="p-6 m-0">
                {isLoadingDocs ? (
                  <div className="space-y-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : todosDocumentos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mt-4 font-semibold">Nenhum documento anexado</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Os documentos do associado aparecerão aqui
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todosDocumentos.map((doc) => (
                      <div 
                        key={doc.id} 
                        className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">
                              {TIPO_DOCUMENTO_LABELS[doc.tipo] || doc.tipo}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Enviado em {formatDate(doc.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getStatusDocBadge(doc.status)}
                          {doc.arquivo_url && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => window.open(doc.arquivo_url, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Preview de Foto */}
      <Dialog open={!!fotoPreview} onOpenChange={() => setFotoPreview(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <div className="relative bg-black">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => setFotoPreview(null)}
            >
              <X className="h-5 w-5" />
            </Button>
            <div className="flex items-center justify-center min-h-[60vh] p-4">
              <img
                src={fotoPreview?.url}
                alt={fotoPreview?.tipo || 'Foto'}
                className="max-w-full max-h-[80vh] object-contain"
              />
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
function InfoItem({ 
  label, 
  value, 
  mono, 
  highlight 
}: { 
  label: string; 
  value?: string | null; 
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn(
        "font-medium",
        mono && "font-mono text-sm",
        highlight && "text-primary text-lg",
        !value && "text-muted-foreground"
      )}>
        {value || '—'}
      </p>
    </div>
  );
}

function FotoCategoriaSection({
  title,
  fotos,
  isOpen,
  onToggle,
  onViewFoto,
}: {
  title: string;
  fotos: FotoVistoriaVeiculo[];
  isOpen: boolean;
  onToggle: () => void;
  onViewFoto: (foto: { url: string; tipo: string }) => void;
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
        <CheckCircle className="h-4 w-4 text-green-500" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {fotos.map((foto) => (
            <div
              key={foto.id}
              className="group relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer border hover:border-primary transition-colors"
              onClick={() => onViewFoto({ url: foto.arquivo_url, tipo: foto.tipo })}
            >
              <img
                src={foto.arquivo_url}
                alt={formatarTipoFotoVeiculo(foto.tipo)}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1.5 text-center truncate">
                {formatarTipoFotoVeiculo(foto.tipo)}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default VeiculoDetalhesModal;
