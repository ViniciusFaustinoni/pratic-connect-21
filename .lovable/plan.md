## Causa raiz
O erro `invalid input syntax for type uuid: "24668"` ocorre porque o vendedor selecionou um **indicador encontrado pelo fallback SGA** (associado existente no Hinova mas ainda não importado para a base local).

Em `src/hooks/useAssociadoSearch.ts` (linha 66), o resultado SGA-only é montado com:

```ts
return [{
  id: String(data.codigo_associado),  // ← "24668" (matrícula), não UUID
  ...
  origem_sga: true,
}];
```

Esse `id` virou `indicadorId` do form e foi enviado ao banco em `cotacoes.indicador_id` (coluna UUID), causando a falha. O SEVERINO FERNANDES ALVES (codigo_hinova 24668) já existe localmente — então a busca também deveria ter encontrado pela base local; o vendedor provavelmente buscou por nome/telefone (caso 2) onde só o LOCAL é consultado, ou buscou por CPF e o fallback foi acionado por algum motivo. Independente disso, o bug é entregar uma matrícula como `id` UUID.

## Correção

### 1. `src/hooks/useAssociadoSearch.ts`
- Não usar `String(codigo_associado)` como `id`. Tornar `id` opcional/null quando `origem_sga=true` e expor `codigo_associado` separadamente.
- Tipo: `id: string | null`.

### 2. `src/components/cotacao/EtapaDadosAssociado.tsx` (`handleSelectIndicador`) e `src/pages/vendas/Cotador.tsx` (handler análogo) e `src/components/cotacoes/CotacaoFormDialog.tsx` (handler do indicador)
- Ao selecionar um resultado:
  - Se `associado.id` é UUID válido → comportamento atual.
  - Se `origem_sga === true` (sem UUID local) → invocar a edge function `importar-associado-sga` com o CPF; usar o `associado_id` retornado como `indicadorId`. Mostrar toast "Importando associado do SGA..." durante o processo e tratar erro com toast amigável.
- Bloquear o botão enquanto importa (estado local `isImportandoIndicador`).

### 3. Defesa em profundidade (validação client-side)
- No submit do form (`CotacaoFormDialog` e `Cotador.tsx`), antes de chamar `createCotacao`, validar `indicadorId` com regex UUID. Se não for UUID e `isIndicacao` estiver ligado → toast "Indicador inválido, selecione novamente" e abortar.

### 4. Sem mudança de schema
Não há mudança no banco. Apenas frontend + reuso da edge function existente.

## Arquivos afetados
- `src/hooks/useAssociadoSearch.ts`
- `src/components/cotacao/EtapaDadosAssociado.tsx`
- `src/pages/vendas/Cotador.tsx`
- `src/components/cotacoes/CotacaoFormDialog.tsx`

## Validação
- Buscar por CPF de associado SGA-only → ao selecionar, deve importar e gravar UUID local; cotação cria normalmente.
- Buscar por CPF de associado local → comportamento inalterado.
- Forçar indicadorId inválido programaticamente → bloqueio com toast claro (sem chegar ao banco).
