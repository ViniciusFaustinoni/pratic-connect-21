// Edge function: importa um chunk de cobranças do CSV, fazendo vínculo automático
// com associados (matricula → codigo_hinova → cpf) e veiculos (placa).
// Idempotente por (lote_id, matricula, linha_digitavel|valor|vencimento).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface BoletoIn {
  placa?: string;
  vencimento?: string; // dd/mm/aaaa
  linha_digitavel?: string;
  valor?: number;
  tipo?: string;
  status_origem?: string;
  link?: string;
}
interface DestinatarioIn {
  nome: string;
  matricula: string;
  cpf?: string;
  telefones_validos?: string[];
  boletos: BoletoIn[];
}
interface Body {
  destinatarios: DestinatarioIn[];
  lote_id?: string | null;
  is_first_chunk?: boolean;
  is_last_chunk?: boolean;
  nome_arquivo?: string;
  total_remessa_destinatarios?: number;
  total_remessa_boletos?: number;
  total_remessa_valor?: number;
}

function parseDataBR(s?: string): string | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const body: Body = await req.json();
    if (!Array.isArray(body.destinatarios)) {
      return new Response(JSON.stringify({ error: 'destinatarios inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let loteId = body.lote_id ?? null;
    if (body.is_first_chunk || !loteId) {
      const { data: lote, error: lerr } = await supabase
        .from('cobranca_csv_lotes')
        .insert({
          nome_arquivo: body.nome_arquivo || 'cobranca.csv',
          total_boletos: body.total_remessa_boletos ?? 0,
          total_associados: body.total_remessa_destinatarios ?? 0,
          valor_total: body.total_remessa_valor ?? 0,
          status: 'processando',
        })
        .select('id')
        .single();
      if (lerr) throw lerr;
      loteId = lote.id;
    }

    // Coleta chaves para resolver em batch.
    const matriculas = new Set<string>();
    const cpfs = new Set<string>();
    const placas = new Set<string>();
    for (const d of body.destinatarios) {
      if (d.matricula) matriculas.add(d.matricula.trim());
      if (d.cpf) cpfs.add(d.cpf.replace(/\D/g, ''));
      for (const b of d.boletos || []) {
        const p = (b.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (p) placas.add(p);
      }
    }

    // Lookup associados por codigo_hinova OU cpf.
    const assocByMatricula = new Map<string, string>();
    const assocByCpf = new Map<string, string>();
    if (matriculas.size) {
      const { data } = await supabase
        .from('associados').select('id, codigo_hinova')
        .in('codigo_hinova', Array.from(matriculas));
      for (const r of data || []) if (r.codigo_hinova) assocByMatricula.set(String(r.codigo_hinova), r.id);
    }
    if (cpfs.size) {
      const { data } = await supabase
        .from('associados').select('id, cpf')
        .in('cpf', Array.from(cpfs));
      for (const r of data || []) if (r.cpf) assocByCpf.set(r.cpf.replace(/\D/g, ''), r.id);
    }

    // Lookup veículos por placa.
    const veicByPlaca = new Map<string, { id: string; associado_id: string | null }>();
    if (placas.size) {
      const { data } = await supabase
        .from('veiculos').select('id, placa, associado_id')
        .in('placa', Array.from(placas));
      for (const r of data || []) if (r.placa) veicByPlaca.set(r.placa.toUpperCase(), { id: r.id, associado_id: r.associado_id });
    }

    // Monta linhas para upsert.
    const rows: any[] = [];
    let matchedAssoc = 0, matchedVeic = 0, semMatch = 0, valorTotal = 0, ignoradosSemLinha = 0;

    for (const d of body.destinatarios) {
      const matricula = (d.matricula || '').trim();
      const cpfDigits = (d.cpf || '').replace(/\D/g, '');
      let assocId: string | null = null;
      let origem: string = 'sem_match';
      if (matricula && assocByMatricula.has(matricula)) {
        assocId = assocByMatricula.get(matricula)!;
        origem = 'codigo_hinova';
      } else if (cpfDigits && assocByCpf.has(cpfDigits)) {
        assocId = assocByCpf.get(cpfDigits)!;
        origem = 'cpf';
      }

      for (const b of d.boletos || []) {
        const linhaDigitavel = (b.linha_digitavel || '').replace(/\D/g, '');
        if (!linhaDigitavel) {
          ignoradosSemLinha++;
          continue;
        }

        const placaNorm = (b.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const veic = placaNorm ? veicByPlaca.get(placaNorm) : null;
        let veicId: string | null = veic?.id || null;
        let rowOrigem = origem;
        if (!assocId && veic?.associado_id) {
          assocId = veic.associado_id;
          rowOrigem = 'placa';
        }
        if (assocId) matchedAssoc++; else semMatch++;
        if (veicId) matchedVeic++;
        valorTotal += Number(b.valor || 0);
        rows.push({
          lote_id: loteId,
          matricula,
          nome: d.nome,
          cpf: cpfDigits || null,
          placa: placaNorm || null,
          vencimento: b.vencimento || null,
          data_vencimento: parseDataBR(b.vencimento),
          linha_digitavel: linhaDigitavel,
          valor: Number(b.valor || 0),
          tipo: b.tipo || 'mensalidade',
          status_origem: b.status_origem || null,
          status: 'pendente_envio',
          telefones: d.telefones_validos || [],
          associado_id: assocId,
          veiculo_id: veicId,
          match_origem: rowOrigem,
          link_fatura: b.link || null,
        });
      }
    }

    // Dedup intra-chunk por linha_digitavel (último vence)
    const dedupMap = new Map<string, any>();
    for (const r of rows) dedupMap.set(r.linha_digitavel, r);
    const uniqueRows = Array.from(dedupMap.values());
    const duplicadosIntraChunk = rows.length - uniqueRows.length;

    let gravadosReais = 0;
    let duplicadosBanco = 0;
    if (uniqueRows.length) {
      // upsert com ignoreDuplicates: boletos já existentes são silenciosamente ignorados
      const { data: inserted, error } = await supabase
        .from('cobranca_csv_boletos')
        .upsert(uniqueRows, { onConflict: 'linha_digitavel', ignoreDuplicates: true })
        .select('id');
      if (error) throw error;
      gravadosReais = inserted?.length || 0;
      duplicadosBanco = uniqueRows.length - gravadosReais;
    }
    const duplicadosIgnorados = duplicadosIntraChunk + duplicadosBanco;

    if (body.is_last_chunk && loteId) {
      // Consolida totais reais do lote.
      const { data: agg } = await supabase
        .from('cobranca_csv_boletos')
        .select('id, valor, matricula', { count: 'exact', head: false })
        .eq('lote_id', loteId);
      const totalBoletos = agg?.length || 0;
      const totalValor = (agg || []).reduce((s, r: any) => s + Number(r.valor || 0), 0);
      const totalAssoc = new Set((agg || []).map((r: any) => r.matricula)).size;
      await supabase.from('cobranca_csv_lotes').update({
        status: 'ativo',
        total_boletos: totalBoletos,
        total_associados: totalAssoc,
        valor_total: totalValor,
      }).eq('id', loteId);
    }

    return new Response(JSON.stringify({
      success: true,
      lote_id: loteId,
      gravados: gravadosReais,
      matched_associado: matchedAssoc,
      matched_veiculo: matchedVeic,
      sem_match: semMatch,
      ignorados_sem_linha_digitavel: ignoradosSemLinha,
      duplicados_ignorados: duplicadosIgnorados,
      valor_total_chunk: valorTotal,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
