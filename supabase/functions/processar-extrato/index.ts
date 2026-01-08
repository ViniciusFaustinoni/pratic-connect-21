import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProcessarExtratoPayload {
  extrato_id: string;
  arquivo_base64: string;
}

interface LancamentoExtrato {
  data: string;
  descricao: string;
  documento: string;
  credito: number | null;
  debito: number | null;
  saldo: number;
}

// Parser para formato Bradesco
function parseBradescoXLS(base64: string): {
  agencia: string;
  conta: string;
  lancamentos: LancamentoExtrato[];
  saldoInicial: number;
  saldoFinal: number;
  dataInicio: string;
  dataFim: string;
} {
  // Decodificar base64
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Ler workbook
  const workbook = XLSX.read(bytes, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  
  // Extrair agência e conta da linha 5 (índice 5)
  let agencia = '';
  let conta = '';
  for (const row of data) {
    const firstCell = String(row[0] || '');
    if (firstCell.includes('Agência:') && firstCell.includes('Conta:')) {
      const match = firstCell.match(/Agência:\s*(\d+)\s*Conta:\s*(\d+-?\d?)/);
      if (match) {
        agencia = match[1];
        conta = match[2];
      }
      break;
    }
  }
  
  // Encontrar linha de cabeçalho
  let headerIndex = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === 'Data' && String(data[i][1]).includes('Lançamento')) {
      headerIndex = i;
      break;
    }
  }
  
  if (headerIndex === -1) {
    throw new Error('Formato de extrato não reconhecido');
  }
  
  // Processar lançamentos
  const lancamentos: LancamentoExtrato[] = [];
  let saldoInicial = 0;
  let saldoFinal = 0;
  let dataInicio = '';
  let dataFim = '';
  
  for (let i = headerIndex + 1; i < data.length; i++) {
    const row = data[i];
    const dataCell = row[0];
    const descricao = String(row[1] || '').trim();
    
    // Ignorar linhas vazias ou de total
    if (!dataCell || descricao === 'Total' || descricao.includes('Saldos Invest')) {
      continue;
    }
    
    // Converter data
    let dataFormatada = '';
    if (typeof dataCell === 'string' && dataCell.match(/\d{2}\/\d{2}\/\d{4}/)) {
      const [dia, mes, ano] = dataCell.split('/');
      dataFormatada = `${ano}-${mes}-${dia}`;
    } else if (typeof dataCell === 'number') {
      // Data Excel serial
      const excelDate = new Date((dataCell - 25569) * 86400 * 1000);
      dataFormatada = excelDate.toISOString().split('T')[0];
    }
    
    if (!dataFormatada) continue;
    
    // Processar valores
    const documento = String(row[2] || '');
    let credito = row[3];
    let debito = row[4];
    let saldo = row[5];
    
    // Converter strings para números
    const parseValor = (val: any): number | null => {
      if (val === null || val === undefined || val === '') return null;
      if (typeof val === 'number') return val;
      const str = String(val).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
      const num = parseFloat(str);
      return isNaN(num) ? null : num;
    };
    
    credito = parseValor(credito);
    debito = parseValor(debito);
    saldo = parseValor(saldo) || 0;
    
    // Identificar saldo anterior
    if (descricao === 'SALDO ANTERIOR') {
      saldoInicial = saldo;
      dataInicio = dataFormatada;
      continue;
    }
    
    // Atualizar data fim
    dataFim = dataFormatada;
    saldoFinal = saldo;
    
    lancamentos.push({
      data: dataFormatada,
      descricao,
      documento,
      credito,
      debito,
      saldo
    });
  }
  
  return {
    agencia,
    conta,
    lancamentos,
    saldoInicial,
    saldoFinal,
    dataInicio,
    dataFim
  };
}

// Categorizar lançamento
async function categorizarLancamento(
  supabase: any,
  descricao: string
): Promise<{ categoria: string; subcategoria: string; origem: string; nomePagador: string; }> {
  // Buscar regras ordenadas por prioridade
  const { data: regras } = await supabase
    .from('regras_categorizacao')
    .select('*')
    .eq('ativo', true)
    .order('prioridade', { ascending: false });
  
  let categoria = 'outros';
  let subcategoria = 'nao_categorizado';
  let origem = 'outros';
  
  for (const regra of regras || []) {
    let match = false;
    
    switch (regra.tipo_match) {
      case 'starts_with':
        match = descricao.toUpperCase().startsWith(regra.padrao_texto.toUpperCase());
        break;
      case 'ends_with':
        match = descricao.toUpperCase().endsWith(regra.padrao_texto.toUpperCase());
        break;
      case 'contains':
        match = descricao.toUpperCase().includes(regra.padrao_texto.toUpperCase());
        break;
      case 'regex':
        match = new RegExp(regra.padrao_texto, 'i').test(descricao);
        break;
    }
    
    if (match) {
      categoria = regra.categoria;
      subcategoria = regra.subcategoria || subcategoria;
      origem = regra.origem_pagamento || origem;
      break;
    }
  }
  
  // Extrair nome do pagador de PIX
  let nomePagador = '';
  if (descricao.includes('TRANSFERENCIA PIX')) {
    const matchPix = descricao.match(/(?:REM:|DES:)\s*(.+?)\s*\d{2}\/\d{2}/);
    if (matchPix) {
      nomePagador = matchPix[1].trim();
    }
  }
  
  return { categoria, subcategoria, origem, nomePagador };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const payload = await req.json() as ProcessarExtratoPayload;
    
    // Buscar extrato
    const { data: extrato, error: extratoError } = await supabase
      .from('extratos_bancarios')
      .select('*, conta_bancaria:contas_bancarias(*)')
      .eq('id', payload.extrato_id)
      .single();
    
    if (extratoError || !extrato) {
      throw new Error('Extrato não encontrado');
    }
    
    // Atualizar status para processando
    await supabase
      .from('extratos_bancarios')
      .update({ status: 'processando' })
      .eq('id', payload.extrato_id);
    
    // Processar arquivo
    const parsed = parseBradescoXLS(payload.arquivo_base64);
    
    // Validar conta
    if (extrato.conta_bancaria) {
      if (extrato.conta_bancaria.agencia !== parsed.agencia || 
          !extrato.conta_bancaria.conta.includes(parsed.conta.replace('-', ''))) {
        // Permitir continuar, mas logar warning
        console.warn('Conta do extrato diferente da conta cadastrada');
      }
    }
    
    // Inserir movimentações
    let inseridos = 0;
    let duplicados = 0;
    let totalCreditos = 0;
    let totalDebitos = 0;
    
    for (const lanc of parsed.lancamentos) {
      // Gerar hash para evitar duplicação
      const { data: hashResult } = await supabase.rpc('gerar_hash_lancamento', {
        p_conta_id: extrato.conta_bancaria_id,
        p_data: lanc.data,
        p_descricao: lanc.descricao,
        p_valor: lanc.credito || lanc.debito,
        p_documento: lanc.documento
      });
      
      // Verificar duplicado
      const { data: existente } = await supabase
        .from('movimentacoes_bancarias')
        .select('id')
        .eq('hash_lancamento', hashResult)
        .maybeSingle();
      
      if (existente) {
        duplicados++;
        continue;
      }
      
      // Categorizar
      const cat = await categorizarLancamento(supabase, lanc.descricao);
      
      // Determinar tipo e valor
      const tipo = lanc.credito ? 'credito' : 'debito';
      const valor = lanc.credito || Math.abs(lanc.debito || 0);
      
      if (tipo === 'credito') {
        totalCreditos += valor;
      } else {
        totalDebitos += valor;
      }
      
      // Inserir
      const { error: insertError } = await supabase
        .from('movimentacoes_bancarias')
        .insert({
          extrato_id: payload.extrato_id,
          conta_bancaria_id: extrato.conta_bancaria_id,
          data_lancamento: lanc.data,
          descricao: lanc.descricao,
          documento: lanc.documento,
          valor,
          tipo,
          saldo_apos: lanc.saldo,
          categoria: cat.categoria,
          subcategoria: cat.subcategoria,
          origem_pagamento: cat.origem,
          nome_pagador: cat.nomePagador,
          hash_lancamento: hashResult
        });
      
      if (!insertError) {
        inseridos++;
      }
    }
    
    // Atualizar extrato com totais
    await supabase
      .from('extratos_bancarios')
      .update({
        data_inicio: parsed.dataInicio,
        data_fim: parsed.dataFim,
        saldo_inicial: parsed.saldoInicial,
        saldo_final: parsed.saldoFinal,
        total_creditos: totalCreditos,
        total_debitos: totalDebitos,
        qtd_lancamentos: inseridos,
        status: 'processado'
      })
      .eq('id', payload.extrato_id);
    
    // Atualizar saldo da conta
    await supabase
      .from('contas_bancarias')
      .update({
        saldo_atual: parsed.saldoFinal,
        data_saldo: parsed.dataFim
      })
      .eq('id', extrato.conta_bancaria_id);
    
    return new Response(
      JSON.stringify({
        success: true,
        dados: {
          lancamentos_inseridos: inseridos,
          lancamentos_duplicados: duplicados,
          total_creditos: totalCreditos,
          total_debitos: totalDebitos,
          saldo_inicial: parsed.saldoInicial,
          saldo_final: parsed.saldoFinal,
          periodo: `${parsed.dataInicio} a ${parsed.dataFim}`
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro ao processar extrato:', errorMessage);
    
    // Tentar atualizar status de erro
    try {
      const body = await req.clone().json();
      if (body.extrato_id) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        await supabase
          .from('extratos_bancarios')
          .update({ status: 'erro', erro_mensagem: errorMessage })
          .eq('id', body.extrato_id);
      }
    } catch (e) {
      console.error('Erro ao atualizar status de erro:', e);
    }
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
