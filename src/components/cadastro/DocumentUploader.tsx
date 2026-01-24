import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useDocumentosPorAssociado } from '@/hooks/useDocumentos';
import { useUploadDocumento } from '@/hooks/useUploadDocumento';
import { DocumentUploaderCard } from './DocumentUploaderCard';
import { DocumentPreviewDialog } from './DocumentPreviewDialog';
import { DocumentViewDialog } from './DocumentViewDialog';
import { FileText, Camera, Loader2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type TipoDocumento = Database['public']['Enums']['tipo_documento'];
type StatusDocumento = Database['public']['Enums']['status_documento'];

export interface DocumentoInfo {
  id: string;
  tipo: TipoDocumento;
  arquivo_url: string;
  status: StatusDocumento;
  motivo_reprovacao?: string | null;
  created_at: string;
  nome_arquivo: string;
}

interface TipoDocumentoConfig {
  label: string;
  obrigatorio: boolean;
  categoria: 'pessoal' | 'veiculo';
  icone: typeof FileText | typeof Camera;
  descricao: string;
}

// Configuração dos tipos de documento baseada nos enums do banco
export const TIPOS_DOCUMENTO_CONFIG: Record<TipoDocumento, TipoDocumentoConfig> = {
  cnh: {
    label: 'CNH',
    obrigatorio: true,
    categoria: 'pessoal',
    icone: FileText,
    descricao: 'Carteira Nacional de Habilitação',
  },
  comprovante_residencia: {
    label: 'Comprovante de Residência',
    obrigatorio: true,
    categoria: 'pessoal',
    icone: FileText,
    descricao: 'Conta de luz, água ou telefone',
  },
  crlv: {
    label: 'CRLV',
    obrigatorio: true,
    categoria: 'veiculo',
    icone: FileText,
    descricao: 'Documento do veículo',
  },
  foto_frontal_veiculo: {
    label: 'Foto Frontal',
    obrigatorio: true,
    categoria: 'veiculo',
    icone: Camera,
    descricao: 'Frente do veículo',
  },
  foto_traseira_veiculo: {
    label: 'Foto Traseira',
    obrigatorio: true,
    categoria: 'veiculo',
    icone: Camera,
    descricao: 'Traseira do veículo',
  },
  foto_lateral_esquerda: {
    label: 'Lateral Esquerda',
    obrigatorio: false,
    categoria: 'veiculo',
    icone: Camera,
    descricao: 'Lado esquerdo do veículo',
  },
  foto_lateral_direita: {
    label: 'Lateral Direita',
    obrigatorio: false,
    categoria: 'veiculo',
    icone: Camera,
    descricao: 'Lado direito do veículo',
  },
  foto_painel: {
    label: 'Foto do Painel',
    obrigatorio: false,
    categoria: 'veiculo',
    icone: Camera,
    descricao: 'Painel do veículo',
  },
  foto_hodometro: {
    label: 'Hodômetro',
    obrigatorio: true,
    categoria: 'veiculo',
    icone: Camera,
    descricao: 'Foto do painel com KM',
  },
  outro: {
    label: 'Outro',
    obrigatorio: false,
    categoria: 'pessoal',
    icone: FileText,
    descricao: 'Outro documento',
  },
  // Novos tipos de vistoria
  selfie_veiculo: {
    label: 'Selfie com Veículo',
    obrigatorio: false,
    categoria: 'veiculo',
    icone: Camera,
    descricao: 'Foto sua com o veículo',
  },
  frente: {
    label: 'Frente',
    obrigatorio: false,
    categoria: 'veiculo',
    icone: Camera,
    descricao: 'Frente do veículo',
  },
  traseira: {
    label: 'Traseira',
    obrigatorio: false,
    categoria: 'veiculo',
    icone: Camera,
    descricao: 'Traseira do veículo',
  },
  lateral_direita: {
    label: 'Lateral Direita',
    obrigatorio: false,
    categoria: 'veiculo',
    icone: Camera,
    descricao: 'Lado direito do veículo',
  },
  lateral_esquerda: {
    label: 'Lateral Esquerda',
    obrigatorio: false,
    categoria: 'veiculo',
    icone: Camera,
    descricao: 'Lado esquerdo do veículo',
  },
  odometro: {
    label: 'Odômetro',
    obrigatorio: false,
    categoria: 'veiculo',
    icone: Camera,
    descricao: 'Foto do odômetro',
  },
  chassi: {
    label: 'Chassi',
    obrigatorio: false,
    categoria: 'veiculo',
    icone: Camera,
    descricao: 'Foto do número do chassi',
  },
  motor: {
    label: 'Motor',
    obrigatorio: false,
    categoria: 'veiculo',
    icone: Camera,
    descricao: 'Foto do motor',
  },
  banco_dianteiro: {
    label: 'Banco Dianteiro',
    obrigatorio: false,
    categoria: 'veiculo',
    icone: Camera,
    descricao: 'Foto do banco dianteiro',
  },
  banco_traseiro: {
    label: 'Banco Traseiro',
    obrigatorio: false,
    categoria: 'veiculo',
    icone: Camera,
    descricao: 'Foto do banco traseiro',
  },
  pneu_dianteiro_direito: {
    label: 'Pneu Diant. Direito',
    obrigatorio: false,
    categoria: 'veiculo',
    icone: Camera,
    descricao: 'Pneu dianteiro direito',
  },
  pneu_dianteiro_esquerdo: {
    label: 'Pneu Diant. Esquerdo',
    obrigatorio: false,
    categoria: 'veiculo',
    icone: Camera,
    descricao: 'Pneu dianteiro esquerdo',
  },
  pneu_traseiro_direito: {
    label: 'Pneu Tras. Direito',
    obrigatorio: false,
    categoria: 'veiculo',
    icone: Camera,
    descricao: 'Pneu traseiro direito',
  },
  pneu_traseiro_esquerdo: {
    label: 'Pneu Tras. Esquerdo',
    obrigatorio: false,
    categoria: 'veiculo',
    icone: Camera,
    descricao: 'Pneu traseiro esquerdo',
  },
  laudo_vistoria: {
    label: 'Laudo da Vistoria',
    obrigatorio: false,
    categoria: 'veiculo',
    icone: FileText,
    descricao: 'PDF do laudo da vistoria',
  },
};

interface DocumentUploaderProps {
  associadoId: string;
  veiculoId?: string;
  modo?: 'completo' | 'pessoal' | 'veiculo';
  onDocumentoEnviado?: (doc: DocumentoInfo) => void;
  onTodosEnviados?: () => void;
  readOnly?: boolean;
}

export function DocumentUploader({
  associadoId,
  veiculoId,
  modo = 'completo',
  onDocumentoEnviado,
  onTodosEnviados,
  readOnly = false,
}: DocumentUploaderProps) {
  const { toast } = useToast();
  const { data: documentos, isLoading } = useDocumentosPorAssociado(associadoId);
  const uploadMutation = useUploadDocumento();

  const [uploadingTipo, setUploadingTipo] = useState<TipoDocumento | null>(null);
  const [previewFile, setPreviewFile] = useState<{ file: File; tipo: TipoDocumento } | null>(null);
  const [viewingDoc, setViewingDoc] = useState<DocumentoInfo | null>(null);

  // Filtrar tipos baseado no modo
  const tiposParaMostrar = useMemo(() => {
    return (Object.entries(TIPOS_DOCUMENTO_CONFIG) as [TipoDocumento, TipoDocumentoConfig][])
      .filter(([tipo, config]) => {
        // Excluir "outro" da grid principal
        if (tipo === 'outro') return false;
        if (modo === 'pessoal') return config.categoria === 'pessoal';
        if (modo === 'veiculo') return config.categoria === 'veiculo';
        return true;
      });
  }, [modo]);

  // Indexar documentos por tipo (pegar o mais recente de cada)
  const documentosPorTipo = useMemo(() => {
    const map: Partial<Record<TipoDocumento, DocumentoInfo>> = {};
    documentos?.forEach((doc) => {
      const existing = map[doc.tipo as TipoDocumento];
      if (!existing || new Date(doc.created_at) > new Date(existing.created_at)) {
        map[doc.tipo as TipoDocumento] = doc as DocumentoInfo;
      }
    });
    return map;
  }, [documentos]);

  // Calcular progresso
  const obrigatorios = tiposParaMostrar.filter(([_, c]) => c.obrigatorio);
  const obrigatoriosEnviados = obrigatorios.filter(([tipo]) => documentosPorTipo[tipo]);
  const progresso = obrigatorios.length > 0
    ? Math.round((obrigatoriosEnviados.length / obrigatorios.length) * 100)
    : 0;

  // Verificar se todos obrigatórios foram enviados
  useEffect(() => {
    const todosEnviados = obrigatorios.every(([tipo]) => documentosPorTipo[tipo]);
    if (todosEnviados && obrigatorios.length > 0 && documentos?.length) {
      onTodosEnviados?.();
    }
  }, [documentosPorTipo, obrigatorios, onTodosEnviados, documentos?.length]);

  // Handler de arquivo selecionado
  const handleFileSelect = (tipo: TipoDocumento, file: File) => {
    // Validar tipo
    const tiposAceitos = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!tiposAceitos.includes(file.type)) {
      toast({
        title: 'Formato inválido',
        description: 'Envie arquivos JPG, PNG, WebP ou PDF',
        variant: 'destructive',
      });
      return;
    }

    // Validar tamanho (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O arquivo deve ter no máximo 10MB',
        variant: 'destructive',
      });
      return;
    }

    // Abrir preview
    setPreviewFile({ file, tipo });
  };

  // Confirmar upload
  const confirmarUpload = async () => {
    if (!previewFile) return;

    const { file, tipo } = previewFile;
    setPreviewFile(null);
    setUploadingTipo(tipo);

    try {
      await uploadMutation.mutateAsync({
        associado_id: associadoId,
        veiculo_id: TIPOS_DOCUMENTO_CONFIG[tipo].categoria === 'veiculo' ? veiculoId : undefined,
        tipo,
        file,
      });

      toast({
        title: 'Documento enviado!',
        description: 'O documento foi enviado e está aguardando análise',
      });

      // Chamar callback com o documento enviado
      onDocumentoEnviado?.({
        id: crypto.randomUUID(), // Placeholder, será atualizado pelo refresh
        tipo,
        arquivo_url: '',
        status: 'pendente',
        created_at: new Date().toISOString(),
        nome_arquivo: file.name,
      });
    } catch (error: any) {
      console.error('Erro no upload:', error);
      toast({
        title: 'Erro no upload',
        description: error.message || 'Não foi possível enviar o documento',
        variant: 'destructive',
      });
    } finally {
      setUploadingTipo(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <CardTitle className="text-lg">Carregando documentos...</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {/* Header com progresso */}
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Documentos</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {obrigatoriosEnviados.length} de {obrigatorios.length} obrigatórios enviados
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-primary">{progresso}%</span>
          </div>
        </div>
        <Progress value={progresso} className="h-2 mt-3" />
      </CardHeader>

      {/* Grid de cards */}
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {tiposParaMostrar.map(([tipo, config]) => (
            <DocumentUploaderCard
              key={tipo}
              tipo={tipo}
              config={config}
              documento={documentosPorTipo[tipo]}
              isUploading={uploadingTipo === tipo}
              readOnly={readOnly}
              onFileSelect={handleFileSelect}
              onView={setViewingDoc}
            />
          ))}
        </div>
      </CardContent>

      {/* Modal de Preview */}
      <DocumentPreviewDialog
        file={previewFile?.file ?? null}
        tipo={previewFile?.tipo ?? null}
        onClose={() => setPreviewFile(null)}
        onConfirm={confirmarUpload}
        isUploading={uploadMutation.isPending}
      />

      {/* Modal de Visualização */}
      <DocumentViewDialog
        documento={viewingDoc}
        onClose={() => setViewingDoc(null)}
      />
    </Card>
  );
}
