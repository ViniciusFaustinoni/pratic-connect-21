// Envia o Termo de Cancelamento ao associado antigo via Autentique (email + PF_FACIAL)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AUTENTIQUE_URL = 'https://api.autentique.com.br/v2/graphql';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { solicitacao_id } = await req.json();
    if (!solicitacao_id) {
      return new Response(JSON.stringify({ error: 'solicitacao_id obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const AUTENTIQUE_TOKEN = Deno.env.get('AUTENTIQUE_API_KEY');

    if (!AUTENTIQUE_TOKEN) {
      return new Response(JSON.stringify({ error: 'Autentique não configurado' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: solicitacao, error: solErr } = await admin
      .from('solicitacoes_troca_titularidade')
      .select('id, novo_titular_dados, associado_antigo_id, veiculo_id, termo_cancelamento_autentique_id')
      .eq('id', solicitacao_id)
      .maybeSingle();
    if (solErr || !solicitacao) throw new Error('Solicitação não encontrada');
    if (solicitacao.termo_cancelamento_autentique_id) {
      return new Response(
        JSON.stringify({ success: true, message: 'Termo já enviado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: associadoAntigo } = await admin
      .from('associados')
      .select('id, nome, cpf, rg, email, telefone, logradouro, numero, complemento, bairro, cidade, uf, cep')
      .eq('id', solicitacao.associado_antigo_id)
      .maybeSingle();
    if (!associadoAntigo?.email) throw new Error('Associado antigo sem email cadastrado');

    const { data: veiculo } = await admin
      .from('veiculos')
      .select('marca, modelo, placa, ano_modelo')
      .eq('id', solicitacao.veiculo_id)
      .maybeSingle();

    const novoTitular = solicitacao.novo_titular_dados as { nome: string; cpf: string };

    const enderecoCompleto = [
      associadoAntigo.logradouro,
      associadoAntigo.numero,
      associadoAntigo.complemento,
      associadoAntigo.bairro,
      associadoAntigo.cidade && associadoAntigo.uf ? `${associadoAntigo.cidade}/${associadoAntigo.uf}` : (associadoAntigo.cidade || associadoAntigo.uf),
      associadoAntigo.cep ? `CEP ${associadoAntigo.cep}` : null,
    ].filter(Boolean).join(', ') || '___';

    const hoje = new Date();
    const dd = String(hoje.getDate()).padStart(2, '0');
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const yyyy = hoje.getFullYear();
    const veiculoTxt = `${veiculo?.marca || ''} ${veiculo?.modelo || ''} ${veiculo?.ano_modelo || ''}`.trim();
    const motivoTxt = `Troca de titularidade para ${novoTitular?.nome || ''} (CPF ${novoTitular?.cpf || ''}).`;

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Termo de Cancelamento</title>
      <style>
        @page { size: A4; margin: 24mm 22mm; }
        body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 11pt; line-height: 1.55; }
        .logo { text-align: center; margin-bottom: 18pt; }
        .logo img { max-height: 70px; }
        h1 { text-align: center; font-size: 16pt; letter-spacing: 1pt; margin: 8pt 0 22pt 0; }
        p { margin: 0 0 12pt 0; text-align: justify; }
        .motivo-box { border: 1px solid #333; padding: 10pt; min-height: 60pt; margin: 14pt 0; }
        .motivo-label { font-weight: bold; }
        .data { margin: 28pt 0 60pt 0; }
        .assinatura { border-top: 1px solid #000; width: 70%; margin: 0 auto; padding-top: 6pt; text-align: center; font-size: 10pt; letter-spacing: 1pt; }
        .footer { margin-top: 50pt; border-top: 1px solid #ccc; padding-top: 10pt; text-align: center; font-size: 9pt; color: #555; line-height: 1.4; }
      </style></head>
      <body>
        <div class="logo"><img src="https://app.praticcar.org/logos/logo-full-light.png" alt="Praticcar" /></div>
        <h1>TERMO DE CANCELAMENTO</h1>

        <p>Eu, <strong>${associadoAntigo.nome || '___'}</strong>, portador da identidade de n° <strong>${associadoAntigo.rg || '___'}</strong> inscrito no CPF sob o n° <strong>${associadoAntigo.cpf || '___'}</strong>, residente ao endereço <strong>${enderecoCompleto}</strong>.</p>

        <p>Solicito o cancelamento de todos os benefícios oferecidos pela Praticcar, inclusive o benefício da proteção veicular do veículo <strong>${veiculoTxt || '___'}</strong>, placa <strong>${veiculo?.placa || '___'}</strong>;</p>

        <p>Declaro estar ciente que na instalação do equipamento rastreador, em regime de comodato, o associado se tornará fiel depositário do aparelho, e na hipótese de não fazer mais parte do quadro associativo da Praticcar, o associado deverá devolver o rastreador a Praticcar. Em caso de não devolução do equipamento rastreador será devido para a associação o valor de <strong>R$400,00 (quatrocentos reais)</strong> conforme prevê o regulamento de benefícios da associação.</p>

        <div class="motivo-box">
          <span class="motivo-label">motivo:</span><br/>
          ${motivoTxt}
        </div>

        <p class="data">Data: ${dd}/${mm}/${yyyy}</p>

        <div class="assinatura">ASSINATURA DO ASSOCIADO</div>

        <div class="footer">
          www.praticcar.org &nbsp;•&nbsp; 21 97019-4372<br/>
          @praticcar_oficial &nbsp;•&nbsp; @protecaopraticcar<br/>
          Avenida das Américas, 19005, Recreio dos Bandeirantes - RJ
        </div>
      </body></html>`;

    // Como Autentique exige PDF, precisamos converter. Usamos uma estratégia simples: enviar como text/html via base64 e deixar o Autentique gerar.
    // Na prática, o sistema usa edge `gerar-documento-autentique`. Aqui invocamos o mutation diretamente com upload simples.

    const cpfRaw = (associadoAntigo.cpf || '').replace(/\D/g, '');
    const signerObj: any = {
      name: associadoAntigo.nome,
      email: associadoAntigo.email,
      action: 'SIGN',
      delivery_method: 'DELIVERY_METHOD_EMAIL',
      security_verifications: [{ type: 'PF_FACIAL' }],
    };
    if (cpfRaw.length === 11) signerObj.configs = { cpf: cpfRaw };

    const operations = {
      query: `mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
        createDocument(sandbox: false, document: $document, signers: $signers, file: $file) { id name }
      }`,
      variables: {
        document: { name: `Termo de Cancelamento - Troca - ${veiculo?.placa || ''}`, new_signature_style: true },
        signers: [signerObj],
        file: null,
      },
    };

    const map = { '0': ['variables.file'] };
    const formData = new FormData();
    formData.append('operations', JSON.stringify(operations));
    formData.append('map', JSON.stringify(map));
    formData.append('0', new Blob([html], { type: 'text/html' }), 'termo-cancelamento.html');

    const resp = await fetch(AUTENTIQUE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${AUTENTIQUE_TOKEN}` },
      body: formData,
    });
    const json = await resp.json();
    if (!resp.ok || json.errors) {
      console.error('[autentique]', json);
      throw new Error('Erro ao criar documento Autentique: ' + JSON.stringify(json.errors || json));
    }

    const docId = json.data?.createDocument?.id;
    if (!docId) throw new Error('Documento sem ID retornado');

    const termoUrl = `https://app.autentique.com.br/documentos/${docId}`;

    await admin
      .from('solicitacoes_troca_titularidade')
      .update({
        termo_cancelamento_autentique_id: docId,
        termo_cancelamento_url: termoUrl,
        termo_cancelamento_enviado_em: new Date().toISOString(),
        // status NÃO é alterado aqui — só o webhook do Autentique promove para
        // 'aguardando_cadastro' depois de confirmar a assinatura do antigo.
      })
      .eq('id', solicitacao_id);

    // Disparo WhatsApp (best-effort, não falha a requisição se der erro)
    if (associadoAntigo.telefone) {
      try {
        const msg = `Olá, ${associadoAntigo.nome}!\n\nRecebemos uma solicitação de troca de titularidade do veículo *${veiculo?.marca} ${veiculo?.modelo} - ${veiculo?.placa}*.\n\nPara liberar a transferência, é necessário assinar o termo de cancelamento abaixo (assinatura por reconhecimento facial):\n\n${termoUrl}\n\nApós sua assinatura, o processo segue automaticamente.`;
        await admin.functions.invoke('whatsapp-send-text', {
          body: { telefone: associadoAntigo.telefone, mensagem: msg },
        });
      } catch (waErr) {
        console.warn('[enviar-termo-cancelamento-troca] WhatsApp falhou:', waErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, autentique_id: docId, termo_url: termoUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[enviar-termo-cancelamento-troca]', e);
    const msg = e instanceof Error ? e.message : 'erro';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
