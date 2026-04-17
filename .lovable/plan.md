

## Causa raiz

Existem **dois fluxos** de criação de cotação e cada um trata o consultor de modo diferente:

### Fluxo A — `CotacaoFormDialog.tsx` (modal em `/vendas/cotacoes`)
**Já está correto.** Linha 181:
```ts
const podeAtribuirVendedor = isDiretor || isGerente || isSupervisor;
```
O bloco "Consultor Responsável" (linhas 2304–2344) só renderiza para liderança. Vendedor comum não vê o dropdown e o `vendedor_id` é gravado automaticamente como `userId || user?.id` (linha 1305–1307). ✅

### Fluxo B — `EtapaDadosAssociado.tsx` (wizard `/vendas/cotacao`) ❌
**Bug aqui.** Linhas 237–260 renderizam o `<Select>` de Consultor **incondicionalmente**, sem checar permissão. Pior: `consultorId` inicia como `''` (Cotacao.tsx linha 73) e o botão "Avançar" exige seleção (linha 88: `consultorId !== ''`), forçando o vendedor logado a se auto-selecionar manualmente — inclusive podendo escolher outro vendedor.

## Correção

**Arquivo único:** `src/components/cotacao/EtapaDadosAssociado.tsx`

1. Importar `useAuth` e `usePermissions`.
2. Calcular `podeAtribuirVendedor = isDiretor || isGerente || isSupervisor` (mesma regra do CotacaoFormDialog para manter paridade).
3. Em `useEffect` ao montar: se `!podeAtribuirVendedor && !consultorId && user?.id`, chamar `setConsultorId(user.id)` automaticamente.
4. Renderizar o bloco do `<Select>` (linhas 237–260 + `<Separator />` da 235) **somente quando `podeAtribuirVendedor === true`**.
5. Para liderança, manter o dropdown atual (mas pré-selecionar com `user.id` como default, para reduzir cliques — eles ainda podem trocar).

Lógica de validação `canProceed` continua funcionando (consultorId estará preenchido automaticamente).

## Validação

1. Login como vendedor (`vendedor_clt` ou `vendedor_externo`) → `/vendas/cotacao` → Etapa 1 não mostra dropdown de Consultor; ao avançar, cotação é gravada com `vendedor_id = userId` do logado.
2. Login como diretor/gerente/supervisor → dropdown aparece, pré-selecionado com o próprio usuário, podendo trocar.
3. Modal `CotacaoFormDialog` em `/vendas/cotacoes` → comportamento inalterado (já correto).
4. Conferir `cotacoes.vendedor_id` no banco após criação por vendedor: deve ser o `auth.uid()` do criador.

## Resultado

Vendedores deixam de ver e selecionar consultor — sistema atribui automaticamente. Liderança mantém controle total para reatribuir.

