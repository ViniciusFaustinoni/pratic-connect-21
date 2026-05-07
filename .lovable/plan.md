## Centralizar "Redução de Cota (Regra de 1%)" num único caminho

### Diagnóstico — hoje está duplicado em 3 lugares

1. **Diretoria → Configurações** (`/diretoria/configuracoes`)
   - Toggle `fipe_menor_ativo` + chaves `fipe_menor_limite_minimo`, `fipe_menor_limite_carro`, `fipe_menor_limite_moto`.
   - Descrição já fala em "desconto de 1% na FIPE".

2. **Diretoria → Gestão Comercial → Regras de Venda → aba "Autorizações e Exceções"**
   (`RegrasVendaContent.tsx` linhas 1330–1612)
   - Faixas de "vendas mês anterior → solicitações permitidas".
   - Limites FIPE máximo (carro/moto) para exceções.
   - Condições especiais (0 km, histórico de boletos).
   - Restrições absolutas (blindado, mudança de linha, depreciação 100%).
   - Dupla aprovação da diretoria (FIPE alto valor).

3. **Diretoria → Faixas & Cotas** (`/diretoria/faixas-cotas`) e chaves atuariais (`valor_por_cota`, `fipe_minimo`, `fipe_maximo`).

O usuário entra por dois caminhos diferentes para configurar a mesma regra — daí o erro/confusão. Como a regra é única, vamos consolidar.

---

### O que vai mudar

#### 1) Nova página única
- Rota: `/diretoria/reducao-cota`
- Título: **"Redução de Cota (Regra de 1%)"**
- Item no menu lateral em **Diretoria** (mesma seção atual de Gestão Comercial).
- A página agrupa em **abas internas** todos os blocos de configuração que hoje estão espalhados:

  ```text
  ┌─ Redução de Cota (Regra de 1%) ──────────────────────┐
  │  [Ativação]  [Limites FIPE]  [Cotas por desempenho]  │
  │  [Exceções & restrições]  [Dupla aprovação]          │
  └──────────────────────────────────────────────────────┘
  ```

  - **Ativação**: toggle `fipe_menor_ativo` (mesma chave de hoje).
  - **Limites FIPE**: `fipe_menor_limite_minimo`, `fipe_menor_limite_carro`, `fipe_menor_limite_moto` + `fipe_max_carro`/`fipe_max_moto` (unifica a duplicação carro/moto).
  - **Cotas por desempenho**: tabela de faixas (vendas mês anterior → solicitações permitidas).
  - **Exceções & restrições**: 0 km, histórico de boletos, blindado, mudança de linha, depreciação em 100%.
  - **Dupla aprovação**: toggle + nº mínimo de aprovadores.

#### 2) Limpeza dos pontos antigos (sem quebrar links existentes)
- **Diretoria → Configurações**: remove o card "FIPE Menor" e troca por um link "Configurar em Redução de Cota (Regra de 1%)" apontando para a nova página.
- **Gestão Comercial → Regras de Venda**: remove a aba "Autorizações e Exceções" e adiciona um banner único "Estas regras foram movidas para *Redução de Cota (Regra de 1%)*" com botão de atalho.
- Menu lateral: remove o item duplicado e mantém **um único** item: "Redução de Cota (Regra de 1%)".
- Rota antiga (`/vendas/aprovacoes-fipe` e `/aprovacoes-elegibilidade`) **permanecem** funcionando — são telas de fila de aprovação, não de configuração; só a *configuração* fica centralizada.

#### 3) Fonte única de verdade
Todas as chaves continuam em `configuracoes` (mesmas chaves já usadas pelos hooks `useFipeMenorAtivo`, `useConfigLimitesVeiculo`, `useValorPorCota`, etc.) — **nenhuma migração de dados** é necessária. Só consolidamos a UI.

---

### Resumo técnico (referência rápida)

- Novo arquivo: `src/pages/diretoria/ReducaoCota.tsx` (composto por subcomponentes reaproveitando blocos existentes de `RegrasVendaContent.tsx` e `Configuracoes.tsx`).
- Nova rota em `src/App.tsx`: `/diretoria/reducao-cota`.
- Item no `AppSidebar.tsx` (seção Diretoria) — apenas para perfis com permissão de regras comerciais (Diretor, Admin, Admin Master, Desenvolvedor).
- `RegrasVendaContent.tsx`: remove o `<TabsContent value="autorizacoes">` (linhas 1330–1620) e o trigger correspondente.
- `Configuracoes.tsx`: remove o bloco `fipeMenorConfig` (linhas ~469–540) e substitui por banner com link.
- Hooks **não mudam** — continuam lendo as mesmas chaves de `configuracoes`.

---

### O que NÃO muda
- Funcionamento da regra durante a cotação (`CotacaoFormDialog.tsx`, `useCalcularCotacao.ts`) permanece igual.
- Filas de aprovação (FIPE menor / FIPE limite / Elegibilidade) continuam onde estão.
- Cálculo atuarial (`valor_por_cota`, faixas) continua onde está — fica só o link a partir da nova página.

Aprovando, eu implemento.