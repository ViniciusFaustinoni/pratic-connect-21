
# Melhorar Geocodificacao do Local Informado pela IA

## Diagnostico

O sinistro `d710629f` foi criado **antes** do deploy do codigo de geocodificacao, por isso `latitude_informada` e `longitude_informada` estao nulos. Alem disso, a query atual envia apenas `"Rua Bacairis proximo ao numero 465, Brasil"` para o Nominatim -- sem cidade/UF, o que pode falhar para enderecos parciais.

## Solucao

### 1. Incluir cidade/UF do associado na query de geocodificacao

**Arquivo:** `supabase/functions/whatsapp-webhook/index.ts` (linha ~998-1014)

Melhorar a query Nominatim usando a cidade e UF do associado (que ja estao disponiveis no contexto):

```text
// Antes:
args.local + ', Brasil'

// Depois:
args.local + ', ' + (associado?.cidade || '') + ', ' + (associado?.uf || '') + ', Brasil'
```

Isso transforma "Rua Bacairis proximo ao numero 465, Brasil" em "Rua Bacairis proximo ao numero 465, RIO DE JANEIRO, RJ, Brasil" -- muito mais preciso.

### 2. Adicionar log antes da geocodificacao

Para facilitar debug futuro, adicionar um `console.log` antes da chamada ao Nominatim.

### 3. Mesma melhoria no `assistente-chat`

**Arquivo:** `supabase/functions/assistente-chat/index.ts`

Aplicar a mesma melhoria na geocodificacao do assistente do App, incluindo cidade/UF do associado na query.

## Resumo de Arquivos

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/whatsapp-webhook/index.ts` | Incluir cidade/UF do associado na query Nominatim + log |
| `supabase/functions/assistente-chat/index.ts` | Mesma melhoria na geocodificacao |

Nenhuma migration necessaria. O sinistro atual (`d710629f`) foi criado antes do deploy anterior, por isso nao foi geocodificado. Novos sinistros ja serao geocodificados com o codigo atualizado.
