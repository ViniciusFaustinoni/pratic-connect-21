import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const AUTENTIQUE_API_URL = 'https://api.autentique.com.br/v2/graphql';
const AUTENTIQUE_TOKEN = Deno.env.get('AUTENTIQUE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Signatario {
  nome: string;
  email: string;
  telefone?: string;
  funcao: 'assinar' | 'testemunha' | 'aprovar';
}

interface EnviarDocumentoRequest {
  documentoGeradoId: string;
  nomeDocumento: string;
  pdfBase64: string;
  signatarios: Signatario[];
  mensagem?: string;
  prazoHoras?: number;
}

// Função para criar documento no Autentique
async function criarDocumentoAutentique(
  nomeDocumento: string,
  pdfBase64: string,
  signatarios: Signatario[],
  mensagem: string = 'Por favor, assine o documento.',
  prazoHoras: number = 168 // 7 dias
) {
  console.log('[autentique-documento] Criando documento no Autentique:', nomeDocumento);
  console.log('[autentique-documento] Signatários:', signatarios.length);

  const signersGraphQL = signatarios.map((s) => `
    {
      email: "${s.email}"
      action: ${s.funcao === 'assinar' ? 'SIGN' : s.funcao === 'testemunha' ? 'WITNESS' : 'APPROVE'}
      name: "${s.nome}"
      ${s.telefone ? `phone: "${s.telefone}"` : ''}
    }
  `).join(',');

  const mutation = `
    mutation {
      createDocument(
        document: {
          name: "${nomeDocumento}"
        }
        signers: [${signersGraphQL}]
        file: {
          content_base64: "${pdfBase64}"
          name: "${nomeDocumento}.pdf"
        }
        message: "${mensagem}"
        deadline_at: "${new Date(Date.now() + prazoHoras * 60 * 60 * 1000).toISOString()}"
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

  const response = await fetch(AUTENTIQUE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTENTIQUE_TOKEN}`,
    },
    body: JSON.stringify({ query: mutation }),
  });

  const result = await response.json();
  console.log('[autentique-documento] Resposta Autentique:', JSON.stringify(result, null, 2));

  if (result.errors) {
    console.error('[autentique-documento] Erro Autentique:', result.errors);
    throw new Error(result.errors[0].message);
  }

  return result.data.createDocument;
}

// Função para consultar status do documento
async function consultarStatusAutentique(documentoId: string) {
  console.log('[autentique-documento] Consultando status do documento:', documentoId);

  const query = `
    query {
      document(id: "${documentoId}") {
        id
        name
        created_at
        signatures {
          public_id
          name
          email
          signed {
            created_at
            ip
          }
          rejected {
            created_at
            reason
          }
          viewed {
            created_at
          }
          link { short_link }
        }
        files {
          signed
          original
        }
      }
    }
  `;

  const response = await fetch(AUTENTIQUE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTENTIQUE_TOKEN}`,
    },
    body: JSON.stringify({ query }),
  });

  const result = await response.json();
  console.log('[autentique-documento] Status Autentique:', JSON.stringify(result, null, 2));

  if (result.errors) {
    console.error('[autentique-documento] Erro ao consultar:', result.errors);
    throw new Error(result.errors[0].message);
  }

  return result.data.document;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, ...params } = await req.json();
    console.log('[autentique-documento] Action:', action);

    switch (action) {
      // ===== ENVIAR DOCUMENTO PARA ASSINATURA =====
      case 'enviar': {
        const { documentoGeradoId, nomeDocumento, pdfBase64, signatarios, mensagem, prazoHoras } = params as EnviarDocumentoRequest;

        console.log('[autentique-documento] Enviando documento:', documentoGeradoId);

        // Verificar se token está configurado
        if (!AUTENTIQUE_TOKEN) {
          throw new Error('AUTENTIQUE_API_KEY não configurada');
        }

        // Criar no Autentique
        const autentiqueDoc = await criarDocumentoAutentique(
          nomeDocumento,
          pdfBase64,
          signatarios,
          mensagem,
          prazoHoras
        );

        // Preparar dados dos signatários com links
        const signatariosComLinks = signatarios.map((s, index) => ({
          ...s,
          assinado: false,
          assinado_em: null,
          link: autentiqueDoc.signatures[index]?.link?.short_link || null,
        }));

        // Salvar no banco
        const { data: assinatura, error } = await supabase
          .from('documento_assinaturas')
          .insert({
            documento_gerado_id: documentoGeradoId,
            autentique_documento_id: autentiqueDoc.id,
            autentique_url: autentiqueDoc.signatures[0]?.link?.short_link,
            signatarios: signatariosComLinks,
            status: 'enviado',
            enviado_em: new Date().toISOString(),
            expira_em: new Date(Date.now() + (prazoHoras || 168) * 60 * 60 * 1000).toISOString(),
          })
          .select()
          .single();

        if (error) {
          console.error('[autentique-documento] Erro ao salvar:', error);
          throw error;
        }

        // Atualizar documento_gerados
        await supabase
          .from('documento_gerados')
          .update({ assinatura_id: assinatura.id })
          .eq('id', documentoGeradoId);

        console.log('[autentique-documento] Assinatura criada:', assinatura.id);

        return new Response(
          JSON.stringify({
            success: true,
            assinatura,
            autentique: autentiqueDoc,
            linkAssinatura: autentiqueDoc.signatures[0]?.link?.short_link,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ===== CONSULTAR STATUS =====
      case 'status': {
        const { assinaturaId } = params;

        console.log('[autentique-documento] Consultando assinatura:', assinaturaId);

        // Buscar assinatura no banco
        const { data: assinatura, error } = await supabase
          .from('documento_assinaturas')
          .select('*')
          .eq('id', assinaturaId)
          .single();

        if (error) {
          console.error('[autentique-documento] Erro ao buscar:', error);
          throw error;
        }

        if (!assinatura.autentique_documento_id) {
          throw new Error('Documento ainda não foi enviado para Autentique');
        }

        // Consultar Autentique
        const autentiqueDoc = await consultarStatusAutentique(assinatura.autentique_documento_id);

        // Calcular novo status
        const assinaturas = autentiqueDoc.signatures || [];
        const totalSignatarios = assinaturas.length;
        const assinados = assinaturas.filter((s: any) => s.signed).length;
        const recusados = assinaturas.filter((s: any) => s.rejected).length;

        let novoStatus = assinatura.status;
        let assinadoEm = null;

        if (recusados > 0) {
          novoStatus = 'recusado';
        } else if (assinados === totalSignatarios && totalSignatarios > 0) {
          novoStatus = 'assinado';
          assinadoEm = new Date().toISOString();
        } else if (assinados > 0) {
          novoStatus = 'parcial';
        } else {
          novoStatus = 'aguardando';
        }

        // Atualizar signatários com status individual
        const signatariosAtualizados = (assinatura.signatarios || []).map((sig: any, index: number) => {
          const autSig = assinaturas[index];
          if (autSig) {
            return {
              ...sig,
              assinado: !!autSig.signed,
              assinado_em: autSig.signed?.created_at || null,
              visualizado_em: autSig.viewed?.created_at || null,
              recusado: !!autSig.rejected,
              motivo_recusa: autSig.rejected?.reason || null,
            };
          }
          return sig;
        });

        // Atualizar banco
        await supabase
          .from('documento_assinaturas')
          .update({
            status: novoStatus,
            assinado_em: assinadoEm,
            autentique_url_download: autentiqueDoc.files?.signed,
            signatarios: signatariosAtualizados,
            updated_at: new Date().toISOString(),
          })
          .eq('id', assinaturaId);

        console.log('[autentique-documento] Status atualizado:', novoStatus);

        return new Response(
          JSON.stringify({
            success: true,
            status: novoStatus,
            assinados,
            totalSignatarios,
            urlAssinado: autentiqueDoc.files?.signed,
            signatarios: signatariosAtualizados,
            detalhes: assinaturas,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ===== CANCELAR ASSINATURA =====
      case 'cancelar': {
        const { assinaturaId } = params;

        console.log('[autentique-documento] Cancelando assinatura:', assinaturaId);

        const { error } = await supabase
          .from('documento_assinaturas')
          .update({
            status: 'cancelado',
            updated_at: new Date().toISOString(),
          })
          .eq('id', assinaturaId);

        if (error) {
          console.error('[autentique-documento] Erro ao cancelar:', error);
          throw error;
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Assinatura cancelada' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Ação não reconhecida: ${action}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[autentique-documento] Erro:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
