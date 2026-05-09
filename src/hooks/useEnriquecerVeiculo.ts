import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface VeiculoMin {
  id: string;
  placa?: string | null;
  marca?: string | null;
  modelo?: string | null;
  ano_modelo?: number | null;
  ano_fabricacao?: number | null;
  cor?: string | null;
  combustivel?: string | null;
  valor_fipe?: number | null;
  codigo_fipe?: string | null;
}

/**
 * Hook compartilhado: dispara plate-lookup + fipe-lookup e atualiza
 * apenas os campos vazios de `veiculos`. Usado nos modais de
 * Cadastro › Veículos e Cadastro › Processos (Troca de Titularidade).
 */
export function useEnriquecerVeiculo() {
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const precisaEnriquecer = (v: Partial<VeiculoMin> | null | undefined) => {
    if (!v) return false;
    return (
      !v.cor || !v.combustivel ||
      !v.valor_fipe || Number(v.valor_fipe) <= 0 || !v.codigo_fipe ||
      !v.ano_modelo || !v.ano_fabricacao
    );
  };

  const enriquecer = async (veiculo: VeiculoMin): Promise<boolean> => {
    if (!veiculo?.id) return false;
    setLoading(true);
    try {
      const placaUp = String(veiculo.placa || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

      // tipo p/ fipe-lookup
      let tipo: 'carros' | 'motos' | 'caminhoes' = 'carros';
      if (veiculo.marca && veiculo.modelo) {
        const { data: mm } = await (supabase as any)
          .from('marcas_modelos')
          .select('tipo_veiculo')
          .ilike('marca', String(veiculo.marca))
          .ilike('modelo', String(veiculo.modelo))
          .limit(1)
          .maybeSingle();
        const tv = String(mm?.tipo_veiculo || '').toLowerCase();
        if (tv.includes('moto')) tipo = 'motos';
        else if (tv.includes('caminh')) tipo = 'caminhoes';
      }

      const ano = String(veiculo.ano_modelo || veiculo.ano_fabricacao || '');

      const [plateRes, fipeRes] = await Promise.all([
        placaUp
          ? supabase.functions.invoke('plate-lookup', { body: { placa: placaUp } }).catch(() => null)
          : Promise.resolve(null),
        veiculo.marca && veiculo.modelo
          ? supabase.functions.invoke('fipe-lookup', {
              body: { action: 'buscar-por-nome', tipo, marca: veiculo.marca, modelo: veiculo.modelo, ano: ano || undefined },
            }).catch(() => null)
          : Promise.resolve(null),
      ]);

      const updates: Record<string, any> = {};

      const plateData: any = (plateRes as any)?.data;
      if (plateData?.success) {
        const vd = plateData.vehicleData || {};
        const fd = plateData.fipeData;
        if (!veiculo.cor && vd.cor) updates.cor = String(vd.cor).trim();
        if (!veiculo.combustivel && vd.combustivel) updates.combustivel = String(vd.combustivel).trim();
        if (!veiculo.ano_modelo && vd.ano_modelo) updates.ano_modelo = Number(vd.ano_modelo) || null;
        if (!veiculo.ano_fabricacao && vd.ano_fabricacao) updates.ano_fabricacao = Number(vd.ano_fabricacao) || null;
        if (fd && (!veiculo.valor_fipe || Number(veiculo.valor_fipe) <= 0)) {
          const valorNum = Number(String(fd.valor || '').replace(/[^\d,]/g, '').replace(',', '.'));
          if (valorNum > 0) updates.valor_fipe = valorNum;
          if (!veiculo.codigo_fipe && fd.codigo) updates.codigo_fipe = fd.codigo;
        }
      }

      const fipeData: any = (fipeRes as any)?.data;
      if (fipeData?.success && fipeData?.found) {
        const valor = Number(fipeData.data?.valorNumerico) || 0;
        const codigo = fipeData.data?.codigoFipe || null;
        const valorFipeAtual = updates.valor_fipe ?? veiculo.valor_fipe;
        if (valor > 0 && (!valorFipeAtual || Number(valorFipeAtual) <= 0)) {
          updates.valor_fipe = valor;
        }
        if (codigo && !(updates.codigo_fipe || veiculo.codigo_fipe)) {
          updates.codigo_fipe = codigo;
        }
      }

      if (Object.keys(updates).length === 0) {
        toast.info('Nada a atualizar — dados já estão preenchidos ou consultas externas não retornaram informações.');
        return false;
      }

      const { error } = await (supabase as any).from('veiculos').update(updates).eq('id', veiculo.id);
      if (error) throw error;

      toast.success(`Veículo atualizado: ${Object.keys(updates).join(', ')}`);
      qc.invalidateQueries({ queryKey: ['veiculo-completo'] });
      qc.invalidateQueries({ queryKey: ['veiculos'] });
      qc.invalidateQueries({ queryKey: ['solicitacao-troca'] });
      return true;
    } catch (e: any) {
      console.error('[useEnriquecerVeiculo] erro:', e);
      toast.error(`Falha ao atualizar dados: ${e?.message || 'erro desconhecido'}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { enriquecer, loading, precisaEnriquecer };
}
