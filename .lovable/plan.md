
# Corrigir Cidade/UF e Bairro vazios na Análise de Eventos

## Problema

Quando o sinistro é criado via assistente de IA (chat), apenas o campo `local_ocorrencia` é preenchido (ex: "Estrada do pau da fome, 1000"). Os campos `cidade_ocorrencia` e `estado_ocorrencia` ficam NULL porque a function tool `comunicar_sinistro` no `assistente-chat` não tem parâmetros separados para cidade/estado e não os extrai do texto.

Resultado: a tela de análise mostra "Cidade/UF: /" (vazio).

## Solução em duas frentes

### 1. Backend: Extrair cidade/estado na criação do sinistro

**Arquivo: `supabase/functions/assistente-chat/index.ts`**

- Adicionar parâmetros `cidade` e `estado` na definição da function tool `comunicar_sinistro` (por volta da linha 217-235)
- Na criação do sinistro (linha 625-635), incluir `cidade_ocorrencia: args.cidade` e `estado_ocorrencia: args.estado`
- Como fallback, se a IA não fornecer cidade/estado, usar os dados do associado (`cidade`, `uf`) que já estão disponíveis no contexto

### 2. Frontend: Fallback na exibição

**Arquivo: `src/pages/eventos/SinistroAnalise.tsx`**

- Na linha que exibe Cidade/UF (linha 682), adicionar fallback para os dados do associado:
  - Se `cidade_ocorrencia` está vazio, usar `sinistro.associado?.cidade`
  - Se `estado_ocorrencia` está vazio, usar `sinistro.associado?.uf`
- Adicionar exibição do bairro (extraído de `linkEvento?.dados_etapa2?.endereco_bairro` ou do endereço do associado) como campo adicional ou junto ao local

## Detalhes técnicos

### assistente-chat/index.ts - Tool definition (linha ~217)

Adicionar ao schema de parâmetros:
```text
cidade: { type: "string", description: "Cidade onde ocorreu" }
estado: { type: "string", description: "UF/Estado (sigla, ex: RJ, SP)" }
```
Estes NÃO serão obrigatórios (required continua apenas tipo, data, local, descricao).

### assistente-chat/index.ts - Insert sinistro (linha ~625)

Adicionar ao insert:
```text
cidade_ocorrencia: args.cidade || associado.cidade || null
estado_ocorrencia: args.estado || associado.uf || null
```

### SinistroAnalise.tsx - Exibição (linha ~682)

Alterar a construção do valor de Cidade/UF para:
```text
cidade = sinistro.cidade_ocorrencia || linkEvento?.dados_etapa2?.endereco_cidade || sinistro.associado?.cidade || ''
uf = sinistro.estado_ocorrencia || linkEvento?.dados_etapa2?.endereco_uf || sinistro.associado?.uf || ''
```

Assim, mesmo sinistros antigos que já estão no banco sem cidade/UF vão exibir corretamente usando os dados disponíveis como fallback.
