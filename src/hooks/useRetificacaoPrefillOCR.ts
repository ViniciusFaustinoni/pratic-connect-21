import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type FonteOCR = 'cnh' | 'crlv' | 'comprovante' | 'nf';

export type PrefillCampo =
  | 'nome' | 'rg' | 'data_nascimento'
  | 'cnh_numero' | 'cnh_categoria' | 'cnh_validade'
  | 'cep' | 'logradouro' | 'numero' | 'bairro' | 'cidade' | 'uf'
  | 'placa' | 'renavam' | 'marca' | 'modelo'
  | 'ano_fabricacao' | 'ano_modelo' | 'cor' | 'combustivel';
// NOTA: 'chassi' intencionalmente fora — regra canônica: chassi sempre manual.

export interface PrefillOCR {
  prefill: Partial<Record<PrefillCampo, string | number>>;
  fontes: Partial<Record<PrefillCampo, FonteOCR>>;
}

function pick<T>(...vals: (T | undefined | null | '')[]): T | undefined {
  for (const v of vals) {
    if (v !== undefined && v !== null && v !== ('' as unknown as T)) return v as T;
  }
  return undefined;
}

function normalizeDate(v: any): string | undefined {
  if (!v || typeof v !== 'string') return undefined;
  // dd/mm/yyyy -> yyyy-mm-dd
  const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  // yyyy-mm-dd já ok
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return undefined;
}

export function useRetificacaoPrefillOCR(contratoId?: string) {
  return useQuery<PrefillOCR>({
    queryKey: ['retificacao-prefill-ocr', contratoId],
    enabled: !!contratoId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contratos_documentos')
        .select('tipo, ocr_resultado, created_at')
        .eq('contrato_id', contratoId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const byTipo: Record<string, any> = {};
      for (const row of data ?? []) {
        const t = (row as any).tipo as string;
        const dados = (row as any).ocr_resultado?.dados;
        if (!dados) continue;
        if (!byTipo[t]) byTipo[t] = dados; // mais recente vence (já está ordenado desc)
      }

      const cnh = byTipo['cnh'] ?? {};
      const crlv = byTipo['crlv'] ?? {};
      const comp = byTipo['comprovante_residencia'] ?? {};
      const nf = byTipo['nota_fiscal_veiculo'] ?? {};

      const prefill: PrefillOCR['prefill'] = {};
      const fontes: PrefillOCR['fontes'] = {};

      const set = (campo: PrefillCampo, valor: any, fonte: FonteOCR) => {
        if (valor === undefined || valor === null || valor === '') return;
        if (prefill[campo] !== undefined) return;
        prefill[campo] = valor;
        fontes[campo] = fonte;
      };

      // Associado — CNH
      set('nome', cnh.nome, 'cnh');
      set('rg', cnh.rg, 'cnh');
      set('data_nascimento', normalizeDate(cnh.data_nascimento), 'cnh');
      set('cnh_numero', pick(cnh.numero_registro, cnh.mrz_registro), 'cnh');
      set('cnh_categoria', cnh.categoria, 'cnh');
      set('cnh_validade', normalizeDate(cnh.validade), 'cnh');

      // Endereço — comprovante de residência
      set('cep', comp.cep, 'comprovante');
      set('logradouro', comp.logradouro, 'comprovante');
      set('numero', comp.numero, 'comprovante');
      set('bairro', comp.bairro, 'comprovante');
      set('cidade', comp.cidade, 'comprovante');
      set('uf', comp.uf, 'comprovante');

      // Veículo — CRLV (fallback NF)
      const setVeic = (campo: PrefillCampo, key: string) => {
        if (crlv[key] !== undefined && crlv[key] !== null && crlv[key] !== '') {
          set(campo, crlv[key], 'crlv');
        } else if (nf[key] !== undefined && nf[key] !== null && nf[key] !== '') {
          set(campo, nf[key], 'nf');
        }
      };
      setVeic('placa', 'placa');
      setVeic('renavam', 'renavam');
      setVeic('marca', 'marca');
      setVeic('modelo', 'modelo');
      setVeic('ano_fabricacao', 'ano_fabricacao');
      setVeic('ano_modelo', 'ano_modelo');
      setVeic('cor', 'cor');
      setVeic('combustivel', 'combustivel');
      // chassi: NUNCA

      return { prefill, fontes };
    },
  });
}
