import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUTENTIQUE_API_URL = "https://api.autentique.com.br/v2/graphql";

interface ContratoRequest {
  contratoId: string;
  clienteNome: string;
  clienteEmail: string;
  clienteCpf?: string;
  clienteTelefone?: string;
}

// Gera HTML do contrato para PDF
function generateContratoHTML(data: {
  numero: string;
  clienteNome: string;
  clienteCpf: string;
  clienteEmail: string;
  clienteTelefone: string;
  planoNome: string;
  valorAdesao: number;
  valorMensal: number;
  diaVencimento: number;
  dataInicio: string;
  veiculoMarca?: string;
  veiculoModelo?: string;
  veiculoPlaca?: string;
  veiculoAno?: number;
}): string {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR");
  };

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
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
  </style>
</head>
<body>
  <div class="header">
    <h1>CONTRATO DE ADESÃO</h1>
    <p><strong>Nº ${data.numero}</strong></p>
    <p>Data de Emissão: ${formatDate(new Date().toISOString())}</p>
  </div>

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

  ${data.veiculoMarca ? `
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
  </div>
  ` : ""}

  <div class="section">
    <h2>3. PLANO CONTRATADO</h2>
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

  <div class="section terms">
    <h2>4. TERMOS E CONDIÇÕES</h2>
    
    <h3>4.1 Objeto do Contrato</h3>
    <p>O presente contrato tem por objeto a prestação de serviços de proteção veicular, incluindo rastreamento, assistência 24 horas e cobertura contra roubo, furto e colisão, conforme condições estabelecidas no plano contratado.</p>
    
    <h3>4.2 Obrigações do Contratante</h3>
    <p>O CONTRATANTE se compromete a: (a) Manter os dados cadastrais atualizados; (b) Efetuar o pagamento das mensalidades até a data de vencimento; (c) Manter o dispositivo de rastreamento em perfeito funcionamento; (d) Comunicar imediatamente qualquer sinistro.</p>
    
    <h3>4.3 Carência</h3>
    <p>O período de carência para acionamento de coberturas é de 90 (noventa) dias a partir da instalação do rastreador no veículo.</p>
    
    <h3>4.4 Vigência e Rescisão</h3>
    <p>O contrato tem vigência de 12 (doze) meses, renovável automaticamente. A rescisão pode ser solicitada a qualquer momento, mediante aviso prévio de 30 dias.</p>
    
    <h3>4.5 Foro</h3>
    <p>Fica eleito o foro da comarca da sede da CONTRATADA para dirimir quaisquer controvérsias oriundas deste contrato.</p>
  </div>

  <div class="signature-area">
    <p>Ao assinar eletronicamente este documento, o CONTRATANTE declara estar ciente e de acordo com todas as condições estabelecidas neste contrato.</p>
    
    <div class="signature-line">
      ${data.clienteNome}<br>
      <small>Contratante</small>
    </div>
  </div>

  <div class="footer">
    <p>Documento gerado eletronicamente e assinado digitalmente via plataforma Autentique.</p>
    <p>Este contrato tem validade jurídica conforme Lei nº 14.063/2020.</p>
  </div>
</body>
</html>
  `;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    // Buscar dados do contrato
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

    // Gerar HTML do contrato
    const contratoHTML = generateContratoHTML({
      numero: contrato.numero,
      clienteNome: clienteNome || contrato.leads?.nome || "Cliente",
      clienteCpf: clienteCpf || contrato.leads?.cpf || "",
      clienteEmail: clienteEmail || contrato.leads?.email || "",
      clienteTelefone: clienteTelefone || contrato.leads?.telefone || "",
      planoNome: contrato.planos?.nome || "Plano Básico",
      valorAdesao: contrato.valor_adesao,
      valorMensal: contrato.valor_mensal,
      diaVencimento: contrato.dia_vencimento || 10,
      dataInicio: contrato.data_inicio,
      veiculoMarca: contrato.leads?.veiculo_marca,
      veiculoModelo: contrato.leads?.veiculo_modelo,
      veiculoPlaca: contrato.leads?.veiculo_placa,
      veiculoAno: contrato.leads?.veiculo_ano,
    });

    // Converter HTML para base64 para envio
    const htmlBase64 = btoa(unescape(encodeURIComponent(contratoHTML)));

    // Criar documento no Autentique via GraphQL
    const mutation = `
      mutation CreateDocument(
        $document: DocumentInput!
        $signers: [SignerInput!]!
        $file: FileInput!
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

    const variables = {
      document: {
        name: `Contrato ${contrato.numero} - ${clienteNome || contrato.leads?.nome}`,
      },
      signers: [
        {
          email: clienteEmail || contrato.leads?.email,
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
      file: {
        name: `contrato-${contrato.numero}.html`,
        content_base64: htmlBase64,
      },
    };

    console.log("Enviando para Autentique...");

    const autentiqueResponse = await fetch(AUTENTIQUE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${autentiqueApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: mutation,
        variables,
      }),
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
        status: "enviado",
      })
      .eq("id", contratoId);

    if (updateError) {
      console.error("Erro ao atualizar contrato:", updateError);
    }

    // Registrar no histórico do lead
    if (contrato.lead_id) {
      await supabase.from("leads_historico").insert({
        lead_id: contrato.lead_id,
        acao: "contrato_enviado",
        descricao: `Contrato ${contrato.numero} enviado para assinatura via Autentique`,
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
