import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface RelatorioFilters {
  dataInicio?: string | null;
  dataFim?: string | null;
  ufs?: string[];
  cidades?: string[];
  situacao?: 'todas' | 'em_andamento' | 'finalizadas';
  etapas?: string[];
  vendedorIds?: string[];
  planoIds?: string[];
  statusSga?: Array<'nao_enviado' | 'pendente' | 'sincronizando' | 'ativado' | 'erro'>;
}

export function useRelatorioCotacoes() {
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  async function preview(filters: RelatorioFilters): Promise<{ total: number; fechadas: number } | null> {
    setPreviewing(true);
    try {
      const { data, error } = await supabase.functions.invoke('gerar-relatorio-cotacoes', {
        body: { ...filters, apenasContagem: true },
      });
      if (error) throw error;
      return data as { total: number; fechadas: number };
    } catch (e: any) {
      toast.error('Não foi possível obter a prévia', { description: e?.message });
      return null;
    } finally {
      setPreviewing(false);
    }
  }

  async function gerar(filters: RelatorioFilters) {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('gerar-relatorio-cotacoes', {
        body: filters,
      });
      if (error) throw error;
      const payload = data as { ok: boolean; base64: string; filename: string; total: number };
      if (!payload?.ok || !payload.base64) throw new Error('Resposta inválida do servidor');

      // base64 -> blob
      const byteChars = atob(payload.base64);
      const len = byteChars.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = payload.filename || 'cotacoes_relatorio.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success(`Relatório gerado com ${payload.total} cotações`);
    } catch (e: any) {
      toast.error('Falha ao gerar relatório', { description: e?.message });
    } finally {
      setLoading(false);
    }
  }

  return { preview, gerar, loading, previewing };
}
