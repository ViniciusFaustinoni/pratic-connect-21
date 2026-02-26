
# Documentos de Reanalise ao Lado das Fotos da Vistoria

## Objetivo
Quando o associado reenvia documentos pendentes, exibir esses documentos **ao lado** das fotos da vistoria (na ZONA 2 da pagina), em vez de esconde-los dentro da aba "Docs". Isso permite que o analista de cadastro veja imediatamente os documentos reenviados sem precisar navegar entre abas.

## O que muda visualmente

**Antes**: Fotos da vistoria aparecem na ZONA 2 (grid de midias). Documentos reenviados ficam escondidos dentro da aba "Docs" (ZONA 3).

**Depois**: Quando existem documentos de reanalise, a ZONA 2 se reorganiza em layout side-by-side:

```text
+-------------------------------+-------------------------------+
|  Fotos da Vistoria (grid)     |  Documentos da Reanalise      |
|  Video 360 / Assinatura       |  [Chassi]  [Visualizar]       |
|                               |  [Odometro] [Visualizar]      |
|                               |  ...                          |
+-------------------------------+-------------------------------+
```

- Se NAO houver documentos de reanalise, o layout permanece como esta hoje (sem mudanca).
- Se houver, as midias ocupam a coluna esquerda e os documentos de reanalise a coluna direita.
- Em telas pequenas (mobile), os documentos ficam empilhados abaixo das fotos.

## Alteracoes Tecnicas

### 1. `src/pages/cadastro/PropostaAnalise.tsx`
- Passar `proposta.documentos_solicitados_enviados` para o `PropostaMidiaGrid` como nova prop.
- O componente decidira internamente se renderiza o layout side-by-side ou normal.

### 2. `src/components/cadastro/proposta/PropostaMidiaGrid.tsx`
- Adicionar prop opcional `documentosSolicitados` (array de `DocumentoSolicitadoEnviado`).
- Quando `documentosSolicitados` tem itens:
  - Envolver tudo em um grid `grid-cols-1 lg:grid-cols-2`.
  - Coluna esquerda: cards de midia existentes (fotos, video, assinatura).
  - Coluna direita: renderizar o `DocumentosSolicitadosCard` importado.
- Quando vazio/undefined: manter layout atual sem alteracao.

### 3. `src/components/cadastro/proposta/PropostaDetalhesTabs.tsx`
- Remover a renderizacao do `DocumentosSolicitadosCard` de dentro da aba "Docs" (pois agora esta na ZONA 2).
- Manter o indicador visual (badge/ponto ambar) na aba "Docs" para sinalizar que ha documentos novos, mas sem duplicar o card.

### Arquivos alterados
1. `src/pages/cadastro/PropostaAnalise.tsx` — passar nova prop
2. `src/components/cadastro/proposta/PropostaMidiaGrid.tsx` — layout side-by-side condicional
3. `src/components/cadastro/proposta/PropostaDetalhesTabs.tsx` — remover DocumentosSolicitadosCard da aba Docs
