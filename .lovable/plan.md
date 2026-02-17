

# Corrigir filtro de sinistros para Analista de Eventos

## Problema

A query de sinistros em `SinistrosList.tsx` usa `isAnalistaEventos` para filtrar, mas esse valor nao faz parte do `queryKey`. Isso significa que quando o perfil do usuario carrega (e `isAnalistaEventos` muda de `false` para `true`), a query NAO re-executa -- mostrando sinistros que deveriam estar ocultos para o analista.

Alem disso, a query nao tem `enabled` condicionado ao carregamento do perfil, entao ela pode executar antes das permissoes estarem disponiveis.

## Mudancas

**Arquivo: `src/pages/eventos/SinistrosList.tsx`**

### 1. Adicionar permissoes ao queryKey

Incluir `isAnalistaEventos` e `isDiretor` no `queryKey` das duas queries (sinistros e contadores) para que elas re-executem quando as permissoes forem resolvidas.

```text
// Query principal (linha 127)
queryKey: ['sinistros', filters, isAnalistaEventos, isDiretor],

// Query contadores (linha 181)
queryKey: ['sinistros-contadores', isAnalistaEventos, isDiretor],
```

### 2. Condicionar execucao ao carregamento do perfil

Usar o `profile` do `useAuth()` para garantir que as queries so executem apos o perfil estar carregado.

```text
// Importar profile do hook de auth
const { profile } = useAuth();  // ou usar usePermissions se expor loading state

// Adicionar enabled nas queries
enabled: !!profile,
```

Isso garante que a query nunca execute antes do sistema saber qual e o perfil do usuario, evitando que sinistros em estagios iniciais (comunicado, em_analise, etc.) aparecam temporariamente para analistas de eventos.

## Resultado

- Analistas de eventos verao apenas sinistros pos-vistoria (aguardando_analise, aprovado, negado, etc.)
- Diretores continuam vendo todos os sinistros
- Nenhuma mudanca visual -- apenas correcao da logica de filtragem

## Arquivos alterados

1. `src/pages/eventos/SinistrosList.tsx` -- adicionar permissoes ao queryKey e condicionar enabled
