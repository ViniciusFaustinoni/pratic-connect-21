// Importa um associado + todos os seus veículos a partir do SGA (Hinova) para a base local.
// Idempotente: faz upsert por CPF (associados) e por placa (veiculos).
// Usado pelo fluxo de Troca de Titularidade para criar espelho local antes de gerar a solicitação.
//
// Input: { cpf: string }
// Output: { associado_id, codigo_associado, veiculos: [{ id, placa, codigo_veiculo, marca, modelo, ano_modelo }] }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getHinovaSession,
  buscarAssociadoComVeiculosPorCpf,
  buscarVeiculoPorPlaca,
  HinovaTransientError,
  HinovaNotFoundError,
} from '../_shared/hinova-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const cleanCPF = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const cleanPlaca = (v: unknown) => String(v ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

async function fetchAssociadoMeta(s: any, cpf: string) {
  try {
    const r = await fetch(`${s.apiUrl}/associado/buscar/${cpf}/cpf`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.tokenUsuario}` },
    });
    if (!r.ok) { await r.text(); return null; }
    const txt = await r.text();
    let j: any; try { j = JSON.parse(txt); } catch { return null; }
    const root = j?.data ?? j?.dados ?? j;
    const a = Array.isArray(root) ? root[0] : root;
    if (!a) return null;
    return {
      nome: a.nome ?? a.nome_completo ?? null,
      email: a.email ?? a.email_principal ?? null,
      telefone: a.telefone_celular ?? a.celular ?? a.telefone ?? null,
      cep: a.cep ?? null,
      logradouro: a.endereco ?? a.logradouro ?? null,
      numero: a.numero ?? null,
      bairro: a.bairro ?? null,
      cidade: a.cidade ?? null,
      uf: a.uf ?? a.estado ?? null,
      data_nascimento: a.data_nascimento ?? a.dt_nascimento ?? null,
      rg: a.rg ?? null,
      sexo: a.sexo ?? null,
    };
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Autenticação obrigatória (qualquer usuário autenticado pode disparar import)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json(401, { error: 'Não autenticado' });
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json(401, { error: 'Não autenticado' });

    const body = await req.json().catch(() => ({}));
    const cpf = cleanCPF(body?.cpf);
    if (cpf.length !== 11) return json(400, { error: 'CPF inválido' });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const session = await getHinovaSession(admin);

    // 1) Busca associado + lista de placas no SGA
    let codigoAssociado: number | null = null;
    let placasSGA: Array<{ placa: string; codigo_veiculo: number }> = [];
    try {
      const r = await buscarAssociadoComVeiculosPorCpf(session, cpf);
      codigoAssociado = r.codigo_associado;
      placasSGA = r.veiculos;
    } catch (e) {
      if (e instanceof HinovaNotFoundError) {
        return json(404, { error: 'Associado não encontrado no SGA' });
      }
      throw e;
    }
    if (!codigoAssociado || placasSGA.length === 0) {
      return json(404, { error: 'Associado/veículos não encontrados no SGA' });
    }

    // 2) Busca metadados do associado (best-effort)
    const meta = await fetchAssociadoMeta(session, cpf);

    // 3) UPSERT do associado (por CPF). Se já existir, só atualizamos codigo_hinova.
    const { data: existente } = await admin
      .from('associados')
      .select('id, nome, email, telefone')
      .eq('cpf', cpf)
      .maybeSingle();

    let associadoId: string;
    if (existente?.id) {
      associadoId = existente.id;
      await admin
        .from('associados')
        .update({
          codigo_hinova: codigoAssociado,
          sincronizado_hinova: true,
          sincronizado_hinova_em: new Date().toISOString(),
        })
        .eq('id', associadoId);
    } else {
      const nome = (meta?.nome || `Associado SGA ${codigoAssociado}`).toString().trim();
      const email = (meta?.email || `sga-${cpf}@import.local`).toString().trim();
      const telefone = String(meta?.telefone || '').replace(/\D/g, '') || '00000000000';
      const insertData: any = {
        nome,
        cpf,
        email,
        telefone,
        status: 'ativo',
        origem_cadastro: 'api_externa',
        codigo_hinova: codigoAssociado,
        sincronizado_hinova: true,
        sincronizado_hinova_em: new Date().toISOString(),
      };
      if (meta?.cep) insertData.cep = String(meta.cep).replace(/\D/g, '') || null;
      if (meta?.logradouro) insertData.logradouro = meta.logradouro;
      if (meta?.numero) insertData.numero = String(meta.numero);
      if (meta?.bairro) insertData.bairro = meta.bairro;
      if (meta?.cidade) insertData.cidade = meta.cidade;
      if (meta?.uf) insertData.uf = meta.uf;
      if (meta?.rg) insertData.rg = meta.rg;
      if (meta?.sexo) insertData.sexo = meta.sexo;
      if (meta?.data_nascimento) {
        // Aceita 'dd/mm/yyyy' ou ISO
        const d = String(meta.data_nascimento);
        const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        insertData.data_nascimento = m ? `${m[3]}-${m[2]}-${m[1]}` : d.slice(0, 10);
      }
      const { data: novo, error: insErr } = await admin
        .from('associados')
        .insert(insertData)
        .select('id')
        .single();
      if (insErr) throw new Error(`Erro ao criar associado: ${insErr.message}`);
      associadoId = novo.id;
    }

    // 4) Para cada placa do SGA, UPSERT em veiculos
    const veiculosOut: Array<{ id: string; placa: string; codigo_veiculo: number; marca: string; modelo: string; ano_modelo: number | null }> = [];
    for (const v of placasSGA) {
      const placa = cleanPlaca(v.placa);
      if (!placa) continue;

      // Buscar detalhes na Hinova (best-effort)
      let det: any = null;
      try {
        const { found } = await buscarVeiculoPorPlaca(session, placa);
        det = found;
      } catch (e) {
        console.warn(`[importar-associado-sga] detalhe placa ${placa} falhou:`, (e as any)?.message);
      }

      const marca = String(det?.marca ?? det?.marca_veiculo ?? 'N/I').trim() || 'N/I';
      const modelo = String(det?.modelo ?? det?.modelo_veiculo ?? 'N/I').trim() || 'N/I';
      const anoFabRaw = det?.ano_fabricacao ?? det?.ano_modelo ?? det?.ano;
      const anoModRaw = det?.ano_modelo ?? det?.ano_fabricacao ?? det?.ano;
      const anoFabricacao = parseInt(String(anoFabRaw || 0), 10) || new Date().getFullYear();
      const anoModelo = parseInt(String(anoModRaw || 0), 10) || anoFabricacao;
      const cor = det?.cor ? String(det.cor) : null;
      const combustivel = det?.combustivel ? String(det.combustivel) : null;
      const chassi = det?.chassi ? String(det.chassi) : null;
      const renavam = det?.renavam ? String(det.renavam) : null;

      // Verifica se placa já existe localmente
      const { data: vExist } = await admin
        .from('veiculos')
        .select('id, associado_id')
        .eq('placa', placa)
        .maybeSingle();

      if (vExist?.id) {
        // Atualiza vínculo (caso esteja apontando para outro associado, NÃO sobrescreve sem cuidado)
        const updates: any = {
          codigo_hinova: v.codigo_veiculo,
          sincronizado_hinova: true,
        };
        // Se o veículo já pertence a outro associado, mantém — apenas grava codigo_hinova
        await admin.from('veiculos').update(updates).eq('id', vExist.id);
        veiculosOut.push({
          id: vExist.id,
          placa,
          codigo_veiculo: v.codigo_veiculo,
          marca,
          modelo,
          ano_modelo: anoModelo,
        });
      } else {
        const { data: novoV, error: vErr } = await admin
          .from('veiculos')
          .insert({
            associado_id: associadoId,
            placa,
            marca,
            modelo,
            ano_fabricacao: anoFabricacao,
            ano_modelo: anoModelo,
            cor,
            combustivel,
            chassi,
            renavam,
            ativo: true,
            codigo_hinova: v.codigo_veiculo,
            sincronizado_hinova: true,
          })
          .select('id')
          .single();
        if (vErr) {
          console.error(`[importar-associado-sga] erro veiculo ${placa}:`, vErr.message);
          continue;
        }
        veiculosOut.push({
          id: novoV.id,
          placa,
          codigo_veiculo: v.codigo_veiculo,
          marca,
          modelo,
          ano_modelo: anoModelo,
        });
      }
    }

    return json(200, {
      success: true,
      associado_id: associadoId,
      codigo_associado: codigoAssociado,
      veiculos: veiculosOut,
    });
  } catch (e: any) {
    console.error('[importar-associado-sga] erro:', e?.message, e?.stack);
    if (e instanceof HinovaTransientError) {
      return json(503, { error: `SGA temporariamente indisponível: ${e.reason}` });
    }
    return json(500, { error: e?.message || 'Erro inesperado' });
  }
});
