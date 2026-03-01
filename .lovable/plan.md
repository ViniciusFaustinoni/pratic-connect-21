

# Corrigir preenchimento automatico de CNH, Leilao, Consultor e Uso Aplicativo na Proposta

## Problemas identificados

### 1. CNH nao preenche automaticamente
**Causa raiz**: O `ContratoWizard.tsx` coleta os dados de CNH via OCR (campos `cnh`, `cnh_validade`, `cnh_categoria` do formulario), mas **nao os envia** na chamada `createContrato.mutateAsync()`. Os campos `cliente_cnh`, `cliente_cnh_validade` e `cliente_cnh_categoria` ficam nulos no contrato.

O fluxo publico (`contrato-gerar` edge function) ja propaga esses campos corretamente (linhas 573-575), entao o problema e exclusivo do fluxo do vendedor via `ContratoWizard`.

### 2. Leilao sempre mostra "NAO"
**Causa raiz**: A funcao `ehLeilao()` verifica se `veiculo_categoria` contem "leilao". Porem a categoria do veiculo e tipicamente "Automovel", "Motocicleta", etc. -- nunca contem "leilao". A informacao real de leilao deveria vir de um campo especifico ou da `procedencia` do veiculo (ex: "Leilao").

### 3. Consultor nao aparece
**Causa raiz**: O `ContratoWizard.tsx` envia `vendedor_id: cotacao.vendedor_id`. A funcao `autentique-create` ja resolve o nome via `profiles`. O problema e que `cotacao.vendedor_id` pode estar vazio se a cotacao foi criada sem vincular vendedor. Precisa garantir fallback para o usuario logado.

### 4. Uso aplicativo nao persiste
**Causa raiz**: O `ContratoWizard.tsx` envia `uso_aplicativo: cotacao.uso_aplicativo || false`. Isso funciona SE a cotacao tiver `uso_aplicativo` preenchido. Precisa verificar se o campo esta sendo buscado corretamente na query da cotacao.

## Solucao

### Arquivo 1: `src/components/contratos/ContratoWizard.tsx`

Adicionar os campos faltantes na chamada `createContrato.mutateAsync()`:

```text
// Campos que serao adicionados (apos linha 726):
cliente_cnh: data.cnh || null,
cliente_cnh_validade: data.cnh_validade || null,
cliente_cnh_categoria: data.cnh_categoria || null,
cliente_rg: data.rg || null,
cliente_rg_orgao: data.rg_orgao || null,
cliente_data_nascimento: data.data_nascimento || null,
cliente_logradouro: data.logradouro || null,
cliente_numero: data.numero || null,
cliente_complemento: data.complemento || null,
cliente_bairro: data.bairro || null,
```

Tambem corrigir `vendedor_id` para usar fallback do usuario logado:

```text
vendedor_id: cotacao.vendedor_id || profile?.id || null,
```

Onde `profile` e o perfil do usuario logado (ja disponivel no componente via hook `useAuth` ou similar).

### Arquivo 2: `supabase/functions/_shared/termo-afiliacao-utils.ts`

Corrigir a funcao `ehLeilao()` para verificar tambem o campo `procedencia`:

```text
function ehLeilao(categoria: string | null | undefined, procedencia?: string | null): boolean {
  if (!categoria && !procedencia) return false;
  const c = (categoria || '').toLowerCase();
  const p = (procedencia || '').toLowerCase();
  return c.includes('leilão') || c.includes('leilao') ||
         p.includes('leilão') || p.includes('leilao');
}
```

Atualizar `mapearDadosParaTemplate` para passar `procedencia` para `ehLeilao`:

```text
leilao: ehLeilao(
  contrato.veiculo_categoria || veiculo.veiculo_categoria,
  contrato.veiculo_procedencia || veiculo.veiculo_procedencia
),
```

### Arquivo 3: `src/components/contratos/ContratoFormDialog.tsx`

Mesma correcao: adicionar campos de CNH e corrigir vendedor_id com fallback.

## Resumo das alteracoes

| Arquivo | O que muda |
|---|---|
| `src/components/contratos/ContratoWizard.tsx` | Propagar CNH, RG, endereco completo e vendedor_id com fallback |
| `src/components/contratos/ContratoFormDialog.tsx` | Mesma propagacao de campos faltantes |
| `supabase/functions/_shared/termo-afiliacao-utils.ts` | Corrigir `ehLeilao()` para verificar `procedencia` alem de `categoria` |

## Resultado esperado

- **CNH**: Numero, validade e categoria preenchidos automaticamente (dados extraidos via OCR no wizard)
- **Leilao**: Marcado como "SIM" se a procedencia do veiculo indicar leilao, "NAO" caso contrario
- **Consultor**: Nome resolvido via `vendedor_id` com fallback para o usuario logado
- **Uso aplicativo**: Ja propagado corretamente -- sera verificado se a query da cotacao inclui o campo

