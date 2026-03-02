
# Fila de Revisao de Recusas do Instalador

## Resumo

Criar fluxo completo para analistas de cadastro, coordenadores de monitoramento, diretores e admin master revisarem servicos negados pelo instalador em campo. Inclui: tela dedicada com fila, notificacoes automaticas, banner de acao na tela de detalhes e decisoes (reverter, cancelar, blacklist).

---

## 1. Hook de dados: `src/hooks/useRecusasInstalador.ts`

Novo hook com:

- **`useRecusasInstalador()`**: Query na tabela `servicos` filtrando `decisao_instalador = 'negado'` com joins em `associados`, `veiculos` e `profiles` (instalador). Retorna lista ordenada por `updated_at` desc.
- **`useResolverRecusa()`**: Mutation que recebe `servicoId`, `acao` (enum: `reverter_recusa`, `cancelar_contrato`, `blacklist`, `nova_vistoria`), `justificativa` e executa:
  - **Reverter recusa**: Reseta `decisao_instalador` para null, status volta para `agendada`. Registra historico.
  - **Cancelar contrato**: Atualiza servico para `cancelada`, cancela contrato e associado. Registra historico.
  - **Blacklist**: Usa `useAdicionarBlacklist` existente + cancela contrato. Registra historico.
  - **Nova vistoria**: Cancela servico atual, cria novo servico de vistoria_entrada para o veiculo. Registra historico.
- **`useContagemRecusasPendentes()`**: Query simples que retorna count de servicos com `decisao_instalador = 'negado'` e `status = 'em_analise'` (para badge no menu).

---

## 2. Pagina: `src/pages/cadastro/RecusasInstalador.tsx`

Nova pagina seguindo o padrao visual de `PropostasPendentes.tsx`:

- Protecao de acesso: `useRequireFuncionario` com perfis `['diretor', 'admin_master', 'analista_cadastro', 'coordenador_monitoramento', 'desenvolvedor']`
- **Header**: Titulo "Recusas do Instalador" + contagem de pendentes
- **Filtros**: Busca por placa/nome, filtro por status (pendente / resolvido)
- **Tabela** com colunas:
  - Data da recusa
  - Associado (nome)
  - Veiculo (placa + modelo)
  - Instalador (nome)
  - Motivo (truncado)
  - Status (badge: Pendente Analise / Resolvido)
  - Acoes (botao "Analisar")
- Clique em "Analisar" abre o `ResolverRecusaDialog`
- Estado vazio com icone quando nao ha recusas pendentes

---

## 3. Dialog de resolucao: `src/components/cadastro/ResolverRecusaDialog.tsx`

Dialog modal com:

- **Contexto**: Exibe placa, motivo do instalador e galeria de fotos de evidencia (`fotos_ressalva`)
- **Opcoes de decisao** (radio group):
  - ( ) Reverter recusa e reagendar instalacao
  - ( ) Cancelar contrato do associado
  - ( ) Incluir veiculo na blacklist
  - ( ) Solicitar nova vistoria
- **Campo de justificativa** obrigatorio (textarea)
- **Botao de confirmar** com loading state
- Ao confirmar, chama `useResolverRecusa()` e registra no `associados_historico`

---

## 4. Banner na tela de detalhes: `src/pages/cadastro/VistoriaCompletaAnalise.tsx`

Editar a pagina existente para:

- Buscar campos `decisao_instalador`, `ressalvas_instalador` e `fotos_ressalva` do servico relacionado a instalacao (query adicional na tabela `servicos`)
- Se `decisao_instalador === 'negado'`, renderizar um **banner vermelho** no topo:
  - Icone `AlertTriangle`
  - Texto: "Veiculo NEGADO pelo instalador - Pendente de revisao"
  - Exibir motivo do instalador
  - Galeria de fotos de evidencia
  - Botao "Tomar Decisao" que abre o `ResolverRecusaDialog`
- Esconder botao de ativacao de rastreador quando houver recusa pendente

---

## 5. Notificacao automatica: `src/components/sinistros/NotificacaoHelper.ts`

Adicionar funcao `notificarRecusaInstalador(servicoId, placa, motivo)`:

- Busca user_ids com roles `analista_cadastro` e `coordenador_monitoramento` (similar a `getDiretoresIds`)
- Tambem notifica diretores
- Insere notificacao para cada um com:
  - titulo: "Veiculo Negado pelo Instalador"
  - mensagem: "Veiculo placa {placa} foi negado. Motivo: {motivo}"
  - tipo: `sistema`, subtipo: `recusa_instalador`
  - link: `/cadastro/recusas-instalador`
  - prioridade: `urgente`

---

## 6. Disparo da notificacao: `src/hooks/useServicos.ts`

Editar `useRecusarVeiculoServico` (linha ~1186, onSuccess):

- Apos sucesso da mutation, chamar `notificarRecusaInstalador()` com os dados do servico (placa, motivo)
- Buscar placa do veiculo antes de notificar (ja disponivel nos parametros da mutation via `veiculoId`)

---

## 7. Rota e navegacao: `src/App.tsx`

- Importar `RecusasInstalador` de `src/pages/cadastro/RecusasInstalador`
- Adicionar rota: `<Route path="/cadastro/recusas-instalador" element={<RecusasInstalador />} />`
- Posicionar junto das demais rotas de `/cadastro/`

---

## Resumo de arquivos

**Criar (3):**
- `src/pages/cadastro/RecusasInstalador.tsx`
- `src/hooks/useRecusasInstalador.ts`
- `src/components/cadastro/ResolverRecusaDialog.tsx`

**Editar (4):**
- `src/App.tsx` — nova rota
- `src/hooks/useServicos.ts` — disparar notificacao na recusa
- `src/components/sinistros/NotificacaoHelper.ts` — funcao `notificarRecusaInstalador`
- `src/pages/cadastro/VistoriaCompletaAnalise.tsx` — banner de alerta + botao de acao

**Nenhuma migration necessaria** — campos `decisao_instalador`, `ressalvas_instalador` e `fotos_ressalva` ja existem na tabela `servicos`.
