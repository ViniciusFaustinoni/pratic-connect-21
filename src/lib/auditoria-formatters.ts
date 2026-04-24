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

const formatPessoa = (value: unknown) => nomeEntidade(value);

const addIfChanged = (linhas: string[], label: string, anterior: unknown, novo: unknown, formatter = formatValor) => {
  const oldText = formatter(anterior);
  const newText = formatter(novo);
  if (oldText !== newText) linhas.push(`${label}: ${oldText} → ${newText}`);
};

const normalizeGradeRules = (snapshot: Record<string, any>) => {
  const rules = new Map<string, { label: string; value: string }>();
  const regrasPorPlano = asRecord(snapshot.regras_por_plano);

  Object.values(regrasPorPlano).forEach((entry: any) => {
    const plano = entry?.plano?.nome || entry?.plano?.id || 'Plano';
    (entry?.parcelas || []).forEach((parcela: any) => {
      const parcelaLabel = parcela.label || parcela.numero_parcela || 'Parcela';
      (parcela?.niveis || []).forEach((nivel: any) => {
        const key = `${entry?.plano?.id || plano}:${parcelaLabel}:${nivel.role || nivel.nome}`;
        const suffix = nivel.tipo_comissao === 'valor_fixo' ? ' fixo' : '%';
        rules.set(key, {
          label: `${plano} / ${parcelaLabel} / ${nivel.nome || nivel.role}`,
          value: `${formatValor(nivel.valor)}${suffix}`,
        });
      });
    });
  });

  if (Array.isArray(snapshot.regras_por_plano)) {
    snapshot.regras_por_plano.forEach((regra: any) => {
      const key = `${regra.plano_id}:${regra.parcela_numero || regra.vitalicia_inicio_parcela || 'vitalicia'}:${regra.role || regra.nome_nivel}`;
      const suffix = regra.tipo_comissao === 'valor_fixo' ? ' fixo' : '%';
      rules.set(key, {
        label: `${regra.plano_nome || regra.plano_id || 'Plano'} / ${regra.parcela_numero ? `${regra.parcela_numero}ª Parcela` : 'Vitalícia'} / ${regra.nome_nivel || regra.role}`,
        value: `${formatValor(regra.valor)}${suffix}`,
      });
    });
  }

  return rules;
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

  const regrasAntigas = normalizeGradeRules(anterior);
  const regrasNovas = normalizeGradeRules(novo);
  const allKeys = Array.from(new Set([...regrasAntigas.keys(), ...regrasNovas.keys()]));

  allKeys.slice(0, 12).forEach((key) => {
    const oldRule = regrasAntigas.get(key);
    const newRule = regrasNovas.get(key);
    const label = newRule?.label || oldRule?.label || key;
    if (!oldRule && newRule) linhas.push(`${label}: adicionado (${newRule.value})`);
    else if (oldRule && !newRule) linhas.push(`${label}: removido (${oldRule.value})`);
    else if (oldRule && newRule && oldRule.value !== newRule.value) linhas.push(`${label}: ${oldRule.value} → ${newRule.value}`);
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
    const linhas: string[] = [
      `Vendedor: ${nomeEntidade(novo.vendedor || anterior.vendedor)}`,
    ];

    addIfChanged(linhas, 'Supervisor', anterior.supervisor, novo.supervisor, formatPessoa);
    addIfChanged(linhas, 'Gerente', anterior.gerente, novo.gerente, formatPessoa);
    addIfChanged(linhas, 'Agência', anterior.agencia, novo.agencia, formatPessoa);
    addIfChanged(linhas, 'Observações', anterior.observacoes, novo.observacoes);

    if (novo.alterado_por || anterior.alterado_por) {
      linhas.push(`Alterado por: ${nomeEntidade(novo.alterado_por || anterior.alterado_por)}`);
    }

    return {
      titulo: 'Resumo da hierarquia',
      linhas,
    };
  }

  return null;
};

export const resumoAuditoriaTexto = (log: Parameters<typeof gerarResumoAuditoria>[0]) => {
  const resumo = gerarResumoAuditoria(log);
  return resumo ? `${resumo.titulo}: ${resumo.linhas.join(' | ')}` : '';
};
