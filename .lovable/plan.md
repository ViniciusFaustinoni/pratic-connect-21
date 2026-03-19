

# Fix: Capturar consultor_id no wizard de substituição

## Problema
O campo `consultor_id` nunca é preenchido ao criar a substituição. A Edge Function `efetivar-substituicao` já verifica `substituicao.consultor_id` para creditar pontos (Step 12), mas ele é sempre `null`.

## Solução

### 1. `src/hooks/useSubstituicaoVeiculo.ts` — `useIniciarSubstituicao`
- Adicionar parâmetro opcional `consultor_id` em `IniciarSubstituicaoParams`
- No `mutationFn`, incluir `consultor_id` no insert

### 2. `src/pages/cadastro/SubstituicaoVeiculoPage.tsx`
- Importar `useAuth` para obter `profile` e `perfis` (ou `isVendedor()`)
- Derivar `consultorId`: se o usuário logado tem role comercial (`vendedor_clt`, `vendedor_externo`, `supervisor_vendas`), usar `profile.id`; senão, `null`
- Passar `consultor_id` para `handleIniciarSubstituicao`
- Exibir badge informativo no header do wizard: "Consultor: Nome do Vendedor" ou "Sem consultor vinculado" (read-only, sem edição)

### 3. Arquivos inalterados
- `efetivar-substituicao/index.ts` — já lê `substituicao.consultor_id` e pontua corretamente
- `pontuacao-helper.ts` — já funciona
- `SubstituicaoStepper.tsx` — sem mudança

## Detalhes técnicos

**Detecção do consultor (Page):**
```typescript
const { profile, isVendedor } = useAuth();
const consultorId = isVendedor() ? profile?.id : null;
const consultorNome = isVendedor() ? profile?.nome : null;
```

**Passagem ao hook:**
```typescript
const result = await iniciarSubstituicao.mutateAsync({
  ...params,
  consultor_id: consultorId,
});
```

**Badge no header (read-only):**
Abaixo da linha "Associado: X — Veículo atual: Y", exibir um badge:
- Verde com nome se consultor detectado
- Cinza "Sem consultor vinculado" se perfil administrativo

