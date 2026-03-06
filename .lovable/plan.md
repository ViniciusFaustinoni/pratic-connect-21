

# Analise dos 4 Botoes do Dialog de Condicao (Checklist NOK)

## Quando o dialog aparece

O dialog e disparado quando o instalador tenta avancar da etapa 2 (Checklist) para a etapa 3 (Fotos) e existem itens marcados como NOK no checklist (`etapaAtual === 2 && temItensNok`).

---

## Botao 1: "Ha condicao de continuar" / "Prosseguir mesmo assim"

**Funcao:** `handleContinuarComRessalva`

**Logica:**
1. Fecha o dialog
2. Salva o checklist no banco (com quilometragem)
3. Avanca para a etapa 3 (Fotos)
4. O instalador continua o fluxo normalmente, porem na etapa final de decisao, se houver itens criticos NOK, a opcao "Aprovado" estara bloqueada — so podera escolher "Aprovado com Ressalva" ou "Negado"

**Status:** Funcional. Nenhum problema encontrado.

---

## Botao 2: "Enviar para Monitoramento"

**Funcao:** `handleEnviarParaMonitoramento`

**Logica:**
1. Coleta os itens NOK e suas observacoes como texto de ressalvas
2. Coleta fotos de evidencia dos itens NOK (se existirem)
3. Chama `useEnviarParaMonitoramento` que:
   - Salva o checklist no banco (`checklist_data`)
   - Atualiza o servico: `status = 'em_analise'`, `decisao_instalador = 'pendente_monitoramento'`
   - Registra historico em `associados_historico` com tipo `'enviado_monitoramento'`
   - Invalida queries relacionadas a ressalvas do monitoramento
   - Tenta atribuir proxima tarefa ao instalador (fire-and-forget)
4. Navega de volta para `/instalador`

**Status:** Funcional apos a correcao da constraint `servicos_decisao_instalador_check` (ja aplicada). O coordenador pode revisar em `/monitoramento/ressalvas-pendentes`.

---

## Botao 3: "Nao ha condicao - Encerrar"

**Funcao:** `handleEncerrarSemCondicao`

**Logica:**
1. Fecha o dialog de condicao
2. Monta um motivo pre-preenchido com os itens NOK e suas observacoes
3. Abre o `ModalRecusaVeiculoComFotos` (com o motivo pre-preenchido)
4. O instalador deve confirmar, podendo adicionar mais detalhes e fotos
5. Ao confirmar, chama `handleRecusarVeiculo` que:
   - Faz upload das fotos de evidencia para o storage
   - Chama `useRecusarVeiculoServico` que: `status = 'em_analise'`, `decisao_instalador = 'negado'`
   - Registra historico como `'negado_pelo_instalador_pendente_analise'`
   - Dispara notificacao para analistas/coordenadores
   - Envia orientacoes de resolucao ao associado via WhatsApp
   - Tenta atribuir proxima tarefa ao instalador
6. Navega de volta para `/instalador`

**Status:** Funcional. Nenhum problema encontrado.

---

## Botao 4: "Revisar checklist"

**Funcao:** `() => setShowDialogCondicao(false)`

**Logica:**
1. Simplesmente fecha o dialog
2. O instalador volta a etapa 2 do checklist para revisar/corrigir os itens marcados como NOK
3. Nenhuma acao destrutiva ou gravacao no banco

**Status:** Funcional. Nenhum problema encontrado.

---

## Verificacao de Infraestrutura

| Item | Status |
|------|--------|
| Constraint `servicos_decisao_instalador_check` | OK — inclui `pendente_monitoramento` e `declinado_monitoramento` |
| Enum `status_servico` inclui `em_analise` | OK |
| RLS permite prestador atualizar seus servicos | OK |
| Campo `tipo` em `associados_historico` e varchar livre | OK |
| Fila de ressalvas do coordenador (`/monitoramento/ressalvas-pendentes`) | Existente |

## Conclusao

**Todos os 4 botoes estao funcionais.** O unico problema existente era a constraint `servicos_decisao_instalador_check` que ja foi corrigida na migracao anterior. Nenhuma correcao adicional e necessaria.

