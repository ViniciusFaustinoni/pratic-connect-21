
# Plano: Inverter Posição dos Botões de Link no Menu de Cotações

## Objetivo

Trocar a ordem dos itens "Acessar Link do Cliente" e "Copiar Link" no menu dropdown do card de cotação.

## Situação Atual

No menu de ações extras (3 pontinhos) do card de cotação:

1. Baixar PDF
2. **Acessar Link do Cliente** (linha 497-503)
3. **Copiar Link** (linha 504-510)
4. Duplicar
5. Excluir

## Situação Desejada

1. Baixar PDF
2. **Copiar Link**
3. **Acessar Link do Cliente**
4. Duplicar
5. Excluir

## Alteração

**Arquivo**: `src/components/cotacoes/CotacaoCard.tsx`

Inverter a ordem dos dois `DropdownMenuItem` (linhas 497-510):

- Mover o bloco de "Copiar Link" (linhas 504-510) para antes do bloco "Acessar Link do Cliente" (linhas 497-503)

## Resumo de Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/components/cotacoes/CotacaoCard.tsx` | Inverter ordem dos itens no dropdown menu |
