import { supabase } from '@/integrations/supabase/client';

/**
 * Helper para criar notificações internas no sistema.
 * Insere diretamente na tabela `notificacoes`.
 * Todas as funções são fire-and-forget.
 */

async function getDiretoresIds(): Promise<string[]> {
  const { data } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'diretor');
  return (data || []).map(r => r.user_id);
}

async function inserirNotificacao(params: {
  userId: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  subtipo?: string;
  link?: string;
  prioridade?: string;
  referenciaId?: string;
  referenciaTipo?: string;
}) {
  try {
    await supabase.from('notificacoes').insert({
      user_id: params.userId,
      titulo: params.titulo,
      mensagem: params.mensagem,
      tipo: params.tipo,
      subtipo: params.subtipo || null,
      link: params.link || null,
      prioridade: params.prioridade || 'normal',
      referencia_id: params.referenciaId || null,
      referencia_tipo: params.referenciaTipo || null,
      lida: false,
      canal_sistema: true,
    });
  } catch (err) {
    console.error('[NotificacaoHelper] Erro ao inserir notificação:', err);
  }
}

async function inserirParaMultiplos(userIds: string[], params: Omit<Parameters<typeof inserirNotificacao>[0], 'userId'>) {
  for (const uid of userIds) {
    await inserirNotificacao({ ...params, userId: uid });
  }
}

// 1. Sindicância aberta → notifica responsável
export async function notificarSindicanciaAberta(sinistroId: string, protocolo: string, responsavelId: string, prazoFim: string) {
  await inserirNotificacao({
    userId: responsavelId,
    titulo: 'Nova Sindicância',
    mensagem: `Sindicância aberta para evento #${protocolo}. Prazo: ${prazoFim}.`,
    tipo: 'sinistro',
    subtipo: 'sindicancia_aberta',
    link: `/eventos/sindicancias/${sinistroId}`,
    prioridade: 'alta',
    referenciaId: sinistroId,
    referenciaTipo: 'sinistro',
  });
}

// 2. 7 dias para vencer → notifica responsável
export async function notificarSindicanciaVencendo7d(sinistroId: string, protocolo: string, responsavelId: string) {
  await inserirNotificacao({
    userId: responsavelId,
    titulo: 'Sindicância Vencendo',
    mensagem: `Sindicância do evento #${protocolo} vence em 7 dias.`,
    tipo: 'sinistro',
    subtipo: 'sindicancia_vencendo',
    link: `/eventos/sindicancias/${sinistroId}`,
    prioridade: 'alta',
    referenciaId: sinistroId,
    referenciaTipo: 'sinistro',
  });
}

// 3. Vencida → notifica responsável + analista + diretores
export async function notificarSindicanciaVencida(sinistroId: string, protocolo: string, responsavelId: string, analistaId?: string) {
  const diretores = await getDiretoresIds();
  const destinos = [responsavelId, ...(analistaId ? [analistaId] : []), ...diretores];
  const unicos = [...new Set(destinos)];
  await inserirParaMultiplos(unicos, {
    titulo: 'Sindicância VENCIDA',
    mensagem: `Sindicância do evento #${protocolo} está VENCIDA.`,
    tipo: 'sinistro',
    subtipo: 'sindicancia_vencida',
    link: `/eventos/sindicancias/${sinistroId}`,
    prioridade: 'urgente',
    referenciaId: sinistroId,
    referenciaTipo: 'sinistro',
  });
}

// 4. Concluída → notifica analista
export async function notificarSindicanciaConcluida(sinistroId: string, protocolo: string, resultado: string, analistaId: string) {
  await inserirNotificacao({
    userId: analistaId,
    titulo: 'Sindicância Concluída',
    mensagem: `Resultado da sindicância #${protocolo}: ${resultado}.`,
    tipo: 'sinistro',
    subtipo: 'sindicancia_concluida',
    link: `/eventos/sindicancias/${sinistroId}`,
    prioridade: 'alta',
    referenciaId: sinistroId,
    referenciaTipo: 'sinistro',
  });
}

// 5. Caso jurídico criado → notifica advogado ou departamento
export async function notificarCasoJuridicoCriado(casoNumero: string, tipo: string, advogadoId?: string) {
  if (advogadoId) {
    await inserirNotificacao({
      userId: advogadoId,
      titulo: 'Novo Caso Jurídico',
      mensagem: `Caso #${casoNumero} criado: ${tipo}.`,
      tipo: 'sistema',
      subtipo: 'caso_juridico_criado',
      link: `/juridico/casos`,
      prioridade: 'alta',
    });
  }
}

// 6. Parecer emitido → notifica analista + diretores
export async function notificarParecerEmitido(casoNumero: string, analistaId?: string) {
  const diretores = await getDiretoresIds();
  const destinos = [...(analistaId ? [analistaId] : []), ...diretores];
  const unicos = [...new Set(destinos)];
  await inserirParaMultiplos(unicos, {
    titulo: 'Parecer Jurídico Emitido',
    mensagem: `Parecer emitido no caso #${casoNumero}.`,
    tipo: 'sistema',
    subtipo: 'parecer_emitido',
    link: `/juridico/casos`,
    prioridade: 'alta',
  });
}

// 7. Decisão registrada → notifica analista + diretores
export async function notificarDecisaoRegistrada(casoNumero: string, decisao: string, analistaId?: string) {
  const diretores = await getDiretoresIds();
  const destinos = [...(analistaId ? [analistaId] : []), ...diretores];
  const unicos = [...new Set(destinos)];
  await inserirParaMultiplos(unicos, {
    titulo: 'Decisão Registrada',
    mensagem: `Decisão: ${decisao} no caso #${casoNumero}.`,
    tipo: 'sistema',
    subtipo: 'decisao_registrada',
    link: `/juridico/casos`,
    prioridade: 'alta',
  });
}

// 8. Aguardando diretoria → notifica todos diretores
export async function notificarAguardandoDiretoria(sinistroId: string, protocolo: string) {
  const diretores = await getDiretoresIds();
  await inserirParaMultiplos(diretores, {
    titulo: 'Evento Aguarda Diretoria',
    mensagem: `Evento #${protocolo} aguarda decisão da diretoria.`,
    tipo: 'sinistro',
    subtipo: 'aguardando_diretoria',
    link: `/eventos/sinistros/${sinistroId}`,
    prioridade: 'urgente',
    referenciaId: sinistroId,
    referenciaTipo: 'sinistro',
  });
}

// 9. Laudo de sindicância emitido → notifica analistas de eventos + diretores
async function getRoleIds(role: string): Promise<string[]> {
  const { data } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', role as any);
  return (data || []).map(r => r.user_id);
}

async function getAnalistasEventosIds(): Promise<string[]> {
  const { data } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'analista_eventos');
  return (data || []).map(r => r.user_id);
}

export async function notificarLaudoEmitido(sinistroId: string, protocolo: string, conclusao: string, sindicanciaNumero: string) {
  const [analistas, diretores] = await Promise.all([getAnalistasEventosIds(), getDiretoresIds()]);
  const unicos = [...new Set([...analistas, ...diretores])];
  await inserirParaMultiplos(unicos, {
    titulo: 'Laudo de Sindicância Recebido',
    mensagem: `📋 Laudo de sindicância recebido — Evento #${protocolo} — Sindicância ${sindicanciaNumero} — Conclusão: ${conclusao}`,
    tipo: 'sinistro',
    subtipo: 'laudo_emitido',
    link: `/eventos/sinistros/${sinistroId}`,
    prioridade: 'alta',
    referenciaId: sinistroId,
    referenciaTipo: 'sinistro',
  });
}

// 10. Recusa do instalador → notifica analista_cadastro, coordenador_monitoramento e diretores
export async function notificarRecusaInstalador(servicoId: string, placa: string, motivo: string) {
  const [analistas, coordenadores, diretores] = await Promise.all([
    getRoleIds('analista_cadastro'),
    getRoleIds('coordenador_monitoramento'),
    getDiretoresIds(),
  ]);
  const unicos = [...new Set([...analistas, ...coordenadores, ...diretores])];
  await inserirParaMultiplos(unicos, {
    titulo: 'Veículo Negado pelo Instalador',
    mensagem: `🚫 Veículo placa ${placa} foi negado pelo instalador. Motivo: ${motivo}`,
    tipo: 'sistema',
    subtipo: 'recusa_instalador',
    link: '/cadastro/recusas-instalador',
    prioridade: 'urgente',
    referenciaId: servicoId,
    referenciaTipo: 'servico',
  });
}
