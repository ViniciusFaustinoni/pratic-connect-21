

# Corrigir tela em branco ao comunicar sinistro

## Problema

Na Etapa 1 do formulário de sinistro (`NovoSinistro.tsx`), os tipos de ocorrência são filtrados por `tiposSinistroPermitidos`, que vem do hook `useMinhasCoberturas`. Se o veículo não tem os campos `cobertura_total` ou `cobertura_roubo_furto` marcados como `true` (o que acontece com veículos importados do SGA que não têm esses campos preenchidos), a lista fica vazia e a tela aparece em branco.

## Solução

### 1. Arquivo: `src/hooks/useMinhasCoberturasApp.ts`

Alterar a lógica de `tiposSinistroPermitidos` para que, quando o veículo não estiver inadimplente, sempre permita ao menos os tipos básicos de sinistro. A cobertura do veículo deve ser tratada como "total" por padrão quando o associado está ativo e adimplente — os campos `cobertura_total`/`cobertura_roubo_furto` são flags opcionais de restrição, não de habilitação.

Lógica proposta:
```ts
const tiposSinistroPermitidos: string[] = inadimplente
  ? []
  : ['colisao', 'roubo', 'furto', 'incendio', 'fenomeno_natural', 'vandalismo', 'outro'];
```

Manter `temCoberturaTotal` e `temCoberturaRouboFurto` para outros usos (assistência, rastreamento), mas não bloquear tipos de sinistro com base neles.

### 2. Arquivo: `src/pages/app/NovoSinistro.tsx`

Adicionar fallback: se `tiposDisponiveis` estiver vazio mesmo após o filtro, mostrar todos os tipos com um aviso informativo em vez de tela em branco.

## Impacto
- 2 arquivos, ~10 linhas alteradas
- Associados poderão abrir sinistro normalmente independente dos flags de cobertura no veículo

