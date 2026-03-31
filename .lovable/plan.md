

# Adicionar Configuração de Carência nos Formulários de Gestão Comercial

## Problema
Os formulários de cobertura e benefício na **Gestão Comercial** (`CatalogoCoberturasBeneficios.tsx`) não possuem a seção de carência. O componente `CarenciaConfigSection` já existe e é usado nos formulários antigos do admin, mas não foi integrado aqui.

## Solução

### `src/components/gestao-comercial/CatalogoCoberturasBeneficios.tsx`

**Para ambos os sheets (CoberturaSheet e BeneficioSheet):**

1. Importar `CarenciaConfigSection` de `@/components/admin/planos/CarenciaConfigSection`
2. Adicionar estado para os campos de carência (`carencia_ativa`, `carencia_tipo`, `carencia_dias`, `carencia_multiplicador`)
3. Carregar valores existentes do item ao abrir (usando campos da tabela `coberturas` ou `benefits`)
4. Renderizar `<CarenciaConfigSection>` entre o campo Valor e o `EligibilityConfigSection`
5. Incluir os campos de carência no payload do `mutationFn` ao salvar

**CoberturaSheet** — payload adicional:
```ts
carencia_ativa, carencia_tipo, carencia_dias, carencia_multiplicador
```

**BeneficioSheet** — idem, usando os mesmos campos da tabela `benefits`

| Arquivo | Ação |
|---|---|
| `src/components/gestao-comercial/CatalogoCoberturasBeneficios.tsx` | Adicionar `CarenciaConfigSection` + estado + persistência em ambos os sheets |

