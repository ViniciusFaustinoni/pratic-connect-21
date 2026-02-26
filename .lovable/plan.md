

# Redesign UI - Analista de Cadastro

Redesign completo das 3 telas do analista de cadastro (Dashboard, Propostas Pendentes, Detalhes da Proposta) com foco em fluidez, hierarquia visual e produtividade operacional. A aba Associados nao sera alterada.

---

## 1. Dashboard do Analista (`DashboardCadastro.tsx`)

**Problemas atuais:** KPIs genericos sem destaque, grafico ocupa muito espaco, acoes rapidas redundantes, banner decorativo sem valor operacional.

**Mudancas:**

- **Banner compacto com contexto operacional**: Reduzir o banner de boas-vindas. Adicionar resumo inline ("Voce tem X propostas aguardando analise").
- **KPIs com micro-tendencia**: Adicionar indicador visual de variacao (seta para cima/baixo + percentual vs ontem). Usar cores de fundo sutis com borda lateral colorida ao inves de icone solido.
- **Fila de trabalho como elemento central**: Substituir o card "Propostas Aguardando" por uma lista estilo kanban cards com preview de dados (placa, nome, tempo de espera). Cada item com indicador visual de prioridade (mais antigo = mais vermelho).
- **Grafico de performance**: Mover para area secundaria, reduzir altura. Adicionar toggle periodo (7d / 30d).
- **Remover card "Acoes Rapidas"**: Redundante, pois a navegacao lateral ja cumpre esse papel.
- **Adicionar mini-pipeline visual**: Barra horizontal mostrando a distribuicao de propostas por status (aguardando / em analise / aprovadas / reprovadas) com proporcao visual.

---

## 2. Lista de Propostas Pendentes (`PropostasPendentes.tsx`)

**Problemas atuais:** Tabela densa, dificulta scan visual. KPIs duplicados com o dashboard. Filtros sem destaque. Secao de ativacao misturada.

**Mudancas:**

- **KPIs compactos no topo**: Redesenhar como pills/chips horizontais ao inves de cards grandes. Exemplo: `Aguardando: 12 | Em Analise: 3 | Aprovados Hoje: 5 | Reprovados: 1`.
- **Substituir tabela por cards de proposta**: Cada proposta vira um card horizontal com:
  - Borda lateral colorida por status (amarelo=aguardando, azul=analise, laranja=doc pendente)
  - Placa em destaque (font-mono, grande)
  - Nome do cliente, modelo do veiculo
  - Badge de status com icone
  - Tempo de espera com cor gradual (verde < 24h, amarelo < 48h, vermelho > 48h)
  - Botao "Analisar" direto no card
- **Filtros inline**: Busca + filtros de status como toggle pills no topo, sem card wrapper.
- **Secao "Ativacao de Rastreador"**: Manter separada mas com design mais compacto, usando alert-style banner ao inves de tabela completa.
- **Ordenacao visual**: Propostas com reanalise (documentos reenviados) aparecem no topo com destaque ambar.

---

## 3. Detalhes da Proposta (`PropostaAnalise.tsx` + subcomponentes)

**Problemas atuais:** Header hero muito grande, botoes de acao longe do conteudo analisavel, tabs na parte inferior forcam scroll.

**Mudancas:**

### 3a. Hero Header (`PropostaHeroHeader.tsx`)
- **Compactar**: Reduzir padding. Mover navegacao (Voltar/Proxima) para barra sticky no topo.
- **Layout horizontal**: Nome do cliente + Veiculo + Status em uma linha. Botoes de acao (Aprovar/Solicitar Docs/Reprovar) ficam a direita na mesma linha.
- **Alerta de reanalise**: Manter destaque ambar mas como banner slim acima do header.

### 3b. Midia Grid (`PropostaMidiaGrid.tsx`)
- **Melhorar grid de fotos**: Thumbnail maior, hover com zoom preview. Manter layout side-by-side com documentos de reanalise.
- **Indicadores visuais**: Badge com contagem de fotos mais visivel. Video 360 com thumbnail real ao inves de player embutido.

### 3c. Tabs (`PropostaDetalhesTabs.tsx`)
- **Tabs sticky**: Fixar a barra de tabs abaixo do header para acesso rapido durante scroll.
- **Indicadores nas tabs**: Ponto de notificacao mais visivel para docs pendentes. Icone de alerta no tab Veiculo quando falta RENAVAM/CHASSI.
- **Layout dos dados**: Usar design de "ficha" com grid mais limpo, separadores visuais entre grupos de informacao.

---

## Arquivos alterados

1. `src/components/cadastro/DashboardCadastro.tsx` — Redesign completo
2. `src/pages/cadastro/PropostasPendentes.tsx` — Cards ao inves de tabela, KPIs compactos
3. `src/components/cadastro/proposta/PropostaHeroHeader.tsx` — Header compacto horizontal
4. `src/components/cadastro/proposta/PropostaMidiaGrid.tsx` — Melhorias visuais no grid
5. `src/components/cadastro/proposta/PropostaDetalhesTabs.tsx` — Tabs sticky, indicadores melhorados

## O que NAO muda
- Logica de negocio (aprovacao, reprovacao, solicitacao de docs)
- Hooks e queries existentes
- Aba Associados
- Dialogs de confirmacao

