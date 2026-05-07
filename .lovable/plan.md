## Problema confirmado por auditoria

A regra atual em `src/hooks/usePropostasPendentes.ts` remove da lista qualquer associado em `aguardando_instalacao` sem docs/vistoria pendentes — independente de já ter ou não instalação concluída e independente do tipo de vistoria. Isso quebra a **Regra 2** ("sem autovistoria → fica em Propostas Pendentes até a conclusão da instalação").

Auditoria identificou ~22 contratos `cadastro_aprovado=true`, sem autovistoria, instalação ainda **não** concluída, que estão saindo indevidamente da lista (ex.: CTR-...V7SJQA, CTR-...R5DRBE, CTR-...UI5RRS, CTR-...EA2ZIL).

## Correção

### `src/hooks/usePropostasPendentes.ts` (e bloco análogo em `usePropostaPendenteSingle`)

Substituir o filtro `propostaJaConcluida` para considerar o tipo de vistoria:

```ts
const isAutovistoria = tipoVistoriaAtual === 'autovistoria';

// Saída da lista por tipo:
// - Autovistoria: sai assim que o Cadastro aprova
// - Não-autovistoria (agendada / agendada_base / NULL): sai apenas
//   quando a instalação for concluída (ou associado/SGA já ativo)
const saiuPorAutovistoriaAprovada = isAutovistoria && cadastroAprovado;
const saiuPorInstalacaoConcluida  = instalacaoConcluida;
const saiuPorAssociadoAtivo       = associado?.status === 'ativo';
const saiuPorSGA                  = jaNoSGA;

const propostaJaConcluida =
  saiuPorAssociadoAtivo ||
  saiuPorSGA ||
  saiuPorAutovistoriaAprovada ||
  saiuPorInstalacaoConcluida;

if (propostaJaConcluida) return null;
```

Remover a condição `(associado.status === 'aguardando_instalacao' && !docsPendentes && !vistoriaPendenteAnalise)` que estava forçando saída prematura.

### Sem mudanças necessárias

- Migration `cadastro_aprovado`: já existe.
- `aprovar-proposta`: já seta `cadastro_aprovado=true` e `associados.status='aguardando_instalacao'`.
- Badge "Pendente Vistoria Inicial" em `PropostasPendentes.tsx` e `PropostaHeroHeader.tsx`: já implementado, passa a aparecer corretamente após a correção do filtro.
- SGA Hinova: regra inalterada.

### Validação pós-deploy

1. Os ~22 contratos listados na auditoria devem voltar a aparecer em `/cadastro/propostas-pendentes` com o badge roxo "Pendente Vistoria Inicial".
2. Casos de autovistoria já aprovada (Wesley, Luiz Otavio, Larissa, Marcos) continuam fora da lista.
3. Quando a instalação de um contrato sem autovistoria for concluída, o `ativar-associado` promove a `ativo` e o filtro `saiuPorAssociadoAtivo` o remove da lista.

### Memória

Atualizar `mem://logic/operations/propostas-pendentes-saida-por-vistoria` deixando explícito que a única condição de saída para não-autovistoria é instalação concluída / associado ativo / SGA.
