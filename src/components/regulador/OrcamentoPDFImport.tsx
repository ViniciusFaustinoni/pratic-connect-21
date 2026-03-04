import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, FileUp, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PecaExtraida {
  descricao: string;
  operacao?: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  origem?: string;
}

export interface ServicoExtraido {
  descricao: string;
  horas?: number;
  valor_unitario?: number;
  valor_total: number;
  tipo_servico?: string;
}

export interface ResumoExtraido {
  total_pecas: number;
  total_mao_obra: number;
  total_geral: number;
}

export interface DadosExtraidos {
  pecas: PecaExtraida[];
  servicos: ServicoExtraido[];
  resumo: ResumoExtraido;
}

interface OrcamentoPDFImportProps {
  onDadosExtraidos: (dados: DadosExtraidos) => void;
  disabled?: boolean;
}

export function OrcamentoPDFImport({ onDadosExtraidos, disabled }: OrcamentoPDFImportProps) {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [imported, setImported] = useState(false);

  const handleDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Apenas arquivos PDF são aceitos');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx. 20MB)');
      return;
    }

    setImporting(true);
    setProgress('Enviando PDF...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');

      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `orcamentos-pdf/${timestamp}-${safeName}`;
      const { error: uploadErr } = await supabase.storage
        .from('documentos')
        .upload(path, file, { contentType: 'application/pdf' });
      if (uploadErr) throw new Error(`Erro no upload: ${uploadErr.message}`);

      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path);
      const pdfUrl = urlData.publicUrl;

      setProgress('Extraindo itens com IA...');

      const res = await fetch(
        `https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/extract-orcamento-pdf`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ pdfUrl }),
        }
      );

      if (res.status === 429) {
        toast.error('Limite de requisições excedido. Tente novamente em alguns segundos.');
        return;
      }
      if (res.status === 402) {
        toast.error('Créditos de IA insuficientes.');
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao extrair dados do PDF');
      }

      const extracted: DadosExtraidos = await res.json();

      if (!extracted.pecas?.length && !extracted.servicos?.length) {
        toast.warning('Nenhum item encontrado no PDF. Verifique o documento.');
        return;
      }

      setImported(true);
      onDadosExtraidos(extracted);
      const total = (extracted.pecas?.length || 0) + (extracted.servicos?.length || 0);
      toast.success(`${total} itens extraídos do PDF com sucesso!`);
    } catch (err: any) {
      console.error('PDF import error:', err);
      toast.error(err.message || 'Erro ao importar PDF');
    } finally {
      setImporting(false);
      setProgress('');
    }
  }, [onDadosExtraidos]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: disabled || importing,
  });

  if (importing) {
    return (
      <div className="rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-6 text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-sm font-medium text-foreground">{progress}</p>
        <Progress value={progress.includes('Extraindo') ? 66 : 33} className="h-1.5" />
        <p className="text-[10px] text-muted-foreground">Isso pode levar alguns segundos...</p>
      </div>
    );
  }

  if (imported) {
    return (
      <div className="rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/30 p-3 flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-medium text-green-800 dark:text-green-300">PDF importado com sucesso!</p>
          <p className="text-[10px] text-green-700 dark:text-green-400">Revise e ajuste os itens abaixo se necessário.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-[10px] h-7"
          {...getRootProps()}
        >
          <input {...getInputProps()} />
          Reimportar
        </Button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
        isDragActive
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50'
      }`}
    >
      <input {...getInputProps()} />
      <FileUp className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
      <p className="text-sm font-medium text-foreground">
        {isDragActive ? 'Solte o PDF aqui' : 'Arraste o PDF do orçamento aqui'}
      </p>
      <p className="text-[10px] text-muted-foreground mt-1">
        ou clique para selecionar • A IA extrairá peças, serviços e valores automaticamente
      </p>
    </div>
  );
}
