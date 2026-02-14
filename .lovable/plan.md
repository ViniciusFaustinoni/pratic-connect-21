
# Exibir Historico de Orcamentos no Card Lateral do Auto Center

## Objetivo

Adicionar uma secao "Historico de Orcamentos" no drawer de detalhes do Auto Center (`AutoCenterDetailDrawer`), mostrando todas as cotacoes de pecas (`evento_cotacoes_pecas`) e ordens de servico (`ordens_servico`) vinculadas aquele Auto Center.

## Dados Disponiveis

Duas tabelas possuem `auto_center_id`:

1. **evento_cotacoes_pecas** -- cotacoes de pecas enviadas ao auto center (com status, valor_total, created_at, sinistro_id)
2. **ordens_servico** -- ordens de servico vinculadas (com numero, status, valor_orcamento, created_at, sinistro_id)

## Implementacao

### 1. Criar hook `useAutoCenterHistorico`

**Arquivo:** `src/hooks/useAutoCenterHistorico.ts` (novo)

- Query em `evento_cotacoes_pecas` filtrando por `auto_center_id`, trazendo `id, status, valor_total, created_at, sinistro_id` e join com `sinistros(protocolo)`
- Query em `ordens_servico` filtrando por `auto_center_id`, trazendo `id, numero, status, valor_orcamento, created_at, sinistro_id` e join com `sinistros(protocolo)`
- Retorna ambos os arrays ordenados por data decrescente

### 2. Criar componente `AutoCenterHistorico`

**Arquivo:** `src/components/oficinas/AutoCenterHistorico.tsx` (novo)

- Recebe `autoCenterId` como prop
- Usa o hook acima para buscar dados
- Exibe uma timeline/lista com:
  - Icone diferenciado para cotacao vs ordem de servico
  - Status com badge colorido
  - Valor total (quando disponivel)
  - Protocolo do sinistro vinculado
  - Data formatada
- Estado vazio: "Nenhum orcamento registrado"
- Estado de loading com skeleton

### 3. Integrar no drawer de detalhes

**Arquivo:** `src/components/oficinas/AutoCenterDetailDrawer.tsx`

- Adicionar a secao "Historico de Orcamentos" (com icone `History`) entre a secao de Pecas e os botoes de acao
- Renderizar o componente `AutoCenterHistorico` passando o `autoCenter.id`

## Arquivos Afetados

| Acao | Arquivo |
|---|---|
| Criar | `src/hooks/useAutoCenterHistorico.ts` -- hook para buscar cotacoes e OS do auto center |
| Criar | `src/components/oficinas/AutoCenterHistorico.tsx` -- componente de timeline do historico |
| Modificar | `src/components/oficinas/AutoCenterDetailDrawer.tsx` -- adicionar secao de historico |
