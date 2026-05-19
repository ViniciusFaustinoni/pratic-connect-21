## Objetivo

Tornar visíveis ao analista do Cadastro — antes de qualquer decisão — três informações que hoje só viajam para o SGA e ficam escondidas em `cotacoes.dados_extras`:

1. **Observação livre** do operador (`observacao_sga`)
2. **Tipo da Cotação** (`tipoCotacao`: nova adesão, inclusão, substituição, troca)
3. **Histórico de avisos SGA / motivo do “Ignorar e Prosseguir”** (`cotacao_avisos_sga`, `motivo_ignorar_aviso`)

Mudança puramente de **leitura/UI** — nenhuma regra de negócio, edge function ou migração é tocada.

## Diagnóstico

Varredura nas telas do Cadastro (`PropostaAnalise.tsx`, `VistoriaCompletaAnalise.tsx`, `ProcessosOperacionais.tsx`, `AssociadoDetalhe.tsx`, `DocumentosSolicitadosCard.tsx`) confirma: **nenhuma** lê `cotacao.dados_extras.observacao_sga`, `tipoCotacao` ou `cotacao_avisos_sga`. O analista aprova sem ver o contexto que o operador deixou.

## Escopo

### 1. Componente novo `ObservacoesCotacaoCard`

`src/components/cadastro/ObservacoesCotacaoCard.tsx`

Card de destaque (borda `border-primary/40`, fundo `bg-primary/5`, ícone `MessageSquareWarning`) com três blocos:

- **Tipo da Cotação** — badge colorido com label legível (mapa `tipoCotacao` → texto).
- **Observação do operador** — bloco com fonte maior, `whitespace-pre-wrap`, ícone destacado. Se `motivo_ignorar_aviso` existir, mostrado abaixo em variante `destructive`.
- **Histórico de avisos SGA** — lista colapsável (`Collapsible`) a partir de `cotacao_avisos_sga` com data, tipo do aviso e motivo.

Quando nenhum dos três existe, o card não é renderizado (sem ruído visual). Props: `cotacao` (objeto com `dados_extras`) e `compact?: boolean` para uso em listas.

### 2. Pontos de uso

- **`PropostaAnalise.tsx`** — card no topo da coluna principal, acima do bloco de documentos. Essa é a tela onde a decisão acontece, então a informação precisa estar acima da dobra.
- **`VistoriaCompletaAnalise.tsx`** — mesmo card, no header da análise da autovistoria.
- **`AssociadoDetalhe.tsx`** — versão compacta na aba da cotação/contrato, para auditoria posterior.
- **`ProcessosOperacionais.tsx` (lista da fila)** — ícone `MessageSquareWarning` ao lado do número da proposta quando houver observação/motivo; tooltip mostra prévia (primeiros ~120 chars). Sinaliza sem poluir a listagem.

### 3. Tipos

Atualizar a tipagem de `dados_extras` (em `src/types/cotacao.ts` ou local equivalente) para incluir, opcionais, `observacao_sga`, `tipoCotacao`, `motivo_ignorar_aviso` e `cotacao_avisos_sga[]`. Sem alterar nada do que já está lá.

## Fora de escopo

- Não alterar `contrato-gerar`, `sga-hinova-sync`, `CotacaoFormDialog` — já gravam e propagam corretamente.
- Sem nova coluna, sem migração — os dados já existem em `cotacoes.dados_extras`.
- Sem mudança em regras de aprovação, bloqueio ou inadimplência.

## Validação

- Cotação criada com observação preenchida → card visível no topo de `PropostaAnalise` com observação, tipo e (se houver) histórico de avisos.
- Cotação sem observação → card omitido, tela inalterada.
- Lista de processos operacionais → ícone-indicador aparece somente nas linhas com observação/motivo; tooltip mostra prévia.
- Texto exibido no Cadastro = exatamente o texto que segue para o campo `observacao` do veículo no SGA.
