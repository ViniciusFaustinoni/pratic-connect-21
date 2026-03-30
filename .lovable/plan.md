

# Enviar Local de Instalação no campo `description` ao criar veículo na Softruck

## Problema

O campo `local_instalacao` do rastreador (ex: "painel", "sob banco") existe na tabela `rastreadores`, mas **não é enviado** para a Softruck ao criar/atualizar o veículo. O campo `description` do veículo na Softruck (que seria o local ideal) vai vazio ou com outro valor.

## Alteração

### 1. `supabase/functions/softruck-ativar-dispositivo/index.ts`

Na etapa de criação do veículo na Softruck (~linha 249), o rastreador já está carregado com seus dados. Adicionar o campo `descricao` com o valor de `rastreador.local_instalacao` (ou `rastreador.descricao_instalacao`):

```
descricao: rastreador.local_instalacao || rastreador.descricao_instalacao || undefined
```

Isso faz com que o campo chegue ao `criar-veiculo` do `softruck-api`, que já mapeia `descricao → description` no payload da Softruck.

Verificar também se o SELECT que carrega o rastreador inclui `local_instalacao` e `descricao_instalacao`.

### 2. Verificar se ao **atualizar** o veículo na Softruck o `description` também é atualizado

No caso `atualizar-veiculo` do `softruck-api/index.ts` (~linha 422), o campo `description` não é incluído nos updates. Adicionar suporte ao campo `descricao` no update também.

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/softruck-ativar-dispositivo/index.ts` | Enviar `local_instalacao` como `descricao` ao criar veículo |
| `supabase/functions/softruck-api/index.ts` | Adicionar `description` no caso `atualizar-veiculo` |

