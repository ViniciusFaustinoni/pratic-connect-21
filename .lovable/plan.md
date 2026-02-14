
# Modulo de Sindicancias — Lista + Detalhe

## Resumo

Criar duas paginas novas dentro do modulo Eventos: lista de sindicancias (com KPIs e tabela filtrada) e tela de trabalho do investigador (detalhe, evidencias, resultado). Adicionar submenu no sidebar e criar tabela de evidencias no banco.

## Migracao de Banco

Criar tabela `sindicancia_evidencias` para armazenar as evidencias coletadas durante a investigacao:

```text
sindicancia_evidencias
- id (uuid PK)
- sinistro_id (FK sinistros.id)
- tipo (text): documento, foto, video, depoimento, laudo_tecnico, relatorio_rastreador, pesquisa_externa, outro
- titulo (text, NOT NULL)
- descricao (text)
- arquivo_url (text) - referencia ao Storage bucket 'sinistros'
- arquivo_nome (text)
- registrado_por (uuid FK profiles.id)
- created_at (timestamptz)
```

RLS: usuarios autenticados podem ler e inserir. O bucket `sinistros` ja existe e e publico.

## Arquivos a Criar

### 1. `src/pages/eventos/SindicanciasList.tsx`

Pagina de lista com:

**4 KPI Cards no topo:**
- Abertas (ambar) — count de sinistros com status `em_sindicancia` ou `em_pericia`
- Vencendo em 7 dias (vermelho se > 0) — sindicancias com `sindicancia_prazo_fim` nos proximos 7 dias
- Concluidas este mes — sinistros com `resultado_sindicancia IS NOT NULL` e updated_at no mes corrente
- Taxa de Irregularidade — percentual de concluidas com resultado `irregular` sobre total concluidas

**Tabela abaixo:**
- Colunas: protocolo (link), tipo (badge sindicancia/pericia), motivo, associado, placa, responsavel, status (badge), prazo, dias restantes (vermelho se < 7, "VENCIDA" se expirada), resultado
- Query: sinistros com status `em_sindicancia`, `em_pericia`, ou que tenham `resultado_sindicancia` preenchido
- Join com profiles (sindicante), associados (nome), veiculos (placa/modelo)
- Filtros: status, tipo (sindicancia/pericia), responsavel, periodo
- Ordenacao padrao: abertas primeiro, por prazo crescente (mais urgentes no topo)

### 2. `src/pages/eventos/SindicanciaDetalhe.tsx`

Tela de trabalho do investigador, dividida em secoes:

**Topo:**
- Titulo "Sindicancia" ou "Pericia Tecnica" com badge de status
- Barra de progresso visual do prazo (% do tempo decorrido)
- Banner vermelho se prazo vencido

**Card Informacoes Gerais:**
- Quem abriu, quando, motivo, responsavel, prazo com vencimento, status, descricao detalhada
- Dados extraidos do historico do sinistro (a entry que registrou o encaminhamento)

**Card Dados do Evento:**
- Protocolo, tipo, data, associado (nome, telefone), veiculo (placa, modelo), status atual
- Botao "Ver evento completo" abre SinistroDetalhe em nova aba

**Card Evidencias:**
- Lista de evidencias ja registradas com tipo (badge), titulo, descricao, arquivo (link download), quem registrou e quando
- Botao "Nova Evidencia" abre modal com: tipo (select), titulo (obrigatorio), descricao (textarea), upload de arquivo (aceita imagem, video, PDF, ate 50MB)
- Upload vai para o bucket `sinistros` no path `{sinistro_id}/evidencias/`

**Card Resultado (so se ainda nao concluida):**
- Reutilizar a logica existente do `ConcluirSindicanciaModal` mas como secao inline, nao modal
- 5 opcoes de resultado com descricao detalhada das consequencias:
  - Regular: volta para `em_analise`, descongela prazo
  - Irregular: nega evento, cria processo juridico tipo `sindicancia_fraude`, notifica juridico
  - Carta de Cancelamento: cancela evento, cria consulta juridica
  - Encaminhar ao Juridico: muda para `suspenso`, cria processo juridico
  - Inconclusivo: muda para `suspenso`, notifica diretores
- Parecer final obrigatorio (min 200 caracteres)
- Upload de relatorio PDF opcional
- Botao "Concluir Sindicancia" com dialog de confirmacao "Tem certeza? Esta acao nao pode ser desfeita."
- Criacao automatica de caso juridico e obrigatoria para irregular, carta_cancelamento e juridico

**Secao Resultado (se ja concluida):**
- Modo somente leitura: resultado, parecer, data de conclusao
- Link para o caso juridico criado (quando aplicavel)

### 3. `src/components/sinistros/NovaEvidenciaModal.tsx`

Modal para adicionar evidencia:
- Select de tipo: documento, foto, video, depoimento de testemunha, laudo tecnico, relatorio do rastreador, pesquisa externa, outro
- Input titulo (obrigatorio)
- Textarea descricao
- Dropzone para upload (aceita imagem/video/PDF, max 50MB)
- Upload para Storage bucket `sinistros/{sinistro_id}/evidencias/{timestamp}_{filename}`
- Insert na tabela `sindicancia_evidencias`

## Arquivos a Modificar

### 4. `src/components/layout/AppSidebar.tsx`

Adicionar item no grupo `eventos`:
```text
items: [
  { title: 'Dashboard', url: '/eventos/dashboard', icon: BarChart3 },
  { title: 'Sinistros', url: '/eventos/sinistros', icon: AlertTriangle },
  { title: 'Sindicancias', url: '/eventos/sindicancias', icon: Search },  // NOVO
],
```

### 5. `src/App.tsx`

Adicionar rotas:
```text
<Route path="/eventos/sindicancias" element={<SindicanciasList />} />
<Route path="/eventos/sindicancias/:id" element={<SindicanciaDetalhe />} />
```

## Detalhes Tecnicos

- A query da lista busca em `sinistros` filtrando por `status IN ('em_sindicancia', 'em_pericia') OR resultado_sindicancia IS NOT NULL`
- O detalhe busca o sinistro pelo ID com joins em associados, veiculos, profiles (sindicante e analista)
- Evidencias: query em `sindicancia_evidencias` filtrada por `sinistro_id`
- O calculo de dias restantes usa `differenceInDays(sindicancia_prazo_fim, today)`
- A barra de progresso calcula `(dias_decorridos / prazo_total) * 100`
- O resultado reutiliza a mesma logica do `ConcluirSindicanciaModal` (criar processo, consulta juridica, atualizar status, registrar historico) mas integrada inline na pagina
- Nao ha botao de criar sindicancia na lista — elas so nascem pela tela de analise

## Ordem de Implementacao

1. Migracao: criar tabela `sindicancia_evidencias` com RLS
2. `NovaEvidenciaModal.tsx` — modal de upload de evidencias
3. `SindicanciasList.tsx` — pagina de lista com KPIs
4. `SindicanciaDetalhe.tsx` — tela de trabalho do investigador
5. `AppSidebar.tsx` — adicionar submenu
6. `App.tsx` — adicionar rotas
