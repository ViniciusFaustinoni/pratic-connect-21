# Bypass de Janela na Troca — 4º destino: Comercial › Aprovações

Mantém tudo que já está no plano anterior (Cadastro decide, banner, `logs_auditoria`, `analises_relacionamento`, `contratos.bypass_aplicado`, banner em Monitoramento) e **adiciona uma nova aba em `/vendas/aprovacoes-fipe`** seguindo exatamente o padrão de Redução de Cota / Elegibilidade: visibilidade + ciência, **não-bloqueante**.

---

## 1. Nova tabela `aprovacoes_bypass_troca`

Colunas de domínio (`status`, `tipo` [`bypass_janela` | `troca_convertida_cotacao`], `contrato_id`, `cotacao_id`, `associado_id`, `placa`, `nome_autorizador`, `justificativa`, `operador_user_id`, `ciente_por`, `ciente_em`, `observacao_supervisor`). RLS: leitura/atualização para quem tem `canManageConsultores` (mesma permissão do `/vendas/aprovacoes-fipe`); insert só via service_role (edges). GRANTs canônicos.

## 2. Ingestão (write nos 4 destinos)

Tanto `aprovar-troca-cadastro` (com `bypass_janela=true`) quanto `converter-troca-em-cotacao-normal` passam a gravar **também** em `aprovacoes_bypass_troca` com `status='ciente_pendente'`, além dos 3 destinos já planejados (logs, análises de relacionamento, `contratos.bypass_aplicado`). Falha do insert é não-bloqueante e logada — não derruba o fluxo de Cadastro.

## 3. Hook + edge de ciência

- `useAprovacoesBypassTroca(status?)` (padrão idêntico a `useAprovacoesFipeMenor`).
- `useMarcarCienteBypassTroca({ id, observacao })` → edge `marcar-ciente-bypass-troca` valida permissão `canManageConsultores`, seta `status='ciente'`, `ciente_por`, `ciente_em`, `observacao_supervisor`. Log auditoria `[BYPASS_TROCA_CIENTE]`.

## 4. UI em `/vendas/aprovacoes-fipe`

Adiciona **3ª aba de seção** ao lado de "Redução de Cota" e "Elegibilidade":

- Trigger: `Bypass Troca` (ícone `AlertTriangle` âmbar) + tooltip "Trocas de titularidade aprovadas fora da janela ou convertidas em cotação normal pelo Cadastro. Apenas ciência — não bloqueia o fluxo."
- Sub-abas Pendentes / Cientes / Todas (idênticas ao padrão).
- Card por solicitação mostrando: tipo (badge âmbar "Aprovada fora da janela" ou cinza "Convertida em cotação"), número da cotação/contrato, associado, veículo+placa, **autorizado por {nome_autorizador}**, operador do Cadastro, data BRT, justificativa, link "Abrir contrato".
- Botão `Marcar como Ciente` abre o mesmo `Dialog` reusado (resumo + alerta "ciência apenas, não altera o processo" + textarea opcional).

## 5. Badge no menu lateral

`AppSidebar` ganha contador de pendentes da nova aba (mesmo padrão de `useAprovacoesFipeMenor` / `aprovacoesMonCount`). Soma ao badge existente em "Aprovações" do menu Comercial, OU vira badge próprio — manter padrão atual do item.

## 6. Memórias atualizadas

- `troca-titularidade-janela-mesmo-dia`: adiciona Comercial como 4º destino.
- `analises-relacionamento-ingestao`: nota o paralelo com Comercial.
- Nova memória curta `aprovacoes-bypass-troca-comercial` documentando a aba não-bloqueante.

---

## Detalhes técnicos

- Mesma página `src/pages/vendas/AprovacoesFipeMenor.tsx`: `SectionTab` vira `'reducao_cota' | 'elegibilidade' | 'bypass_troca'`; componente novo `<PainelAprovacoesBypassTroca/>` em `src/components/aprovacoes/`.
- Sem reuso de `aprovacoes_fipe_menor` (domínio diferente). Tabela separada evita misturar contadores e RLS.
- Idempotência: edges fazem `upsert` por `(contrato_id, tipo)` — reaprovar mesmo contrato não duplica linha pendente.
- Performance: índice `(status, created_at desc)` para a listagem.

## Fora de escopo
- Notificação realtime para Comercial (segue padrão pull do `useAprovacoesFipeMenor`).
- Reverter bypass a partir da tela Comercial (somente ciência).
- Alterar a regra de quem aprova (continua exclusivo do Cadastro).
