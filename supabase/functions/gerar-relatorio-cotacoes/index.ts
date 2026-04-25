// Edge function: gerar-relatorio-cotacoes
// Gera um Excel multi-aba com cotações filtradas. Restrito a diretores.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ReqFilters {
  dataInicio?: string | null; // ISO yyyy-mm-dd
  dataFim?: string | null;
  ufs?: string[];
  cidades?: string[]; // já normalizadas
  situacao?: 'todas' | 'em_andamento' | 'finalizadas';
  etapas?: string[]; // chaves do funil
  vendedorIds?: string[];
  planoIds?: string[];
  statusSga?: Array<'nao_enviado' | 'pendente' | 'sincronizando' | 'ativado' | 'erro'>;
  apenasContagem?: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  enviada: 'Link Enviado',
  visualizada: 'Visualizada',
  aceita: 'Fechada',
  recusada: 'Recusada',
  expirada: 'Expirada',
};

const ETAPA_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  enviada: 'Link Enviado',
  escolhendo_plano: 'Escolhendo Plano',
  enviando_documentos: 'Enviando Docs',
  em_analise: 'Em Análise',
  assinando_contrato: 'Assinando Contrato',
  pagando_taxa: 'Pagando Taxa',
  agendando_vistoria: 'Agendando Vistoria',
  concluido: 'Fechado',
  perdida: 'Recusada/Expirada',
};

function normalizarCidade(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .trim();
}

function capitalizar(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function etapaDaCotacao(c: any): string {
  const sc = c.status_contratacao || '';
  const st = c.status;
  if (st === 'aceita' || sc === 'concluido') return 'concluido';
  if (['recusada', 'expirada'].includes(st)) return 'perdida';
  if (sc === 'pagando_taxa') return 'pagando_taxa';
  if (sc === 'assinando_contrato') return 'assinando_contrato';
  if (sc === 'em_analise') return 'em_analise';
  if (sc === 'agendando_vistoria') return 'agendando_vistoria';
  if (['enviando_documentos', 'dados_preenchidos'].includes(sc)) return 'enviando_documentos';
  if (['escolhendo_plano', 'plano_escolhido'].includes(sc)) return 'escolhendo_plano';
  if (st === 'enviada' || st === 'visualizada') return 'enviada';
  return 'rascunho';
}

function statusSgaDoVeiculo(v: any): { key: string; label: string } {
  if (!v) return { key: 'nao_enviado', label: 'Não enviado' };
  if (v.sincronizado_hinova) return { key: 'ativado', label: 'Ativado no SGA' };
  if (v.status_sga === 'erro_sincronizacao') return { key: 'erro', label: 'Erro' };
  if (v.status_sga === 'sincronizando') return { key: 'sincronizando', label: 'Sincronizando' };
  if (v.status_sga === 'pendente' || v.status_sga === 'pendente_sga')
    return { key: 'pendente', label: 'Pendente' };
  return { key: 'nao_enviado', label: 'Não enviado' };
}

function formatBRL(n: number | null | undefined): string {
  if (n == null) return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n));
}

function formatDateTimeBR(s: string | null | undefined): string {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Cliente do usuário para autenticar e obter user.id
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cliente service role p/ bypass de RLS após autorização
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verifica se é diretor
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'diretor')
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const filters: ReqFilters = await req.json().catch(() => ({}));

    // Monta query base de cotações
    let q = supabase
      .from('cotacoes')
      .select(
        `id, numero, created_at, updated_at, status, status_contratacao,
         vendedor_id, plano_id, plano_escolhido_id, token_publico,
         nome_solicitante, telefone1_solicitante, email_solicitante, cpf_cnpj_solicitante,
         cliente_cidade, cliente_uf,
         veiculo_marca, veiculo_modelo, veiculo_ano, veiculo_placa, veiculo_categoria,
         valor_fipe, valor_adesao,
         leads:leads!fk_cotacoes_lead_id(id, nome, telefone, email),
         contrato:contratos!contratos_cotacao_id_fkey(
            id, numero, status,
            associados:associados!fk_contratos_associado(id, status)
         )`
      )
      .order('created_at', { ascending: false })
      .limit(20000);

    if (filters.dataInicio) q = q.gte('created_at', `${filters.dataInicio}T00:00:00`);
    if (filters.dataFim) q = q.lte('created_at', `${filters.dataFim}T23:59:59`);
    if (filters.ufs && filters.ufs.length > 0) q = q.in('cliente_uf', filters.ufs);
    if (filters.vendedorIds && filters.vendedorIds.length > 0)
      q = q.in('vendedor_id', filters.vendedorIds);

    const { data: rawCotacoes, error: cErr } = await q;
    if (cErr) throw cErr;

    let cotacoes = (rawCotacoes || []) as any[];

    // Filtros pós-query (envolvem cálculo)
    if (filters.cidades && filters.cidades.length > 0) {
      const set = new Set(filters.cidades.map(normalizarCidade));
      cotacoes = cotacoes.filter((c) => set.has(normalizarCidade(c.cliente_cidade)));
    }

    if (filters.situacao && filters.situacao !== 'todas') {
      cotacoes = cotacoes.filter((c) => {
        const finalizada =
          ['aceita', 'recusada', 'expirada'].includes(c.status) ||
          c.status_contratacao === 'concluido';
        return filters.situacao === 'finalizadas' ? finalizada : !finalizada;
      });
    }

    if (filters.etapas && filters.etapas.length > 0) {
      const set = new Set(filters.etapas);
      cotacoes = cotacoes.filter((c) => set.has(etapaDaCotacao(c)));
    }

    if (filters.planoIds && filters.planoIds.length > 0) {
      const set = new Set(filters.planoIds);
      cotacoes = cotacoes.filter((c) =>
        set.has(c.plano_escolhido_id || c.plano_id || '')
      );
    }

    // Buscar veículos de associados (status SGA) — apenas para fechadas
    const associadoIds = Array.from(
      new Set(
        cotacoes
          .map((c) => {
            const contrato = Array.isArray(c.contrato) ? c.contrato[0] : c.contrato;
            return contrato?.associados?.id;
          })
          .filter(Boolean)
      )
    ) as string[];

    const veiculoPorAssociado = new Map<string, any>();
    if (associadoIds.length > 0) {
      // Trazer veículos em chunks de 200
      for (let i = 0; i < associadoIds.length; i += 200) {
        const chunk = associadoIds.slice(i, i + 200);
        const { data: vs } = await supabase
          .from('veiculos')
          .select('id, associado_id, placa, sincronizado_hinova, sincronizado_hinova_em, status_sga, codigo_hinova')
          .in('associado_id', chunk);
        (vs || []).forEach((v: any) => {
          // Pega o primeiro veículo encontrado por associado (ou o sincronizado, preferencialmente)
          const existing = veiculoPorAssociado.get(v.associado_id);
          if (!existing || (v.sincronizado_hinova && !existing.sincronizado_hinova)) {
            veiculoPorAssociado.set(v.associado_id, v);
          }
        });
      }
    }

    // Anexa status SGA em cada cotação
    cotacoes = cotacoes.map((c) => {
      const contrato = Array.isArray(c.contrato) ? c.contrato[0] : c.contrato;
      const assocId = contrato?.associados?.id;
      const veiculo = assocId ? veiculoPorAssociado.get(assocId) : null;
      const sga = statusSgaDoVeiculo(veiculo);
      return {
        ...c,
        _contrato: contrato,
        _veiculoSga: veiculo,
        _sga: sga,
      };
    });

    if (filters.statusSga && filters.statusSga.length > 0) {
      const set = new Set(filters.statusSga);
      cotacoes = cotacoes.filter((c) => set.has(c._sga.key as any));
    }

    // Modo "apenas contagem" para preview no modal
    if (filters.apenasContagem) {
      return new Response(
        JSON.stringify({
          total: cotacoes.length,
          fechadas: cotacoes.filter(
            (c) => c.status === 'aceita' || c.status_contratacao === 'concluido'
          ).length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar nomes de vendedores e planos
    const vendedorIds = Array.from(new Set(cotacoes.map((c) => c.vendedor_id).filter(Boolean)));
    const planoIds = Array.from(
      new Set(
        cotacoes
          .map((c) => c.plano_escolhido_id || c.plano_id)
          .filter(Boolean) as string[]
      )
    );

    const vendedorMap = new Map<string, string>();
    if (vendedorIds.length > 0) {
      const { data: vs } = await supabase
        .from('profiles')
        .select('user_id, nome, full_name')
        .in('user_id', vendedorIds);
      (vs || []).forEach((v: any) => vendedorMap.set(v.user_id, v.full_name || v.nome || ''));
    }

    const planoMap = new Map<string, string>();
    if (planoIds.length > 0) {
      const { data: ps } = await supabase.from('planos').select('id, nome').in('id', planoIds);
      (ps || []).forEach((p: any) => planoMap.set(p.id, p.nome));
    }

    // Monta linhas da aba "Cotações"
    const origin =
      req.headers.get('origin') || 'https://app.praticcar.org';
    const cotacoesRows = cotacoes.map((c) => {
      const lead = c.leads || {};
      const cliente = lead.nome || c.nome_solicitante || '';
      const telefone = lead.telefone || c.telefone1_solicitante || '';
      const email = lead.email || c.email_solicitante || '';
      const planoNome =
        planoMap.get(c.plano_escolhido_id || '') || planoMap.get(c.plano_id || '') || '';
      const link = c.token_publico ? `${origin}/cotacao/${c.token_publico}` : '';
      const etapa = etapaDaCotacao(c);
      const cidade = c.cliente_cidade ? capitalizar(c.cliente_cidade) : '';
      const finalizada =
        ['aceita', 'recusada', 'expirada'].includes(c.status) ||
        c.status_contratacao === 'concluido';

      return {
        Número: c.numero,
        'Data Criação': formatDateTimeBR(c.created_at),
        'Última Atualização': formatDateTimeBR(c.updated_at),
        Cliente: cliente,
        'CPF/CNPJ': c.cpf_cnpj_solicitante || '',
        Telefone: telefone,
        Email: email,
        Cidade: cidade,
        UF: c.cliente_uf || '',
        Marca: c.veiculo_marca || '',
        Modelo: c.veiculo_modelo || '',
        Ano: c.veiculo_ano || '',
        Placa: c.veiculo_placa || '',
        Categoria: c.veiculo_categoria || '',
        FIPE: c.valor_fipe ? Number(c.valor_fipe) : null,
        'FIPE Formatada': formatBRL(c.valor_fipe),
        'Plano Escolhido': planoNome,
        Status: STATUS_LABEL[c.status] || c.status,
        'Etapa do Funil': ETAPA_LABEL[etapa] || etapa,
        Situação: finalizada ? 'Finalizada' : 'Em andamento',
        Consultor: vendedorMap.get(c.vendedor_id || '') || '',
        'Status SGA': c._sga.label,
        'SGA Sincronizado em': formatDateTimeBR(c._veiculoSga?.sincronizado_hinova_em),
        'Código Hinova': c._veiculoSga?.codigo_hinova || '',
        'Link Público': link,
      };
    });

    // Agregações
    const porStatus = new Map<string, { qtd: number; fipeTotal: number }>();
    const porRegiao = new Map<
      string,
      { uf: string; cidade: string; qtd: number; fechadas: number; fipeTotal: number }
    >();
    const porConsultor = new Map<
      string,
      { qtd: number; fechadas: number; fipeTotal: number }
    >();

    cotacoes.forEach((c) => {
      const etapa = etapaDaCotacao(c);
      const label = ETAPA_LABEL[etapa] || etapa;
      const fipe = Number(c.valor_fipe || 0);
      const finalizada =
        c.status === 'aceita' || c.status_contratacao === 'concluido';

      const ps = porStatus.get(label) || { qtd: 0, fipeTotal: 0 };
      ps.qtd += 1;
      ps.fipeTotal += fipe;
      porStatus.set(label, ps);

      const uf = c.cliente_uf || 'N/D';
      const cidNorm = normalizarCidade(c.cliente_cidade) || 'N/D';
      const key = `${uf}|${cidNorm}`;
      const pr =
        porRegiao.get(key) || { uf, cidade: capitalizar(cidNorm), qtd: 0, fechadas: 0, fipeTotal: 0 };
      pr.qtd += 1;
      if (finalizada) pr.fechadas += 1;
      pr.fipeTotal += fipe;
      porRegiao.set(key, pr);

      const consNome = vendedorMap.get(c.vendedor_id || '') || 'Sem consultor';
      const pc = porConsultor.get(consNome) || { qtd: 0, fechadas: 0, fipeTotal: 0 };
      pc.qtd += 1;
      if (finalizada) pc.fechadas += 1;
      pc.fipeTotal += fipe;
      porConsultor.set(consNome, pc);
    });

    const totalGeral = cotacoes.length;
    const totalFechadas = cotacoes.filter(
      (c) => c.status === 'aceita' || c.status_contratacao === 'concluido'
    ).length;
    const ticketMedio =
      totalGeral > 0
        ? cotacoes.reduce((s, c) => s + Number(c.valor_fipe || 0), 0) / totalGeral
        : 0;

    // ===== Monta XLSX =====
    const wb = XLSX.utils.book_new();

    // Aba 1: Resumo
    const resumoRows: any[][] = [
      ['Relatório Inteligente de Cotações'],
      [],
      ['Gerado em', formatDateTimeBR(new Date().toISOString())],
      ['Período', `${filters.dataInicio || '—'} a ${filters.dataFim || '—'}`],
      ['Situação', filters.situacao || 'todas'],
      ['UFs', (filters.ufs || []).join(', ') || 'Todas'],
      ['Cidades', (filters.cidades || []).join(', ') || 'Todas'],
      [],
      ['Total de cotações', totalGeral],
      ['Cotações fechadas', totalFechadas],
      ['Taxa de conversão', totalGeral ? `${((totalFechadas / totalGeral) * 100).toFixed(1)}%` : '0%'],
      ['Ticket médio (FIPE)', formatBRL(ticketMedio)],
      [],
      ['Por Consultor'],
      ['Consultor', 'Cotações', 'Fechadas', 'Conversão', 'FIPE Total'],
    ];
    Array.from(porConsultor.entries())
      .sort((a, b) => b[1].qtd - a[1].qtd)
      .forEach(([nome, v]) => {
        resumoRows.push([
          nome,
          v.qtd,
          v.fechadas,
          v.qtd ? `${((v.fechadas / v.qtd) * 100).toFixed(1)}%` : '0%',
          formatBRL(v.fipeTotal),
        ]);
      });
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoRows);
    wsResumo['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

    // Aba 2: Cotações
    const wsCot = XLSX.utils.json_to_sheet(cotacoesRows);
    wsCot['!cols'] = Object.keys(cotacoesRows[0] || {}).map((k) => ({
      wch: Math.min(Math.max(k.length + 2, 12), 40),
    }));
    XLSX.utils.book_append_sheet(wb, wsCot, 'Cotações');

    // Aba 3: Por Status
    const statusRows = [
      ['Etapa', 'Quantidade', 'FIPE Total'],
      ...Array.from(porStatus.entries())
        .sort((a, b) => b[1].qtd - a[1].qtd)
        .map(([label, v]) => [label, v.qtd, formatBRL(v.fipeTotal)]),
    ];
    const wsStatus = XLSX.utils.aoa_to_sheet(statusRows);
    wsStatus['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsStatus, 'Por Status');

    // Aba 4: Por Região
    const regiaoRows = [
      ['UF', 'Cidade', 'Cotações', 'Fechadas', 'Conversão', 'Ticket Médio (FIPE)'],
      ...Array.from(porRegiao.values())
        .sort((a, b) => b.qtd - a.qtd)
        .map((v) => [
          v.uf,
          v.cidade,
          v.qtd,
          v.fechadas,
          v.qtd ? `${((v.fechadas / v.qtd) * 100).toFixed(1)}%` : '0%',
          formatBRL(v.qtd ? v.fipeTotal / v.qtd : 0),
        ]),
    ];
    const wsRegiao = XLSX.utils.aoa_to_sheet(regiaoRows);
    wsRegiao['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, wsRegiao, 'Por Região');

    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const bytes = new Uint8Array(buf);
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const base64 = btoa(bin);

    return new Response(
      JSON.stringify({
        ok: true,
        total: totalGeral,
        filename: `cotacoes_relatorio_${new Date().toISOString().slice(0, 10)}.xlsx`,
        base64,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[gerar-relatorio-cotacoes] erro', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
