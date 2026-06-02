## Bug

Na Substituição, dentro do `CotacaoFormDialog` aberto pelo `Cotacoes.tsx`, ao preencher a placa do veículo novo e clicar na lupa, os planos aparecem por um instante e somem.

## Causa

`src/pages/vendas/Cotacoes.tsx` (linha ~1396) passa `cotacaoBase` e `origemSubstituicao` como **objetos literais criados inline a cada render**:

```tsx
<CotacaoFormDialog
  origemSubstituicao={substituicaoCtx ? { ... } : null}
  cotacaoBase={substituicaoCtx ? { ... } : null}
  ...
/>
```

Cada re-render do `Cotacoes` (e há vários enquanto a lupa busca: SGA check, placa duplicada, getByPlaca, setVeiculoEncontrado, setPlanos…) gera **novas referências** desses objetos. O `useEffect` de pré-preenchimento dentro do dialog (linha 1322, deps `[cotacaoBase, open, form, restaurarVeiculoPorPlaca]`) dispara em cada render do pai, e:

1. Re-executa `restaurarVeiculoPorPlaca(cotacaoBase.veiculo_placa)` (async, chama `getByPlaca` de novo).
2. Quando volta, faz `setVeiculoEncontrado(novoObjeto)` — referência nova → recalcula `marcaResolvida`/`modeloResolvido`/`tipoVeiculoDetectado` → muda a query key do `usePlanosCotacao` → planos somem (volta para `isLoading`) e podem voltar com lista vazia se o segundo `getByPlaca` falhar/limitar (rate limit ou SGA modal abre).
3. Re-chama `form.setValue('valor_fipe', …)` com o valor do cotacaoBase (que é **0** no substituicaoCtx) — em alguns ramos zera o FIPE momentaneamente e derruba os planos calculados.

A combinação faz os planos "piscarem e sumirem".

## Correção (mínima, só presentation/data wiring)

### 1. `src/pages/vendas/Cotacoes.tsx` — estabilizar `cotacaoBase` e `origemSubstituicao`

Envolver os dois objetos em `useMemo` com dependências sobre os campos primitivos de `substituicaoCtx`. Assim a referência só muda quando os dados realmente mudam.

```tsx
const origemSubstituicaoProp = useMemo(
  () => substituicaoCtx ? { solicitacaoId, associadoId, veiculoAntigoId, veiculoAntigoPlaca, veiculoAntigoModelo, veiculoNovoPlaca: ... || undefined } : null,
  [substituicaoCtx?.solicitacaoId, substituicaoCtx?.associadoId, ...]
);

const cotacaoBaseProp = useMemo(
  () => substituicaoCtx ? { valor_fipe: 0, ..., veiculo_placa: substituicaoCtx.veiculoNovoPlaca || null, nome_solicitante: substituicaoCtx.nome || null, ... } : null,
  [substituicaoCtx?.veiculoNovoPlaca, substituicaoCtx?.nome, ...]
);
```

### 2. `src/components/cotacoes/CotacaoFormDialog.tsx` — efeito 1322 não pode brigar com busca manual

Dois ajustes defensivos para que, mesmo se a referência mudar de novo no futuro, o efeito não destrua o que o usuário acabou de buscar:

- Não chamar `restaurarVeiculoPorPlaca` se já existe `veiculoEncontrado` ou se `buscandoPlaca` está true. Hoje o efeito não tem esse guard, então qualquer re-disparo desfaz a lupa.
- Trocar o disparo único do efeito para depender apenas dos campos primitivos relevantes de `cotacaoBase` (placa, FIPE, marca, modelo, ano, lead_id, nome/telefone/email, categoria, região), não do objeto inteiro. Isso evita re-execução por mudança de referência irrelevante.

Não mexer em lógica de cálculo de planos, `usePlanosCotacao`, nem no fluxo da Substituição em si.

### 3. Validação

- Abrir Substituição → preencher placa do novo veículo → clicar lupa → confirmar que os planos aparecem **e ficam**.
- Repetir com placa que dispara modal SGA: planos não devem aparecer (correto), modal abre.
- Confirmar que o fluxo normal de cotação (sem `cotacaoBase`) segue idêntico.
- Confirmar que duplicação de cotação (que também usa `cotacaoBase`) continua pré-preenchendo corretamente.

## Fora do escopo

Não tocar no fluxo da Troca de Titularidade (usa `origemTroca` em caminho diferente), nem em `usePlanosCotacao`, nem nos guards de placa duplicada/SGA.
