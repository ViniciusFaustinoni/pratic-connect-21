
# S06 — Integracao do Laudo na Tela de Analise + Decisao + Lista

## Resumo

Integrar o resultado da sindicancia (laudo) na tela de analise do analista (`SinistroAnalise.tsx`), com: (1) card destacado do laudo quando disponivel, (2) banner de bloqueio durante sindicancia em andamento, (3) modal de decisao pos-sindicancia com 5 opcoes que reutilizam os fluxos existentes de aprovacao/reprovacao, e (4) reescrever a lista de sindicancias (`SindicanciasList.tsx`) para usar a tabela `sindicancias` ao inves da tabela `sinistros`.

---

## 1. Criar componente `CardLaudoSindicancia`

**Arquivo novo:** `src/components/sinistros/CardLaudoSindicancia.tsx`

Card read-only que exibe o laudo emitido pelo sindicante. Recebe a sindicancia como prop.

Conteudo:
- Titulo: "Laudo de Sindicancia — SIND-XXXXXXXX-001"
- Subtitulo: "Emitido em [data_laudo] por [nome_fantasia da empresa]"
- Badge grande de conclusao com cores (Regular=verde, Irregular Comprovada=vermelho, Irregular Suspeita=laranja, Inconclusivo=amarelo) usando `CONCLUSAO_LAUDO_LABELS`
- Resumo Executivo: texto completo de `laudo_resumo`
- Irregularidades (condicional): card com borda vermelha se conclusao irregular, mostrando `laudo_irregularidades`
- Recomendacao: badge informativo "O sindicante recomenda: [recomendacao]" usando `RECOMENDACAO_LABELS`
- Diligencias (expansivel via Collapsible): titulo "[X] diligencias realizadas em [Y] dias", lista resumida com data + tipo + descricao truncada. Buscar `sindicancia_diligencias` dentro do componente.
- Botao "Baixar Laudo Formal (PDF)" se `laudo_arquivo_url` existir

---

## 2. Criar componente `BannerSindicanciaEmAndamento`

**Arquivo novo:** `src/components/sinistros/BannerSindicanciaEmAndamento.tsx`

Banner informativo quando existe sindicancia ativa sem laudo.

- Card com fundo azul/indigo
- Icone de lupa + "Sindicancia em andamento — SIND-XXXXXXXX-001"
- "Sindicante: [nome_fantasia] | Prazo: [data_limite] ([X] dias restantes)"
- "Aguardando emissao do laudo pelo sindicante."
- Retorna `null` se nao houver sindicancia ativa

---

## 3. Criar componente `DecisaoPosSindicanciaModal`

**Arquivo novo:** `src/components/sinistros/DecisaoPosSindicanciaModal.tsx`

Modal de decisao do analista apos receber o laudo.

### Props
- `open`, `onOpenChange`
- `sinistroId`, `protocolo`
- `sindicancia` (dados completos com laudo)
- `onSuccess`

### Conteudo
- Titulo: "Decisao Pos-Sindicancia"
- Card resumo no topo: conclusao (badge) + recomendacao do sindicante (badge)
- 5 opcoes (RadioGroup), cada uma como card clicavel:
  1. **Regular — Retomar Fluxo Normal**: chama `supabase.functions.invoke('aprovar-sinistro')` (mesmo fluxo de aprovacao existente)
  2. **Irregular — Negar Evento**: chama `supabase.functions.invoke('reprovar-sinistro')` com motivo 'fraude_sindicancia'
  3. **Carta de Cancelamento**: negar evento + marcar associado para exclusao + criar registro juridico. Alerta vermelho de aviso.
  4. **Encaminhar para o Juridico**: status -> 'aguardando_juridico'
  5. **Inconclusivo — Escalar para Diretoria**: status -> 'aguardando_diretoria'
- Justificativa obrigatoria (textarea, min 30 chars)

### Fluxo ao confirmar
1. Atualizar `sindicancias`: SET `decisao_analista` = opcao, `decisao_observacao` = justificativa, `decisao_por` = profile_id, `decisao_em` = now(), `status` = 'encerrado'
2. Conforme a decisao:
   - **Regular**: invocar edge function `aprovar-sinistro` (reutiliza fluxo completo existente que ja gera link de pagamento da cota)
   - **Negar**: invocar edge function `reprovar-sinistro` com motivo e justificativa
   - **Carta cancelamento**: reprovar + criar registro em `processos` + marcar associado
   - **Juridico**: UPDATE sinistros SET status='aguardando_juridico', inserir historico, notificar
   - **Diretoria**: UPDATE sinistros SET status='aguardando_diretoria', inserir historico, notificar via `notificarAguardandoDiretoria`
3. Inserir `sinistro_historico` com descricao da decisao
4. Notificacoes conforme decisao
5. Toast de sucesso com proximo passo
6. Invalidar queries e chamar onSuccess

---

## 4. Integrar na tela de analise (`SinistroAnalise.tsx`)

**Arquivo:** `src/pages/eventos/SinistroAnalise.tsx`

### 4a. Adicionar query para buscar sindicancia do evento

Nova query usando `useQuery`:
```
sindicancias WHERE sinistro_id = id
  AND status NOT IN ('cancelado')
  ORDER BY created_at DESC LIMIT 1
```
Com join na `empresas_sindicancia` para obter nome_fantasia.

### 4b. Banner de sindicancia em andamento (apos alertas existentes, antes do grid principal)

Se sindicancia com status IN ('atribuido', 'em_andamento'):
- Renderizar `BannerSindicanciaEmAndamento`
- Na secao de acoes (coluna direita), desabilitar TODOS os botoes de acao
- Excecao: diretor pode ver botao "Cancelar Sindicancia" (se implementado)

### 4c. Card do laudo (antes do grid principal ou no topo da coluna esquerda)

Se sindicancia com status IN ('laudo_emitido', 'encerrado') E `laudo_conclusao` preenchido:
- Renderizar `CardLaudoSindicancia`

### 4d. Botao "Decidir com Base no Laudo" (coluna direita)

Se sindicancia com status = 'laudo_emitido' (laudo recebido, pendente decisao):
- Em vez das acoes normais, mostrar unico botao "Decidir com Base no Laudo" (azul)
- Abre `DecisaoPosSindicanciaModal`

### 4e. Estado do modal

Adicionar: `const [showDecisaoSindicancia, setShowDecisaoSindicancia] = useState(false)`

---

## 5. Reescrever lista de sindicancias (`SindicanciasList.tsx`)

**Arquivo:** `src/pages/eventos/SindicanciasList.tsx`

A lista atual consulta a tabela `sinistros` com campos antigos. Precisa ser reescrita para usar a tabela `sindicancias` que e a nova fonte de verdade.

### Query principal
```
sindicancias.select('*, empresa:empresas_sindicancia(nome_fantasia), sinistros(protocolo, tipo)')
  .order('data_limite', { ascending: true })
```

### KPIs (4 cards)
- "Em Andamento": count status IN ('atribuido', 'em_andamento')
- "Aguardando Decisao": count status = 'laudo_emitido'
- "Prazo Vencido": count data_limite < hoje AND status NOT IN ('encerrado', 'cancelado')
- "Concluidas no Mes": count status = 'encerrado' AND updated_at >= inicio do mes

### Filtros
- Status: select com opcoes (todos, aguardando_atribuicao, atribuido, em_andamento, laudo_emitido, encerrado, cancelado) — usar `STATUS_SINDICANCIA_LABELS`
- Sindicante: select com empresas_sindicancia
- Conclusao: regular, irregular, inconclusivo, sem laudo
- Busca por texto (numero, protocolo evento)

### Tabela
Colunas: Numero (SIND-*), Evento (protocolo, link), Tipo, Sindicante (nome_fantasia ou "Nao atribuido"), Status (badge colorido usando `STATUS_SINDICANCIA_COLORS`), Prazo (data + dias restantes/vencido), Conclusao (badge se laudo emitido), Acoes.

Acoes:
- "Atribuir" se status = 'aguardando_atribuicao' (abre `AtribuirSindicanteModal` de S03)
- "Ver Caso" para qualquer status (link para detalhe)
- "Decidir" se status = 'laudo_emitido' (link para analise do evento)

### Importar componentes necessarios
- `AtribuirSindicanteModal` de S03
- `STATUS_SINDICANCIA_LABELS`, `STATUS_SINDICANCIA_COLORS`, `CONCLUSAO_LAUDO_LABELS` dos types

---

## Arquivos a Criar

| Arquivo | Descricao |
|---|---|
| `src/components/sinistros/CardLaudoSindicancia.tsx` | Card read-only com laudo completo |
| `src/components/sinistros/BannerSindicanciaEmAndamento.tsx` | Banner de bloqueio durante sindicancia |
| `src/components/sinistros/DecisaoPosSindicanciaModal.tsx` | Modal de decisao pos-sindicancia com 5 opcoes |

## Arquivos a Modificar

| Arquivo | Alteracao |
|---|---|
| `src/pages/eventos/SinistroAnalise.tsx` | Query de sindicancia + banner + card laudo + botao decisao + bloqueio de acoes |
| `src/pages/eventos/SindicanciasList.tsx` | Reescrever para usar tabela sindicancias com KPIs, filtros e acoes corretos |

## Sequencia de Implementacao

1. Criar `CardLaudoSindicancia.tsx`
2. Criar `BannerSindicanciaEmAndamento.tsx`
3. Criar `DecisaoPosSindicanciaModal.tsx`
4. Integrar na `SinistroAnalise.tsx` (query + banner + card + botao + bloqueio)
5. Reescrever `SindicanciasList.tsx`
