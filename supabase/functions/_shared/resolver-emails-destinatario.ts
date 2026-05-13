// Resolve a lista de e-mails destinatários para o espelho do template Meta WhatsApp.
// Usa contexto fornecido pelo caller (telefone, referencia_tipo, referencia_id, template_name)
// e regras de papel (associado novo/antigo, técnico, diretor, etc.).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizePhone(raw: string): string {
  return String(raw || '').replace(/\D/g, '').replace(/^55/, '');
}

function valid(emails: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const e of emails) {
    const v = String(e || '').trim().toLowerCase();
    if (v && EMAIL_RX.test(v)) set.add(v);
  }
  return Array.from(set);
}

export interface ResolveParams {
  supabase: SupabaseClient;
  telefone: string;
  template_name: string;
  referencia_tipo?: string;
  referencia_id?: string;
}

export async function resolverEmailsDestinatario(p: ResolveParams): Promise<string[]> {
  const out: string[] = [];
  const tel = normalizePhone(p.telefone);
  const tname = (p.template_name || '').toLowerCase();

  // 1. Por referencia_tipo + referencia_id
  try {
    if (p.referencia_id) {
      switch (p.referencia_tipo) {
        case 'solicitacao_troca_titularidade':
        case 'troca_titularidade': {
          const { data } = await p.supabase
            .from('solicitacoes_troca_titularidade')
            .select('associado_antigo_id, novo_associado_id')
            .eq('id', p.referencia_id)
            .maybeSingle();
          if (data) {
            const ids = [data.associado_antigo_id, data.novo_associado_id].filter(Boolean);
            if (ids.length) {
              const { data: ass } = await p.supabase.from('associados').select('email').in('id', ids);
              ass?.forEach((a: any) => out.push(a.email));
            }
          }
          break;
        }
        case 'solicitacao_substituicao':
        case 'substituicao_placa': {
          const { data } = await p.supabase
            .from('solicitacoes_substituicao_placa')
            .select('associado_id')
            .eq('id', p.referencia_id)
            .maybeSingle();
          if (data?.associado_id) {
            const { data: ass } = await p.supabase.from('associados').select('email').eq('id', data.associado_id).maybeSingle();
            if (ass?.email) out.push(ass.email);
          }
          break;
        }
        case 'sinistro': {
          const { data } = await p.supabase.from('sinistros').select('associado_id').eq('id', p.referencia_id).maybeSingle();
          if (data?.associado_id) {
            const { data: ass } = await p.supabase.from('associados').select('email').eq('id', data.associado_id).maybeSingle();
            if (ass?.email) out.push(ass.email);
          }
          break;
        }
        case 'instalacao':
        case 'vistoria':
        case 'servico': {
          const tbl = p.referencia_tipo === 'servico' ? 'servicos' : (p.referencia_tipo === 'vistoria' ? 'vistorias' : 'instalacoes');
          const { data } = await p.supabase.from(tbl).select('associado_id').eq('id', p.referencia_id).maybeSingle();
          if ((data as any)?.associado_id) {
            const { data: ass } = await p.supabase.from('associados').select('email').eq('id', (data as any).associado_id).maybeSingle();
            if (ass?.email) out.push(ass.email);
          }
          break;
        }
        case 'cobranca':
        case 'boleto': {
          const { data } = await p.supabase.from('cobrancas').select('associado_id').eq('id', p.referencia_id).maybeSingle();
          if (data?.associado_id) {
            const { data: ass } = await p.supabase.from('associados').select('email').eq('id', data.associado_id).maybeSingle();
            if (ass?.email) out.push(ass.email);
          }
          break;
        }
        case 'cotacao': {
          const { data } = await p.supabase.from('cotacoes').select('email_solicitante, vendedor_id').eq('id', p.referencia_id).maybeSingle();
          if (data?.email_solicitante) out.push(data.email_solicitante);
          if (data?.vendedor_id) {
            const { data: prof } = await p.supabase.from('profiles').select('email').eq('user_id', data.vendedor_id).maybeSingle();
            if (prof?.email) out.push(prof.email);
          }
          break;
        }
      }
    }
  } catch (e) {
    console.warn('[resolverEmails] erro referencia:', (e as Error).message);
  }

  // 2. Heurística por nome de template — diretoria
  if (/diretoria|diretor/i.test(tname)) {
    try {
      const { data: roles } = await p.supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin_master', 'diretor', 'desenvolvedor']);
      const userIds = (roles || []).map((r: any) => r.user_id).filter(Boolean);
      if (userIds.length) {
        const { data: profs } = await p.supabase.from('profiles').select('email').in('user_id', userIds);
        profs?.forEach((p: any) => p.email && out.push(p.email));
      }
    } catch (e) {
      console.warn('[resolverEmails] erro diretoria:', (e as Error).message);
    }
  }

  // 3. Fallback: por telefone → associados (telefone OU whatsapp)
  if (out.length === 0 && tel) {
    try {
      const { data } = await p.supabase
        .from('associados')
        .select('email, telefone, whatsapp')
        .or(`telefone.ilike.%${tel}%,whatsapp.ilike.%${tel}%`)
        .limit(3);
      data?.forEach((a: any) => a.email && out.push(a.email));
    } catch (e) {
      console.warn('[resolverEmails] erro associados telefone:', (e as Error).message);
    }
  }

  // 4. Fallback: profiles por telefone (campo opcional)
  if (out.length === 0 && tel) {
    try {
      const { data } = await p.supabase
        .from('profiles')
        .select('email, telefone')
        .ilike('telefone', `%${tel}%`)
        .limit(3);
      data?.forEach((pr: any) => pr.email && out.push(pr.email));
    } catch (_) {
      // profiles pode não ter coluna telefone — tudo bem
    }
  }

  return valid(out);
}
