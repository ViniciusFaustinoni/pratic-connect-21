

# Corrigir erro de duplicação: valor excede varchar(100)

## Problema

Ao duplicar coberturas ou benefícios, o código/slug gerado inclui `Date.now()` (13 dígitos), resultando em valores como `COB-VID-COPIA-1775160096000` que ultrapassam o limite de `varchar(100)` das colunas `coberturas.codigo` e `benefits.slug`.

## Solução

### Arquivo: `src/hooks/usePlansAdmin.ts`

**Cobertura (linha 653)**: Trocar `Date.now()` por um sufixo curto (6 chars aleatórios) e truncar o código base para garantir que o total fique abaixo de 100 caracteres:

```ts
const suffix = Math.random().toString(36).slice(2, 8);
const baseCode = (cobData.codigo || 'COB').slice(0, 80);
codigo: `${baseCode}-CP-${suffix}`,
```

**Benefício (linha 831)**: Mesmo tratamento para o `slug`:

```ts
const suffix = Math.random().toString(36).slice(2, 8);
const baseSlug = (benefitData.slug || 'ben').slice(0, 80);
slug: `${baseSlug}-cp-${suffix}`,
```

**Benefício nome (linha 830)**: Truncar `name` para caber em 150 chars com o sufixo " (cópia)":

```ts
name: `${benefitData.name.slice(0, 140)} (cópia)`,
```

**Cobertura nome (linha 652)**: Mesmo tratamento:

```ts
nome: `${cobData.nome.slice(0, 140)} (cópia)`,
```

## Impacto
- 1 arquivo, ~6 linhas alteradas
- Duplicação passa a funcionar sem erro de truncamento

