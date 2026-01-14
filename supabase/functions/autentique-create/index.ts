import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUTENTIQUE_API_URL = "https://api.autentique.com.br/v2/graphql";
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Função para validar autorização (chamada interna ou usuário autenticado)
async function validateAuthorization(req: Request): Promise<{ authorized: boolean; method?: string; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  const apiKey = req.headers.get('apikey') || req.headers.get('x-apikey');
  
  console.log('[autentique-create] Validando auth - tem Authorization:', !!authHeader, '- tem apikey:', !!apiKey);
  
  // Cenário A: Chamada interna com apikey = service role key
  if (apiKey === SUPABASE_SERVICE_ROLE_KEY) {
    console.log('[autentique-create] Auth via apikey (service role)');
    return { authorized: true, method: 'apikey' };
  }
  
  // Cenário B: Chamada interna com Authorization Bearer = service role key
  if (authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    console.log('[autentique-create] Auth via bearer (service role)');
    return { authorized: true, method: 'bearer' };
  }
  
  // Cenário C: Usuário autenticado via JWT
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } }
      });
      
      const { data: { user }, error } = await supabaseUser.auth.getUser();
      if (user && !error) {
        console.log('[autentique-create] Auth via JWT user:', user.email);
        return { authorized: true, method: 'jwt' };
      }
    } catch (e) {
      console.error('[autentique-create] Erro ao validar JWT:', e);
    }
  }
  
  console.warn('[autentique-create] Nenhum método de auth válido encontrado');
  return { authorized: false, error: 'Unauthorized - Token inválido ou ausente' };
}

interface ContratoRequest {
  contratoId: string;
  clienteNome: string;
  clienteEmail: string;
  clienteCpf?: string;
  clienteTelefone?: string;
}

interface ContratoTemplateData {
  numero: string;
  clienteNome: string;
  clienteCpf: string;
  clienteEmail: string;
  clienteTelefone: string;
  planoNome: string;
  planoCodigo: string;
  planoDescricao: string;
  tipoUso: string;
  valorAdesao: number;
  valorMensal: number;
  diaVencimento: number;
  dataInicio: string;
  veiculoMarca?: string;
  veiculoModelo?: string;
  veiculoPlaca?: string;
  veiculoAno?: number;
  valorFipe?: number;
}

// ============= UTILIDADES =============

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR");
};

// ============= SEÇÕES COMUNS =============

const generateStyles = () => `
  <style>
    body {
      font-family: Arial, sans-serif;
      font-size: 12px;
      line-height: 1.6;
      color: #333;
      padding: 40px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 2px solid #1e40af;
      padding-bottom: 20px;
    }
    .header h1 {
      font-size: 24px;
      margin: 0;
      color: #1e40af;
    }
    .header .plano-badge {
      display: inline-block;
      background-color: #1e40af;
      color: white;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      margin-top: 8px;
    }
    .header p {
      margin: 5px 0;
      color: #666;
    }
    .section {
      margin-bottom: 25px;
    }
    .section h2 {
      font-size: 14px;
      color: #1e40af;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 5px;
      margin-bottom: 15px;
    }
    .field {
      margin-bottom: 8px;
    }
    .field-label {
      font-weight: bold;
      display: inline-block;
      width: 150px;
    }
    .values-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    .values-table th, .values-table td {
      border: 1px solid #e5e7eb;
      padding: 10px;
      text-align: left;
    }
    .values-table th {
      background-color: #f9fafb;
    }
    .coverage-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    .coverage-table td {
      border: 1px solid #e5e7eb;
      padding: 8px 12px;
    }
    .coverage-table tr:nth-child(even) {
      background-color: #f9fafb;
    }
    .coverage-check {
      color: #16a34a;
      font-weight: bold;
    }
    .coverage-x {
      color: #dc2626;
    }
    .terms {
      font-size: 10px;
      text-align: justify;
    }
    .terms h3 {
      font-size: 12px;
      margin-top: 15px;
    }
    .signature-area {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }
    .signature-line {
      margin-top: 60px;
      border-top: 1px solid #333;
      width: 300px;
      text-align: center;
      padding-top: 5px;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 10px;
      color: #666;
    }
    .highlight-box {
      background-color: #eff6ff;
      border: 1px solid #1e40af;
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
    }
  </style>
`;

const generateHeader = (data: ContratoTemplateData) => `
  <div class="header">
    <h1>CONTRATO DE ADESÃO</h1>
    <span class="plano-badge">${data.planoNome.toUpperCase()}</span>
    <p><strong>Nº ${data.numero}</strong></p>
    <p>Data de Emissão: ${formatDate(new Date().toISOString())}</p>
  </div>
`;

const generateDadosContratante = (data: ContratoTemplateData) => `
  <div class="section">
    <h2>1. DADOS DO CONTRATANTE</h2>
    <div class="field">
      <span class="field-label">Nome Completo:</span>
      ${data.clienteNome}
    </div>
    <div class="field">
      <span class="field-label">CPF:</span>
      ${data.clienteCpf || "Não informado"}
    </div>
    <div class="field">
      <span class="field-label">Email:</span>
      ${data.clienteEmail}
    </div>
    <div class="field">
      <span class="field-label">Telefone:</span>
      ${data.clienteTelefone || "Não informado"}
    </div>
  </div>
`;

const generateDadosVeiculo = (data: ContratoTemplateData) => {
  if (!data.veiculoMarca) return "";
  
  return `
    <div class="section">
      <h2>2. DADOS DO VEÍCULO</h2>
      <div class="field">
        <span class="field-label">Marca/Modelo:</span>
        ${data.veiculoMarca} ${data.veiculoModelo || ""}
      </div>
      <div class="field">
        <span class="field-label">Placa:</span>
        ${data.veiculoPlaca || "Não informado"}
      </div>
      <div class="field">
        <span class="field-label">Ano:</span>
        ${data.veiculoAno || "Não informado"}
      </div>
      ${data.valorFipe ? `
      <div class="field">
        <span class="field-label">Valor FIPE:</span>
        ${formatCurrency(data.valorFipe)}
      </div>
      ` : ""}
    </div>
  `;
};

const generateValoresContrato = (data: ContratoTemplateData) => `
  <div class="section">
    <h2>3. VALORES DO CONTRATO</h2>
    <table class="values-table">
      <tr>
        <th>Descrição</th>
        <th>Valor</th>
      </tr>
      <tr>
        <td>Plano</td>
        <td>${data.planoNome}</td>
      </tr>
      <tr>
        <td>Taxa de Adesão</td>
        <td>${formatCurrency(data.valorAdesao)}</td>
      </tr>
      <tr>
        <td>Mensalidade</td>
        <td>${formatCurrency(data.valorMensal)}</td>
      </tr>
      <tr>
        <td>Dia de Vencimento</td>
        <td>Todo dia ${data.diaVencimento}</td>
      </tr>
      <tr>
        <td>Data de Início</td>
        <td>${formatDate(data.dataInicio)}</td>
      </tr>
    </table>
  </div>
`;

const generateAssinatura = (data: ContratoTemplateData) => `
  <div class="signature-area">
    <p>Ao assinar eletronicamente este documento, o CONTRATANTE declara estar ciente e de acordo com todas as condições estabelecidas neste contrato, incluindo as coberturas, carências e exclusões do plano ${data.planoNome}.</p>
    
    <div class="signature-line">
      ${data.clienteNome}<br>
      <small>Contratante</small>
    </div>
  </div>
`;

const generateFooter = () => `
  <div class="footer">
    <p>Documento gerado eletronicamente e assinado digitalmente via plataforma Autentique.</p>
    <p>Este contrato tem validade jurídica conforme Lei nº 14.063/2020.</p>
  </div>
`;

// ============= COBERTURAS POR PLANO =============

const generateCoberturasBasico = (data: ContratoTemplateData) => `
  <div class="section">
    <h2>4. COBERTURAS CONTRATADAS - PLANO BÁSICO</h2>
    <table class="coverage-table">
      <tr>
        <td><span class="coverage-check">✓</span> Roubo e Furto</td>
        <td>100% Tabela FIPE</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Assistência 24h</td>
        <td>Guincho até 100km</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Rastreamento Veicular</td>
        <td>Monitoramento 24h</td>
      </tr>
      <tr>
        <td><span class="coverage-x">✗</span> Colisão</td>
        <td>Não incluso</td>
      </tr>
      <tr>
        <td><span class="coverage-x">✗</span> Danos a Terceiros</td>
        <td>Não incluso</td>
      </tr>
      <tr>
        <td><span class="coverage-x">✗</span> Carro Reserva</td>
        <td>Não incluso</td>
      </tr>
    </table>
    
    <div class="highlight-box">
      <strong>Franquia:</strong> 10% do valor FIPE em caso de indenização<br>
      <strong>Carência:</strong> 90 dias após instalação do rastreador
    </div>
  </div>
`;

const generateCoberturasIntermediario = (data: ContratoTemplateData) => `
  <div class="section">
    <h2>4. COBERTURAS CONTRATADAS - PLANO INTERMEDIÁRIO</h2>
    <table class="coverage-table">
      <tr>
        <td><span class="coverage-check">✓</span> Roubo e Furto</td>
        <td>100% Tabela FIPE</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Colisão</td>
        <td>Franquia: 8% FIPE</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Incêndio e Fenômenos Naturais</td>
        <td>100% Tabela FIPE</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Assistência 24h Completa</td>
        <td>Guincho até 200km</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Rastreamento Veicular</td>
        <td>Monitoramento 24h</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Carro Reserva</td>
        <td>7 dias</td>
      </tr>
      <tr>
        <td><span class="coverage-x">✗</span> Danos a Terceiros</td>
        <td>Não incluso</td>
      </tr>
      <tr>
        <td><span class="coverage-x">✗</span> Vidros e Faróis</td>
        <td>Não incluso</td>
      </tr>
    </table>
    
    <div class="highlight-box">
      <strong>Franquia:</strong> 8% do valor FIPE em caso de indenização<br>
      <strong>Carência:</strong> 60 dias após instalação do rastreador
    </div>
  </div>
`;

const generateCoberturasPremium = (data: ContratoTemplateData) => `
  <div class="section">
    <h2>4. COBERTURAS CONTRATADAS - PLANO PREMIUM</h2>
    <table class="coverage-table">
      <tr>
        <td><span class="coverage-check">✓</span> Roubo e Furto</td>
        <td>100% Tabela FIPE</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Colisão</td>
        <td>Franquia: 5% FIPE</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Incêndio e Fenômenos Naturais</td>
        <td>100% Tabela FIPE</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Danos a Terceiros</td>
        <td>Até R$ 50.000,00</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Vidros, Faróis e Retrovisores</td>
        <td>Sem franquia</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Assistência 24h Premium</td>
        <td>Guincho ilimitado + chaveiro</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Rastreamento Veicular</td>
        <td>Monitoramento 24h + bloqueio remoto</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Carro Reserva</td>
        <td>15 dias</td>
      </tr>
    </table>
    
    <div class="highlight-box">
      <strong>Franquia:</strong> 5% do valor FIPE em caso de indenização<br>
      <strong>Carência:</strong> 30 dias após instalação do rastreador<br>
      <strong>Benefício exclusivo:</strong> Desconto de 10% na renovação
    </div>
  </div>
`;

const generateCoberturasAplicativo = (data: ContratoTemplateData) => `
  <div class="section">
    <h2>4. COBERTURAS CONTRATADAS - PLANO APLICATIVO</h2>
    <p><em>Plano especial para veículos utilizados em aplicativos de transporte (Uber, 99, etc.)</em></p>
    <table class="coverage-table">
      <tr>
        <td><span class="coverage-check">✓</span> Roubo e Furto</td>
        <td>100% Tabela FIPE</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Colisão</td>
        <td>Franquia: 6% FIPE</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Incêndio e Fenômenos Naturais</td>
        <td>100% Tabela FIPE</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Danos a Terceiros</td>
        <td>Até R$ 40.000,00</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Assistência 24h Comercial</td>
        <td>Guincho ilimitado + pane seca</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Rastreamento Veicular</td>
        <td>Monitoramento 24h + relatório de uso</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Carro Reserva</td>
        <td>10 dias</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Lucros Cessantes</td>
        <td>5 diárias de R$ 100,00</td>
      </tr>
    </table>
    
    <div class="highlight-box">
      <strong>Franquia:</strong> 6% do valor FIPE em caso de indenização<br>
      <strong>Carência:</strong> 15 dias após instalação do rastreador<br>
      <strong>Observação:</strong> Cobertura válida durante uso comercial em aplicativos
    </div>
  </div>
`;

const generateCoberturasDefault = (data: ContratoTemplateData) => `
  <div class="section">
    <h2>4. COBERTURAS CONTRATADAS</h2>
    <table class="coverage-table">
      <tr>
        <td><span class="coverage-check">✓</span> Roubo e Furto</td>
        <td>100% Tabela FIPE</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Assistência 24h</td>
        <td>Guincho até 100km</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Rastreamento Veicular</td>
        <td>Monitoramento 24h</td>
      </tr>
    </table>
    
    <div class="highlight-box">
      <strong>Franquia:</strong> Conforme tabela do plano contratado<br>
      <strong>Carência:</strong> 90 dias após instalação do rastreador
    </div>
  </div>
`;

// ============= TERMOS POR PLANO =============

const generateTermosBasico = () => `
  <div class="section terms">
    <h2>5. TERMOS E CONDIÇÕES - PLANO BÁSICO</h2>
    
    <h3>5.1 Objeto do Contrato</h3>
    <p>O presente contrato tem por objeto a prestação de serviços de proteção veicular básica, incluindo rastreamento, assistência 24 horas e cobertura contra roubo e furto, conforme condições estabelecidas neste instrumento.</p>
    
    <h3>5.2 Coberturas e Exclusões</h3>
    <p>O PLANO BÁSICO cobre exclusivamente eventos de roubo e furto qualificado. Não estão cobertas colisões, danos a terceiros, fenômenos naturais ou quaisquer avarias no veículo decorrentes de uso normal ou acidente.</p>
    
    <h3>5.3 Carência</h3>
    <p>O período de carência para acionamento de coberturas é de 90 (noventa) dias a partir da instalação do rastreador no veículo. Durante este período, apenas a assistência 24h estará disponível.</p>
    
    <h3>5.4 Franquia</h3>
    <p>Em caso de indenização, será aplicada franquia de 10% (dez por cento) do valor FIPE do veículo na data do sinistro.</p>
    
    <h3>5.5 Obrigações do Contratante</h3>
    <p>O CONTRATANTE se compromete a: (a) Manter os dados cadastrais atualizados; (b) Efetuar o pagamento das mensalidades até a data de vencimento; (c) Manter o dispositivo de rastreamento em perfeito funcionamento; (d) Comunicar imediatamente qualquer sinistro em até 24 horas.</p>
    
    <h3>5.6 Vigência e Rescisão</h3>
    <p>O contrato tem vigência de 12 (doze) meses, renovável automaticamente. A rescisão pode ser solicitada a qualquer momento, mediante aviso prévio de 30 dias e pagamento de eventuais débitos pendentes.</p>
    
    <h3>5.7 Foro</h3>
    <p>Fica eleito o foro da comarca da sede da CONTRATADA para dirimir quaisquer controvérsias oriundas deste contrato.</p>
  </div>
`;

const generateTermosIntermediario = () => `
  <div class="section terms">
    <h2>5. TERMOS E CONDIÇÕES - PLANO INTERMEDIÁRIO</h2>
    
    <h3>5.1 Objeto do Contrato</h3>
    <p>O presente contrato tem por objeto a prestação de serviços de proteção veicular intermediária, incluindo rastreamento, assistência 24 horas completa, cobertura contra roubo, furto e colisão, além de carro reserva por 7 dias.</p>
    
    <h3>5.2 Coberturas</h3>
    <p>O PLANO INTERMEDIÁRIO inclui: (a) Roubo e furto qualificado - 100% FIPE; (b) Colisão - mediante franquia; (c) Incêndio e fenômenos naturais; (d) Assistência 24h com guincho até 200km; (e) Carro reserva por 7 dias em caso de sinistro coberto.</p>
    
    <h3>5.3 Exclusões</h3>
    <p>Não estão cobertas: danos a terceiros, vidros/faróis/retrovisores, danos por uso comercial não declarado, sinistros durante condução por pessoas não habilitadas.</p>
    
    <h3>5.4 Carência</h3>
    <p>O período de carência é de 60 (sessenta) dias a partir da instalação do rastreador. A assistência 24h está disponível desde o primeiro dia.</p>
    
    <h3>5.5 Franquia</h3>
    <p>Franquia de 8% (oito por cento) do valor FIPE para eventos de colisão. Roubo e furto não possuem franquia adicional.</p>
    
    <h3>5.6 Obrigações do Contratante</h3>
    <p>O CONTRATANTE se compromete a: (a) Manter os dados cadastrais atualizados; (b) Efetuar o pagamento das mensalidades pontualmente; (c) Realizar vistorias periódicas quando solicitado; (d) Comunicar sinistros em até 24 horas; (e) Registrar Boletim de Ocorrência em caso de roubo/furto.</p>
    
    <h3>5.7 Vigência e Rescisão</h3>
    <p>Vigência de 12 meses, renovável automaticamente. Rescisão mediante aviso prévio de 30 dias.</p>
    
    <h3>5.8 Foro</h3>
    <p>Fica eleito o foro da comarca da sede da CONTRATADA para dirimir quaisquer controvérsias.</p>
  </div>
`;

const generateTermosPremium = () => `
  <div class="section terms">
    <h2>5. TERMOS E CONDIÇÕES - PLANO PREMIUM</h2>
    
    <h3>5.1 Objeto do Contrato</h3>
    <p>O presente contrato tem por objeto a prestação de serviços de proteção veicular completa, o mais abrangente da nossa linha de produtos, incluindo todas as coberturas disponíveis, assistência 24h premium e benefícios exclusivos.</p>
    
    <h3>5.2 Coberturas Completas</h3>
    <p>O PLANO PREMIUM inclui: (a) Roubo e furto - 100% FIPE; (b) Colisão - franquia reduzida de 5%; (c) Incêndio e fenômenos naturais; (d) Danos a terceiros até R$ 50.000; (e) Vidros, faróis e retrovisores sem franquia; (f) Assistência 24h premium com guincho ilimitado e chaveiro; (g) Carro reserva por 15 dias; (h) Bloqueio remoto do veículo.</p>
    
    <h3>5.3 Benefícios Exclusivos</h3>
    <p>Clientes Premium têm direito a: (a) Carência reduzida de apenas 30 dias; (b) Desconto de 10% na renovação anual; (c) Atendimento prioritário; (d) App exclusivo com funcionalidades avançadas.</p>
    
    <h3>5.4 Carência</h3>
    <p>Período de carência reduzido de 30 (trinta) dias. Assistência 24h disponível imediatamente.</p>
    
    <h3>5.5 Franquia</h3>
    <p>Franquia reduzida de 5% (cinco por cento) do valor FIPE para colisão. Vidros, faróis e retrovisores sem franquia.</p>
    
    <h3>5.6 Obrigações do Contratante</h3>
    <p>O CONTRATANTE se compromete a manter cadastro atualizado, efetuar pagamentos pontualmente, manter rastreador funcionando, comunicar sinistros em até 24h, registrar B.O. quando aplicável e realizar vistorias quando solicitado.</p>
    
    <h3>5.7 Vigência e Renovação</h3>
    <p>Vigência de 12 meses com renovação automática e desconto de fidelidade de 10%. Rescisão mediante aviso de 30 dias.</p>
    
    <h3>5.8 Foro</h3>
    <p>Fica eleito o foro da comarca da sede da CONTRATADA para dirimir quaisquer controvérsias.</p>
  </div>
`;

const generateTermosAplicativo = () => `
  <div class="section terms">
    <h2>5. TERMOS E CONDIÇÕES - PLANO APLICATIVO</h2>
    
    <h3>5.1 Objeto do Contrato</h3>
    <p>O presente contrato tem por objeto a prestação de serviços de proteção veicular especial para veículos utilizados em aplicativos de transporte de passageiros (Uber, 99, InDriver e similares), com coberturas específicas para uso comercial.</p>
    
    <h3>5.2 Declaração de Uso Comercial</h3>
    <p>O CONTRATANTE declara que o veículo objeto deste contrato é utilizado para transporte de passageiros por aplicativo, estando ciente de que esta condição é essencial para a validade das coberturas contratadas.</p>
    
    <h3>5.3 Coberturas Especiais</h3>
    <p>O PLANO APLICATIVO inclui: (a) Roubo e furto - 100% FIPE; (b) Colisão - franquia de 6%; (c) Incêndio e fenômenos naturais; (d) Danos a terceiros até R$ 40.000; (e) Assistência 24h comercial com guincho ilimitado; (f) Carro reserva por 10 dias; (g) Lucros cessantes - 5 diárias de R$ 100.</p>
    
    <h3>5.4 Lucros Cessantes</h3>
    <p>Em caso de sinistro coberto que impeça o uso do veículo, o CONTRATANTE receberá indenização de R$ 100,00 (cem reais) por dia, limitado a 5 (cinco) diárias, para compensar a perda de rendimentos.</p>
    
    <h3>5.5 Carência Reduzida</h3>
    <p>Período de carência de apenas 15 (quinze) dias, considerando a natureza comercial da atividade. Assistência 24h disponível desde o primeiro dia.</p>
    
    <h3>5.6 Franquia</h3>
    <p>Franquia de 6% (seis por cento) do valor FIPE para eventos de colisão.</p>
    
    <h3>5.7 Vistoria Periódica</h3>
    <p>Devido ao uso intensivo do veículo, poderão ser solicitadas vistorias periódicas a cada 6 meses para verificação das condições do veículo e funcionamento do rastreador.</p>
    
    <h3>5.8 Obrigações Específicas</h3>
    <p>Além das obrigações gerais, o CONTRATANTE deve: (a) Manter cadastro ativo na plataforma de aplicativo; (b) Informar alteração de plataforma; (c) Manter documentação do veículo em dia para transporte de passageiros.</p>
    
    <h3>5.9 Vigência e Rescisão</h3>
    <p>Vigência de 12 meses, renovável. Rescisão mediante aviso de 30 dias.</p>
    
    <h3>5.10 Foro</h3>
    <p>Fica eleito o foro da comarca da sede da CONTRATADA para dirimir controvérsias.</p>
  </div>
`;

const generateTermosDefault = () => `
  <div class="section terms">
    <h2>5. TERMOS E CONDIÇÕES GERAIS</h2>
    
    <h3>5.1 Objeto do Contrato</h3>
    <p>O presente contrato tem por objeto a prestação de serviços de proteção veicular, incluindo rastreamento, assistência 24 horas e coberturas conforme plano contratado.</p>
    
    <h3>5.2 Obrigações do Contratante</h3>
    <p>O CONTRATANTE se compromete a: (a) Manter os dados cadastrais atualizados; (b) Efetuar o pagamento das mensalidades até a data de vencimento; (c) Manter o dispositivo de rastreamento em perfeito funcionamento; (d) Comunicar imediatamente qualquer sinistro.</p>
    
    <h3>5.3 Carência</h3>
    <p>O período de carência para acionamento de coberturas é de 90 (noventa) dias a partir da instalação do rastreador no veículo.</p>
    
    <h3>5.4 Vigência e Rescisão</h3>
    <p>O contrato tem vigência de 12 (doze) meses, renovável automaticamente. A rescisão pode ser solicitada a qualquer momento, mediante aviso prévio de 30 dias.</p>
    
    <h3>5.5 Foro</h3>
    <p>Fica eleito o foro da comarca da sede da CONTRATADA para dirimir quaisquer controvérsias oriundas deste contrato.</p>
  </div>
`;

// ============= FUNÇÕES GERADORAS DE TEMPLATE =============

function generateTemplateBasico(data: ContratoTemplateData): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  ${generateStyles()}
</head>
<body>
  ${generateHeader(data)}
  ${generateDadosContratante(data)}
  ${generateDadosVeiculo(data)}
  ${generateValoresContrato(data)}
  ${generateCoberturasBasico(data)}
  ${generateTermosBasico()}
  ${generateAssinatura(data)}
  ${generateFooter()}
</body>
</html>
  `;
}

function generateTemplateIntermediario(data: ContratoTemplateData): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  ${generateStyles()}
</head>
<body>
  ${generateHeader(data)}
  ${generateDadosContratante(data)}
  ${generateDadosVeiculo(data)}
  ${generateValoresContrato(data)}
  ${generateCoberturasIntermediario(data)}
  ${generateTermosIntermediario()}
  ${generateAssinatura(data)}
  ${generateFooter()}
</body>
</html>
  `;
}

function generateTemplatePremium(data: ContratoTemplateData): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  ${generateStyles()}
</head>
<body>
  ${generateHeader(data)}
  ${generateDadosContratante(data)}
  ${generateDadosVeiculo(data)}
  ${generateValoresContrato(data)}
  ${generateCoberturasPremium(data)}
  ${generateTermosPremium()}
  ${generateAssinatura(data)}
  ${generateFooter()}
</body>
</html>
  `;
}

function generateTemplateAplicativo(data: ContratoTemplateData): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  ${generateStyles()}
</head>
<body>
  ${generateHeader(data)}
  ${generateDadosContratante(data)}
  ${generateDadosVeiculo(data)}
  ${generateValoresContrato(data)}
  ${generateCoberturasAplicativo(data)}
  ${generateTermosAplicativo()}
  ${generateAssinatura(data)}
  ${generateFooter()}
</body>
</html>
  `;
}

function generateTemplateDefault(data: ContratoTemplateData): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  ${generateStyles()}
</head>
<body>
  ${generateHeader(data)}
  ${generateDadosContratante(data)}
  ${generateDadosVeiculo(data)}
  ${generateValoresContrato(data)}
  ${generateCoberturasDefault(data)}
  ${generateTermosDefault()}
  ${generateAssinatura(data)}
  ${generateFooter()}
</body>
</html>
  `;
}

// ============= SELETOR DE TEMPLATE =============

type TemplateGenerator = (data: ContratoTemplateData) => string;

const TEMPLATES: Record<string, TemplateGenerator> = {
  'BASICO': generateTemplateBasico,
  'BASIC': generateTemplateBasico,
  'INTERMEDIARIO': generateTemplateIntermediario,
  'INTER': generateTemplateIntermediario,
  'PREMIUM': generateTemplatePremium,
  'PREM': generateTemplatePremium,
  'APLICATIVO': generateTemplateAplicativo,
  'APP': generateTemplateAplicativo,
  'UBER': generateTemplateAplicativo,
};

function getTemplateByPlanCode(planoCodigo: string): TemplateGenerator {
  // Normaliza o código: uppercase, remove acentos
  const codigo = planoCodigo
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  
  // Procura match exato ou parcial
  for (const [key, template] of Object.entries(TEMPLATES)) {
    if (codigo.includes(key) || key.includes(codigo)) {
      return template;
    }
  }
  
  return generateTemplateDefault;
}

// ============= HANDLER PRINCIPAL =============

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validar autorização (chamada interna ou usuário autenticado)
  const authResult = await validateAuthorization(req);
  if (!authResult.authorized) {
    console.error('[autentique-create] Acesso não autorizado');
    return new Response(
      JSON.stringify({ error: authResult.error }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const autentiqueApiKey = Deno.env.get("AUTENTIQUE_API_KEY");
    if (!autentiqueApiKey) {
      throw new Error("AUTENTIQUE_API_KEY não configurada");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { contratoId, clienteNome, clienteEmail, clienteCpf, clienteTelefone }: ContratoRequest = await req.json();

    console.log("Criando documento Autentique para contrato:", contratoId);

    // Buscar dados do contrato com plano e lead
    const { data: contrato, error: contratoError } = await supabase
      .from("contratos")
      .select(`
        *,
        planos (*),
        leads (*)
      `)
      .eq("id", contratoId)
      .single();

    if (contratoError || !contrato) {
      throw new Error(`Contrato não encontrado: ${contratoError?.message}`);
    }

    // Preparar dados do template
    const templateData: ContratoTemplateData = {
      numero: contrato.numero,
      clienteNome: clienteNome || contrato.leads?.nome || "Cliente",
      clienteCpf: clienteCpf || contrato.leads?.cpf || "",
      clienteEmail: clienteEmail || contrato.leads?.email || "",
      clienteTelefone: clienteTelefone || contrato.leads?.telefone || "",
      planoNome: contrato.planos?.nome || "Plano Padrão",
      planoCodigo: contrato.planos?.codigo || "",
      planoDescricao: contrato.planos?.descricao || "",
      tipoUso: contrato.planos?.tipo_uso || "particular",
      valorAdesao: contrato.valor_adesao,
      valorMensal: contrato.valor_mensal,
      diaVencimento: contrato.dia_vencimento || 10,
      dataInicio: contrato.data_inicio,
      veiculoMarca: contrato.leads?.veiculo_marca,
      veiculoModelo: contrato.leads?.veiculo_modelo,
      veiculoPlaca: contrato.leads?.veiculo_placa,
      veiculoAno: contrato.leads?.veiculo_ano,
      valorFipe: contrato.leads?.veiculo_fipe,
    };

    // Selecionar template baseado no código do plano
    const planoCodigo = contrato.planos?.codigo || "";
    const templateGenerator = getTemplateByPlanCode(planoCodigo);
    const contratoHTML = templateGenerator(templateData);

    console.log(`Template selecionado para plano "${planoCodigo}": ${templateGenerator.name}`);

    // Criar documento no Autentique via GraphQL Multipart Request Spec
    // Referência: https://github.com/jaydenseric/graphql-multipart-request-spec
    const mutation = `
      mutation CreateDocumentMutation(
        $document: DocumentInput!
        $signers: [SignerInput!]!
        $file: Upload!
      ) {
        createDocument(
          document: $document
          signers: $signers
          file: $file
        ) {
          id
          name
          refusable
          sortable
          created_at
          signatures {
            public_id
            name
            email
            created_at
            action { name }
            link { short_link }
            user { id name email }
          }
        }
      }
    `;

    const signerEmail = clienteEmail || contrato.leads?.email;
    const documentName = `Contrato ${contrato.numero} - ${clienteNome || contrato.leads?.nome} - ${contrato.planos?.nome || 'Plano'}`;
    
    // Preparar operations JSON (com file: null como placeholder)
    const operations = {
      query: mutation,
      variables: {
        document: {
          name: documentName,
        },
        signers: [
          {
            email: signerEmail,
            action: "SIGN",
            positions: [
              {
                x: "65.0",
                y: "80.0",
                z: "1",
                element: "SIGNATURE",
              },
            ],
          },
        ],
        file: null, // Placeholder - será mapeado pelo FormData
      },
    };

    // Map indica onde o arquivo será injetado
    const map = {
      "0": ["variables.file"],
    };

    // Criar FormData seguindo GraphQL Multipart Request Spec
    const formData = new FormData();
    formData.append("operations", JSON.stringify(operations));
    formData.append("map", JSON.stringify(map));
    
    // Criar Blob do HTML e anexar ao FormData
    const htmlBlob = new Blob([contratoHTML], { type: "text/html" });
    formData.append("0", htmlBlob, `contrato-${contrato.numero}.html`);

    console.log("Enviando para Autentique via multipart/form-data...");
    console.log("Document name:", documentName);
    console.log("Signer email:", signerEmail);
    console.log("HTML size:", contratoHTML.length, "bytes");

    const autentiqueResponse = await fetch(AUTENTIQUE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${autentiqueApiKey}`,
        // NÃO definir Content-Type - FormData define automaticamente com boundary
      },
      body: formData,
    });

    const autentiqueData = await autentiqueResponse.json();
    
    console.log("Resposta Autentique:", JSON.stringify(autentiqueData, null, 2));

    if (autentiqueData.errors) {
      throw new Error(`Erro Autentique: ${JSON.stringify(autentiqueData.errors)}`);
    }

    const document = autentiqueData.data?.createDocument;
    if (!document) {
      throw new Error("Documento não foi criado no Autentique");
    }

    // Obter link de assinatura
    const signatureLink = document.signatures?.[0]?.link?.short_link;

    // Atualizar contrato com dados do Autentique
    const { error: updateError } = await supabase
      .from("contratos")
      .update({
        autentique_documento_id: document.id,
        autentique_url: signatureLink,
        autentique_status: "pending",
        status: "pendente_assinatura",
        data_envio: new Date().toISOString(),
      })
      .eq("id", contratoId);

    if (updateError) {
      console.error("Erro ao atualizar contrato:", updateError);
    }

    // Registrar no histórico do contrato
    await supabase.from("contratos_historico").insert({
      contrato_id: contratoId,
      evento: "enviado_assinatura",
      descricao: `Contrato enviado para assinatura via Autentique`,
      dados: { 
        autentique_id: document.id, 
        link: signatureLink 
      },
    });

    // Registrar no histórico do lead
    if (contrato.lead_id) {
      await supabase.from("leads_historico").insert({
        lead_id: contrato.lead_id,
        acao: "contrato_enviado",
        descricao: `Contrato ${contrato.numero} (${contrato.planos?.nome}) enviado para assinatura via Autentique`,
        etapa_anterior: "contrato_enviado",
        etapa_nova: "contrato_enviado",
      });

      // Atualizar etapa do lead
      await supabase
        .from("leads")
        .update({ etapa: "contrato_enviado" })
        .eq("id", contrato.lead_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        documentId: document.id,
        signatureLink,
        templateUsed: templateGenerator.name,
        message: "Contrato enviado para assinatura com sucesso",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Erro na função autentique-create:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
