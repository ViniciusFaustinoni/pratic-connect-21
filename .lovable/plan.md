

# Detalhe do Caso Juridico — Pagina com 5 Abas

## Resumo

Criar a pagina de detalhe de um caso juridico (`/juridico/casos/:id`) com 5 abas: Resumo, Parecer Juridico, Decisao, Historico e Documentos. Sera necessaria uma nova tabela para armazenar o historico de acoes do caso e outra para documentos anexados pelo advogado.

## Migracao de Banco

### Tabela `caso_juridico_historico`

Registra todas as acoes do caso em ordem cronologica. Imutavel — nenhum registro e editado ou apagado.

```text
caso_juridico_historico
- id (uuid PK)
- consulta_id (uuid FK consultas_juridicas.id, nullable)
- processo_id (uuid FK processos.id, nullable)
- tipo (text): abertura, encaminhamento, parecer_emitido, decisao, mudanca_status, documento_anexado, acao_registrada, notificacao_enviada, prioridade_alterada, advogado_atribuido
- titulo (text NOT NULL)
- descricao (text)
- usuario_id (uuid FK profiles.user_id)
- created_at (timestamptz default now())
```

RLS: usuarios autenticados podem ler e inserir.

### Tabela `caso_juridico_documentos`

Documentos anexados pelo advogado (peticoes, laudos, notificacoes).

```text
caso_juridico_documentos
- id (uuid PK)
- consulta_id (uuid FK consultas_juridicas.id, nullable)
- processo_id (uuid FK processos.id, nullable)
- titulo (text NOT NULL)
- arquivo_url (text NOT NULL)
- arquivo_nome (text)
- tipo (text): peticao, notificacao, laudo, ata, relatorio, outro
- registrado_por (uuid FK profiles.user_id)
- created_at (timestamptz default now())
```

RLS: usuarios autenticados podem ler e inserir.

### Coluna adicional em `consultas_juridicas`

Adicionar `decisao` (text, nullable) e `decisao_observacoes` (text, nullable) e `decisao_por` (uuid FK, nullable) e `decisao_em` (timestamptz, nullable) para armazenar a decisao final.

## Arquivos a Criar

### 1. `src/pages/juridico/CasoJuridicoDetalhe.tsx`

Pagina principal com 5 abas. Recebe o ID do caso via URL params.

**Determinacao da fonte**: o ID pode ser de uma `consulta_juridica` ou de um `processo`. Tentar buscar primeiro em `consultas_juridicas`, se nao encontrar buscar em `processos`. Usar campo `_source` para diferenciar.

**Topo:**
- Botao voltar para `/juridico/casos`
- Titulo: "Caso #[numero] — [tipo classificado]" com badges de status e prioridade
- Botoes: "Alterar Prioridade" (dropdown com baixa/media/alta/urgente) e "Atribuir Advogado" (dialog com select de advogados ativos)

**Aba Resumo:**
- Card "Informacoes do Caso": numero, tipo classificado (mesmo badge colorido da lista), origem (sindicancia/encaminhamento/analise interna), prioridade, data abertura, advogado responsavel, status, dias em aberto, descricao completa
- Card "Dados do Associado": query join com `associados` via `sinistro.associado_id` — nome, CPF, telefone, email, plano (via plano_id join), status (adimplente/inadimplente baseado no status do associado), tempo como associado (differenceInDays desde data_adesao), contagem de sinistros anteriores (query count em sinistros do mesmo associado_id)
- Card "Dados do Veiculo": placa, marca/modelo/ano, valor FIPE (do sinistro), rastreador (campo pendencia_rastreador do associado)
- Card "Evento Vinculado": protocolo (link para /eventos/sinistros/:id), tipo, data ocorrencia, status atual (badge), valor FIPE, valor orcamento, botao "Ver evento completo" (abre em nova aba)
- Card "Sindicancia Vinculada" (condicional — so aparece se sinistro tem resultado_sindicancia): tipo (sindicancia/pericia), motivo, resultado (badge), parecer resumido (truncado), botao "Ver sindicancia" (link para /eventos/sindicancias/:sinistro_id)

**Aba Parecer Juridico:**
- Se `parecer` e null ou vazio:
  - Textarea grande para o advogado escrever a analise formal (min 100 caracteres)
  - Area de upload para ate 5 documentos (peticoes, notificacoes, laudos) — upload para Storage bucket `sinistros` no path `juridico/{caso_id}/`
  - Botao "Emitir Parecer" — atualiza `parecer`, `respondido_em`, `respondido_por`, `status` para `respondida`, insere entrada em `caso_juridico_historico`
- Se `parecer` ja existe:
  - Exibe parecer em modo leitura com formatacao
  - Data e autor: "Emitido em DD/MM/YYYY as HH:MM por [nome]"
  - Lista de documentos anexos com icone e botao download
  - Botao "Editar" visivel apenas para quem emitiu (respondido_por === user.id) ou para diretores (usar usePermissions)

**Aba Decisao:**
- Desabilitada se nao existe parecer — mostrar mensagem "Emita o parecer juridico antes de registrar a decisao"
- Se ja existe decisao: modo somente leitura com resultado, observacoes, quem decidiu e quando
- Se ainda nao tem decisao:
  - RadioGroup com 7 opcoes, cada uma com titulo e descricao detalhada das consequencias:
    1. `aprovado` — "Evento Aprovado" com descricao do fluxo
    2. `negado` — "Evento Negado"
    3. `suspensao_associado` — "Suspensao do Associado"
    4. `exclusao_associado` — "Exclusao do Associado"
    5. `acao_judicial` — "Acao Judicial"
    6. `acordo` — "Acordo"
    7. `arquivar` — "Arquivar"
  - Campo de observacoes (textarea)
  - Checkbox "Notificar associado?" com campo de texto para mensagem
  - Checkbox "Aplicar suspensao no veiculo?" com campo de motivo
  - Botao "Registrar Decisao" com AlertDialog de confirmacao
  - Ao confirmar, executar as acoes correspondentes:
    - `aprovado`: sinistro volta para `em_analise`
    - `negado`: sinistro muda para `negado`
    - `suspensao_associado`: sinistro `negado` + update associado status para `suspenso`
    - `exclusao_associado`: sinistro `negado` + update associado status para `cancelado`
    - `acao_judicial`: sinistro `negado`, caso status `ativo` (em execucao)
    - `acordo`: caso status `respondida`
    - `arquivar`: sinistro volta para `em_analise`, caso `arquivada`
  - Registrar em `caso_juridico_historico` e `sinistro_historico`

**Aba Historico:**
- Query em `caso_juridico_historico` + `sinistro_historico` (filtrado pelo sinistro_id do caso), combinados e ordenados por created_at desc
- Cada entrada: icone baseado no tipo, titulo, descricao, nome do usuario (join profiles), data/hora formatada
- Botao "Registrar Acao" abre modal com: descricao obrigatoria (textarea) e upload de arquivo opcional. Insere em `caso_juridico_historico` com tipo `acao_registrada`

**Aba Documentos:**
- Secoes colapsiveis (Collapsible):
  1. "Fotos da Auto Vistoria" — query `sinistro_fotos` where tipo IN ('foto_dano', 'foto_veiculo', etc)
  2. "Boletim de Ocorrencia" — sinistro.bo_arquivo_url
  3. "Relato e Audio" — sinistro.descricao + sinistro_documentos where tipo='audio_relato'
  4. "Vistoria do Regulador" — query `vistorias_evento` + `sinistro_fotos` where tipo starts with 'vistoria'
  5. "Orcamento" — query `evento_cotacoes_pecas`
  6. "Evidencias da Sindicancia" — query `sindicancia_evidencias` (se houver)
  7. "Documentos do Advogado" — query `caso_juridico_documentos`
- Cada documento: miniatura ou icone, titulo, botao download
- Fotos ampliavel em modal (Dialog com img full)

### 2. `src/components/juridico/RegistrarAcaoModal.tsx`

Modal para registrar acao manual no historico:
- Textarea descricao obrigatoria
- Upload de arquivo opcional (para Storage)
- Insere em `caso_juridico_historico` com tipo `acao_registrada`
- Se anexou arquivo, insere tambem em `caso_juridico_documentos`

## Arquivos a Modificar

### 3. `src/App.tsx`

Adicionar rota:

```text
<Route path="/juridico/casos/:id" element={<CasoJuridicoDetalhe />} />
```

## Detalhes Tecnicos

- A pagina determina se o caso e uma `consulta_juridica` ou `processo` tentando ambas as queries
- Para consultas: sinistro_id esta direto na tabela, join com sinistros -> associados, veiculos
- Para processos: sinistro_id tambem esta direto, mesmos joins
- Contagem de sinistros anteriores do associado: `supabase.from('sinistros').select('*', { count: 'exact', head: true }).eq('associado_id', associadoId)`
- Upload de documentos usa bucket `sinistros` (ja existe e e publico) no path `juridico/{caso_id}/`
- O historico combina `caso_juridico_historico` (acoes do caso) com `sinistro_historico` (mudancas de status do evento), ambos com join em profiles para nome do usuario
- A aba Decisao executa multiplas operacoes em sequencia: atualiza sinistro, atualiza consulta/processo, atualiza associado (se suspensao/exclusao), insere historico
- URLs assinadas nao sao necessarias pois o bucket `sinistros` e publico

## Ordem de Implementacao

1. Migracao: criar tabelas `caso_juridico_historico` e `caso_juridico_documentos`, adicionar colunas de decisao em `consultas_juridicas`
2. `RegistrarAcaoModal.tsx` — modal de acao manual
3. `CasoJuridicoDetalhe.tsx` — pagina completa com 5 abas
4. `App.tsx` — adicionar rota

