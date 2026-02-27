

# Redesign UI: Dashboard, Propostas Pendentes e Detalhes da Proposta

## Objetivo
Aprimorar a experiencia do analista de cadastro com um design mais fluido, visual e produtivo nas tres telas principais, sem alterar conteudo exibido nem a tela de Associados.

---

## 1. Dashboard do Analista (`DashboardCadastro.tsx`)

**Melhorias planejadas:**

- **Banner de boas-vindas**: Adicionar gradiente sutil e icone de avatar com iniciais do usuario, tornando o greeting mais acolhedor
- **KPIs**: Redesenhar com icones maiores, micro-animacao de pulse no indicador principal (aguardando), e adicionar uma linha de "tendencia" comparando com ontem (ex: "+3 vs ontem")
- **Pipeline visual**: Transformar a barra segmentada em cards mini-funil com setas entre eles (Aguardando -> Em Analise -> Aprovado/Reprovado) para visualizacao mais intuitiva do fluxo
- **Fila de trabalho**: Adicionar indicador visual de prioridade (dot pulsante vermelho para >48h), hover com preview rapido (nome + placa + tempo) e transicao de hover mais suave com elevacao
- **Grafico de performance**: Adicionar tooltip customizado com mais contexto e melhorar legenda visual

**Componentes afetados:**
- `src/components/cadastro/DashboardCadastro.tsx` (componente unico, refatorar internamente)

---

## 2. Propostas Pendentes (`PropostasPendentes.tsx`)

**Melhorias planejadas:**

- **Header**: Adicionar icone decorativo e subtitulo mais descritivo, similar ao padrao `LeadsHeader`
- **KPIs pills**: Transformar em cards pequenos com fundo mais destacado e hover interativo (ao clicar, filtra automaticamente)
- **Cards de proposta**: 
  - Aumentar altura levemente para melhor legibilidade
  - Adicionar avatar com iniciais do cliente (circulo colorido com letras)
  - Separar visualmente placa em badge estilizado (fundo escuro, mono font)
  - Adicionar preview do plano como chip colorido
  - Indicador de reanalise mais proeminente com badge "NOVO" pulsante
  - Hover com translate-x sutil (deslize para direita) como ja existe na CotacoesTable
- **Estado vazio**: Ilustracao mais amigavel com mensagem motivacional
- **Contador de resultados**: Mover para dentro da barra de filtros

**Componentes afetados:**
- `src/pages/cadastro/PropostasPendentes.tsx`

---

## 3. Detalhes da Proposta (`PropostaAnalise.tsx` + subcomponentes)

**Melhorias planejadas:**

### 3a. Hero Header (`PropostaHeroHeader.tsx`)
- Adicionar gradiente de fundo sutil baseado no status (amarelo para aguardando, azul para em analise)
- Botoes de acao maiores e mais visiveis com cores cheias (nao outline) e icones mais claros
- Badge de reanalise mais proeminente com contagem de documentos novos
- Adicionar "quick stats" inline: placa em destaque, valor mensal, plano

### 3b. Grid de Midia (`PropostaMidiaGrid.tsx`)
- Layout mais organizado com fotos em grid maior (3 colunas em desktop)
- Card de documentos solicitados com badge "NOVO" pulsante nos itens novos
- Thumbnails de fotos maiores para facilitar visualizacao rapida antes de abrir galeria

### 3c. Tabs de Detalhes (`PropostaDetalhesTabs.tsx`)
- Tab bar com icones mais claros e labels sempre visiveis (remover hidden em sm)
- Badge de notificacao nos tabs mais visivel (maior, com numero)
- Cards internos com bordas superiores coloridas por categoria (azul para cliente, roxo para veiculo, etc.)
- Campos de ficha com hover highlight para facilitar leitura
- Separadores visuais entre grupos de campos

**Componentes afetados:**
- `src/components/cadastro/proposta/PropostaHeroHeader.tsx`
- `src/components/cadastro/proposta/PropostaMidiaGrid.tsx`
- `src/components/cadastro/proposta/PropostaDetalhesTabs.tsx`
- `src/pages/cadastro/PropostaAnalise.tsx` (ajustes menores de spacing)

---

## Principios de Design Aplicados
- **Hierarquia visual**: Elementos mais importantes (acoes, alertas) com maior destaque
- **Feedback visual**: Hover states, transicoes suaves, indicadores pulsantes
- **Densidade informacional**: Mais dados visiveis sem scroll, layouts compactos mas legíveis
- **Consistencia**: Seguir padroes ja existentes no sistema (cores de status, badges, cards com borda lateral)
- **Produtividade**: Reducao de cliques, informacoes criticas visiveis de imediato

## Arquivos Modificados (total: 5)
1. `src/components/cadastro/DashboardCadastro.tsx`
2. `src/pages/cadastro/PropostasPendentes.tsx`
3. `src/components/cadastro/proposta/PropostaHeroHeader.tsx`
4. `src/components/cadastro/proposta/PropostaMidiaGrid.tsx`
5. `src/components/cadastro/proposta/PropostaDetalhesTabs.tsx`

