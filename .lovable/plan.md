

# Gaps Finais do Modulo Contabilidade

## Analise do Estado Atual

O modulo de contabilidade esta **95% implementado**. Apos auditoria completa do codigo e do banco de dados, identifiquei os seguintes gaps restantes:

---

## Gap 1 — Fechamento Anual (TODO no codigo)

O botao "Fechar Exercicio" existe na tela de Fechamentos mas esta com `/* TODO */` e nao faz nada ao ser clicado.

**O que falta implementar:**
- Dialog de confirmacao com resumo do exercicio (total receitas, total despesas, resultado)
- Apuracao automatica: calcular Receitas (grupo 4) - Despesas (grupo 5) = Superavit ou Deficit
- Lancamento automatico de transferencia para Patrimonio Social:
  - Se superavit: zera contas de receita e despesa, transfere diferenca para conta 3.3.01 (Superavits Acumulados)
  - Se deficit: mesmo processo, transfere para 3.3.02 (Deficits Acumulados)
- Marcar o exercicio como fechado
- Bloquear lancamentos em todos os meses do exercicio

**Arquivos a modificar:**
- `src/pages/contabilidade/Fechamentos.tsx` — adicionar Dialog e logica do fechamento anual
- `src/hooks/useContabilidade.ts` — adicionar hook `useFechamentoAnual`

---

## Gap 2 — Exportacao PDF real (DRE e Balanco)

Os botoes de exportar PDF no DRE e Balanco Patrimonial mostram `toast.info('PDF em breve')` ou `toast.info('Exportacao PDF em breve')`.

**O que falta implementar:**
- DRE: gerar PDF com a estrutura completa (receitas, despesas por secao, resultado, indicadores)
- Balanco: gerar PDF com formato lado a lado (Ativo | Passivo+PL), incluindo comparacao com ano anterior

**Arquivos a modificar:**
- `src/pages/contabilidade/DRE.tsx` — conectar botao de download ao `exportarRelatorioPDF`
- `src/pages/contabilidade/BalancoPatrimonial.tsx` — implementar exportacao PDF real
- `src/lib/contabilidade-exports.ts` — adicionar funcoes especificas para DRE e Balanco

---

## Gap 3 — Plano de Contas: Exportar e Desativar conta

A especificacao menciona acoes que nao existem na tela:
- **Exportar** plano de contas para CSV/PDF — nao implementado
- **Desativar** conta — o campo `ativa` existe no form de edicao (switch), mas nao ha um botao dedicado de "Desativar" na tree view

**O que falta implementar:**
- Botao "Exportar CSV" no header da pagina PlanoContas
- Botao "Desativar" na tree view (ao lado de Edit), com confirmacao

**Arquivos a modificar:**
- `src/pages/contabilidade/PlanoContas.tsx` — adicionar botao Exportar
- `src/components/contabilidade/PlanoContasTree.tsx` — adicionar botao Desativar com confirmacao

---

## Gap 4 — Nomenclatura "Patrimonio Social" no formulario

O formulario de conta (`ContaFormDialog.tsx`) ainda mostra "Patrimonio Liquido" no select de tipo. Deve mostrar "Patrimonio Social" para consistencia com a especificacao.

**Arquivo a modificar:**
- `src/components/contabilidade/ContaFormDialog.tsx` — renomear label

---

## Gap 5 — Cores por grupo na Tree View

A especificacao pede cores diferenciadas: "Ativo em azul, Passivo em vermelho, Despesa em laranja, Receita em verde." O PlanoContasTree ja tem cores por tipo, mas usa roxo para passivo e verde escuro para PL. Ajustar para as cores da especificacao.

**Arquivo a modificar:**
- `src/components/contabilidade/PlanoContasTree.tsx` — ajustar `tipoColors`

---

## Resumo de Arquivos

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/contabilidade/Fechamentos.tsx` | Implementar fechamento anual com dialog, apuracao e lancamento automatico |
| `src/hooks/useContabilidade.ts` | Adicionar `useFechamentoAnual` |
| `src/pages/contabilidade/DRE.tsx` | Conectar exportacao PDF real |
| `src/pages/contabilidade/BalancoPatrimonial.tsx` | Implementar exportacao PDF real |
| `src/lib/contabilidade-exports.ts` | Funcoes de export para DRE e Balanco |
| `src/pages/contabilidade/PlanoContas.tsx` | Botao Exportar CSV |
| `src/components/contabilidade/PlanoContasTree.tsx` | Botao Desativar + ajuste de cores |
| `src/components/contabilidade/ContaFormDialog.tsx` | Renomear "Patrimonio Liquido" para "Patrimonio Social" |

---

## Detalhes Tecnicos

**Fechamento Anual:**
- Buscar todas as contas analiticas dos grupos 4 (receita) e 5 (despesa) com saldo no exercicio
- Calcular total receitas e total despesas
- Gerar lancamento automatico via `criarLancamentoAutomatico`:
  - Para cada conta de receita com saldo: D: conta de receita / C: conta 3.4 (Resultado do Exercicio)
  - Para cada conta de despesa com saldo: D: conta 3.4 / C: conta de despesa
  - O saldo resultante da conta 3.4 e transferido para 3.3.01 (superavit) ou 3.3.02 (deficit)
- Usa IDs de `contabilidade-config.ts`: `CONTAS_PADRAO.RESULTADO_EXERCICIO`, `CONTAS_PADRAO.SUPERAVITS_ACUMULADOS`, `CONTAS_PADRAO.DEFICITS_ACUMULADOS`

**PDF Export:**
- Usa `jspdf` + `jspdf-autotable` (ja instalados)
- A funcao `exportarRelatorioPDF` ja existe em `contabilidade-exports.ts` e funciona para o Razao — basta adaptar para DRE e Balanco

