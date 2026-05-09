## Diagnóstico

O problema da FIPE faltante é só a ponta visível. A causa de fundo é que a troca de titularidade **herda passivamente** o que estiver gravado em `veiculos`. Para o caso da screenshot:

- Cor, combustível, FIPE, etc. estão `NULL` no registro do veículo (cadastros legados / importações antigas).
- O modal de troca em `/cadastro/processos` mostra apenas 1 linha de veículo (marca/modelo/ano/placa). Não traz rastreador, fotos, documentos, contrato — embora todas essas informações estejam disponíveis via hooks já existentes (`useVeiculoCompleto`, `useFotosVistoriaPorVeiculo`, `useDocumentosAssociadoCompleto`, `useEventosVeiculo`).
- O modal de Cadastro › Veículos já é completo, mas hoje só consegue exibir o que tem no banco — não tem botão para enriquecer dados em falta.

## Mudanças

### 1. Enriquecimento automático na criação da troca
**Arquivo:** `supabase/functions/criar-solicitacao-troca-titularidade/index.ts`

Hoje só consulta `fipe-lookup` quando FIPE/código FIPE faltam. Vamos generalizar:

- Sempre que o veículo tiver **qualquer um** dos campos `cor`, `combustivel`, `valor_fipe`, `codigo_fipe`, `ano_modelo`, `ano_fabricacao` ausentes, a edge dispara também a edge `plate-lookup` (mesma usada pela cotação para puxar dados oficiais por placa) — em paralelo com `fipe-lookup`.
- Resultados são mesclados com prioridade: dado já existente no banco > `plate-lookup` > `fipe-lookup`. Nunca sobrescreve dado preenchido (não destrói cor digitada manualmente, p.ex.).
- Atualiza `veiculos` com tudo que veio: `cor`, `combustivel`, `valor_fipe`, `codigo_fipe`, `ano_modelo`, `ano_fabricacao`. A cotação criada já carrega `valor_fipe` e `codigo_fipe` enriquecidos.
- Tudo em `try/catch` com timeout — falhas não bloqueiam a criação.

### 2. Botão "Atualizar dados via placa" no modal Cadastro › Veículos
**Arquivo:** `src/components/cadastro/VeiculoDetalhesModal.tsx`

Na aba **Resumo**, ao lado do título "Veículo", adicionar um botão pequeno (ícone refresh + label) visível apenas quando algum campo (cor / combustível / FIPE) estiver vazio:

- Chama as edges `plate-lookup` e `fipe-lookup` direto do cliente (mesmas que a cotação usa).
- Faz `update` na tabela `veiculos` (apenas campos hoje vazios).
- Invalida o react-query do veículo para refletir na hora.
- Toast de sucesso/falha.

Isso resolve casos legados sem precisar refazer a troca.

### 3. Modal de Troca de Titularidade — passar a mostrar TUDO
**Arquivo:** `src/components/troca-titularidade/ModalDetalhesTroca.tsx`

Substituir o card mínimo "Veículo" (3 linhas) por um **bloco rico** dentro da aba **Dados**, dividido em sub-seções colapsáveis (default abertas as 2 primeiras):

1. **Veículo** (full): Marca, Modelo, Ano (Fab/Mod), Cor, Placa, Chassi, Renavam, Combustível, **Valor FIPE**, Status atual, Uso App.
2. **Rastreador**: código, IMEI, plataforma (Softruck/Rede), status, último sinal — ou aviso "Sem rastreador instalado".
3. **Contrato vigente do antigo**: nº, plano, valor mensal, status, data início.
4. **Fotos da última vistoria** (thumbs 80×80, click amplia em lightbox já existente). Reaproveita `useFotosVistoriaPorVeiculo` + `MediaViewerModal`.
5. **Documentos do associado antigo** (CNH, CRLV, etc.) — lista vinda de `useDocumentosAssociadoCompleto`, com link para abrir o doc.
6. **Eventos do veículo** (resumo: nº de sinistros + assistências) com link "Ver todos" que abre o `VeiculoDetalhesModal` completo.

Reaproveita os hooks `useVeiculoCompleto`, `useFotosVistoriaPorVeiculo`, `useDocumentosAssociadoCompleto`, `useEventosVeiculo` — nenhum hook novo.

Adiciona também o mesmo botão **"Atualizar dados via placa"** (item 2) no topo do bloco "Veículo" — útil para o operador que abriu a troca antes do enriquecimento automático.

### 4. (Bônus baixo custo) Largura do modal de troca
O `DialogContent` atual é `max-w-3xl`. Com as novas seções, sobe para `max-w-4xl` + `max-h-[92vh]` com `ScrollArea` interno (mesmo padrão do `VeiculoDetalhesModal`).

## Fora de escopo

- Não cria UI separada para "histórico de auditoria de enriquecimento" — só log no console da edge.
- Não altera o fluxo do novo titular na cotação pública (esse já refaz a consulta naturalmente quando ele abre o link).
- Não toca em `efetivar-troca-titularidade` — ele já lê de `veiculos` no momento certo.

## Resultado esperado para o caso da screenshot

Após o enriquecimento (e o operador clicando "Atualizar dados via placa" uma vez no caso retroativo):
- Cor, combustível e FIPE preenchidos no card de Cadastro › Veículos.
- Modal da troca em /cadastro/processos passa a mostrar veículo completo + rastreador + fotos + documentos do associado, tudo em uma só tela.
