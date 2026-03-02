
# Correcao: Documentos CNH/CRLV sempre mostram "Pendente" na tela do analista

## Diagnostico

### Causa raiz

O sistema possui **duas tabelas de documentos separadas** que nao se comunicam adequadamente:

1. **`documentos`** -- usada pela Fila de Documentos e tela do Associado para analise individual
2. **`contratos_documentos`** -- usada pelo fluxo de cotacao/proposta para armazenar documentos enviados durante o cadastro

Quando documentos sao enviados durante a cotacao (pelo vendedor ou pelo sistema), eles sao inseridos **apenas** na tabela `contratos_documentos` via `UnifiedDocumentUploader`. Eles **nunca** sao inseridos na tabela `documentos`.

A tela de analise da proposta (`PropostaAnalise.tsx` > `DocumentosAnexadosPanel`) le os documentos diretamente de `contratos_documentos`. Como nao existe **nenhum mecanismo de aprovacao individual** nessa tela (apenas botoes de Fechar/Baixar no modal de visualizacao), os documentos permanecem eternamente com status `pendente`.

A sincronizacao que existe em `useDocumentos.ts` (aprovar na tabela `documentos` e sincronizar para `contratos_documentos` via `arquivo_url`) **nao funciona neste caso** porque os documentos da cotacao nunca existem na tabela `documentos`.

### Impacto

- Analista ve CNH e CRLV como "Pendente" mesmo apos verificar visualmente
- Nao ha botao de aprovar/reprovar individual no fluxo de proposta
- A unica forma de "aprovar" era aprovar a proposta inteira (que faz bulk update)

## Solucao

Adicionar botoes de **Aprovar** e **Reprovar** diretamente no `VisualizadorDocumentoModal` quando o documento estiver pendente. Ao clicar, atualizar diretamente na tabela `contratos_documentos` e invalidar o cache.

### Arquivos a editar

#### 1. `src/components/cadastro/VisualizadorDocumentoModal.tsx`

- Adicionar props `onAprovar` e `onReprovar` (opcionais, callbacks)
- Quando o documento tiver `status === 'pendente'` e os callbacks estiverem presentes, exibir botoes "Aprovar" (verde) e "Reprovar" (vermelho) na barra de acoes
- Ao reprovar, exibir campo de motivo antes de confirmar

#### 2. `src/components/cadastro/proposta/PropostaDetalhesTabs.tsx`

- Adicionar props `onAprovarDocumento` e `onReprovarDocumento` ao componente
- Repassar para `DocumentosAnexadosPanel`

#### 3. `src/components/cadastro/DocumentosAnexadosPanel.tsx`

- Adicionar props `onAprovarDocumento` e `onReprovarDocumento` (opcionais)
- Repassar para `DocumentoAnexadoCard`

#### 4. `src/components/cadastro/DocumentoAnexadoCard.tsx`

- Adicionar botoes de acao rapida (Aprovar/Reprovar) diretamente no card quando o documento estiver pendente
- Os botoes chamam os callbacks recebidos via props

#### 5. `src/pages/cadastro/PropostaAnalise.tsx`

- Criar funcoes `handleAprovarDocumento(docId)` e `handleReprovarDocumento(docId, motivo)` que:
  - Atualizam `contratos_documentos` diretamente via Supabase (`status: 'aprovado'` ou `status: 'reprovado'`)
  - Invalidam query cache de `contratos` e da proposta
  - Exibem toast de confirmacao
- Repassar esses callbacks para `PropostaDetalhesTabs`

#### 6. `src/hooks/usePropostasPendentes.ts` (linha ~202-220)

- Na query de documentos (`contratos_documentos`), adicionar `order('created_at', ascending: true)` se nao existir, para garantir ordenacao consistente
- Nenhuma outra alteracao necessaria - a invalidacao do cache ja e feita pelo PropostaAnalise

### Fluxo resultante

```text
Analista abre proposta
  -> Ve documentos na aba "Docs"
  -> CNH mostra "Pendente" com botoes [Aprovar] [Reprovar]
  -> Analista clica no card ou no botao de visualizar
  -> Modal abre com preview + botoes [Aprovar] [Reprovar]
  -> Analista aprova -> status muda para "aprovado" em contratos_documentos
  -> Badge atualiza imediatamente
```

Nao e necessaria nenhuma migration de banco de dados.
