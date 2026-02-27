// ============================================
// TERMO DE AFILIAÇÃO AO PSM - TEMPLATE UNIFICADO
// ============================================
// Estrutura: 9 seções conforme especificação
// 1. Cabeçalho
// 2. Qualificação do Associado
// 3. Veículo Protegido
// 4. Plano e Coberturas
// 5. Valores e Pagamento
// 6. Declarações do Associado (9 itens)
// 7. Proteção de Dados (LGPD)
// 8. Disposições Finais
// 9. Assinatura
// ============================================

import {
  TermoAfiliacaoData,
  formatCPF,
  formatPhone,
  formatCEP,
  formatCurrency,
  formatDate,
  formatDateExtended,
  calcularCotaParticipacao,
  calcularPrimeiraMensalidade,
} from "./termo-afiliacao-utils.ts";

// ============= ESTILOS CSS =============

const generateStyles = (): string => `
<style>
  @page {
    size: A4;
    margin: 20mm;
  }
  
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt;
    line-height: 1.15;
    color: #333333;
    background: #ffffff;
  }
  
  .page {
    max-width: 210mm;
    margin: 0 auto;
  }
  
  /* CABEÇALHO */
  .header {
    text-align: center;
    margin-bottom: 20pt;
    padding-bottom: 10pt;
    border-bottom: 2px solid #1e40af;
  }
  
  .header-logo {
    font-size: 18pt;
    font-weight: bold;
    color: #1e40af;
    margin-bottom: 6pt;
  }
  
  .header-empresa {
    font-size: 9pt;
    color: #666666;
    margin-bottom: 4pt;
  }
  
  .header-titulo {
    font-size: 16pt;
    font-weight: bold;
    color: #1e40af;
    margin-top: 12pt;
    margin-bottom: 4pt;
  }
  
  .header-numero {
    font-size: 11pt;
    font-weight: bold;
  }
  
  /* SEÇÕES */
  .section {
    margin-bottom: 16pt;
    page-break-inside: avoid;
  }
  
  .section-title {
    font-size: 12pt;
    font-weight: bold;
    color: #1e40af;
    margin-bottom: 10pt;
    padding-bottom: 4pt;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .section-subtitle {
    font-size: 10pt;
    font-weight: bold;
    color: #374151;
    margin-top: 10pt;
    margin-bottom: 6pt;
  }
  
  /* CAMPOS */
  .field-row {
    display: flex;
    flex-wrap: wrap;
    margin-bottom: 6pt;
  }
  
  .field {
    margin-right: 20pt;
    margin-bottom: 4pt;
  }
  
  .field-label {
    font-weight: bold;
    display: inline;
  }
  
  .field-value {
    display: inline;
  }
  
  .field-full {
    width: 100%;
    margin-bottom: 6pt;
  }
  
  /* TABELAS */
  .table-valores {
    width: 100%;
    border-collapse: collapse;
    margin: 12pt 0;
    font-size: 10pt;
  }
  
  .table-valores td {
    padding: 8pt 10pt;
    border: 1px solid #d1d5db;
  }
  
  .table-valores td:first-child {
    background-color: #f9fafb;
    font-weight: normal;
    width: 60%;
  }
  
  .table-valores td:last-child {
    text-align: right;
    font-weight: bold;
  }
  
  .table-valores .header-row td {
    background-color: #1e40af;
    color: white;
    font-weight: bold;
    text-align: center;
  }
  
  /* COBERTURAS */
  .cobertura-list {
    margin: 10pt 0;
  }
  
  .cobertura-item {
    font-family: 'Courier New', monospace;
    font-size: 10pt;
    margin-bottom: 4pt;
    padding-left: 5pt;
  }
  
  .cobertura-check {
    color: #16a34a;
    font-weight: bold;
  }
  
  .cobertura-x {
    color: #9ca3af;
  }
  
  /* DECLARAÇÕES */
  .declaracao {
    margin-bottom: 12pt;
    text-align: justify;
  }
  
  .declaracao-titulo {
    font-weight: bold;
    margin-bottom: 4pt;
  }
  
  .declaracao-texto {
    font-size: 9pt;
    line-height: 1.4;
  }
  
  /* DESTAQUE */
  .highlight-box {
    background-color: #eff6ff;
    border: 1px solid #1e40af;
    border-radius: 4pt;
    padding: 10pt;
    margin: 10pt 0;
  }
  
  .nota-rodape {
    font-size: 8pt;
    color: #666666;
    font-style: italic;
    margin-top: 8pt;
  }
  
  /* ASSINATURA */
  .signature-area {
    margin-top: 40pt;
    padding-top: 20pt;
    border-top: 1px solid #e5e7eb;
    page-break-inside: avoid;
  }
  
  .signature-local-data {
    text-align: center;
    margin-bottom: 50pt;
    font-size: 10pt;
  }
  
  .signature-block {
    display: inline-block;
    width: 45%;
    text-align: center;
    vertical-align: top;
  }
  
  .signature-line {
    border-top: 1px solid #333333;
    width: 280px;
    margin: 0 auto;
    padding-top: 6pt;
    font-size: 9pt;
  }
  
  .signature-name {
    font-weight: bold;
    font-size: 10pt;
  }
  
  .signature-doc {
    font-size: 8pt;
    color: #666666;
  }
  
  .signature-role {
    font-size: 9pt;
    color: #374151;
  }
  
  /* RODAPÉ */
  .footer {
    margin-top: 30pt;
    text-align: center;
    font-size: 8pt;
    color: #666666;
    border-top: 1px solid #e5e7eb;
    padding-top: 10pt;
  }
  
  /* PÁGINA */
  .page-break {
    page-break-after: always;
  }
</style>
`;

// ============= CABEÇALHO =============

const generateHeader = (data: TermoAfiliacaoData): string => `
<div class="header">
  <div class="header-logo">ABP PRATICCAR</div>
  <div class="header-empresa">
    ASSOCIAÇÃO DE BENEFÍCIOS PRATICCAR<br>
    CNPJ: ${data.empresa.cnpj}<br>
    ${data.empresa.logradouro}, ${data.empresa.numero} - ${data.empresa.bairro}<br>
    ${data.empresa.cidade}/${data.empresa.uf} - CEP ${data.empresa.cep}
  </div>
  <div class="header-titulo">TERMO DE AFILIAÇÃO AO PROGRAMA DE SOCORRO MÚTUO</div>
  <div class="header-numero">Nº ${data.contrato.numero}</div>
</div>
`;

// ============= SEÇÃO 1: QUALIFICAÇÃO DO ASSOCIADO =============

const generateSecao1 = (data: TermoAfiliacaoData): string => `
<div class="section">
  <h2 class="section-title">1. QUALIFICAÇÃO DO ASSOCIADO</h2>
  
  <div class="field-full">
    <span class="field-label">Nome:</span> 
    <span class="field-value">${data.cliente.nome}</span>
  </div>
  
  <div class="field-row">
    <div class="field">
      <span class="field-label">CPF:</span> 
      <span class="field-value">${formatCPF(data.cliente.cpf)}</span>
    </div>
    <div class="field">
      <span class="field-label">RG:</span> 
      <span class="field-value">${data.cliente.rg || '—'}${data.cliente.rg_orgao ? ` - ${data.cliente.rg_orgao}` : ''}</span>
    </div>
  </div>
  
  <div class="field-row">
    <div class="field">
      <span class="field-label">CNH:</span> 
      <span class="field-value">${data.cliente.cnh || '—'}</span>
    </div>
    <div class="field">
      <span class="field-label">Validade:</span> 
      <span class="field-value">${formatDate(data.cliente.cnh_validade)}</span>
    </div>
    <div class="field">
      <span class="field-label">Categoria:</span> 
      <span class="field-value">${data.cliente.cnh_categoria || '—'}</span>
    </div>
  </div>
  
  <div class="field-row">
    <div class="field">
      <span class="field-label">Data de Nascimento:</span> 
      <span class="field-value">${formatDate(data.cliente.data_nascimento)}</span>
    </div>
    <div class="field">
      <span class="field-label">Estado Civil:</span> 
      <span class="field-value">${data.cliente.estado_civil || '—'}</span>
    </div>
  </div>
  
  <div class="field-full">
    <span class="field-label">Profissão:</span> 
    <span class="field-value">${data.cliente.profissao || '—'}</span>
  </div>
  
  <div class="field-full">
    <span class="field-label">E-mail:</span> 
    <span class="field-value">${data.cliente.email}</span>
  </div>
  
  <div class="field-row">
    <div class="field">
      <span class="field-label">Telefone:</span> 
      <span class="field-value">${formatPhone(data.cliente.telefone)}</span>
    </div>
    <div class="field">
      <span class="field-label">Telefone Secundário:</span> 
      <span class="field-value">${data.cliente.telefone_secundario ? formatPhone(data.cliente.telefone_secundario) : '—'}</span>
    </div>
  </div>
  
  <div class="field-full">
    <span class="field-label">Endereço:</span> 
    <span class="field-value">${data.cliente.logradouro}, ${data.cliente.numero}${data.cliente.complemento ? ', ' + data.cliente.complemento : ''}</span>
  </div>
  
  <div class="field-full">
    <span class="field-label">Bairro:</span> 
    <span class="field-value">${data.cliente.bairro}</span>
  </div>
  
  <div class="field-row">
    <div class="field">
      <span class="field-label">Cidade:</span> 
      <span class="field-value">${data.cliente.cidade} - ${data.cliente.uf}</span>
    </div>
    <div class="field">
      <span class="field-label">CEP:</span> 
      <span class="field-value">${formatCEP(data.cliente.cep)}</span>
    </div>
  </div>
</div>
`;

// ============= SEÇÃO 2: VEÍCULO PROTEGIDO =============

const generateSecao2 = (data: TermoAfiliacaoData): string => `
<div class="section">
  <h2 class="section-title">2. VEÍCULO PROTEGIDO</h2>
  
  <div class="field-row">
    <div class="field">
      <span class="field-label">Placa:</span> 
      <span class="field-value">${data.veiculo.placa}</span>
    </div>
    <div class="field">
      <span class="field-label">Chassi:</span> 
      <span class="field-value">${data.veiculo.chassi || '—'}</span>
    </div>
  </div>
  
  <div class="field-full">
    <span class="field-label">Renavam:</span> 
    <span class="field-value">${data.veiculo.renavam || '—'}</span>
  </div>
  
  <div class="field-full">
    <span class="field-label">Marca/Modelo:</span> 
    <span class="field-value">${data.veiculo.marca} ${data.veiculo.modelo}</span>
  </div>
  
  <div class="field-row">
    <div class="field">
      <span class="field-label">Ano Fabricação/Modelo:</span> 
      <span class="field-value">${data.veiculo.ano_fabricacao || data.veiculo.ano}/${data.veiculo.ano}</span>
    </div>
    <div class="field">
      <span class="field-label">Cor:</span> 
      <span class="field-value">${data.veiculo.cor || '—'}</span>
    </div>
  </div>
  
  <div class="field-row">
    <div class="field">
      <span class="field-label">Combustível:</span> 
      <span class="field-value">${data.veiculo.combustivel || '—'}</span>
    </div>
    <div class="field">
      <span class="field-label">Categoria:</span> 
      <span class="field-value">${data.veiculo.categoria || 'Automóvel'}</span>
    </div>
  </div>
  
  <div class="field-full">
    <span class="field-label">Tipo de Uso:</span> 
    <span class="field-value">${data.veiculo.tipo_uso || 'Particular'}</span>
  </div>
  
  <div class="field-row">
    <div class="field">
      <span class="field-label">Código FIPE:</span> 
      <span class="field-value">${data.veiculo.codigo_fipe || '—'}</span>
    </div>
    <div class="field">
      <span class="field-label">Valor FIPE na Data da Adesão:</span> 
      <span class="field-value">${formatCurrency(data.veiculo.valor_fipe)}</span>
    </div>
  </div>
  
  <div class="field-full">
    <span class="field-label">Alienação Fiduciária:</span> 
    <span class="field-value">${data.veiculo.alienado ? 'Sim' : 'Não'}</span>
    ${data.veiculo.alienado && data.veiculo.financeira ? `<br><span class="field-label">Agente Financeiro:</span> <span class="field-value">${data.veiculo.financeira}</span>` : ''}
  </div>
</div>
`;

// ============= SEÇÃO 3: PLANO E COBERTURAS =============

const generateSecao3 = (data: TermoAfiliacaoData): string => {
  const coberturas = data.plano.coberturas || [];
  const rastreador = exigeRastreador(data.veiculo, data.configRastreador);
  const textoRastreador = rastreador.exige ? 'Obrigatório' : 'Opcional';
  const coberturasHTML = coberturas.map(c => 
    `<div class="cobertura-item"><span class="cobertura-check">[X]</span> ${c}</div>`
  ).join('\n');
  
  return `
<div class="section">
  <h2 class="section-title">3. PLANO CONTRATADO E COBERTURAS</h2>
  
  <div class="field-row">
    <div class="field">
      <span class="field-label">Plano:</span> 
      <span class="field-value">${data.plano.nome}</span>
    </div>
    <div class="field">
      <span class="field-label">Tipo:</span> 
      <span class="field-value">${data.plano.tipo || data.plano.linha || 'Normal'}</span>
    </div>
  </div>
  
  <h3 class="section-subtitle">COBERTURAS INCLUÍDAS:</h3>
  <div class="cobertura-list">
    ${coberturasHTML || '<div class="cobertura-item"><span class="cobertura-check">[X]</span> Roubo e Furto</div><div class="cobertura-item"><span class="cobertura-check">[X]</span> Assistência 24 horas</div>'}
  </div>
  
  <div class="highlight-box">
    <strong>Rastreador Veicular:</strong> ${textoRastreador} (instalação por técnico credenciado)
  </div>
</div>
`;
};

// ============= SEÇÃO 4: VALORES E PAGAMENTO =============

const generateSecao4 = (data: TermoAfiliacaoData): string => {
  const cotaParticipacao = calcularCotaParticipacao(data.veiculo.valor_fipe, data.plano.cota_participacao);
  const primeiraMensalidade = calcularPrimeiraMensalidade(data.contrato.dia_vencimento);
  
  return `
<div class="section">
  <h2 class="section-title">4. VALORES E CONDIÇÕES DE PAGAMENTO</h2>
  
  <table class="table-valores">
    <tr class="header-row">
      <td colspan="2">RESUMO FINANCEIRO</td>
    </tr>
    <tr>
      <td>Valor FIPE do Veículo:</td>
      <td>${formatCurrency(data.veiculo.valor_fipe)}</td>
    </tr>
    <tr>
      <td>Taxa de Filiação (pagamento único):</td>
      <td>${formatCurrency(data.contrato.valor_adesao)}</td>
    </tr>
    <tr>
      <td>Quota Mensal Estimada:</td>
      <td>${formatCurrency((data.contrato.valor_mensal || 0) - (data.contrato.valor_adicional || 0))}</td>
    </tr>
    ${(data.contrato.valor_adicional || 0) > 0 ? `
    <tr>
      <td>Valor Adicional:</td>
      <td>${formatCurrency(data.contrato.valor_adicional)}</td>
    </tr>
    <tr>
      <td><strong>Total Mensal:</strong></td>
      <td><strong>${formatCurrency(data.contrato.valor_mensal)}</strong></td>
    </tr>
    ` : ''}
    <tr>
      <td>Cota de Participação (${data.plano.cota_participacao || 10}%):</td>
      <td>${formatCurrency(cotaParticipacao)}</td>
    </tr>
    <tr>
      <td>Cota Mínima:</td>
      <td>${formatCurrency(data.plano.cota_minima || 3000)}</td>
    </tr>
    <tr>
      <td>Dia de Vencimento:</td>
      <td>Todo dia ${data.contrato.dia_vencimento}</td>
    </tr>
    <tr>
      <td>Forma de Pagamento:</td>
      <td>${data.contrato.forma_pagamento || 'Boleto Bancário'}</td>
    </tr>
    <tr>
      <td>Primeira Mensalidade em:</td>
      <td>${primeiraMensalidade}</td>
    </tr>
  </table>
  
  <p class="nota-rodape">
    A quota mensal é pós-paga e calculada por rateio entre os associados, 
    podendo variar mensalmente conforme os custos do período.
  </p>
</div>
`;
};

// ============= SEÇÃO 5: DECLARAÇÕES DO ASSOCIADO =============

const generateSecao5 = (data: TermoAfiliacaoData): string => `
<div class="section">
  <h2 class="section-title">5. DECLARAÇÕES DO ASSOCIADO</h2>
  
  <p style="margin-bottom: 12pt;">
    Eu, <strong>${data.cliente.nome}</strong>, portador(a) do CPF nº <strong>${formatCPF(data.cliente.cpf)}</strong>, 
    DECLARO para os devidos fins que:
  </p>
  
  <div class="declaracao">
    <p class="declaracao-titulo">5.1. REGULAMENTO DO PSM</p>
    <p class="declaracao-texto">
      Recebi, li e compreendi integralmente o Regulamento do Programa de Socorro 
      Mútuo (PSM) da ABP PraticCar, concordando com todos os seus termos, 
      condições e disposições.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">5.2. VERACIDADE DAS INFORMAÇÕES</p>
    <p class="declaracao-texto">
      Todas as informações prestadas neste Termo de Afiliação são verdadeiras, 
      completas e atualizadas, estando ciente de que a prestação de informações 
      falsas, incompletas ou a omissão de dados relevantes pode resultar em minha 
      exclusão imediata do programa, sem direito a qualquer ressarcimento ou 
      indenização.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">5.3. CONDIÇÃO DO VEÍCULO</p>
    <p class="declaracao-texto">
      O veículo descrito neste termo encontra-se em perfeitas condições de 
      conservação, funcionamento e segurança, sem avarias, danos, sinistros 
      anteriores não declarados ou alterações que possam afetar sua segurança 
      ou agravar o risco de sinistro.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">5.4. DOCUMENTAÇÃO REGULAR</p>
    <p class="declaracao-texto">
      O veículo está com toda a documentação regularizada e em dia, incluindo 
      licenciamento anual, IPVA, multas e demais impostos e taxas, estando apto 
      a circular livremente em via pública conforme o Código de Trânsito Brasileiro.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">5.5. PROCEDÊNCIA DO VEÍCULO</p>
    <p class="declaracao-texto">
      A procedência do veículo protegido é: <strong>${data.veiculo.procedencia || 'Usado de particular'}</strong>
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">5.6. COMPREENSÃO DO MUTUALISMO</p>
    <p class="declaracao-texto">
      Compreendo plenamente que a ABP PraticCar é uma ASSOCIAÇÃO DE SOCORRO MÚTUO, 
      constituída sob a forma de associação civil sem fins lucrativos, NÃO SE 
      CONFIGURANDO como empresa seguradora, e que os valores das contribuições 
      mensais são RATEADOS entre todos os associados de acordo com os custos e 
      despesas de cada período, podendo variar para mais ou para menos.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">5.7. VALOR FIPE DE REFERÊNCIA</p>
    <p class="declaracao-texto">
      Estou ciente de que o valor de referência para cálculo de eventual 
      indenização será o VALOR FIPE REGISTRADO NO MOMENTO DESTA ADESÃO 
      (<strong>${formatCurrency(data.veiculo.valor_fipe)}</strong>), podendo solicitar atualização anual mediante pagamento 
      de taxa específica. Caso não solicite a atualização, a indenização será 
      calculada exclusivamente sobre o valor FIPE registrado neste termo, 
      independentemente da valorização ou desvalorização do veículo.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">5.8. AUTORIZAÇÃO DE SUB-ROGAÇÃO</p>
    <p class="declaracao-texto">
      AUTORIZO expressamente a ABP PraticCar a ser sub-rogada em todos os 
      direitos, ações e pretensões relativos a eventuais prejuízos causados ao 
      veículo protegido por terceiros, podendo a associação buscar o ressarcimento 
      dos valores pagos a título de indenização junto aos responsáveis pelo sinistro.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">5.9. RASTREADOR VEICULAR</p>
    <p class="declaracao-texto">
      Concordo com a instalação obrigatória do rastreador veicular, que será 
      realizada por técnico credenciado pela ABP PraticCar após aprovação do 
      cadastro, sendo condição indispensável para a efetivação da proteção.
    </p>
  </div>
</div>
`;

// ============= SEÇÃO 6: PROTEÇÃO DE DADOS (LGPD) =============

const generateSecao6 = (data: TermoAfiliacaoData): string => `
<div class="section">
  <h2 class="section-title">6. PROTEÇÃO DE DADOS PESSOAIS (LGPD)</h2>
  
  <p style="margin-bottom: 10pt;">Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018):</p>
  
  <div class="declaracao">
    <p class="declaracao-titulo">6.1. COLETA E TRATAMENTO</p>
    <p class="declaracao-texto">
      Autorizo a ABP PraticCar a coletar, armazenar, processar e tratar meus 
      dados pessoais para fins de cadastro, gestão da associação, processamento 
      de pagamentos, análise de sinistros, comunicações oficiais e cumprimento 
      de obrigações legais.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">6.2. COMPARTILHAMENTO</p>
    <p class="declaracao-texto">
      Autorizo o compartilhamento de meus dados pessoais com empresas de 
      rastreamento veicular, oficinas credenciadas, empresas de assistência 24h, 
      instituições financeiras, empresas de cobrança e órgãos públicos quando 
      exigido por lei, exclusivamente para as finalidades relacionadas à 
      execução dos serviços de proteção veicular.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">6.3. COMUNICAÇÕES</p>
    <p class="declaracao-texto">
      Autorizo o recebimento de comunicações oficiais da ABP PraticCar através 
      de WhatsApp, e-mail, SMS e telefone, reconhecendo o WhatsApp como canal 
      válido para notificações de cobrança e informações sobre sinistros.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">6.4. DIREITOS DO TITULAR</p>
    <p class="declaracao-texto">
      Estou ciente dos meus direitos como titular de dados pessoais, incluindo 
      acesso, correção, exclusão, portabilidade e revogação do consentimento, 
      podendo exercê-los através do e-mail ${data.empresa.lgpd_email || 'lgpd@praticcar.com.br'}.
    </p>
  </div>
</div>
`;

// ============= SEÇÃO 7: DISPOSIÇÕES FINAIS =============

const generateSecao7 = (): string => `
<div class="section">
  <h2 class="section-title">7. DISPOSIÇÕES FINAIS</h2>
  
  <div class="declaracao">
    <p class="declaracao-texto">
      <strong>7.1.</strong> Este Termo de Afiliação entra em vigor na data de sua assinatura, 
      passando o veículo a contar com a proteção do PSM após a confirmação do 
      pagamento da taxa de filiação e aprovação do cadastro.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-texto">
      <strong>7.2.</strong> A proteção somente terá início após a instalação do rastreador 
      veicular por técnico credenciado.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-texto">
      <strong>7.3.</strong> O associado declara ter recebido cópia do Regulamento do PSM e estar 
      ciente de todas as suas disposições.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-texto">
      <strong>7.4.</strong> Fica eleito o foro da Comarca do Rio de Janeiro/RJ para dirimir 
      quaisquer questões oriundas deste instrumento, com renúncia a qualquer 
      outro, por mais privilegiado que seja.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-texto">
      <strong>7.5.</strong> Este documento foi gerado eletronicamente e será assinado digitalmente, 
      tendo validade jurídica conforme Medida Provisória 2.200-2/2001 e 
      Lei 14.063/2020.
    </p>
  </div>
</div>
`;

// ============= SEÇÃO 8: ASSINATURA =============

const generateSecao8 = (data: TermoAfiliacaoData): string => {
  const localAssinatura = `${data.cliente.cidade}/${data.cliente.uf}`;
  const dataAssinatura = formatDateExtended(new Date().toISOString());
  
  return `
<div class="signature-area">
  <h2 class="section-title">8. ASSINATURA</h2>
  <br><br>
  <p class="signature-local-data">
    ${localAssinatura}, ${dataAssinatura}
  </p>
</div>
`;
};

// ============= RODAPÉ =============

const generateFooter = (data: TermoAfiliacaoData): string => `
<div class="footer">
  ABP PraticCar | Termo de Afiliação Nº ${data.contrato.numero}
</div>
`;

// ============= SEÇÃO CONDICIONAL: TERMO ADITIVO VEÍCULO 0KM =============

const generateSecaoCarroZero = (data: TermoAfiliacaoData): string => {
  // Verifica se é carro zero (sem placa, placa temporária ou procedência 0km)
  const isCarroZero = 
    !data.veiculo.placa || 
    data.veiculo.placa === '' || 
    data.veiculo.placa.startsWith('000') ||
    data.veiculo.procedencia === 'Novo (zero km)';
  
  if (!isCarroZero) return '';
  
  return `
<div class="section" style="margin-top: 30pt; border: 2px solid #dc2626; padding: 15pt; border-radius: 4pt;">
  <h2 class="section-title" style="color: #dc2626;">
    TERMO ADITIVO DE VEÍCULO 0KM
  </h2>
  
  <div class="declaracao">
    <p class="declaracao-titulo">Cláusula Primeira</p>
    <p class="declaracao-texto">
      O presente Termo Aditivo tem por objeto regulamentar a proteção de 
      veículo zero quilômetro (0 km) que ainda não possua placa no momento 
      da adesão à Associação.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">Cláusula Segunda</p>
    <p class="declaracao-texto">
      O associado compromete-se a providenciar o devido emplacamento do veículo 
      junto aos órgãos de trânsito competentes, dentro do prazo legal estabelecido 
      pelo CONTRAN e demais legislações aplicáveis.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">Cláusula Terceira</p>
    <p class="declaracao-texto">
      O associado declara, neste ato, estar ciente e de pleno acordo que, caso 
      não realize o emplacamento no prazo legal, a proteção de roubo e furto será 
      imediatamente suspensa, não sendo devida qualquer indenização em eventos 
      ocorridos durante o período de irregularidade.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">Cláusula Quarta</p>
    <p class="declaracao-texto">
      A cobertura será restabelecida automaticamente a partir da apresentação, 
      pelo associado, da documentação comprobatória de emplacamento do veículo 
      junto à Associação.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">Cláusula Quinta</p>
    <p class="declaracao-texto">
      A responsabilidade pelo emplacamento do veículo zero quilômetro é exclusiva 
      do associado, não cabendo à Associação qualquer obrigação ou interferência 
      junto aos órgãos de trânsito.
    </p>
  </div>
</div>
`;
};

// ============= SEÇÃO CONDICIONAL: TERMO RESPONSABILIDADE RASTREADOR =============

/**
 * Verifica se o rastreador é obrigatório com base nas regras:
 * - Diesel: SEMPRE obrigatório
 * - Moto: FIPE > R$ 9.000
 * - Carro: FIPE > R$ 20.000
 */
const exigeRastreador = (
  veiculo: any,
  config?: { fipeMinCarro: number; fipeMinMoto: number }
): { exige: boolean; motivo: string | null } => {
  // Diesel sempre exige rastreador
  if (veiculo.combustivel?.toLowerCase() === 'diesel') {
    return { exige: true, motivo: 'Veículo a diesel' };
  }
  
  const valorFipe = veiculo.valor_fipe || 0;
  const categoria = (veiculo.categoria || '').toLowerCase();
  const isMoto = categoria.includes('moto') || categoria.includes('ciclomotor');
  
  const thresholdMoto = config?.fipeMinMoto ?? 9000;
  const thresholdCarro = config?.fipeMinCarro ?? 30000;
  
  if (isMoto && valorFipe > thresholdMoto) {
    return { exige: true, motivo: `Valor FIPE acima de R$ ${thresholdMoto.toLocaleString('pt-BR')}` };
  }
  
  if (!isMoto && valorFipe > thresholdCarro) {
    return { exige: true, motivo: `Valor FIPE acima de R$ ${thresholdCarro.toLocaleString('pt-BR')}` };
  }
  
  return { exige: false, motivo: null };
};

const generateSecaoRastreador = (data: TermoAfiliacaoData): string => {
  const rastreador = exigeRastreador(data.veiculo, data.configRastreador);
  
  // Só gera a seção se rastreador for obrigatório
  if (!rastreador.exige) return '';
  
  const localAssinatura = `${data.cliente.cidade}/${data.cliente.uf}`;
  const dataAssinatura = formatDateExtended(new Date().toISOString());
  
  return `
<div class="section page-break" style="margin-top: 30pt; border: 2px solid #7c3aed; padding: 15pt; border-radius: 4pt;">
  <h2 class="section-title" style="color: #7c3aed;">
    TERMO DE RESPONSABILIDADE - EQUIPAMENTO RASTREADOR
  </h2>
  <p style="text-align: center; font-size: 9pt; color: #666; margin-bottom: 15pt;">
    (Anexo ao Termo de Afiliação Nº ${data.contrato.numero})
  </p>
  
  <p style="margin-bottom: 15pt; text-align: justify;">
    Pelo presente termo, o(a) associado(a) abaixo qualificado(a) declara ter 
    recebido em regime de <strong>COMODATO</strong> o equipamento rastreador para instalação 
    no veículo cadastrado, assumindo inteira responsabilidade pela sua guarda 
    e conservação.
  </p>
  
  <table class="table-valores" style="margin-bottom: 15pt;">
    <tr>
      <td style="background-color: #f9fafb; font-weight: bold;">Associado:</td>
      <td>${data.cliente.nome}</td>
    </tr>
    <tr>
      <td style="background-color: #f9fafb; font-weight: bold;">CPF:</td>
      <td>${formatCPF(data.cliente.cpf)}</td>
    </tr>
    <tr>
      <td style="background-color: #f9fafb; font-weight: bold;">Veículo:</td>
      <td>${data.veiculo.marca} ${data.veiculo.modelo} - ${data.veiculo.placa || 'ZERO KM'}</td>
    </tr>
    <tr>
      <td style="background-color: #f9fafb; font-weight: bold;">Motivo da Obrigatoriedade:</td>
      <td>${rastreador.motivo}</td>
    </tr>
  </table>
  
  <div class="declaracao">
    <p class="declaracao-titulo">1. DO EQUIPAMENTO</p>
    <p class="declaracao-texto">
      O equipamento rastreador é de propriedade exclusiva da ${data.empresa.nome}, 
      sendo cedido em comodato ao associado durante a vigência da filiação.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">2. DO RASTREAMENTO</p>
    <p class="declaracao-texto">
      O associado tem ciência e <strong>AUTORIZA</strong> o rastreamento 24 (vinte e quatro) horas 
      do veículo cadastrado, para fins de monitoramento e recuperação em caso de sinistro.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">3. DA DEVOLUÇÃO</p>
    <p class="declaracao-texto">
      O associado compromete-se a devolver o equipamento em perfeito estado de 
      funcionamento quando do desligamento do PSM, no prazo máximo de 15 (quinze) dias.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">4. DA MULTA</p>
    <p class="declaracao-texto">
      A não devolução do equipamento no prazo estipulado acarretará multa de 
      <strong>R$ 400,00 (quatrocentos reais)</strong>, valor que poderá ser cobrado judicialmente.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">5. DO TÍTULO EXECUTIVO</p>
    <p class="declaracao-texto">
      O presente termo tem força de <strong>TÍTULO EXECUTIVO EXTRAJUDICIAL</strong>, nos termos 
      do Art. 784 do Código de Processo Civil.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">6. DA OBRIGATORIEDADE</p>
    <p class="declaracao-texto">
      O associado declara estar ciente de que a instalação do rastreador é <strong>CONDIÇÃO OBRIGATÓRIA</strong> 
      para início da proteção, conforme as regras do PSM para veículos com valor FIPE superior 
      aos limites estabelecidos ou movidos a diesel.
    </p>
  </div>
  
  <div class="signature-area" style="margin-top: 30pt; padding-top: 15pt; border-top: 1px solid #e5e7eb;">
    <h2 class="section-title">ASSINATURA</h2>
    <br><br>
    <p style="text-align: center;">
      ${localAssinatura}, ${dataAssinatura}
    </p>
  </div>
</div>
`;
};

// ============= FUNÇÃO PRINCIPAL =============

/**
 * Gera o HTML completo do Termo de Afiliação ao PSM
 */
export function generateTermoAfiliacao(data: TermoAfiliacaoData): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Termo de Afiliação - ${data.contrato.numero}</title>
  ${generateStyles()}
</head>
<body>
  <div class="page">
    ${generateHeader(data)}
    ${generateSecao1(data)}
    ${generateSecao2(data)}
    ${generateSecaoCarroZero(data)}
    ${generateSecaoRastreador(data)}
    ${generateSecao3(data)}
    ${generateSecao4(data)}
    ${generateSecao5(data)}
    ${generateSecao6(data)}
    ${generateSecao7()}
    ${generateSecao8(data)}
    ${generateFooter(data)}
  </div>
</body>
</html>
  `;
}

export default generateTermoAfiliacao;
