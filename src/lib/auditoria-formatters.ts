export interface AuditoriaResumo {
  titulo: string;
  linhas: string[];
}

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};

const nomeEntidade = (value: unknown, fallback = '—') => {
  const record = asRecord(value);
  return record.nome || record.email || record.label || record.id || fallback;
};

const formatValor = (value: unknown) => value === null || value === undefined || value === '' ? '—' : String(value);

const formatGrade = (value: unknown) => {
  const record = asRecord(value);
  if (!Object.keys(record).length) return '—';
  return `${record.nome || record.id || 'Grade'}${record.versao ? ` v${record.versao}` : ''}`;
};

const extractGradeChanges = (anterior: Record<string, any>, novo: Record<string, any>) => {
  const linhas: string[] = [];
  const gradeAnterior = asRecord(anterior.grade);
  const gradeNova = asRecord(novo.grade);

  if (gradeAnterior.versao || gradeNova.versao) {
    linhas.push(`Versão: ${formatValor(gradeAnterior.versao)} → ${formatValor(gradeNova.versao)}`);
  }

  if (gradeAnterior.nome !== gradeNova.nome && (gradeAnterior.nome || gradeNova.nome)) {
    linhas.push(`Nome: ${formatValor(gradeAnterior.nome)} → ${formatValor(gradeNova.nome)}`);
  }

  const planosNovos = Array.isArray(novo.planos) ? novo.planos.map((p: any) => p.nome || p.id).filter(Boolean) : [];
  if (planosNovos.length) linhas.push(`Planos: ${planosNovos.join(', ')}`);

  const regrasPorPlano = asRecord(novo.regras_por_plano);
  Object.values(regrasPorPlano).slice(0, 8).forEach((entry: any) => {
    const plano = entry?.plano?.nome || entry?.plano?.id || 'Plano';
    (entry?.parcelas || []).slice(0, 4).forEach((parcela: any) => {
      (parcela?.niveis || []).slice(0, 6).forEach((nivel: any) => {
        linhas.push(`${plano} / ${parcela.label || parcela.numero_parcela || 'Parcela'} / ${nivel.nome || nivel.role}: ${nivel.valor}${nivel.tipo_comissao === 'valor_fixo' ? '' : '%'}`);
      });
    });
  });

  return linhas;
};

export const gerarResumoAuditoria = (log: {
  tabela?: string | null;
  modulo?: string | null;
  descricao?: string | null;
  dados_anteriores?: unknown;
  dados_novos?: unknown;
}): AuditoriaResumo | null => {
  const anterior = asRecord(log.dados_anteriores);
  const novo = asRecord(log.dados_novos);

  if (log.tabela === 'grades_comissao' || log.tabela === 'grades_comissao_versoes') {
    return {
      titulo: 'Resumo da grade',
      linhas: extractGradeChanges(anterior, novo).slice(0, 12),
    };
  }

  if (log.tabela === 'usuario_grade_comissao') {
    return {
      titulo: 'Resumo da atribuição',
      linhas: [
        `Usuário afetado: ${nomeEntidade(novo.usuario_afetado || anterior.usuario_afetado)}`,
        `Grade: ${formatGrade(anterior.grade)} → ${formatGrade(novo.grade)}`,
        `Papel no nível: ${formatValor(anterior.papel_no_nivel)} → ${formatValor(novo.papel_no_nivel)}`,
        `Vigência: ${formatValor(anterior.data_inicio)} → ${formatValor(novo.data_inicio)}`,
      ],
    };
  }

  if (log.tabela === 'hierarquia_vendas') {
    return {
      titulo: 'Resumo da hierarquia',
      linhas: [
        `Vendedor: ${nomeEntidade(novo.vendedor || anterior.vendedor)}`,
        `Supervisor: ${nomeEntidade(anterior.supervisor)} → ${nomeEntidade(novo.supervisor)}`,
        `Gerente: ${nomeEntidade(anterior.gerente)} → ${nomeEntidade(novo.gerente)}`,
        `Agência: ${nomeEntidade(anterior.agencia)} → ${nomeEntidade(novo.agencia)}`,
        `Observações: ${formatValor(anterior.observacoes)} → ${formatValor(novo.observacoes)}`,
      ],
    };
  }

  return null;
};

export const resumoAuditoriaTexto = (log: Parameters<typeof gerarResumoAuditoria>[0]) => {
  const resumo = gerarResumoAuditoria(log);
  return resumo ? `${resumo.titulo}: ${resumo.linhas.join(' | ')}` : '';
};
