// ============================================
// TEMPLATE UTILS - Substituição de Variáveis e Geração HTML
// ============================================

import {
  TermoAfiliacaoData,
  RegrasVendaData,
  CoberturaDetalhada,
  BeneficioDetalhado,
  formatCPF,
  formatPhone,
  formatCEP,
  formatCurrency,
  formatDate,
  formatDateExtended,
  calcularCotaParticipacao,
  calcularPrimeiraMensalidade,
} from "./termo-afiliacao-utils.ts";

// ============= GERADORES DE TABELAS HTML =============

function gerarListaCoberturas(plano: TermoAfiliacaoData['plano']): string {
  if (plano.coberturas_detalhadas?.length) {
    return plano.coberturas_detalhadas.map(c => c.nome).join(', ');
  }
  return (plano.coberturas || []).join(', ') || 'Roubo e Furto, Assistência 24 horas';
}

function gerarListaBeneficios(plano: TermoAfiliacaoData['plano']): string {
  if (plano.beneficios_detalhados?.length) {
    return plano.beneficios_detalhados.map(b => b.nome).join(', ');
  }
  return '';
}

function gerarTabelaCoberturasHTML(coberturas: CoberturaDetalhada[]): string {
  if (!coberturas.length) return '<p><em>Nenhuma cobertura vinculada ao plano.</em></p>';
  const rows = coberturas.map(c => {
    const detalhes: string[] = [];
    if (c.valor_personalizado) detalhes.push(c.valor_personalizado);
    if (c.carencia_dias) detalhes.push(`Carência: ${c.carencia_dias} dias`);
    if (c.franquia_percentual) detalhes.push(`Franquia: ${c.franquia_percentual}%`);
    return `<tr><td>${c.nome}</td><td>${c.descricao || '—'}</td><td>${detalhes.join(' · ') || '—'}</td></tr>`;
  }).join('');
  return `<table class="plan-details"><thead><tr><th>Cobertura</th><th>Descrição</th><th>Detalhes</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function gerarTabelaBeneficiosHTML(beneficios: BeneficioDetalhado[]): string {
  if (!beneficios.length) return '<p><em>Nenhum benefício vinculado ao plano.</em></p>';
  const rows = beneficios.map(b => {
    return `<tr><td>${b.nome}</td><td>${b.descricao || '—'}</td><td>${b.valor_personalizado || '—'}</td></tr>`;
  }).join('');
  return `<table class="plan-details"><thead><tr><th>Benefício</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/**
 * Gera um bloco HTML autossuficiente com coberturas e benefícios do plano.
 * Usado para injeção automática quando o template do banco não contém essas variáveis.
 */
export function gerarSecaoCoberturasInjetavel(dados: TermoAfiliacaoData): string {
  const coberturas = dados.plano?.coberturas_detalhadas || [];
  const beneficios = dados.plano?.beneficios_detalhados || [];
  if (!coberturas.length && !beneficios.length) return '';

  let html = `<div style="page-break-inside: avoid; margin-top: 20pt;">
    <h3 style="text-align: center; font-size: 14px; text-transform: uppercase; margin-bottom: 12pt; color: #1a1a6e;">COBERTURAS E BENEFÍCIOS DO PLANO</h3>`;

  if (coberturas.length) {
    html += `<table class="plan-details" style="width:100%; border-collapse:collapse; margin-bottom:12pt;">
      <thead><tr><th style="background:#1a1a6e;color:#fff;padding:6px;font-size:11px;">Coberturas</th></tr></thead><tbody>`;
    for (const c of coberturas) {
      html += `<tr><td style="padding:4px;border:1px solid #ddd;font-size:10px;">${c.nome}</td></tr>`;
    }
    html += '</tbody></table>';
  }

  if (beneficios.length) {
    html += `<table class="plan-details" style="width:100%; border-collapse:collapse; margin-bottom:12pt;">
      <thead><tr><th style="background:#1a1a6e;color:#fff;padding:6px;font-size:11px;">Benefícios</th></tr></thead><tbody>`;
    for (const b of beneficios) {
      html += `<tr><td style="padding:4px;border:1px solid #ddd;font-size:10px;">${b.nome}</td></tr>`;
    }
    html += '</tbody></table>';
  }

  html += '</div>';
  return html;
}

function gerarTabelaCompletaHTML(coberturas: CoberturaDetalhada[], beneficios: BeneficioDetalhado[]): string {
  if (!coberturas.length && !beneficios.length) return '<p><em>Nenhuma cobertura ou benefício vinculado ao plano.</em></p>';
  
  let html = '<table class="plan-details">';
  
  if (coberturas.length) {
    html += '<thead><tr><th style="background:#1a1a6e;color:#fff;">Coberturas</th></tr></thead><tbody>';
    for (const c of coberturas) {
      html += `<tr><td>${c.nome}</td></tr>`;
    }
    html += '</tbody>';
  }
  
  if (beneficios.length) {
    html += '<thead><tr><th style="background:#1a1a6e;color:#fff;">Benefícios</th></tr></thead><tbody>';
    for (const b of beneficios) {
      html += `<tr><td>${b.nome}</td></tr>`;
    }
    html += '</tbody>';
  }
  
  html += '</table>';
  return html;
}

// ============= MAPEAMENTO DE VARIÁVEIS =============

/**
 * Cria o mapeamento de variáveis disponíveis com seus valores
 */
export function criarMapeamentoVariaveis(dados: TermoAfiliacaoData): Record<string, string> {
  const dataAtual = new Date().toISOString();
  const cotaParticipacao = calcularCotaParticipacao(dados.veiculo.valor_fipe, dados.plano.cota_participacao);
  const primeiraMensalidade = calcularPrimeiraMensalidade(dados.contrato.dia_vencimento);
  
  return {
    // Contrato
    'contrato.numero': dados.contrato.numero || '—',
    'contrato.data_inicio': formatDate(dados.contrato.data_inicio) || formatDate(dataAtual),
    'contrato.dia_vencimento': String(dados.contrato.dia_vencimento || 10),
    'contrato.valor_adesao': formatCurrency(dados.contrato.valor_adesao),
    'contrato.valor_mensal': formatCurrency(dados.contrato.valor_mensal),
    'contrato.valor_adicional': formatCurrency(dados.contrato.valor_adicional || 0),
    'contrato.valor_mensal_base': formatCurrency((dados.contrato.valor_mensal || 0) - (dados.contrato.valor_adicional || 0)),
    'contrato.valor_mensal_total': formatCurrency(dados.contrato.valor_mensal),
    'contrato.forma_pagamento': dados.contrato.forma_pagamento || 'Boleto Bancário',
    'contrato.primeira_mensalidade': primeiraMensalidade,
    
    // Associado/Cliente
    'associado.nome': dados.cliente.nome || '—',
    'associado.cpf': formatCPF(dados.cliente.cpf) || '—',
    'associado.rg': dados.cliente.rg || '—',
    'associado.rg_orgao': dados.cliente.rg_orgao || '',
    'associado.data_nascimento': formatDate(dados.cliente.data_nascimento),
    'associado.email': dados.cliente.email || '—',
    'associado.telefone': formatPhone(dados.cliente.telefone),
    'associado.whatsapp': formatPhone(dados.cliente.telefone_secundario || dados.cliente.telefone),
    'associado.telefone_secundario': dados.cliente.telefone_secundario ? formatPhone(dados.cliente.telefone_secundario) : '—',
    'associado.logradouro': dados.cliente.logradouro || '—',
    'associado.numero': dados.cliente.numero || '—',
    'associado.complemento': dados.cliente.complemento || '',
    'associado.bairro': dados.cliente.bairro || '—',
    'associado.cidade': dados.cliente.cidade || '—',
    'associado.uf': dados.cliente.uf || '—',
    'associado.cep': formatCEP(dados.cliente.cep),
    'associado.estado_civil': dados.cliente.estado_civil || '—',
    'associado.profissao': dados.cliente.profissao || '—',
    'associado.cnh': dados.cliente.cnh || '—',
    'associado.cnh_validade': formatDate(dados.cliente.cnh_validade),
    'associado.cnh_categoria': dados.cliente.cnh_categoria || '—',
    'associado.endereco_completo': `${dados.cliente.logradouro || ''}, ${dados.cliente.numero || ''}${dados.cliente.complemento ? ', ' + dados.cliente.complemento : ''} - ${dados.cliente.bairro || ''} - ${dados.cliente.cidade || ''}/${dados.cliente.uf || ''} - CEP ${formatCEP(dados.cliente.cep)}`,
    
    // Veículo
    'veiculo.marca': dados.veiculo.marca || '—',
    'veiculo.modelo': dados.veiculo.modelo || '—',
    'veiculo.placa': dados.veiculo.placa || 'ZERO QUILÔMETRO',
    'veiculo.chassi': dados.veiculo.chassi || '—',
    'veiculo.renavam': dados.veiculo.renavam || '—',
    'veiculo.ano': String(dados.veiculo.ano || '—'),
    'veiculo.ano_fabricacao': String(dados.veiculo.ano_fabricacao || dados.veiculo.ano || '—'),
    'veiculo.cor': dados.veiculo.cor || '—',
    'veiculo.combustivel': dados.veiculo.combustivel || '—',
    'veiculo.categoria': dados.veiculo.categoria || 'Automóvel',
    'veiculo.tipo': dados.veiculo.categoria || 'Automóvel',
    'veiculo.tipo_uso': dados.veiculo.tipo_uso || 'Particular',
    'veiculo.codigo_fipe': dados.veiculo.codigo_fipe || '—',
    'veiculo.valor_fipe': formatCurrency(dados.veiculo.valor_fipe),
    'veiculo.alienado': dados.veiculo.alienado ? 'Sim' : 'Não',
    'veiculo.financeira': dados.veiculo.financeira || '—',
    'veiculo.procedencia': dados.veiculo.procedencia || 'Usado de particular',
    'veiculo.cambio': dados.veiculo.cambio || '—',
    'veiculo.portas': String(dados.veiculo.portas ?? 4),
    'veiculo.leilao': dados.veiculo.leilao ? 'SIM' : 'NÃO',
    'veiculo.uso_aplicativo': dados.veiculo.uso_aplicativo ? 'SIM' : 'NÃO',
    'veiculo.valor_protegido': formatCurrency(dados.veiculo.valor_fipe),
    
    // Consultor
    'consultor.nome': dados.consultor?.nome || '—',
    
    // Plano
    'plano.nome': dados.plano.nome || '—',
    'plano.tipo': dados.plano.tipo || dados.plano.linha || 'Normal',
    'plano.linha': dados.plano.linha || '—',
    'plano.coberturas': gerarListaCoberturas(dados.plano),
    'plano.beneficios': gerarListaBeneficios(dados.plano),
    'plano.tabela_coberturas': gerarTabelaCoberturasHTML(dados.plano.coberturas_detalhadas || []),
    'plano.tabela_beneficios': gerarTabelaBeneficiosHTML(dados.plano.beneficios_detalhados || []),
    'plano.tabela_completa': gerarTabelaCompletaHTML(dados.plano.coberturas_detalhadas || [], dados.plano.beneficios_detalhados || []),
    
    'plano.valor_base': formatCurrency(dados.contrato.valor_mensal),
    'plano.cobertura_fipe': `${dados.plano.cobertura_fipe || 100}%`,
    'plano.cota_participacao': `${dados.plano.cota_participacao ?? 6}%`,
    'plano.cota_participacao_valor': formatCurrency(cotaParticipacao),
    'plano.cota_minima': dados.plano.cota_minima === 0 ? 'Sem mínimo' : formatCurrency(dados.plano.cota_minima ?? 1200),
    
    // Empresa
    'empresa.nome': dados.empresa.nome || 'ASSOCIAÇÃO DE PROTEÇÃO PATRIMONIAL PARA MOTORISTAS DE APLICATIVO PRATICCAR',
    'empresa.cnpj': dados.empresa.cnpj || '—',
    'empresa.logradouro': dados.empresa.logradouro || '—',
    'empresa.numero': dados.empresa.numero || '—',
    'empresa.bairro': dados.empresa.bairro || '—',
    'empresa.cidade': dados.empresa.cidade || '—',
    'empresa.uf': dados.empresa.uf || '—',
    'empresa.cep': dados.empresa.cep || '—',
    'empresa.endereco': `${dados.empresa.logradouro || ''}, ${dados.empresa.numero || ''} - ${dados.empresa.bairro || ''} - ${dados.empresa.cidade || ''}/${dados.empresa.uf || ''} - CEP ${dados.empresa.cep || ''}`,
    'empresa.lgpd_email': dados.empresa.lgpd_email || 'lgpd@praticcar.com.br',
    
    // Sistema
    'sistema.data_atual': formatDate(dataAtual),
    'sistema.data_extenso': formatDateExtended(dataAtual),

    // Tipo de Operação (checkboxes condicionais)
    'operacao.adesao': (dados.contrato.tipo_entrada === 'adesao' || dados.contrato.tipo_entrada === 'nova') ? '(X)' : '( )',
    'operacao.migracao': dados.contrato.tipo_entrada === 'migracao' ? '(X)' : '( )',
    'operacao.inclusao': dados.contrato.tipo_entrada === 'inclusao' ? '(X)' : '( )',
    'operacao.troca_titularidade': dados.contrato.tipo_entrada === 'troca_titularidade' ? '(X)' : '( )',
    'operacao.reativacao': dados.contrato.tipo_entrada === 'reativacao' ? '(X)' : '( )',
    'operacao.substituicao_placa': dados.contrato.tipo_entrada === 'substituicao_placa' ? '(X)' : '( )',

    // Regras de Venda (dinâmicas da Diretoria)
    ...(dados.regrasVenda ? {
      'regras.taxa_adesao_percentual': `${dados.regrasVenda.taxa_adesao_percentual_fipe}%`,
      'regras.taxa_adesao_minimo_volante': formatCurrency(Number(dados.regrasVenda.taxa_adesao_minimo_volante)),
      'regras.taxa_adesao_minimo_base': formatCurrency(Number(dados.regrasVenda.taxa_adesao_minimo_base)),
      'regras.repasse_volante': formatCurrency(Number(dados.regrasVenda.taxa_repasse_volante)),
      'regras.taxa_substituicao_placa': formatCurrency(Number(dados.regrasVenda.taxa_substituicao_placa)),
      'regras.taxa_troca_titularidade': formatCurrency(Number(dados.regrasVenda.taxa_troca_titularidade)),
      'regras.taxa_revistoria': formatCurrency(Number(dados.regrasVenda.taxa_revistoria)),
      'regras.multa_rastreador': formatCurrency(Number(dados.regrasVenda.multa_rastreador)),
      'regras.migracao_comprovantes': dados.regrasVenda.migracao_comprovantes_exigidos,
      'regras.migracao_prazo_horas': dados.regrasVenda.migracao_prazo_resposta_horas,
      'regras.migracao_canal': dados.regrasVenda.migracao_canal_oficial,
      'regras.migracao_carencia_isenta': dados.regrasVenda.migracao_isentar_carencia === 'true' ? 'Sim' : 'Não',
      'regras.prazo_reativacao_dias': dados.regrasVenda.prazo_reativacao_dias,
      'regras.repasse_pct_favoravel': `${dados.regrasVenda.repasse_maior_pct_favoravel}%`,
      'regras.repasse_pct_reduzido': `${dados.regrasVenda.repasse_maior_pct_reduzido}%`,
      'regras.repasse_valor_favoravel': formatCurrency(Number(dados.regrasVenda.repasse_maior_valor_favoravel)),
      'regras.repasse_valor_reduzido': formatCurrency(Number(dados.regrasVenda.repasse_maior_valor_reduzido)),
      'regras.repasse_corte_boletos': dados.regrasVenda.repasse_maior_corte_boletos,
    } : {}),

    // Migração (quando aplicável)
    ...(dados.migracao ? {
      'migracao.aprovada': dados.migracao.aprovada ? 'Sim' : 'Não',
      'migracao.associacao_origem': dados.migracao.associacao_origem || '—',
      'migracao.data_aprovacao': dados.migracao.data_aprovacao ? formatDate(dados.migracao.data_aprovacao) : '—',
      'migracao.carencia_status': dados.migracao.carencia_isenta
        ? 'Dispensada — migração aprovada'
        : 'Período padrão',
    } : {}),

    // Substituição de Placa (quando aplicável)
    ...(dados.substituicao ? {
      'substituicao.placa_anterior': dados.substituicao.placa_anterior || '—',
      'substituicao.modelo_anterior': dados.substituicao.modelo_anterior || '—',
      'substituicao.fipe_anterior': formatCurrency(dados.substituicao.fipe_anterior),
      'substituicao.tipo_operacao': 'Substituição de Placa',
    } : {
      'substituicao.tipo_operacao': dados.contrato.tipo_entrada === 'substituicao_placa' ? 'Substituição de Placa' : 'Nova Adesão',
    }),

    // Troca de Titularidade (quando aplicável)
    ...(dados.trocaTitularidade ? {
      'troca.titular_anterior': dados.trocaTitularidade.titular_anterior || '—',
      'troca.cenario': dados.trocaTitularidade.cenario || '—',
      'troca.cenario_label': dados.trocaTitularidade.cenario_label || '—',
    } : {}),

    // Indicador (quando aplicável)
    ...(dados.indicador ? {
      'indicador.nome': dados.indicador.nome || '—',
      'indicador.cpf': dados.indicador.cpf ? formatCPF(dados.indicador.cpf) : '—',
    } : {
      'indicador.nome': '—',
      'indicador.cpf': '—',
    }),

    // Oficina (quando aplicável — vinculada via OS)
    ...(dados.oficina ? {
      'oficina.nome': dados.oficina.nome || '—',
      'oficina.cnpj': dados.oficina.cnpj || '—',
      'oficina.telefone': formatPhone(dados.oficina.telefone),
      'oficina.whatsapp': formatPhone(dados.oficina.whatsapp || dados.oficina.telefone),
      'oficina.endereco': [
        dados.oficina.logradouro,
        dados.oficina.numero ? `, ${dados.oficina.numero}` : '',
        dados.oficina.bairro ? ` - ${dados.oficina.bairro}` : '',
        dados.oficina.cidade ? ` - ${dados.oficina.cidade}` : '',
        dados.oficina.estado ? `/${dados.oficina.estado}` : '',
        dados.oficina.cep ? ` - CEP ${formatCEP(dados.oficina.cep)}` : '',
      ].join('') || '—',
    } : {}),
  };
}

/**
 * Substitui todas as variáveis {{...}} no conteúdo
 */
/**
 * Remove qualquer {{variavel}} que não foi substituída
 */
export function limparVariaveisNaoSubstituidas(html: string): string {
  const restantes = html.match(/\{\{[^}]+\}\}/g);
  if (restantes) {
    console.warn('[template-utils] Variáveis não substituídas encontradas:', restantes);
  }
  return html.replace(/\{\{[^}]+\}\}/g, '—');
}

export function substituirVariaveis(conteudo: string, dados: TermoAfiliacaoData): string {
  const mapeamento = criarMapeamentoVariaveis(dados);
  let resultado = conteudo;
  
  // Normalizar variáveis: remover caracteres unicode invisíveis inseridos pelo TipTap
  resultado = resultado.replace(/\{\{([^}]*)\}\}/g, (_match, inner) => {
    const cleaned = inner.replace(/[\u200B\u200C\u200D\uFEFF\u00A0]/g, '').trim();
    return `{{${cleaned}}}`;
  });
  
  // Substituir todas as ocorrências de {{variavel}}
  for (const [chave, valor] of Object.entries(mapeamento)) {
    resultado = resultado.replace(
      new RegExp(`\\{\\{\\s*${chave.replace('.', '\\.')}\\s*\\}\\}`, 'gi'),
      valor || '—'
    );
  }
  
  // Remover bloco "Serviços:" — todas as variantes possíveis
  // 1) Container HTML com ç literal
  resultado = resultado.replace(
    /<(p|div|td|li|tr)[^>]*>[\s\S]*?Servi[çc]os\s*:[\s\S]*?<\/\1>/gi,
    ''
  );
  // 2) Container HTML com &ccedil; entity
  resultado = resultado.replace(
    /<(p|div|td|li|tr)[^>]*>[\s\S]*?Servi&ccedil;os\s*:[\s\S]*?<\/\1>/gi,
    ''
  );
  // 3) Variable chip residual com plano.descricao
  resultado = resultado.replace(
    /<span[^>]*data-variable="[^"]*plano\.descricao[^"]*"[^>]*>[^<]*<\/span>/gi,
    ''
  );
  // 4) Inline residual (todas as formas de ç)
  resultado = resultado.replace(
    /Servi([çc]|&ccedil;)os\s*:\s*[^\n<]*/gi,
    ''
  );

  // Fallback: preencher célula vazia após "Consultor:" com o nome do consultor
  const nomeConsultor = mapeamento['consultor.nome'] || '—';
  resultado = resultado.replace(
    /(<td[^>]*>\s*<p[^>]*>\s*<strong>\s*Consultor\s*:\s*<\/strong>\s*<\/p>\s*<\/td>\s*<td[^>]*>\s*)<p[^>]*>\s*(?:<br\s*\/?>|&nbsp;|\s)*<\/p>/gi,
    `$1<p>${nomeConsultor}</p>`
  );

  // Limpar variáveis residuais que não foram mapeadas
  resultado = limparVariaveisNaoSubstituidas(resultado);
  
  return resultado;
}

// ============= ESTILOS CSS PADRÃO =============

export const generateStyles = (): string => `
<style>
  @page {
    size: A4;
    margin: 15mm 18mm;
  }
  
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt;
    line-height: 1.4;
    color: #222222;
    background: #ffffff;
  }
  
  .page {
    max-width: 210mm;
    margin: 0 auto;
    overflow: hidden;
  }
  
  /* ===== CABEÇALHO ===== */
  .header {
    text-align: center;
    margin-bottom: 14pt;
  }

  .header-gradient {
    background: linear-gradient(90deg, #c41e3a 0%, #1a1a6e 100%);
    height: 8px;
    margin-bottom: 10pt;
  }

  .header-logo-area {
    margin-bottom: 6pt;
  }

  .header-logo-area img {
    max-height: 55px;
    max-width: 180px;
  }

  .header-empresa {
    font-size: 8pt;
    color: #444;
    line-height: 1.3;
    margin-bottom: 8pt;
  }

  .header-titulo {
    background: #1a1a6e;
    color: #ffffff;
    font-size: 11pt;
    font-weight: bold;
    padding: 6pt 10pt;
    text-transform: uppercase;
    letter-spacing: 0.5pt;
  }

  .header-numero {
    font-size: 10pt;
    font-weight: bold;
    padding: 4pt 0;
    border-bottom: 2px solid #1a1a6e;
    margin-bottom: 10pt;
  }

  /* ===== SEÇÕES ===== */
  .section {
    margin-bottom: 10pt;
    page-break-inside: avoid;
  }

  /* ===== CONTEÚDO RICO (TipTap) — SEM page-break-inside: avoid ===== */
  .content-body {
    margin-bottom: 10pt;
  }

  .content-body table {
    page-break-inside: auto;
  }
  
  .section-title {
    background: #1a1a6e;
    color: #ffffff;
    font-size: 9pt;
    font-weight: bold;
    padding: 4pt 8pt;
    text-transform: uppercase;
    margin-bottom: 0;
    letter-spacing: 0.3pt;
  }
  
  .section-subtitle {
    font-size: 9pt;
    font-weight: bold;
    color: #1a1a6e;
    text-align: center;
    text-transform: uppercase;
    padding: 6pt 0;
    margin: 8pt 0 4pt 0;
    border-top: 1px solid #1a1a6e;
    border-bottom: 1px solid #1a1a6e;
  }

  /* ===== GRID DE CAMPOS (estilo tabela) ===== */
  .fields-grid {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8pt;
    font-size: 9pt;
  }

  .fields-grid td {
    border: 1px solid #999;
    padding: 3pt 5pt;
    vertical-align: top;
  }

  .fields-grid .field-label {
    font-weight: bold;
    font-size: 7pt;
    text-transform: uppercase;
    color: #333;
    display: block;
    margin-bottom: 1pt;
  }

  .fields-grid .field-value {
    font-size: 9pt;
    color: #111;
  }

  /* Campos inline legados */
  .field-row {
    display: flex;
    flex-wrap: wrap;
    margin-bottom: 4pt;
  }
  
  .field {
    margin-right: 16pt;
    margin-bottom: 3pt;
  }
  
  .field-label {
    font-weight: bold;
    display: inline;
    font-size: 9pt;
  }
  
  .field-value {
    display: inline;
    font-size: 9pt;
  }
  
  .field-full {
    width: 100%;
    margin-bottom: 4pt;
  }
  
  /* ===== TABELAS ===== */
  .table-valores {
    width: 100%;
    border-collapse: collapse;
    margin: 8pt 0;
    font-size: 9pt;
  }
  
  .table-valores td,
  .table-valores th {
    padding: 4pt 6pt;
    border: 1px solid #999;
  }
  
  .table-valores td:first-child {
    font-weight: normal;
  }
  
  .table-valores td:last-child {
    text-align: right;
    font-weight: bold;
  }
  
  .table-valores .header-row td,
  .table-valores thead th {
    background-color: #1a1a6e;
    color: white;
    font-weight: bold;
    text-align: center;
  }

  /* Tabelas do TipTap */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 6pt 0;
    font-size: 9pt;
  }

  table td,
  table th {
    border: 1px solid #999;
    padding: 3pt 5pt;
    vertical-align: top;
  }

  table th,
  table thead td {
    background-color: #1a1a6e;
    color: #ffffff;
    font-weight: bold;
    font-size: 8pt;
    text-transform: uppercase;
  }

   /* ===== TABELA DE COBERTURAS/BENEFÍCIOS DO PLANO ===== */
   .plan-details {
     width: 100%;
     border-collapse: collapse;
     margin: 8pt 0;
     font-size: 9pt;
   }
   .plan-details th {
     background-color: #1a1a6e;
     color: #ffffff;
     font-weight: bold;
     font-size: 8pt;
     text-transform: uppercase;
     padding: 4pt 6pt;
     border: 1px solid #999;
   }
   .plan-details td {
     padding: 3pt 5pt;
     border: 1px solid #999;
     vertical-align: top;
   }

   /* ===== COBERTURAS ===== */
   .cobertura-list {
     margin: 6pt 0;
   }
   
   .cobertura-item {
     font-size: 9pt;
     margin-bottom: 2pt;
     padding-left: 5pt;
   }
   
   .cobertura-check {
     color: #16a34a;
     font-weight: bold;
   }
  
  /* ===== DECLARAÇÕES / CORPO ===== */
  .declaracao {
    margin-bottom: 8pt;
    text-align: justify;
  }
  
  .declaracao-titulo {
    font-weight: bold;
    margin-bottom: 3pt;
    font-size: 9pt;
  }
  
  .declaracao-texto {
    font-size: 9pt;
    line-height: 1.4;
  }
  
  /* ===== DESTAQUE ===== */
  .highlight-box {
    background-color: #f0f4ff;
    border: 1px solid #1a1a6e;
    padding: 8pt;
    margin: 8pt 0;
    font-size: 9pt;
  }
  
  .nota-rodape {
    font-size: 7pt;
    color: #666666;
    font-style: italic;
    margin-top: 6pt;
  }
  
  /* ===== ASSINATURA ===== */
  .signature-area {
    margin-top: 30pt;
    padding-top: 15pt;
    page-break-inside: avoid;
  }
  
  .signature-local-data {
    text-align: center;
    margin-bottom: 40pt;
    font-size: 9pt;
  }
  
  .signature-block {
    display: inline-block;
    width: 45%;
    text-align: center;
    vertical-align: top;
  }
  
  .signature-line {
    border-top: 1px solid #333333;
    width: 260px;
    margin: 0 auto;
    padding-top: 4pt;
    font-size: 8pt;
  }
  
  .signature-name {
    font-weight: bold;
    font-size: 9pt;
  }
  
  .signature-doc {
    font-size: 7pt;
    color: #666666;
  }
  
  .signature-role {
    font-size: 8pt;
    color: #374151;
  }
  
  /* ===== RODAPÉ ===== */
  .footer {
    margin-top: 20pt;
    text-align: center;
    font-size: 7pt;
    color: #888;
    border-top: 2px solid #1a1a6e;
    padding-top: 6pt;
  }
  
  /* ===== PAGINAÇÃO ===== */
  .page-break {
    page-break-before: always;
  }
  
  /* ===== MARKDOWN/TIPTAP CONVERTED ===== */
  h1, h2, h3, h4, h5, h6 {
    margin-top: 10pt;
    margin-bottom: 4pt;
  }
  
  h1 { font-size: 12pt; color: #1a1a6e; }
  h2 { font-size: 11pt; color: #1a1a6e; background: #1a1a6e; color: #fff; padding: 4pt 8pt; text-transform: uppercase; }
  h3 { font-size: 10pt; color: #1a1a6e; text-transform: uppercase; border-bottom: 1px solid #1a1a6e; padding-bottom: 2pt; }
  
  p {
    margin-bottom: 6pt;
    text-align: justify;
    font-size: 9pt;
    line-height: 1.4;
  }
  
  ul, ol {
    margin-left: 16pt;
    margin-bottom: 6pt;
    font-size: 9pt;
  }
  
  li {
    margin-bottom: 2pt;
  }
  
  strong, b {
    font-weight: bold;
  }
  
  em, i {
    font-style: italic;
  }
</style>
`;

// ============= CABEÇALHO =============

export function generateHeader(dados: TermoAfiliacaoData): string {
  return `
<div class="header">
  <div class="header-gradient"></div>
  <div class="header-logo-area">
    <img src="https://app.praticcar.org/logos/logo-full-light.png" alt="Logo PraticCar" onerror="this.style.display='none'" />
  </div>
  <div class="header-empresa">
    ${dados.empresa.razao_social || 'ASSOCIAÇÃO DE PROTEÇÃO PATRIMONIAL PARA MOTORISTAS DE APLICATIVO PRATICCAR'}<br>
    CNPJ: ${dados.empresa.cnpj} | ${dados.empresa.logradouro}, ${dados.empresa.numero} - ${dados.empresa.bairro} - ${dados.empresa.cidade}/${dados.empresa.uf} - CEP ${dados.empresa.cep}
  </div>
  <div class="header-titulo">TERMO DE AFILIAÇÃO AO PROGRAMA DE SOCORRO MÚTUO</div>
  <div class="header-numero">Nº ${dados.contrato.numero}</div>
</div>
`;
}

// ============= RODAPÉ =============

export function generateFooter(dados: TermoAfiliacaoData): string {
  return `
<div class="footer">
  PRATICCAR | Termo de Afiliação Nº ${dados.contrato.numero}
</div>
`;
}

// ============= DETECÇÃO E SANITIZAÇÃO DE ASSINATURA =============

/**
 * Detecta se o conteúdo HTML já contém uma área de assinatura válida.
 * Verifica múltiplos padrões: classes CSS, títulos, blocos manuais com nome+CPF.
 */
export function hasSignatureArea(html: string): boolean {
  if (!html) return false;
  const patterns = [
    /class\s*=\s*["']signature-area["']/i,
    /class\s*=\s*["']signature-block["']/i,
    /class\s*=\s*["']signature-line["']/i,
    /class\s*=\s*["']signature-local-data["']/i,
    />ASSINATURA<\//i,
    />\s*8\.\s*ASSINATURA\s*<\//i,
    // Detectar área de assinatura do template AF1 (nome + CPF em contexto de assinatura)
    /Associado\s*\(a\)\s*:/i,
    /{{associado\.nome}}[\s\S]*?{{associado\.cpf}}/i,
    /border-top.*?ASSOCIADO/is,
  ];
  return patterns.some(p => p.test(html));
}

/**
 * Remove blocos de assinatura manual do conteúdo HTML.
 * Cobre todos os padrões encontrados nos templates reais:
 * - Classes CSS (signature-block, signature-line, signature-labels, signature-area)
 * - Bordas decorativas (━━━, ───)
 * - Linhas de underscores (_____)
 * - Labels soltas (ASSOCIADO, ASSOCIAÇÃO, AUTORIZAÇÃO, ASSINATURA DO ASSOCIADO)
 * - Sintaxe legada (!{Associado}, !{Associacao}, ${local}, #{data_de_emissao})
 * - Tabelas de assinatura legadas (Leilão)
 * - Parágrafos finais com nome+CPF do associado ou empresa+CNPJ
 * Preserva o restante do conteúdo intacto.
 */
export function sanitizeSignatureBlocks(html: string): string {
  if (!html) return html;
  let result = html;

  // 1. Blocos com classes CSS de assinatura
  result = result.replace(/<div[^>]*class\s*=\s*["'][^"']*signature-(?:block|area|labels|local-data)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');
  result = result.replace(/<p[^>]*class\s*=\s*["'][^"']*signature-(?:line|local-data)[^"']*["'][^>]*>[\s\S]*?<\/p>/gi, '');

  // 2. Bordas decorativas ━━━
  result = result.replace(/<p[^>]*>\s*[━]{5,}\s*<\/p>/gi, '');

  // 3. Bordas decorativas ────
  result = result.replace(/<p[^>]*>\s*[─]{5,}\s*<\/p>/gi, '');

  // 4. Parágrafos com linhas de underscores (3+)
  result = result.replace(/<p[^>]*>[^<]*_{3,}[^<]*<\/p>/gi, '');

  // 5. Texto "ASSINATURA DO ASSOCIADO" / variantes
  result = result.replace(/<p[^>]*>\s*(?:<strong>)?\s*(?:ASSINATURA|Assinatura)\s+(?:DO|do|da|DE|de)\s+(?:ASSOCIADO|Associado|CONTRATANTE|Contratante)[^<]*(?:<\/strong>)?\s*<\/p>/gi, '');

  // 6. Label "ASSOCIADO" sozinha
  result = result.replace(/<p[^>]*>\s*(?:<strong>)?\s*ASSOCIADO\s*(?:<\/strong>)?\s*<\/p>/gi, '');

  // 7. Label "ASSOCIAÇÃO" sozinha
  result = result.replace(/<p[^>]*>\s*(?:<strong>)?\s*ASSOCIA[ÇC][ÃA]O\s*(?:<\/strong>)?\s*<\/p>/gi, '');

  // 8. Label "AUTORIZAÇÃO" sozinha (TEV01)
  result = result.replace(/<p[^>]*>\s*AUTORIZA[ÇC][ÃA]O\s*<\/p>/gi, '');

  // 9. Sintaxe legada !{Associado}, !{Associacao}, ${local}, #{data_de_emissao}
  result = result.replace(/<p[^>]*>[^<]*!\{(?:Associado|Associacao)\}[^<]*<\/p>/gi, '');
  result = result.replace(/<p[^>]*>[^<]*\$\{local\}[^<]*#\{data_de_emissao\}[^<]*<\/p>/gi, '');

  // 10. Tabela de assinatura legada (Leilão) com !{Associado}
  result = result.replace(/<table[^>]*>[\s\S]*?!\{(?:Associado|Associacao)\}[\s\S]*?<\/table>/gi, '');

  // 11. Parágrafos finais com nome+CPF do associado (variáveis)
  result = result.replace(/<p[^>]*>\s*(?:<strong>)?\s*\{\{associado\.nome\}\}[\s\S]{0,30}(?:CPF|cpf)[:\s]*\{\{associado\.cpf\}\}\s*(?:<\/strong>)?\s*<\/p>/gi, '');

  // 12. Parágrafos com dados da empresa em contexto de assinatura (variáveis)
  result = result.replace(/<p[^>]*>\s*(?:<strong>)?\s*\{\{empresa\.nome\}\}[\s\S]{0,30}(?:CNPJ|cnpj)[:\s]*\{\{empresa\.cnpj\}\}\s*(?:<\/strong>)?\s*<\/p>/gi, '');

  // 13. Parágrafo "Dados da Agencia" (Leilão)
  result = result.replace(/<p[^>]*>\s*Dados da Agencia\s*<\/p>/gi, '');

  // 14. "Local / Data" ou "Local e Data" em contexto de assinatura
  result = result.replace(/<p[^>]*>\s*(?:<strong>)?\s*(?:Local\s*[\/e]\s*Data|LOCAL\s*[\/E]\s*DATA)\s*(?::)?\s*(?:<\/strong>)?\s*<\/p>/gi, '');

  // 15. Parágrafos com "Local, data" seguido de data por extenso
  result = result.replace(/<p[^>]*>[^<]*(?:Local|LOCAL)\s*,?\s*(?:\d{1,2}\s+de\s+\w+\s+de\s+\d{4}|—)[^<]*<\/p>/gi, '');

  // 15b. Parágrafos com "Local: ___" e "Data: ___" (underscores como placeholders)
  result = result.replace(/<p[^>]*>[^<]*Local\s*:\s*_{2,}[^<]*Data\s*:\s*[_/]{2,}[^<]*<\/p>/gi, '');

  // 16. Seção inteira "8. ASSINATURA" ou "ASSINATURA" como título de seção
  result = result.replace(/<(?:h[1-6]|div)[^>]*(?:class\s*=\s*["'][^"']*section-title[^"']*["'])?[^>]*>\s*(?:\d+\.\s*)?ASSINATURA\s*<\/(?:h[1-6]|div)>/gi, '');

  // 17. Divs com border-top que contêm nome/CPF ou ASSOCIADO/PRATICCAR (blocos de assinatura visual)
  result = result.replace(/<div[^>]*style\s*=\s*["'][^"']*border-top[^"']*["'][^>]*>[\s\S]{0,500}?(?:ASSOCIADO|PRATICCAR|CPF\s*:|CNPJ\s*:)[\s\S]*?<\/div>/gi, '');

  // 18. Parágrafos com nome real do associado + CPF formatado em contexto de assinatura (dados já substituídos)
  result = result.replace(/<p[^>]*>\s*(?:<strong>)?\s*CPF\s*:\s*\d{3}\.\d{3}\.\d{3}-\d{2}\s*(?:<\/strong>)?\s*<\/p>/gi, '');

  // 19. Div "signature-area" completa (com todo conteúdo interno)
  result = result.replace(/<div[^>]*class\s*=\s*["']signature-area["'][^>]*>[\s\S]*?<\/div>\s*(?:<\/div>\s*)*(?=<div[^>]*class\s*=\s*["']footer["']|<\/div>\s*<\/body>|$)/gi, '');

  // 20. Parágrafos com nome real (em bold) seguido de " - CPF: 123.456.789-00" (dados já substituídos)
  result = result.replace(/<p[^>]*>\s*(?:<strong>)?\s*[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇ][A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇ\s]+\s*-\s*CPF\s*:\s*\d{3}\.\d{3}\.\d{3}-\d{2}\s*(?:<\/strong>)?\s*<\/p>/gi, '');

  // 21. Parágrafos com cidade + data por extenso: "CIDADE, dd de mês de yyyy." (blocos de local/data já substituídos)
  result = result.replace(/<p[^>]*>\s*[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇ][A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇ\s]*,\s*\d{1,2}\s+de\s+\w+\s+de\s+\d{4}\.?\s*<\/p>/gi, '');

  // 22. Heading h3 "ASSINATURA" (gerado por markdown ### ASSINATURA)
  result = result.replace(/<h3[^>]*>\s*ASSINATURA\s*<\/h3>/gi, '');

  // 23. Limpar <p><br></p> consecutivos que sobraram
  result = result.replace(/(?:<p[^>]*>\s*(?:<br\s*\/?>)?\s*<\/p>\s*){3,}/gi, '<p><br></p>');

  return result;
}

// ============= SEÇÃO ASSINATURA (REMOVIDA) =============
// As funções generateAssinaturaAnexo e generateSecaoAssinatura foram removidas.
// A assinatura agora é feita exclusivamente via Autentique (rubrica + assinatura digital).



// ============= SUBSTITUIÇÃO DE VARIÁVEIS PARA EVENTO =============

/**
 * Substitui variáveis {{...}} usando mapeamento direto (não depende de TermoAfiliacaoData)
 */
export function substituirVariaveisEvento(conteudo: string, variaveis: Record<string, string>): string {
  let resultado = conteudo;
  for (const [chave, valor] of Object.entries(variaveis)) {
    resultado = resultado.replace(
      new RegExp(`\\{\\{\\s*${chave.replace('.', '\\.')}\\s*\\}\\}`, 'gi'),
      valor || '—'
    );
  }
  return resultado;
}

// ============= MARKDOWN PARA HTML =============

/**
 * Converte markdown básico para HTML
 */
export function markdownParaHTML(conteudo: string): string {
  // Se o conteúdo já é HTML rico (vindo do TipTap), não aplicar conversão markdown
  if (conteudo.includes('<table') || conteudo.includes('<p>') || conteudo.includes('<p ') || conteudo.includes('<div')) {
    return `<div class="content-body">${conteudo}</div>`;
  }

  let html = conteudo;
  
  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="section-title">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Bold e Italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  // Listas não ordenadas
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  
  // Listas ordenadas
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  
  // Parágrafos
  html = html.replace(/^([^<\n].+)$/gm, '<p>$1</p>');
  
  // Limpar linhas vazias duplicadas
  html = html.replace(/\n{3,}/g, '\n\n');
  
  // Envolver em div de seção
  html = `<div class="section">${html}</div>`;
  
  return html;
}

// ============= VERIFICAÇÕES CONDICIONAIS =============

/**
 * Verifica se é veículo zero km
 */
export function ehVeiculoZeroKm(veiculo: any): boolean {
  return (
    !veiculo.placa || 
    veiculo.placa === '' || 
    veiculo.placa.startsWith('000') ||
    veiculo.procedencia === 'Novo (zero km)'
  );
}

/**
 * Verifica se rastreador é obrigatório
 */
export function exigeRastreador(
  veiculo: any,
  config?: { fipeMinCarro: number; fipeMinMoto: number }
): { exige: boolean; motivo: string | null } {
  if (veiculo.combustivel?.toLowerCase() === 'diesel') {
    return { exige: true, motivo: 'Veículo a diesel' };
  }
  
  const valorFipe = veiculo.valor_fipe || 0;
  const categoria = (veiculo.categoria || '').toLowerCase();
  const isMoto = categoria.includes('moto') || categoria.includes('ciclomotor');
  
  const thresholdMoto = config?.fipeMinMoto ?? 9000;
  const thresholdCarro = config?.fipeMinCarro ?? 30000;
  
  if (isMoto && valorFipe >= thresholdMoto) {
    return { exige: true, motivo: `Valor FIPE acima de R$ ${thresholdMoto.toLocaleString('pt-BR')}` };
  }
  
  if (!isMoto && valorFipe >= thresholdCarro) {
    return { exige: true, motivo: `Valor FIPE acima de R$ ${thresholdCarro.toLocaleString('pt-BR')}` };
  }
  
  return { exige: false, motivo: null };
}

// ============= ADITIVOS DINÂMICOS =============

interface RegraAditivo {
  tipo: string;
  ativo: boolean;
  valor_config?: string;
}

interface TermoAditivo {
  id: string;
  nome: string;
  conteudo_html: string | null;
  regras: RegraAditivo[];
  ordem: number;
}

/**
 * Extrai códigos de benefícios adicionais contratados do templateData/contrato.
 * Procura em adicionais_selecionados (array de objetos com codigo) ou beneficios_codigos.
 */
export function extrairCodigosBeneficios(dados: any): string[] {
  // Se já tem array de códigos direto
  if (Array.isArray(dados?.beneficios_codigos)) return dados.beneficios_codigos;
  
  // Extrair de adicionais_selecionados (formato cotação/contrato)
  const adicionais = dados?.adicionais_selecionados || dados?.contrato?.adicionais_selecionados || [];
  if (Array.isArray(adicionais)) {
    return adicionais
      .map((a: any) => typeof a === 'string' ? a : (a?.codigo || a?.id || ''))
      .filter(Boolean);
  }
  return [];
}

function avaliarRegraEdge(
  regra: RegraAditivo,
  veiculo: any,
  fipeLimite: number,
  contexto?: { tipo_evento?: string; beneficios_codigos?: string[]; configRastreador?: { fipeMinCarro: number; fipeMinMoto: number }; sinistro?: { tipo?: string; com_bombeiros?: boolean; reparo_aprovado?: boolean }; contrato_extra?: { em_reativacao?: boolean; inadimplencia_dias?: number } }
): boolean {
  if (!regra.ativo) return false;

  const beneficios = contexto?.beneficios_codigos || [];

  switch (regra.tipo) {
    case 'veiculo_0km':
      return ehVeiculoZeroKm(veiculo);
    
    case 'fipe_acima_de':
      return (veiculo.valor_fipe || 0) >= fipeLimite;
    
    case 'evento_vidros':
      return contexto?.tipo_evento?.toLowerCase().includes('vidros') === true;
    
    case 'veiculo_blindado':
      return veiculo.blindado === true;

    // ===== REGRAS POR CARACTERÍSTICA DO VEÍCULO =====

    case 'rastreador_obrigatorio': {
      const fipe = veiculo.valor_fipe || 0;
      const combustivel = (veiculo.combustivel || '').toLowerCase();
      if (combustivel === 'diesel') return true;
      const categoria = (veiculo.categoria || '').toLowerCase();
      if (categoria.includes('moto')) {
        const limMoto = contexto?.configRastreador?.fipeMinMoto ?? 9000;
        return fipe >= limMoto;
      }
      const limCarro = contexto?.configRastreador?.fipeMinCarro ?? 30000;
      return fipe >= limCarro;
    }

    case 'rastreador_movel':
      return veiculo.instalacao_mesmo_dia === false;

    case 'veiculo_aplicativo': {
      const uso = (veiculo.tipo_uso || veiculo.uso_aplicativo || '').toString().toLowerCase();
      return uso.includes('app') || uso.includes('uber') || uso.includes('táxi') || uso.includes('taxi') || uso.includes('aplicativo') || veiculo.uso_aplicativo === true;
    }

    // ===== REGRAS POR BENEFÍCIO CONTRATADO =====

    case 'beneficio_vidros':
      return beneficios.some((c: string) => c.includes('VIDROS'));

    case 'beneficio_kit_gas':
      return beneficios.some((c: string) => c.includes('KIT_GAS'));

    case 'beneficio_danos_terceiros':
      return beneficios.some((c: string) => c.includes('TERCEIROS'));

    case 'beneficio_carro_reserva':
      return beneficios.some((c: string) => c.includes('CARRO_RESERVA'));

    case 'beneficio_reboque_excedente':
      return beneficios.some((c: string) => c.includes('REBOQUE_EXCEDENTE'));

    case 'beneficio_carencia_zero':
      return beneficios.some((c: string) => c.includes('CARENCIA_ZERO'));

    // ===== REGRAS POR SINISTRO/EVENTO =====

    case 'evento_sub_rogacao':
      return !!contexto?.sinistro?.tipo;

    case 'evento_aprovacao_conserto':
      return contexto?.sinistro?.reparo_aprovado === true;

    case 'evento_incendio':
      return contexto?.sinistro?.tipo?.toLowerCase().includes('incêndio') === true && contexto?.sinistro?.com_bombeiros === false;

    // ===== REGRAS POR GRUPO/CATEGORIA ESPECIAL =====

    case 'grupo_raridades_especial': {
      const grupo = (veiculo.grupo || '').toLowerCase();
      return grupo.includes('raridade') || grupo.includes('especial');
    }

    case 'categoria_depreciacao': {
      const cat = (veiculo.categoria_veiculo || veiculo.procedencia || '').toLowerCase();
      return cat.includes('leilao') || cat.includes('leilão') || cat.includes('chassi_remarcado') || cat.includes('ex_taxi') || cat.includes('placa_vermelha') || veiculo.leilao === true;
    }

    // ===== GESTÃO DE EQUIPAMENTO =====

    case 'rastreador_terceiros':
      return veiculo.rastreador_terceiros === true;

    // ===== MANUTENÇÃO/ATUALIZAÇÃO =====

    case 'opcao_atualizacao_fipe':
      return true;

    case 'vistoria_reativacao':
      return contexto?.contrato_extra?.em_reativacao === true || (contexto?.contrato_extra?.inadimplencia_dias || 0) > 5;

    // ===== PROPRIEDADE TERCEIRA =====

    case 'anuencia_proprietario': {
      const prop = (veiculo.proprietario_nome || '').trim().toLowerCase();
      const assoc = (veiculo.associado_nome || '').trim().toLowerCase();
      return prop !== '' && assoc !== '' && prop !== assoc;
    }

    default:
      return false;
  }
}

/**
 * Busca aditivos ativos do banco, avalia regras contra dados do veículo,
 * e retorna o HTML concatenado dos aditivos aplicáveis (com variáveis substituídas).
 */
export async function buscarEGerarAditivos(
  supabase: any,
  dadosVeiculo: any,
  dadosTemplate: any,
  contexto?: { tipo_evento?: string; beneficios_codigos?: string[]; configRastreador?: { fipeMinCarro: number; fipeMinMoto: number }; sinistro?: { tipo?: string; com_bombeiros?: boolean; reparo_aprovado?: boolean }; contrato_extra?: { em_reativacao?: boolean; inadimplencia_dias?: number } }
): Promise<string> {
  // 1. Buscar aditivos ativos ordenados
  const { data: aditivos, error: aditivosError } = await supabase
    .from('termos_aditivos')
    .select('id, nome, conteudo_html, regras, ordem')
    .eq('ativo', true)
    .order('ordem', { ascending: true });

  if (aditivosError || !aditivos || aditivos.length === 0) {
    console.log('[template-utils] Nenhum aditivo ativo encontrado:', aditivosError?.message);
    return '';
  }

  // 2. Buscar limite FIPE das configurações
  const { data: configData } = await supabase
    .from('configuracoes')
    .select('valor')
    .eq('chave', 'aditivo_fipe_limite')
    .maybeSingle();

  const fipeLimite = configData ? Number(configData.valor) : 100000;

  // 3. Avaliar regras e filtrar aditivos aplicáveis
  const aditivosAplicaveis: TermoAditivo[] = [];

  for (const aditivo of aditivos) {
    const regras = (aditivo.regras || []) as RegraAditivo[];
    
    // Se não tem regras, não anexa automaticamente
    if (regras.length === 0) continue;
    
    const algumaRegraBate = regras.some(r => avaliarRegraEdge(r, dadosVeiculo, fipeLimite, contexto));
    if (algumaRegraBate) {
      aditivosAplicaveis.push(aditivo);
    }
  }

  if (aditivosAplicaveis.length === 0) {
    console.log('[template-utils] Nenhum aditivo aplicável para este veículo');
    return '';
  }

  console.log(`[template-utils] ${aditivosAplicaveis.length} aditivo(s) aplicável(is):`, 
    aditivosAplicaveis.map(a => a.nome).join(', '));

  // 4. Gerar HTML dos aditivos aplicáveis (page-break-before no 1º aditivo; sem page-break-after no último)
  let htmlFinal = '';

  for (const aditivo of aditivosAplicaveis) {
    let conteudo = aditivo.conteudo_html || '';
    
    // Substituir variáveis no conteúdo do aditivo
    if (conteudo && dadosTemplate) {
      conteudo = substituirVariaveis(conteudo, dadosTemplate);
    }

    htmlFinal += `
<div class="section" style="page-break-before: always; margin-top: 30pt; border: 2px solid #1e40af; padding: 15pt; border-radius: 4pt;">
  <h2 class="section-title" style="color: #1e40af;">
    ${aditivo.nome}
  </h2>
  <p style="text-align: center; font-size: 9pt; color: #666; margin-bottom: 15pt;">
    (Anexo ao Termo de Afiliação)
  </p>
  ${conteudo}
</div>
`;
  }

  return htmlFinal;
}
