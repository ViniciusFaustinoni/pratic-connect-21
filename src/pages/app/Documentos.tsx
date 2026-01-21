import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Shield, Share2, Download, FileText, Award, BookOpen, 
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
import { useContratoAssociado } from '@/hooks/useDocumentosApp';
import { cn } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import jsPDF from 'jspdf';
import { format, addYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppAssociadoLayout } from '@/layouts/AppAssociadoLayout';

// Types
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

// Função para mascarar CPF
const mascararCPF = (cpf: string | null | undefined) => {
  if (!cpf) return '***.***.***-**';
  const limpo = cpf.replace(/\D/g, '');
  if (limpo.length < 11) return '***.***.***-**';
  return `***.***.*${limpo.slice(6, 9)}-${limpo.slice(9, 11)}`;
};

export default function Documentos() {
  const navigate = useNavigate();
  const { data: associado, isLoading: loadingAssociado } = useMyAssociado();
  const { data: veiculos, isLoading: loadingVeiculos } = useMyVehicles();
  const { data: documentos, isLoading: loadingDocumentos } = useMyDocumentos();
  const { data: boletos } = useMyBoletos();
  const { data: contrato } = useContratoAssociado();
  const qrRef = useRef<SVGSVGElement>(null);

  const [documentoAberto, setDocumentoAberto] = useState<DocumentoItem | null>(null);

  const veiculo = veiculos?.[0];
  const isLoading = loadingAssociado || loadingVeiculos || loadingDocumentos;

  // Calcular validade da carteirinha baseado no contrato
  const validadeCarteirinha = useMemo(() => {
    if (contrato?.data_fim) {
      return format(new Date(contrato.data_fim), 'MM/yyyy');
    }
    // Fallback: 1 ano a partir de agora
    return format(addYears(new Date(), 1), 'MM/yyyy');
  }, [contrato]);

  // Dados da carteirinha
  const carteirinhaData = useMemo(() => ({
    nome: associado?.nome || 'Associado',
    cpf: associado?.cpf,
    matricula: associado?.id?.slice(0, 8).toUpperCase() || '00000000',
    veiculo: {
      modelo: veiculo?.marca && veiculo?.modelo ? `${veiculo.marca} ${veiculo.modelo}` : 'Não informado',
      placa: veiculo?.placa || 'ABC-0000',
    },
    status: associado?.status || 'ativo',
    codigoVerificacao: `PRTC-${associado?.id?.slice(0, 8).toUpperCase() || '00000000'}`,
  }), [associado, veiculo]);

  // URL de verificação para QR Code
  const urlVerificacao = `https://pratic-connect-21.lovable.app/verificar/${carteirinhaData.codigoVerificacao}`;

  // Boletos pagos para comprovantes (últimos 3)
  const boletosPagos = useMemo(() => {
    return boletos
      ?.filter(b => b.status === 'pago')
      .slice(0, 3) || [];
  }, [boletos]);

  // Group vehicle documents (fotos)
  const fotosVistoria = documentos?.filter(d => d.tipo.startsWith('foto_')) || [];
  const docsCNH = documentos?.find(d => d.tipo === 'cnh');
  const docsCRLV = documentos?.find(d => d.tipo === 'crlv');

  // Handlers
  const handleCompartilhar = async () => {
    const shareData = {
      title: 'Minha Carteirinha PRATIC',
      text: `Associado: ${carteirinhaData.nome}\nMatrícula: ${carteirinhaData.matricula}\nVeículo: ${carteirinhaData.veiculo.modelo} - ${carteirinhaData.veiculo.placa}\n\nVerifique em: ${urlVerificacao}`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        navigator.clipboard.writeText(urlVerificacao);
        toast.success('Link de verificação copiado!');
      }
    } else {
      navigator.clipboard.writeText(urlVerificacao);
      toast.success('Link de verificação copiado!');
    }
  };

  const handleBaixarCarteirinha = () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [85.6, 53.98] // Tamanho padrão de cartão de crédito
      });
      
      // Background gradient (simulated with solid color)
      doc.setFillColor(37, 99, 235); // blue-600
      doc.rect(0, 0, 85.6, 53.98, 'F');
      
      // Add a darker section at the bottom
      doc.setFillColor(30, 64, 175); // blue-800
      doc.rect(0, 35, 85.6, 18.98, 'F');
      
      // Logo PRATIC
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('PRATIC', 5, 10);
      
      // Status badge
      doc.setFontSize(6);
      doc.setFillColor(255, 255, 255, 0.2);
      doc.text(carteirinhaData.status.toUpperCase(), 75, 8);
      
      // Nome do associado
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(carteirinhaData.nome.slice(0, 30), 5, 20);
      
      // CPF
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(191, 219, 254); // blue-200
      doc.text(`CPF: ${mascararCPF(carteirinhaData.cpf)}`, 5, 25);
      
      // Dados do veículo e matrícula
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6);
      
      // Veículo
      doc.setTextColor(191, 219, 254);
      doc.text('Veículo', 5, 40);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(carteirinhaData.veiculo.modelo.slice(0, 15), 5, 44);
      
      // Placa
      doc.setTextColor(191, 219, 254);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text('Placa', 35, 40);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(carteirinhaData.veiculo.placa, 35, 44);
      
      // Matrícula
      doc.setTextColor(191, 219, 254);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text('Matrícula', 5, 48);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(carteirinhaData.matricula, 5, 52);
      
      // Validade
      doc.setTextColor(191, 219, 254);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text('Validade', 35, 48);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(validadeCarteirinha, 35, 52);
      
      // QR Code area (white background)
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(67, 38, 15, 15, 1, 1, 'F');
      
      // Add QR code as image if available
      if (qrRef.current) {
        const svgData = new XMLSerializer().serializeToString(qrRef.current);
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
          ctx?.drawImage(img, 0, 0, 100, 100);
          const imgData = canvas.toDataURL('image/png');
          doc.addImage(imgData, 'PNG', 68, 39, 13, 13);
          doc.save(`Carteirinha_PRATIC_${carteirinhaData.matricula}.pdf`);
          toast.success('Carteirinha baixada com sucesso!');
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
      } else {
        doc.save(`Carteirinha_PRATIC_${carteirinhaData.matricula}.pdf`);
        toast.success('Carteirinha baixada com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar carteirinha');
    }
  };

  const handleAbrirDocumento = (documento: DocumentoItem) => {
    setDocumentoAberto(documento);
  };

  const handleBaixarDocumento = (url?: string, nome?: string) => {
    if (url) {
      window.open(url, '_blank');
      toast.success(`Download de ${nome || 'documento'} iniciado`);
    } else {
      toast.info('Documento não disponível para download');
    }
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
    <AppAssociadoLayout>
      <div className="p-4 pb-24 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-foreground">Meus Documentos</h1>
          <p className="text-sm text-muted-foreground">Acesse seus documentos digitais</p>
        </div>

        {/* Carteirinha Digital - Hero */}
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
                <div className="text-blue-200 text-sm">CPF: {mascararCPF(carteirinhaData.cpf)}</div>
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
                    <div className="font-semibold">{validadeCarteirinha}</div>
                  </div>
                </div>
              </div>

              {/* QR Code / Código de verificação */}
              <div className="mt-4 pt-4 border-t border-white/20 flex items-center justify-between">
                <div>
                  <div className="text-xs text-blue-200">Código de verificação</div>
                  <div className="font-mono font-bold text-sm">{carteirinhaData.codigoVerificacao}</div>
                </div>
                <div className="w-16 h-16 bg-white rounded-lg p-1 flex items-center justify-center">
                  <QRCodeSVG 
                    ref={qrRef}
                    value={urlVerificacao}
                    size={56}
                    level="M"
                    fgColor="#1e40af"
                    bgColor="#FFFFFF"
                  />
                </div>
              </div>
            </div>

            {/* Botões da carteirinha */}
            <div className="flex gap-3">
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

        {/* Seção: Documentos Contratuais */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Documentos Contratuais
          </h2>

          <div className="space-y-2">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))
            ) : (
              <>
                {/* Contrato de Adesão - dados reais */}
                <Card 
                  className="cursor-pointer hover:bg-muted/50 transition-colors border-0 shadow-sm"
                  onClick={() => handleAbrirDocumento({ 
                    id: 'contrato',
                    nome: 'Contrato de Adesão', 
                    subtitulo: contrato?.data_assinatura 
                      ? `Assinado em ${format(new Date(contrato.data_assinatura), 'dd/MM/yyyy')}`
                      : 'Assinatura pendente',
                    tipo: 'contrato',
                    url: contrato?.pdf_assinado_url || undefined
                  })}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={cn('p-3 rounded-xl', iconColorClasses.blue.bg)}>
                        <FileText className={cn('h-6 w-6', iconColorClasses.blue.text)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground">Contrato de Adesão</div>
                        <div className="text-sm text-muted-foreground">
                          {contrato?.data_assinatura 
                            ? `Assinado em ${format(new Date(contrato.data_assinatura), 'dd/MM/yyyy')}`
                            : 'Assinatura pendente'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {contrato?.pdf_assinado_url && <Badge variant="outline" className="text-xs">PDF</Badge>}
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Certificado de Proteção */}
                <Card 
                  className="cursor-pointer hover:bg-muted/50 transition-colors border-0 shadow-sm"
                  onClick={() => handleAbrirDocumento({ 
                    id: 'certificado',
                    nome: 'Certificado de Proteção', 
                    subtitulo: `Válido até ${validadeCarteirinha}`,
                    tipo: 'certificado',
                  })}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={cn('p-3 rounded-xl', iconColorClasses.green.bg)}>
                        <Shield className={cn('h-6 w-6', iconColorClasses.green.text)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground">Certificado de Proteção</div>
                        <div className="text-sm text-muted-foreground">Válido até {validadeCarteirinha}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">PDF</Badge>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Carteirinha Digital - Mini preview */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={cn('p-3 rounded-xl', iconColorClasses.blue.bg)}>
                        <CreditCard className={cn('h-6 w-6', iconColorClasses.blue.text)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground">Carteirinha Digital</div>
                        {/* Mini preview */}
                        <div className="mt-2 bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-2 text-white text-xs">
                          <div className="font-semibold truncate">{carteirinhaData.nome}</div>
                          <div className="flex justify-between mt-1 text-blue-200">
                            <span>{carteirinhaData.veiculo.placa}</span>
                            <span>Val: {validadeCarteirinha}</span>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={handleCompartilhar}>
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Regulamento */}
                <Card 
                  className="cursor-pointer hover:bg-muted/50 transition-colors border-0 shadow-sm"
                  onClick={() => handleAbrirDocumento({ 
                    id: 'regulamento',
                    nome: 'Regulamento Geral', 
                    subtitulo: 'Versão 2025.1',
                    tipo: 'regulamento',
                  })}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={cn('p-3 rounded-xl', iconColorClasses.purple.bg)}>
                        <BookOpen className={cn('h-6 w-6', iconColorClasses.purple.text)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground">Regulamento Geral</div>
                        <div className="text-sm text-muted-foreground">Versão 2025.1</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">PDF</Badge>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>

        {/* Seção: Documentos do Veículo */}
        <div>
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
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Comprovantes
          </h2>

          <div className="space-y-2">
            {isLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))
            ) : boletosPagos.length > 0 ? (
              <>
                {boletosPagos.map((boleto) => (
                  <Card 
                    key={boleto.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors border-0 shadow-sm"
                    onClick={() => handleAbrirDocumento({ 
                      id: boleto.id, 
                      nome: `Comprovante ${boleto.competencia}`, 
                      subtitulo: boleto.dataPagamento ? `Pago em ${boleto.dataPagamento}` : 'Pagamento confirmado',
                      tipo: 'comprovante',
                      url: boleto.urlComprovante || boleto.urlBoleto
                    })}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className={cn('p-3 rounded-xl', iconColorClasses.emerald.bg)}>
                          <Receipt className={cn('h-6 w-6', iconColorClasses.emerald.text)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground">Comprovante {boleto.competencia}</div>
                          <div className="text-sm text-muted-foreground">
                            {boleto.dataPagamento ? `Pago em ${boleto.dataPagamento}` : 'Pagamento confirmado'}
                          </div>
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
            ) : (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 text-center text-muted-foreground">
                  <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum comprovante disponível</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Modal Visualizar Documento */}
        <Dialog open={documentoAberto !== null} onOpenChange={() => setDocumentoAberto(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{documentoAberto?.nome}</DialogTitle>
            </DialogHeader>

            {/* Preview do documento */}
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
                onClick={() => handleBaixarDocumento(documentoAberto?.url, documentoAberto?.nome)}
              >
                <Download className="h-4 w-4" />
                Baixar PDF
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppAssociadoLayout>
  );
}
