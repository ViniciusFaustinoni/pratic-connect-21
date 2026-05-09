# Reordenar abas do drawer "Solicitação de Troca de Titularidade"

## Problema
Hoje a ordem das abas é:
`Dados → Análise prévia → Financeiro Antigo → Termo → Timeline`

Mas o fluxo real do Cadastro é:
1. Confere os **Dados** (titular antigo, novo titular, veículo).
2. Envia o **Termo de Cancelamento** e aguarda assinatura.
3. Só depois faz sentido olhar **Análise prévia** (snapshot só é gerado após aprovar) e **Financeiro Antigo** (validar adimplência antes de aprovar).
4. **Timeline** fecha como histórico.

A aba **Termo** estar em 4º lugar é contra-intuitivo — o próprio alerta "Próximo passo" empurra o usuário para ela, mas ela aparece quase no fim.

## Mudança proposta
Reordenar para:

`Dados → Termo → Análise prévia → Financeiro Antigo → Timeline`

## Arquivo afetado
- `src/components/troca-titularidade/ModalDetalhesTroca.tsx` — apenas reordenar os `TabsTrigger` (linhas 156-160) e os `TabsContent` correspondentes (linhas 163-263). Nenhuma lógica de negócio muda.

## Atualizações secundárias
- Tutorial `src/data/tutoriais/aprovacao-troca-titularidade-cadastro.ts` (Step 2): trocar a frase "Confira na ordem: Dados, Análise prévia, Financeiro Antigo, Termo" para refletir a nova ordem.

## Não faz parte
- Não muda nenhum hook, edge function, status ou regra de aprovação.
- Não mexe na aba Titularidade da página `/cadastro/processos` (só o conteúdo interno do drawer).
