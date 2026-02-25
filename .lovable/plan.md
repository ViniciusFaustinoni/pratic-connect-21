
# Redesign da Pagina de Detalhes do Sinistro

## Objetivo
Reorganizar a pagina de detalhes do sinistro para ser mais intuitiva, bonita e funcional, sem remover nenhuma funcionalidade existente. O arquivo atual tem 1705 linhas em um unico componente monolitico -- sera dividido em sub-componentes organizados por abas.

## Mudancas Visuais Principais

### 1. Header Compacto e Moderno
- Protocolo grande com icone do tipo de evento ao lado
- Status badge proeminente com cor forte
- Badges de alerta organizados em linha abaixo
- Botoes de acao rapida (WhatsApp, Acoes) alinhados a direita
- Fundo sutil com gradiente baseado no tipo de evento

### 2. Cards Informativos Superiores (Quick Stats)
- Faixa horizontal com 4 mini-cards logo abaixo do header:
  - Associado (nome + CPF, clicavel para expandir)
  - Veiculo (placa + modelo)
  - Valor FIPE
  - Prazo Ressarcimento (dias restantes)
- Informacao critica visivel sem scroll

### 3. Conteudo Organizado em Abas
Em vez de scroll infinito, o conteudo principal sera dividido em 5 abas:

**Aba "Informacoes"** (padrao):
- Card de informacoes do sinistro (tipo, data, local, descricao)
- Card de valores (FIPE, participacao, indenizacao)
- Card de parecer (se existir)
- Secao sindicancias/juridico
- Secao terceiros (se colisao)

**Aba "Reparo e Orcamento"**:
- Termo de assinatura
- Controle de reparo
- Orcamento do reparo
- Vistoria do regulador
- Tabs de terceiros (se houver)

**Aba "Documentos"**:
- Lista de documentos com status
- Botao solicitar documentos
- Link do evento
- Processos juridicos vinculados

**Aba "GPS e Rastreador"**:
- Comparacao de posicoes
- Botao abrir localizacao
- Trajeto antes da colisao
- Alertas de fraude (roubo/furto)
- Card de recuperacao
- Card de acionamento

**Aba "Historico"**:
- Timeline completa de atualizacoes

### 4. Sidebar Compacta (direita)
- Card Associado com layout compacto (avatar, nome, telefone com botao WhatsApp inline)
- Card Veiculo compacto (placa grande, modelo, FIPE destacado)
- Card de acoes contextuais baseado no status

## Arquitetura de Arquivos

### Novos arquivos a criar:
```
src/components/sinistros/detalhe/
  SinistroDetalheHeader.tsx      -- Header + badges + acoes
  SinistroDetalheQuickStats.tsx  -- Mini-cards informativos
  SinistroDetalheInfo.tsx        -- Aba informacoes
  SinistroDetalheReparo.tsx      -- Aba reparo/orcamento
  SinistroDetalheDocs.tsx        -- Aba documentos
  SinistroDetalheGPS.tsx         -- Aba GPS/rastreador
  SinistroDetalheSidebar.tsx     -- Sidebar direita (associado + veiculo)
```

### Arquivo principal refatorado:
- `src/pages/eventos/SinistroDetalhe.tsx` -- Mantem queries e estado, delega renderizacao para sub-componentes

## Detalhes Tecnicos

### SinistroDetalheHeader.tsx
- Recebe: sinistro, statusInfo, tipoConfig, permissoes, callbacks dos modais
- Renderiza: breadcrumb, protocolo, badges, dropdown de acoes
- Estilo: fundo com borda inferior colorida baseada no tipo (colisao=azul, roubo=vermelho, furto=laranja, incendio=vermelho, vidros=ciano)

### SinistroDetalheQuickStats.tsx
- Recebe: sinistro (com associado e veiculo embarcados)
- 4 mini-cards horizontais com icone, label e valor
- Responsivo: 2 colunas no mobile, 4 no desktop

### SinistroDetalheInfo.tsx
- Extrai linhas 722-1109 do arquivo atual (cards de info, valores, parecer, vistoria regulador, sindicancias, terceiros)
- Recebe: sinistro, vistoriaEvento, descricaoCliente, mensagensChat, callbacks

### SinistroDetalheReparo.tsx
- Extrai linhas 1112-1163 (tabs terceiros, termo assinatura, controle reparo, orcamento)
- Recebe: sinistro, terceirosData, permissoes, callbacks

### SinistroDetalheDocs.tsx
- Extrai linhas 1260-1380 (documentos, link evento, processos juridicos, prazo ressarcimento)
- Recebe: sinistro, documentos, processosVinculados, callbacks

### SinistroDetalheGPS.tsx
- Extrai linhas 1458-1507 (localizacao, comparacao posicoes, trajeto, alertas fraude, recuperacao, indenizacao)
- Recebe: sinistro, rastreadorVeiculo, permissoes, callbacks

### SinistroDetalheSidebar.tsx
- Extrai linhas 1165-1258 (associado + veiculo)
- Layout compacto com icones inline e acoes rapidas
- Valor FIPE destacado em verde

### Pagina principal (refatorada)
- Mantem todas as queries (sinistro, historico, documentos, processos, solicitacaoIA, etc.)
- Mantem todos os estados de modais
- Usa `Tabs` do Radix para organizar o conteudo
- Layout: header full-width, quick stats, depois grid 2/3 + 1/3 com tabs no lado esquerdo e sidebar no direito
- Todos os modais permanecem no final do componente principal

### Estilos
- Cards com `hover:shadow-md transition-shadow` para feedback visual
- Icones coloridos nos titulos dos cards
- Badges com cores mais vibrantes
- Separadores visuais mais sutis
- Tabs com indicador animado (ja suportado pelo Radix Tabs)

## O que NAO muda
- Nenhuma query de dados
- Nenhuma logica de negocios
- Nenhum modal
- Nenhuma funcionalidade removida
- Todas as condicoes de visibilidade por tipo/status/permissao
- Todas as integrações (WhatsApp, Autentique, rastreador, etc.)
