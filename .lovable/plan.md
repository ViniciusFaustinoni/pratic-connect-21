
# Aba "Cotacoes Recebidas" no Detalhe do Evento

## Resumo

Adicionar uma aba "Cotacoes Recebidas" na pagina de analise do sinistro (`SinistroAnalise.tsx`) que mostra pedidos enviados, permite registro manual de cotacoes, exibe comparativo lado a lado e permite aprovar uma unica cotacao por evento.

---

## Alteracoes no Banco de Dados

A tabela `evento_cotacoes_pecas` ja existe com os campos necessarios (`id`, `sinistro_id`, `auto_center_id`, `itens`, `status`, `resposta`, `created_at`, etc.). Precisamos apenas adicionar colunas para suportar aprovacao:

```text
ALTER TABLE evento_cotacoes_pecas 
  ADD COLUMN aprovada boolean DEFAULT false,
  ADD COLUMN aprovada_em timestamptz,
  ADD COLUMN aprovada_por uuid REFERENCES profiles(id),
  ADD COLUMN valor_total numeric DEFAULT 0,
  ADD COLUMN prazo_geral text,
  ADD COLUMN observacoes_auto_center text;
```

---

## Arquivos a Criar

### 1. `src/components/sinistros/CotacoesRecebidasTab.tsx`

Componente principal da aba, dividido em 4 secoes:

**Secao 1 - Resumo dos Pedidos Enviados:**
- Query em `evento_cotacoes_pecas` filtrado por `sinistro_id`
- Join com `auto_centers` para nome
- Mostra cards com: nome auto center, data envio, status (badge colorido)
- Pedidos com mais de 24h sem resposta: status automaticamente "expirado" (verificacao no frontend ao renderizar)
- Botao "Reenviar cotacao" para expirados (chama edge function `enviar-cotacao-pecas` novamente)

**Secao 2 - Botao "Registrar Cotacao Recebida":**
- Abre modal `RegistrarCotacaoDialog`
- So aparece se ha pedidos com status "enviado"

**Secao 3 - Comparativo de Cotacoes:**
- Tabela comparativa horizontal quando ha 2+ cotacoes com resposta
- Linhas: cada peca do orcamento
- Colunas: cada auto center que respondeu
- Celulas: valor unitario + disponibilidade + prazo
- Rodape: total por auto center, menor preco em verde
- Pecas indisponiveis em vermelho

**Secao 4 - Cards de Cotacoes com botao Aprovar:**
- Card por cotacao respondida
- Botao "Aprovar esta Cotacao" no canto
- Se ja existe uma aprovada: mostra ela em destaque no topo, demais com badge "nao selecionada" cinza
- Modal de confirmacao antes de aprovar (irreversivel)
- Ao aprovar: update `aprovada=true`, `aprovada_em=now()`, `aprovada_por=user_id` e marcar demais como `status='nao_selecionada'`

### 2. `src/components/sinistros/RegistrarCotacaoDialog.tsx`

Modal para registro manual:

- Dropdown de auto centers (apenas os acionados para este evento, filtrados de `evento_cotacoes_pecas`)
- Lista de pecas pre-preenchida do orcamento (readonly descricao e quantidade)
- Para cada peca: valor unitario (R$), prazo entrega (texto), disponibilidade (select: Disponivel/Indisponivel/Sob consulta)
- Valor total calculado automaticamente (soma de unitario x quantidade para itens disponiveis)
- Campo observacoes (textarea)
- Campo prazo geral (texto)
- Ao salvar: update na `evento_cotacoes_pecas` correspondente com `status='respondido'`, `resposta=jsonb` com os valores, `valor_total`, `prazo_geral`, `observacoes_auto_center`

### 3. `src/hooks/useCotacoesEvento.ts`

Hook para buscar cotacoes de um sinistro:
- Query em `evento_cotacoes_pecas` com join em `auto_centers(nome_fantasia, nome, whatsapp)`
- Filtro por `sinistro_id`
- Retorna lista de cotacoes com dados do auto center

---

## Arquivos a Modificar

### `src/pages/eventos/SinistroAnalise.tsx`

Transformar a area principal de conteudo (coluna esquerda) em um componente com abas (`Tabs`):

- Aba "Detalhes" (padrao): conteudo atual (cards de associado, veiculo, sinistro, documentos, etc.)
- Aba "Cotacoes Recebidas": novo componente `CotacoesRecebidasTab`
- A aba de cotacoes so aparece quando status e `pronto_para_oficina`, `em_reparo` ou posterior
- Importar componentes `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`

A coluna direita (acoes, checklist, historico) permanece inalterada fora das abas.

---

## Fluxo do Usuario

```text
1. Evento com status "pronto_para_oficina" ou "em_reparo"
2. Analista/Regulador abre o evento
3. Ve aba "Cotacoes Recebidas" ao lado de "Detalhes"
4. Clica na aba -> ve resumo dos pedidos enviados
5. Auto center responde via WhatsApp
6. Analista clica "Registrar Cotacao Recebida"
7. Preenche valores, disponibilidade, prazos
8. Salva -> cotacao aparece no comparativo
9. Repete para outros auto centers
10. Analisa comparativo lado a lado
11. Clica "Aprovar esta Cotacao" no melhor custo-beneficio
12. Confirma -> cotacao aprovada, demais marcadas como nao selecionadas
```

---

## Arquivos Afetados

| Acao | Arquivo |
|---|---|
| Migration SQL | Adicionar colunas `aprovada`, `aprovada_em`, `aprovada_por`, `valor_total`, `prazo_geral`, `observacoes_auto_center` em `evento_cotacoes_pecas` |
| Criar | `src/hooks/useCotacoesEvento.ts` |
| Criar | `src/components/sinistros/CotacoesRecebidasTab.tsx` |
| Criar | `src/components/sinistros/RegistrarCotacaoDialog.tsx` |
| Modificar | `src/pages/eventos/SinistroAnalise.tsx` — adicionar sistema de abas com aba de cotacoes |
