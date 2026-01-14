import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Shield, QrCode, Share2, Download, FileText, Award, BookOpen, 
  ChevronRight, Car, CreditCard, Camera, CheckCircle, Clock, XCircle,
  Receipt, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useMyAssociado, useMyVehicles, useMyDocumentos, useMyBoletos } from '@/hooks/useMyData';
import { cn } from '@/lib/utils';

// Types
interface DocumentoContratual {
  id: string;
  tipo: string;
  nome: string;
  subtitulo: string;
  formato: string;
  icon: React.ComponentType<{ className?: string }>;
  cor: string;
}

interface DocumentoItem {
  id: string;
  nome: string;
  subtitulo: string;
  tipo: string;
  status?: string;
  url?: string;
}

// Status configuration
const statusDocConfig: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
  aprovado: { label: 'Aprovado', icon: CheckCircle, className: 'bg-green-100 text-green-700' },
  pendente: { label: 'Pendente', icon: Clock, className: 'bg-yellow-100 text-yellow-700' },
  em_analise: { label: 'Em análise', icon: Clock, className: 'bg-blue-100 text-blue-700' },
  reprovado: { label: 'Reprovado', icon: XCircle, className: 'bg-red-100 text-red-700' },
};

// Mock data for contractual documents
const documentosContratuaisMock: DocumentoContratual[] = [
  { id: '1', tipo: 'contrato', nome: 'Proposta de Filiação', subtitulo: 'Assinado em 15/01/2024', formato: 'PDF', icon: FileText, cor: 'blue' },
  { id: '2', tipo: 'certificado', nome: 'Certificado de Filiação', subtitulo: 'Emitido em 20/01/2024', formato: 'PDF', icon: Award, cor: 'green' },
  { id: '3', tipo: 'regulamento', nome: 'Regulamento Geral', subtitulo: 'Versão 2024.1', formato: 'PDF', icon: BookOpen, cor: 'purple' },
  { id: '4', tipo: 'cobertura', nome: 'Tabela de Coberturas', subtitulo: 'Plano Proteção Total', formato: 'PDF', icon: Shield, cor: 'amber' },
];

// Mock data for payment receipts
const comprovantesMock = [
  { id: '1', mes: 'Janeiro/2024', dataPagamento: '10/01/2024' },
  { id: '2', mes: 'Dezembro/2023', dataPagamento: '08/12/2023' },
];

// Tipo labels for vehicle documents
const tipoLabels: Record<string, string> = {
  cnh: 'CNH',
  crlv: 'CRLV Digital',
  comprovante_residencia: 'Comprovante de Residência',
  foto_frontal_veiculo: 'Foto Frontal',
  foto_traseira_veiculo: 'Foto Traseira',
  foto_lateral_esquerda: 'Foto Lateral Esquerda',
  foto_lateral_direita: 'Foto Lateral Direita',
  foto_painel: 'Foto do Painel',
  foto_hodometro: 'Foto do Hodômetro',
};

// Color classes for icons
const iconColorClasses: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
  green: { bg: 'bg-green-100', text: 'text-green-600' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-600' },
  gray: { bg: 'bg-gray-100', text: 'text-gray-600' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
};

export default function AppDocumentos() {
  const navigate = useNavigate();
  const { data: associado, isLoading: loadingAssociado } = useMyAssociado();
  const { data: veiculos, isLoading: loadingVeiculos } = useMyVehicles();
  const { data: documentos, isLoading: loadingDocumentos } = useMyDocumentos();
  const { data: boletos } = useMyBoletos();

  const [documentoAberto, setDocumentoAberto] = useState<DocumentoItem | null>(null);

  const veiculo = veiculos?.[0];
  const isLoading = loadingAssociado || loadingVeiculos || loadingDocumentos;

  // Mock data for membership card
  const carteirinhaData = {
    nome: associado?.nome || 'João da Silva',
    cpf: associado?.cpf || '123.456.789-00',
    matricula: associado?.id?.slice(0, 8).toUpperCase() || '00012345',
    veiculo: {
      modelo: veiculo?.marca && veiculo?.modelo ? `${veiculo.marca} ${veiculo.modelo}` : 'Gol G5 1.0',
      placa: veiculo?.placa || 'ABC-1234',
    },
    status: associado?.status || 'ativo',
    validadeCarteirinha: '12/2024',
    codigoVerificacao: `PRTC-2024-${(associado?.id?.slice(0, 8) || '00012345').toUpperCase()}`,
  };

  // Group vehicle documents (fotos)
  const fotosVistoria = documentos?.filter(d => d.tipo.startsWith('foto_')) || [];
  const docsCNH = documentos?.find(d => d.tipo === 'cnh');
  const docsCRLV = documentos?.find(d => d.tipo === 'crlv');

  // Handlers
  const handleCompartilhar = async () => {
    const shareData = {
      title: 'Minha Carteirinha PRATIC',
      text: `Associado: ${carteirinhaData.nome}\nMatrícula: ${carteirinhaData.matricula}\nVeículo: ${carteirinhaData.veiculo.modelo} - ${carteirinhaData.veiculo.placa}`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or error
        navigator.clipboard.writeText(carteirinhaData.codigoVerificacao);
        toast.success('Código de verificação copiado!');
      }
    } else {
      navigator.clipboard.writeText(carteirinhaData.codigoVerificacao);
      toast.success('Código de verificação copiado!');
    }
  };

  const handleBaixarCarteirinha = () => {
    toast.success('Download da carteirinha iniciado');
  };

  const handleAbrirDocumento = (documento: DocumentoItem) => {
    setDocumentoAberto(documento);
  };

  const handleBaixarDocumento = (nome: string) => {
    toast.success(`Download de ${nome} iniciado`);
    setDocumentoAberto(null);
  };

  const handleVisualizarDocumento = (url?: string) => {
    if (url) {
      window.open(url, '_blank');
    } else {
      toast.info('Pré-visualização não disponível');
    }
    setDocumentoAberto(null);
  };

  const getStatusBadge = (status: string) => {
    const config = statusDocConfig[status] || statusDocConfig.pendente;
    const Icon = config.icon;
    return (
      <Badge className={cn('text-xs border-0', config.className)}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className="min-h-[44px] min-w-[44px]"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="font-semibold text-foreground">Meus Documentos</span>
          <div className="w-10" />
        </div>
      </header>

      {/* Carteirinha Digital - Hero */}
      <div className="mx-4 mt-4">
        {isLoading ? (
          <Skeleton className="h-72 w-full rounded-2xl" />
        ) : (
          <>
            <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 rounded-2xl p-5 text-white shadow-xl">
              {/* Header da carteirinha */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-6 w-6" />
                  <span className="font-bold text-lg">PRATIC</span>
                </div>
                <Badge className="bg-white/20 text-white border-0 uppercase text-xs">
                  {carteirinhaData.status === 'ativo' ? 'Ativo' : carteirinhaData.status}
                </Badge>
              </div>

              {/* Dados do associado */}
              <div className="space-y-1">
                <div className="text-xl font-bold">{carteirinhaData.nome}</div>
                <div className="text-blue-200 text-sm">CPF: {carteirinhaData.cpf}</div>
              </div>

              {/* Dados do veículo */}
              <div className="mt-4 pt-4 border-t border-white/20">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-blue-200">Veículo</div>
                    <div className="font-semibold">{carteirinhaData.veiculo.modelo}</div>
                  </div>
                  <div>
                    <div className="text-xs text-blue-200">Placa</div>
                    <div className="font-semibold font-mono">{carteirinhaData.veiculo.placa}</div>
                  </div>
                  <div>
                    <div className="text-xs text-blue-200">Matrícula</div>
                    <div className="font-semibold font-mono">{carteirinhaData.matricula}</div>
                  </div>
                  <div>
                    <div className="text-xs text-blue-200">Validade</div>
                    <div className="font-semibold">{carteirinhaData.validadeCarteirinha}</div>
                  </div>
                </div>
              </div>

              {/* QR Code / Código de verificação */}
              <div className="mt-4 pt-4 border-t border-white/20 flex items-center justify-between">
                <div>
                  <div className="text-xs text-blue-200">Código de verificação</div>
                  <div className="font-mono font-bold text-sm">{carteirinhaData.codigoVerificacao}</div>
                </div>
                <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
                  <QrCode className="h-12 w-12 text-blue-900" />
                </div>
              </div>
            </div>

            {/* Botões da carteirinha */}
            <div className="flex gap-3 mt-3">
              <Button 
                variant="outline" 
                className="flex-1 gap-2 min-h-[44px]" 
                onClick={handleCompartilhar}
              >
                <Share2 className="h-4 w-4" />
                Compartilhar
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 gap-2 min-h-[44px]" 
                onClick={handleBaixarCarteirinha}
              >
                <Download className="h-4 w-4" />
                Baixar PDF
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Seção: Documentos Contratuais */}
      <div className="mx-4 mt-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Documentos Contratuais
        </h2>

        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))
          ) : (
            documentosContratuaisMock.map((doc) => {
              const IconComponent = doc.icon;
              const colors = iconColorClasses[doc.cor];
              
              return (
                <Card 
                  key={doc.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors border-0 shadow-sm"
                  onClick={() => handleAbrirDocumento({ 
                    id: doc.id, 
                    nome: doc.nome, 
                    subtitulo: doc.subtitulo,
                    tipo: doc.tipo 
                  })}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={cn('p-3 rounded-xl', colors.bg)}>
                        <IconComponent className={cn('h-6 w-6', colors.text)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground">{doc.nome}</div>
                        <div className="text-sm text-muted-foreground">{doc.subtitulo}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{doc.formato}</Badge>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Seção: Documentos do Veículo */}
      <div className="mx-4 mt-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Documentos do Veículo
        </h2>

        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))
          ) : (
            <>
              {/* CRLV */}
              <Card 
                className="cursor-pointer hover:bg-muted/50 transition-colors border-0 shadow-sm"
                onClick={() => handleAbrirDocumento({ 
                  id: docsCRLV?.id || 'crlv',
                  nome: 'CRLV Digital', 
                  subtitulo: docsCRLV ? `Enviado em ${new Date(docsCRLV.created_at).toLocaleDateString('pt-BR')}` : 'Não enviado',
                  tipo: 'crlv',
                  status: docsCRLV?.status,
                  url: docsCRLV?.arquivo_url
                })}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={cn('p-3 rounded-xl', iconColorClasses.gray.bg)}>
                      <Car className={cn('h-6 w-6', iconColorClasses.gray.text)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground">CRLV Digital</div>
                      <div className="text-sm text-muted-foreground">
                        {docsCRLV ? `Enviado em ${new Date(docsCRLV.created_at).toLocaleDateString('pt-BR')}` : 'Documento não enviado'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {docsCRLV && getStatusBadge(docsCRLV.status)}
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* CNH */}
              <Card 
                className="cursor-pointer hover:bg-muted/50 transition-colors border-0 shadow-sm"
                onClick={() => handleAbrirDocumento({ 
                  id: docsCNH?.id || 'cnh',
                  nome: 'CNH', 
                  subtitulo: docsCNH ? `Enviado em ${new Date(docsCNH.created_at).toLocaleDateString('pt-BR')}` : 'Não enviado',
                  tipo: 'cnh',
                  status: docsCNH?.status,
                  url: docsCNH?.arquivo_url
                })}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={cn('p-3 rounded-xl', iconColorClasses.gray.bg)}>
                      <CreditCard className={cn('h-6 w-6', iconColorClasses.gray.text)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground">CNH</div>
                      <div className="text-sm text-muted-foreground">
                        {docsCNH ? `Enviado em ${new Date(docsCNH.created_at).toLocaleDateString('pt-BR')}` : 'Documento não enviado'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {docsCNH && getStatusBadge(docsCNH.status)}
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Fotos da Vistoria */}
              <Card 
                className="cursor-pointer hover:bg-muted/50 transition-colors border-0 shadow-sm"
                onClick={() => handleAbrirDocumento({ 
                  id: 'fotos',
                  nome: 'Fotos da Vistoria', 
                  subtitulo: fotosVistoria.length > 0 
                    ? `${fotosVistoria.length} fotos • ${new Date(fotosVistoria[0].created_at).toLocaleDateString('pt-BR')}`
                    : 'Nenhuma foto enviada',
                  tipo: 'fotos',
                  status: fotosVistoria.length > 0 ? 'aprovado' : undefined
                })}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={cn('p-3 rounded-xl', iconColorClasses.gray.bg)}>
                      <Camera className={cn('h-6 w-6', iconColorClasses.gray.text)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground">Fotos da Vistoria</div>
                      <div className="text-sm text-muted-foreground">
                        {fotosVistoria.length > 0 
                          ? `${fotosVistoria.length} fotos • ${new Date(fotosVistoria[0].created_at).toLocaleDateString('pt-BR')}`
                          : 'Nenhuma foto enviada'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {fotosVistoria.length > 0 && getStatusBadge('aprovado')}
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Seção: Comprovantes */}
      <div className="mx-4 mt-6 mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Comprovantes
        </h2>

        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))
          ) : (
            <>
              {comprovantesMock.map((comp) => (
                <Card 
                  key={comp.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors border-0 shadow-sm"
                  onClick={() => handleAbrirDocumento({ 
                    id: comp.id, 
                    nome: `Comprovante ${comp.mes}`, 
                    subtitulo: `Pago em ${comp.dataPagamento}`,
                    tipo: 'comprovante'
                  })}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={cn('p-3 rounded-xl', iconColorClasses.emerald.bg)}>
                        <Receipt className={cn('h-6 w-6', iconColorClasses.emerald.text)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground">Comprovante {comp.mes}</div>
                        <div className="text-sm text-muted-foreground">Pago em {comp.dataPagamento}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">PDF</Badge>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Ver todos */}
              <Button 
                variant="ghost" 
                className="w-full text-primary justify-center"
                onClick={() => navigate('/app/boletos')}
              >
                Ver todos os comprovantes
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Modal Visualizar Documento */}
      <Dialog open={documentoAberto !== null} onOpenChange={() => setDocumentoAberto(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{documentoAberto?.nome}</DialogTitle>
          </DialogHeader>

          {/* Preview do documento (placeholder) */}
          <div className="bg-muted rounded-lg h-64 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <FileText className="h-16 w-16 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Pré-visualização do documento</p>
              {documentoAberto?.subtitulo && (
                <p className="text-xs mt-1">{documentoAberto.subtitulo}</p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1 gap-2"
              onClick={() => handleVisualizarDocumento(documentoAberto?.url)}
            >
              <Eye className="h-4 w-4" />
              Visualizar
            </Button>
            <Button 
              className="flex-1 gap-2"
              onClick={() => handleBaixarDocumento(documentoAberto?.nome || 'Documento')}
            >
              <Download className="h-4 w-4" />
              Baixar PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
