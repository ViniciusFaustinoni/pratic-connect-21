# Vistoria em duas etapas com link público unificado

## Objetivo

Substituir a obrigação de "técnico responsável pela vistoria inteira" por um **link público único** com duas etapas independentes:

1. **Fotos & Vídeo** — pode ser feito por qualquer pessoa (associado, terceiro, técnico).
2. **Instalação do Rastreador** — sempre concluída pelo técnico (interno ou prestador).

Ambas as etapas podem ser feitas em qualquer ordem e em momentos distintos ou concomitantes. O link só é gerado **após a aprovação documental**. O associado só é ativado (sistema + SGA) **após as duas etapas concluídas** (antes disso, fica inativo ou pendene em casos de auto vistoria).

## Como funcionará para o usuário

### Fluxo do diretor / cadastro

1. Cadastro aprova a documentação no `PropostaApprovalStepper` (etapa atual permanece igual).
2. Ao concluir a aprovação documental, o sistema **gera automaticamente o link público de vistoria** e exibe na cotação um botão **"Abrir link de vistoria"** + ícone de copiar URL.
3. Atribuição opcional de técnico interno ou prestador continua funcionando normalmente (gera tarefa no monitoramento e marca tempo de execução só para o técnico).

### Fluxo da pessoa que abre o link `/vistoria/:token`

- Vê os dados do veículo/associado e dois cartões grandes:
  - **Realizar Fotos e Vídeo** (some quando concluído)
  - **Realizar Instalação do Rastreador** (some quando concluído)
- Cada etapa é independente. Ao clicar:
  - **Fotos & Vídeo** → tela igual à atual de vistoria pública (mesmas fotos, mesmo vídeo 360°, mesmo checklist visual, mesma compressão, mesma quantidade mínima).
  - **Instalação do Rastreador** → primeiro pergunta o **nome do técnico**:
    - Se um técnico interno foi atribuído pelo monitoramento → preenchido automaticamente, **sem edição**.
    - Se houver prestador atribuído → preenchido com o nome do prestador, **sem edição**.
    - Se ninguém atribuído → campo livre obrigatório (qualquer pessoa pode preencher).
  - Em seguida, mostra o checklist e fotos de instalação (idênticos ao fluxo atual de instalação).

### Fluxo do técnico interno

- Continua recebendo a tarefa no app do instalador exatamente como hoje (`/instalador/vistoria/:id`).
- A tela do instalador passa a refletir as duas etapas: badges "Fotos & Vídeo" e "Instalação Rastreador" no topo, cada uma marcada como concluída se a outra ponta (link público) já enviou.
- **Tempo de execução** (`iniciada_em`, `TemporizadorExecucao`) continua sendo marcado **apenas** quando o técnico interno inicia a etapa de instalação — não é afetado por alguém abrindo o link público.

### Ativação final

- Quando a **última das duas etapas** é concluída (independentemente de quem concluiu cada uma), o sistema:
  1. Marca a vistoria como `aprovada` e a instalação como `concluida`.
  2. Aciona o fluxo já existente de aprovação do monitoramento (continua manual no painel de aprovação).
  3. **Somente depois da aprovação do monitoramento** o associado é ativado e enviado ao SGA — comportamento atual preservado.

## Escopo do que não muda

- Quantidade e tipos de fotos, vídeo 360°, checklist, compressão, geolocalização, upload offline.
- Atribuição de tarefas/mapa do monitoramento, marcação de tempo, lançamentos contábeis do prestador.
- Aprovação documental no Cadastro, aprovação do monitoramento, ativação SGA via `sga-hinova-sync`.
- Páginas existentes `/vistoria-prestador/:token` e fluxos antigos continuam funcionando (compatibilidade).

---

## Detalhes técnicos

### 1. Banco de dados (migration)

Nova tabela `vistoria_links` (link unificado por instalação):

```text
vistoria_links
  id uuid pk
  instalacao_id uuid not null unique  -- 1 link por instalação
  vistoria_id uuid                    -- referência opcional à vistoria já criada
  token text not null unique          -- token público (gen_random_uuid::text)
  status text default 'pendente'      -- pendente | fotos_concluidas | instalacao_concluida | concluido | cancelado
  fotos_etapa_status text default 'pendente'      -- pendente | em_andamento | concluida
  instalacao_etapa_status text default 'pendente' -- idem
  fotos_concluida_em timestamptz
  instalacao_concluida_em timestamptz
  fotos_executor_nome text            -- quem fez (livre quando público)
  instalacao_executor_nome text       -- nome do técnico (obrigatório)
  instalacao_executor_tipo text       -- 'interno' | 'prestador' | 'publico'
  tecnico_atribuido_id uuid           -- profile_id quando interno
  prestador_atribuido_id uuid         -- vistoriador_prestador_id quando prestador
  criado_por uuid
  created_at, updated_at timestamptz
```

- RLS: `select` público pelo token (anon), `update` público restrito a colunas de etapa via Edge Function.
- Trigger `BEFORE UPDATE`: quando `fotos_etapa_status` e `instalacao_etapa_status` ficam ambos `concluida`, define `status='concluido'`.

Não removemos `vistoria_prestador_links` nem `instalacao_prestador_links` — continuam ativas para os fluxos legados.

### 2. Edge Functions

- `gerar-link-vistoria-publica` (nova): cria/retorna o `vistoria_links` da instalação. Disparada **automaticamente** quando o stepper de aprovação documental completa todos os documentos. Idempotente.
- `concluir-etapa-fotos-publica` (nova): valida token, salva fotos/vídeo/checklist na vistoria, marca `fotos_etapa_status='concluida'` e dispara `aplicar-conclusao-vistoria` se a outra etapa também já estiver concluída.
- `concluir-etapa-instalacao-publica` (nova): valida token, exige `executor_nome` (interno → travado server-side), salva checklist/fotos de instalação, marca `instalacao_etapa_status='concluida'` e dispara `aplicar-conclusao-vistoria` se a outra etapa também já estiver concluída.
- `aplicar-conclusao-vistoria` (nova, interna): faz exatamente o que `useAprovarVeiculoVistoria` já faz hoje (atualiza vistoria/instalação/serviço/agendamento_base, gera laudo, registra histórico) — **sem** chamar SGA. A aprovação do monitoramento continua sendo manual e dispara o SGA como hoje.

### 3. Frontend

Rota nova: `/vistoria/:token` → `src/pages/public/VistoriaPublica.tsx`

- Layout com 2 cartões; oculta cartão de etapa concluída.
- Sub-rotas internas (state-based) `?etapa=fotos` e `?etapa=instalacao`.
- Etapa "fotos" reaproveita `VistoriaFotoSequencial` + `VideoCapture`.
- Etapa "instalação" reaproveita `ChecklistItem` e o checklist do instalador.
- Modal "Identificação do técnico" obrigatório antes da etapa instalação; campo bloqueado quando atribuição interna existir.

Atualizações na cotação:

- `src/components/cotacoes/CotacaoDetalhesModal.tsx` e `CotacaoCard.tsx`: novo bloco "Vistoria" mostrando o status das duas etapas + botões "Abrir link", "Copiar URL", "Reenviar por WhatsApp".
- Hook novo `useVistoriaLink(cotacaoId)` para consultar o `vistoria_links` da instalação vinculada.

Atualização do app do instalador:

- `ExecutarVistoriaCompleta` ganha cabeçalho com badges das duas etapas. Botões "Aprovar/Reprovar" só ficam ativos quando ambas concluídas. Tempo (`TemporizadorExecucao`) só inicia ao tocar "Iniciar instalação", preservando a métrica do técnico.

Geração automática do link:

- Em `usePropostasPendentes` / fluxo de aprovação documental, quando todos os documentos ficam `aprovado`, chama `gerar-link-vistoria-publica` (idempotente). UI mostra toast "Link de vistoria gerado".

### 4. Compatibilidade e segurança

- Páginas legadas `/vistoria-prestador/:token` continuam funcionando para tarefas em curso.
- RLS: o token é único, longo e tratado como segredo (igual aos atuais).
- Geolocalização contínua e upload offline reaproveitam o mesmo padrão atual (`watchPosition`, `useUploadVistoriaOffline`).
- Não há alteração no envio ao SGA — continua disparado **apenas** após aprovação do monitoramento.

### 5. Itens fora deste plano (sugestões futuras)

- Migrar fluxos antigos `vistoria_prestador_links` / `instalacao_prestador_links` para o novo modelo unificado.
- Permitir múltiplas tentativas de fotos por etapa (versionamento) — hoje sobrescreve.