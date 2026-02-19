
# Corrigir: Erro 22001 - estado_evento muito longo para o campo estado_ocorrencia

## Diagnóstico Confirmado

Os logs da edge function mostram claramente:

```
[criar-sinistro] Erro ao inserir sinistro: {
  code: "22001",
  message: "value too long for type character varying(2)"
}

Payload recebido:
  "estado_evento": "Rio de Janeiro"
```

O campo `estado_ocorrencia` no banco é `character varying(2)`, aceitando apenas siglas de UF (ex: "RJ"). O app (tanto o formulario manual quanto a IA) envia o nome completo do estado ("Rio de Janeiro"), causando a falha no INSERT.

## Solucao

### 1. Adicionar funcao de normalizacao de UF na edge function `criar-sinistro`

**Arquivo:** `supabase/functions/criar-sinistro/index.ts`

Adicionar um mapa de conversao de nome completo para sigla logo apos os imports, e usar essa funcao antes de inserir o sinistro:

```text
// Mapa de estados brasileiros → sigla
const ESTADOS_MAP: Record<string, string> = {
  "acre": "AC", "alagoas": "AL", "amapa": "AP", "amazonas": "AM",
  "bahia": "BA", "ceara": "CE", "distrito federal": "DF",
  "espirito santo": "ES", "goias": "GO", "maranhao": "MA",
  "mato grosso": "MT", "mato grosso do sul": "MS", "minas gerais": "MG",
  "para": "PA", "paraiba": "PB", "parana": "PR", "pernambuco": "PE",
  "piaui": "PI", "rio de janeiro": "RJ", "rio grande do norte": "RN",
  "rio grande do sul": "RS", "rondonia": "RO", "roraima": "RR",
  "santa catarina": "SC", "sao paulo": "SP", "sergipe": "SE",
  "tocantins": "TO",
};

function normalizarEstado(estado: string | undefined): string {
  if (!estado) return '';
  if (estado.length === 2) return estado.toUpperCase(); // já é sigla
  const chave = estado.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // remove acentos
  return ESTADOS_MAP[chave] || estado.substring(0, 2).toUpperCase();
}
```

### 2. Aplicar normalizacao antes do INSERT

Na linha 513, alterar:
```typescript
// ANTES
estado_ocorrencia: payload.estado_evento || '',

// DEPOIS
estado_ocorrencia: normalizarEstado(payload.estado_evento),
```

### 3. Corrigir tambem o campo `estado_evento` no payload do chat (assistente-chat)

**Arquivo:** `supabase/functions/assistente-chat/index.ts`

Na linha 641, o `assistente-chat` tambem insere diretamente na tabela `sinistros` com o campo `estado_ocorrencia`. Aplicar a mesma normalizacao ou truncar para 2 chars para garantir consistencia.

Adicionar uma funcao utilitaria identica no `assistente-chat` e aplicar no campo:
```typescript
estado_ocorrencia: normalizarEstado(args.estado || associado?.uf || null),
```

### 4. Deploy das edge functions

Fazer deploy de `criar-sinistro` e `assistente-chat` com as correcoes.

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/criar-sinistro/index.ts` | Adicionar `normalizarEstado()` e aplicar no INSERT (linha 513) |
| `supabase/functions/assistente-chat/index.ts` | Adicionar `normalizarEstado()` e aplicar no INSERT do sinistro via chat (linha 641) |

## Resultado esperado

- Associado preenche o sinistro no app com "Rio de Janeiro"
- A funcao converte para "RJ" antes de inserir no banco
- INSERT ocorre com sucesso
- Sinistro criado com status `comunicado`
- Fluxo continua normalmente (link do evento gerado, etc.)

## Observacao adicional

O campo `necessita_reboque: true` no payload indica que o app tambem estava tentando criar um chamado de reboque automaticamente junto com o sinistro (linhas 609-650 do `criar-sinistro`). Isso e um comportamento do formulario manual (nao do chat da IA). O formulario tem uma opcao onde o associado informa se precisa de reboque, e isso e enviado no payload. Esse comportamento e correto para o formulario direto.
