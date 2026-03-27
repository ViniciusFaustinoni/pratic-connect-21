
# Adicionar Regiões do Rio de Janeiro nas Configurações de Campo

## Problema
A lista de regiões de atuação (tanto no banco `configuracoes.chave='regioes_atendimento'` quanto no fallback hardcoded) contém apenas regiões de São Paulo.

## Alterações

### 1. `src/hooks/useRegioesAtendimento.ts`
Atualizar o `FALLBACK_REGIOES` para incluir regiões do RJ:
- Rio de Janeiro - Centro
- Rio de Janeiro - Zona Sul
- Rio de Janeiro - Zona Norte
- Rio de Janeiro - Zona Oeste
- Niterói e São Gonçalo
- Baixada Fluminense
- Região dos Lagos
- Região Serrana

### 2. Migração SQL
Atualizar o registro existente em `configuracoes` com a lista completa (SP + RJ), mantendo os valores de SP e adicionando os novos do RJ no mesmo formato JSON.

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/hooks/useRegioesAtendimento.ts` | Adicionar regiões RJ ao fallback |
| Nova migração SQL | Atualizar `configuracoes.valor` para incluir regiões RJ |
