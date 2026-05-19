import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface NomeCanonicoResult {
  nome: string;
  fonte: 'associado_local' | 'sga';
}

function onlyDigits(s: string | null | undefined): string {
  return (s || '').replace(/\D/g, '');
}

function validarCpf(cpf: string): boolean {
  const c = onlyDigits(cpf);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(c[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(c[10]);
}

/**
 * Busca o nome canônico do associado pelo CPF (local + SGA via edge function).
 * Usado para sugerir correção quando o OCR da CNH retorna nome com erro
 * tipográfico (ex.: "LOPWS" em vez de "LOPES") e o CPF já existe no cadastro.
 *
 * Funciona em contexto autenticado e público — a edge function é
 * `verify_jwt=false` e usa service role internamente.
 */
export function useNomeCanonicoPorCpf(cpf: string | null | undefined) {
  const cpf11 = onlyDigits(cpf || '');
  const enabled = cpf11.length === 11 && validarCpf(cpf11);

  return useQuery<NomeCanonicoResult | null>({
    queryKey: ['nome-canonico-cpf', cpf11],
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          'consultar-nome-por-cpf',
          { body: { cpf: cpf11 } },
        );
        if (error) {
          console.warn('[useNomeCanonicoPorCpf] erro:', error);
          return null;
        }
        if (data?.encontrado && data?.nome) {
          return { nome: String(data.nome), fonte: data.fonte };
        }
        return null;
      } catch (e) {
        console.warn('[useNomeCanonicoPorCpf] exceção:', e);
        return null;
      }
    },
  });
}
