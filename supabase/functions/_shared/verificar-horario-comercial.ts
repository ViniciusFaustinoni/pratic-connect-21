/**
 * Utilitário para verificar horário comercial para envio de mensagens
 * Respeita o timezone de Brasília (America/Sao_Paulo)
 */

/**
 * Retorna a data/hora atual no fuso horário de Brasília
 */
export function getHoraBrasilia(): Date {
  const agora = new Date();
  // UTC-3 para Brasília
  const brasiliaOffset = -3 * 60;
  const localOffset = agora.getTimezoneOffset();
  return new Date(agora.getTime() + (localOffset - brasiliaOffset) * 60 * 1000);
}

/**
 * Verifica se está dentro do horário comercial
 * - Segunda a Sexta: 8h - 20h
 * - Sábado: 9h - 14h
 * - Domingo/Feriados: NÃO enviar
 */
export function dentroHorarioComercial(): boolean {
  const brasilia = getHoraBrasilia();
  const hora = brasilia.getHours();
  const dia = brasilia.getDay(); // 0 = Domingo, 6 = Sábado
  
  // Domingo: NÃO enviar
  if (dia === 0) return false;
  
  // Sábado: 9h - 14h
  if (dia === 6) return hora >= 9 && hora < 14;
  
  // Segunda a Sexta: 8h - 20h
  return hora >= 8 && hora < 20;
}

/**
 * Retorna informações sobre o horário comercial para logging
 */
export function infoHorarioComercial(): {
  hora: number;
  dia: number;
  diaSemana: string;
  dentroHorario: boolean;
  mensagem: string;
} {
  const brasilia = getHoraBrasilia();
  const hora = brasilia.getHours();
  const dia = brasilia.getDay();
  
  const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const diaSemana = diasSemana[dia];
  const dentroHorario = dentroHorarioComercial();
  
  let mensagem = '';
  if (!dentroHorario) {
    if (dia === 0) {
      mensagem = 'Domingo - Sem envio de mensagens';
    } else if (dia === 6 && (hora < 9 || hora >= 14)) {
      mensagem = `Sábado fora do horário (9h-14h). Atual: ${hora}h`;
    } else {
      mensagem = `Fora do horário comercial (8h-20h). Atual: ${hora}h`;
    }
  } else {
    mensagem = `Dentro do horário comercial: ${diaSemana} ${hora}h`;
  }
  
  return {
    hora,
    dia,
    diaSemana,
    dentroHorario,
    mensagem,
  };
}

/**
 * Calcula o próximo horário comercial disponível
 */
export function proximoHorarioComercial(): Date {
  const brasilia = getHoraBrasilia();
  const hora = brasilia.getHours();
  const dia = brasilia.getDay();
  
  // Se é domingo, próximo horário é segunda às 8h
  if (dia === 0) {
    brasilia.setDate(brasilia.getDate() + 1);
    brasilia.setHours(8, 0, 0, 0);
    return brasilia;
  }
  
  // Se é sábado
  if (dia === 6) {
    if (hora < 9) {
      // Esperar até 9h
      brasilia.setHours(9, 0, 0, 0);
      return brasilia;
    } else if (hora >= 14) {
      // Próximo é segunda às 8h
      brasilia.setDate(brasilia.getDate() + 2);
      brasilia.setHours(8, 0, 0, 0);
      return brasilia;
    }
  }
  
  // Dias úteis (segunda a sexta)
  if (hora < 8) {
    // Esperar até 8h
    brasilia.setHours(8, 0, 0, 0);
    return brasilia;
  } else if (hora >= 20) {
    // Próximo dia às 8h
    brasilia.setDate(brasilia.getDate() + 1);
    // Se cair em domingo, pular para segunda
    if (brasilia.getDay() === 0) {
      brasilia.setDate(brasilia.getDate() + 1);
    }
    brasilia.setHours(8, 0, 0, 0);
    return brasilia;
  }
  
  // Já está dentro do horário
  return brasilia;
}
