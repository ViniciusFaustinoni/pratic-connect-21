import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUTENTIQUE_API_URL = "https://api.autentique.com.br/v2/graphql";
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface VistoriaRequest {
  vistoriaId: string;
  clienteNome: string;
  clienteEmail: string;
  clienteCpf: string;
  veiculoModelo: string;
  veiculoPlaca: string;
  hodometro: number;
  avarias: string[];
  vistoriadorNome: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatCpf = (cpf: string) => {
  const numbers = cpf.replace(/\D/g, '');
  return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

// Gerar HTML do termo de vistoria
function gerarTermoVistoriaHtml(params: VistoriaRequest): string {
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  
  const avariasHtml = params.avarias.length > 0 
    ? params.avarias.map(a => `<li>${a}</li>`).join('')
    : '<li>Nenhuma avaria registrada</li>';

  return `
    <!DOCTYPE html>
    <html>
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
          font-size: 22px;
          margin: 0;
          color: #1e40af;
        }
        .header p {
          margin: 5px 0;
          color: #666;
        }
        .section {
          margin-bottom: 25px;
          background-color: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 15px;
        }
        .section h2 {
          font-size: 14px;
          color: #1e40af;
          margin: 0 0 15px 0;
          padding-bottom: 8px;
          border-bottom: 1px solid #e5e7eb;
        }
        .field {
          margin-bottom: 8px;
        }
        .field-label {
          font-weight: bold;
          display: inline-block;
          width: 120px;
        }
        .avarias-list {
          margin: 0;
          padding-left: 20px;
        }
        .avarias-list li {
          margin-bottom: 5px;
        }
        .declaracao {
          background-color: #eff6ff;
          border: 1px solid #1e40af;
          border-radius: 8px;
          padding: 20px;
          margin: 25px 0;
        }
        .declaracao h2 {
          color: #1e40af;
          margin: 0 0 15px 0;
        }
        .declaracao ul {
          margin: 10px 0;
          padding-left: 20px;
        }
        .declaracao li {
          margin-bottom: 8px;
        }
        .signature-area {
          margin-top: 50px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
        }
        .signature-line {
          margin-top: 60px;
          border-top: 1px solid #333;
          width: 300px;
          display: inline-block;
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
        <h1>TERMO DE VISTORIA VEICULAR</h1>
        <p><strong>Data:</strong> ${dataAtual} às ${horaAtual}</p>
      </div>

      <div class="section">
        <h2>DADOS DO PROPRIETÁRIO</h2>
        <div class="field">
          <span class="field-label">Nome:</span>
          ${params.clienteNome}
        </div>
        <div class="field">
          <span class="field-label">CPF:</span>
          ${formatCpf(params.clienteCpf)}
        </div>
        <div class="field">
          <span class="field-label">Email:</span>
          ${params.clienteEmail}
        </div>
      </div>

      <div class="section">
        <h2>DADOS DO VEÍCULO</h2>
        <div class="field">
          <span class="field-label">Veículo:</span>
          ${params.veiculoModelo}
        </div>
        <div class="field">
          <span class="field-label">Placa:</span>
          ${params.veiculoPlaca}
        </div>
        <div class="field">
          <span class="field-label">Hodômetro:</span>
          ${params.hodometro.toLocaleString('pt-BR')} km
        </div>
      </div>

      <div class="section">
        <h2>DADOS DA VISTORIA</h2>
        <div class="field">
          <span class="field-label">Data:</span>
          ${dataAtual}
        </div>
        <div class="field">
          <span class="field-label">Hora:</span>
          ${horaAtual}
        </div>
        <div class="field">
          <span class="field-label">Vistoriador:</span>
          ${params.vistoriadorNome}
        </div>
      </div>

      <div class="section">
        <h2>AVARIAS PRÉ-EXISTENTES</h2>
        <ul class="avarias-list">
          ${avariasHtml}
        </ul>
      </div>

      <div class="declaracao">
        <h2>DECLARAÇÃO DO PROPRIETÁRIO</h2>
        <p>Eu, <strong>${params.clienteNome}</strong>, portador(a) do CPF <strong>${formatCpf(params.clienteCpf)}</strong>, declaro que:</p>
        <ul>
          <li>As informações prestadas nesta vistoria são verdadeiras;</li>
          <li>As fotos registradas correspondem ao estado atual do veículo;</li>
          <li>As avarias listadas acima são pré-existentes à contratação;</li>
          <li>Estou ciente de que avarias não declaradas não terão cobertura;</li>
          <li>Autorizo a PRATIC a utilizar as informações e imagens para fins de proteção veicular.</li>
        </ul>
      </div>

      <div class="signature-area">
        <p>Ao assinar eletronicamente este documento, o PROPRIETÁRIO declara estar ciente e de acordo com todas as informações registradas nesta vistoria.</p>
        
        <div class="signature-line">
          ${params.clienteNome}<br>
          <small>Proprietário do Veículo</small>
        </div>
      </div>

      <div class="footer">
        <p>Documento gerado eletronicamente e assinado digitalmente via plataforma Autentique.</p>
        <p>Este termo tem validade jurídica conforme Lei nº 14.063/2020.</p>
      </div>
    </body>
    </html>
  `;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const AUTENTIQUE_TOKEN = Deno.env.get('AUTENTIQUE_API_KEY');
    if (!AUTENTIQUE_TOKEN) {
      throw new Error('AUTENTIQUE_API_KEY não configurada');
    }

    const params: VistoriaRequest = await req.json();
    console.log('[autentique-vistoria-create] Params:', {
      vistoriaId: params.vistoriaId,
      clienteEmail: params.clienteEmail,
      veiculoPlaca: params.veiculoPlaca,
    });

    // Validar campos obrigatórios
    if (!params.vistoriaId || !params.clienteNome || !params.clienteEmail || !params.clienteCpf) {
      throw new Error('Campos obrigatórios não preenchidos');
    }

    // Gerar HTML do termo
    const htmlContent = gerarTermoVistoriaHtml(params);
    console.log('[autentique-vistoria-create] HTML gerado, tamanho:', htmlContent.length);

    // Criar documento no Autentique via multipart/form-data
    const documentName = `Termo de Vistoria - ${params.veiculoPlaca} - ${new Date().toLocaleDateString('pt-BR')}`;
    
    const operations = JSON.stringify({
      query: `
        mutation CreateDocumentMutation(
          $document: DocumentInput!,
          $signers: [SignerInput!]!,
          $file: Upload!
        ) {
          createDocument(
            sandbox: false,
            document: $document,
            signers: $signers,
            file: $file
          ) {
            id
            name
            signatures {
              public_id
              name
              email
              link {
                short_link
              }
            }
          }
        }
      `,
      variables: {
        document: {
          name: documentName,
        },
        signers: [
          {
            email: params.clienteEmail,
            action: "SIGN",
            positions: [
              {
                x: "50",
                y: "80",
                z: "1",
              }
            ]
          }
        ],
        file: null,
      },
    });

    const map = JSON.stringify({ "0": ["variables.file"] });

    // Converter HTML para Blob
    const htmlBlob = new Blob([htmlContent], { type: 'text/html' });

    const formData = new FormData();
    formData.append('operations', operations);
    formData.append('map', map);
    formData.append('0', htmlBlob, `termo-vistoria-${params.veiculoPlaca}.html`);

    console.log('[autentique-vistoria-create] Enviando para Autentique...');
    
    const response = await fetch(AUTENTIQUE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTENTIQUE_TOKEN}`,
      },
      body: formData,
    });

    const result = await response.json();
    console.log('[autentique-vistoria-create] Resposta Autentique:', JSON.stringify(result));

    if (result.errors) {
      console.error('[autentique-vistoria-create] Erros:', result.errors);
      throw new Error(result.errors[0]?.message || 'Erro na API do Autentique');
    }

    const document = result.data?.createDocument;
    if (!document) {
      throw new Error('Documento não foi criado');
    }

    const documentId = document.id;
    const signatureLink = document.signatures?.[0]?.link?.short_link;

    console.log('[autentique-vistoria-create] Documento criado:', documentId);

    // Atualizar vistoria no banco
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { error: updateError } = await supabase
      .from('vistorias')
      .update({
        assinatura_autentique_id: documentId,
        assinatura_status: 'enviada',
        assinatura_enviada_em: new Date().toISOString(),
      })
      .eq('id', params.vistoriaId);

    if (updateError) {
      console.error('[autentique-vistoria-create] Erro ao atualizar vistoria:', updateError);
      // Não falha se não conseguir atualizar, documento já foi criado
    }

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        signatureLink,
        message: 'Documento enviado para assinatura',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[autentique-vistoria-create] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
