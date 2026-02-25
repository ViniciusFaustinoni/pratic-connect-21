import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, Image, Video, CheckCircle, XCircle, Clock, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { TIPO_DOCUMENTO_LABELS } from '@/types/terceiros';

interface DocumentoData {
  id: string;
  tipo: string;
  nome: string;
  url: string;
  status: string;
  motivo_rejeicao?: string;
  created_at: string;
}

interface Props {
  token: string;
  documentos: DocumentoData[];
  onRefresh: () => void;
}

const DOCUMENTOS_OBRIGATORIOS = ['cnh', 'crlv', 'bo', 'foto_dano'];
const DOCUMENTOS_OPCIONAIS = ['video', 'orcamento_1', 'orcamento_2', 'orcamento_3'];

export function TerceiroDocumentos({ token, documentos, onRefresh }: Props) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentTipo, setCurrentTipo] = useState<string>('');

  const getDocByTipo = (tipo: string) => documentos.filter(d => d.tipo === tipo);

  const handleUpload = async (tipo: string, file: File) => {
    setUploading(tipo);
    try {
      const formData = new FormData();
      formData.append('token', token);
      formData.append('tipo', tipo);
      formData.append('arquivo', file);

      const { data, error } = await supabase.functions.invoke('upload-documento-terceiro', {
        body: formData,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao enviar');

      toast.success('Documento enviado!');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar documento');
    } finally {
      setUploading(null);
    }
  };

  const handleConfirmar = async () => {
    setConfirmando(true);
    try {
      const { data, error } = await supabase.functions.invoke('salvar-etapa-terceiro', {
        body: { token, acao: 'confirmar_documentos', dados: {} },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error);
      toast.success('Documentos confirmados!');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao confirmar');
    } finally {
      setConfirmando(false);
    }
  };

  const enviados = DOCUMENTOS_OBRIGATORIOS.filter(tipo => {
    const docs = getDocByTipo(tipo);
    return docs.some(d => d.status !== 'rejeitado');
  }).length;

  const todosEnviados = enviados === DOCUMENTOS_OBRIGATORIOS.length;

  const triggerUpload = (tipo: string) => {
    setCurrentTipo(tipo);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentTipo) {
      handleUpload(currentTipo, file);
    }
    e.target.value = '';
  };

  const renderDocItem = (tipo: string, obrigatorio: boolean) => {
    const docs = getDocByTipo(tipo);
    const label = TIPO_DOCUMENTO_LABELS[tipo as keyof typeof TIPO_DOCUMENTO_LABELS] || tipo;
    const ultimoDoc = docs[docs.length - 1];
    const rejeitado = ultimoDoc?.status === 'rejeitado';
    const enviado = ultimoDoc && ultimoDoc.status !== 'rejeitado';

    return (
      <div key={tipo} className="border rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{label}</span>
            {obrigatorio && <Badge variant="outline" className="text-xs">Obrigatório</Badge>}
          </div>
          {enviado && (
            <Badge className="bg-green-100 text-green-800 text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              Enviado
            </Badge>
          )}
          {rejeitado && (
            <Badge className="bg-red-100 text-red-800 text-xs">
              <XCircle className="h-3 w-3 mr-1" />
              Rejeitado
            </Badge>
          )}
          {!ultimoDoc && (
            <Badge className="bg-yellow-100 text-yellow-800 text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Pendente
            </Badge>
          )}
        </div>

        {rejeitado && ultimoDoc.motivo_rejeicao && (
          <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
            Motivo: {ultimoDoc.motivo_rejeicao}
          </p>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => triggerUpload(tipo)}
          disabled={uploading === tipo}
        >
          {uploading === tipo ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-1" />
          )}
          {rejeitado ? 'Reenviar' : enviado ? 'Substituir' : 'Enviar'}
        </Button>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          📄 Envio de Documentos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Envie os documentos abaixo para dar andamento ao processo.
        </p>

        <Progress value={(enviados / DOCUMENTOS_OBRIGATORIOS.length) * 100} className="h-2" />
        <p className="text-xs text-muted-foreground text-center">
          {enviados} de {DOCUMENTOS_OBRIGATORIOS.length} documentos obrigatórios enviados
        </p>

        <div className="space-y-3">
          {DOCUMENTOS_OBRIGATORIOS.map(tipo => renderDocItem(tipo, true))}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Opcionais</p>
          {DOCUMENTOS_OPCIONAIS.map(tipo => renderDocItem(tipo, false))}
        </div>

        <Button
          className="w-full"
          disabled={!todosEnviados || confirmando}
          onClick={handleConfirmar}
        >
          {confirmando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
          Confirmar envio de documentos
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,application/pdf,video/*"
          onChange={handleFileChange}
        />
      </CardContent>
    </Card>
  );
}
