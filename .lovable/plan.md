
# Corrigir Persistencia de Marcas e Tipos de Pecas no Auto Center

## Problema

A interface TypeScript `AutoCenter` em `src/hooks/useAutoCenters.ts` esta incompleta -- ela declara apenas 13 campos, mas a tabela `auto_centers` no banco possui 31 colunas. Os campos `marcas_atendidas`, `especialidades`, `status`, `razao_social`, `cnpj`, `whatsapp`, `bairro`, dados bancarios e outros estao **ausentes da interface**.

As mutations `useCreateAutoCenter` e `useUpdateAutoCenter` usam essa interface como tipo do payload. Como resultado, campos fora da interface podem ser silenciosamente ignorados ou causar erros de tipo, impedindo a persistencia dos dados.

## Correcao

### 1. Atualizar a interface AutoCenter

**Arquivo:** `src/hooks/useAutoCenters.ts`

Adicionar todos os campos que existem na tabela do banco:

```
razao_social, nome_fantasia, cnpj, inscricao_estadual,
whatsapp, telefone2, logradouro, numero, complemento, bairro,
banco, agencia, conta, pix_chave, pix_tipo,
especialidades (string[]), marcas_atendidas (string[]),
status
```

### 2. Corrigir tipagem das mutations

**Arquivo:** `src/hooks/useAutoCenters.ts`

Com a interface completa, as mutations `useCreateAutoCenter` e `useUpdateAutoCenter` passarao a aceitar todos os campos do payload corretamente, sem necessidade de `as any`.

### 3. Remover casts `as any` do formulario

**Arquivo:** `src/components/oficinas/AutoCenterFormDialog.tsx`

Com a interface correta, os acessos como `(autoCenter as any).marcas_atendidas` poderao ser simplificados para `autoCenter.marcas_atendidas`.

## Arquivos Afetados

| Acao | Arquivo |
|---|---|
| Modificar | `src/hooks/useAutoCenters.ts` -- completar interface AutoCenter com todos os campos do banco |
| Modificar | `src/components/oficinas/AutoCenterFormDialog.tsx` -- remover casts `as any` desnecessarios |
| Modificar | `src/pages/oficinas/AutoCenters.tsx` -- remover casts `as any` na listagem |
