

# Fluxo de Autorização para Elegibilidade Negada com Double-Check da Supervisão

## Resumo

Quando o motor de cotação detecta veículos "negados" por elegibilidade, em vez de ocultar silenciosamente, exibiremos um alerta claro ao consultor com opção de solicitar autorização. A diretoria aprova/recusa, e a supervisão é notificada para dar um "double-check" que acelera a resposta.

## Mudanças

### 1. Tabela `aprovacoes_elegibilidade`

Nova tabela seguindo o padrão de `aprovacoes_fipe_menor`:

- `cotacao_id`, `plano_id`, `solicitante_id` — referências
- `marca`, `modelo`, `ano`, `combustivel`, `placa` — dados do veículo
- `motivo_bloqueio` (text) — observação da regra
- `justificativa` (text) — razão do consultor
- `status` (`pendente` / `aprovado` / `recusado`)
- `aprovador_id`, `observacao_aprovador`, `respondido_em`
- `supervisor_check` (boolean default false) — flag do double-check da supervisão
- `supervisor_id`, `supervisor_check_em` — quem e quando fez o double-check
- RLS: consultor vê as próprias; diretoria e supervisão veem todas pendentes

### 2. Permissão `canApproveElegibilidade`

Adicionar à `app_roles_config` para diretoria. Supervisão recebe permissão de visualizar (`canViewElegibilidadePendente`) e marcar double-check, mas **não** de aprovar/recusar.

### 3. Alterar `usePlanosCotacao.ts` — expor planos negados

O hook passa a retornar `planosNegados` além de `planos`:

```typescript
return {
  planos,        // aprovados + limitados (como hoje)
  planosNegados, // [{ planoId, planoNome, motivo }]
  isLoading,
};
```

No loop (linha 288), em vez de `continue`, coletar em array separado.

### 4. Novo hook `useAprovacaoElegibilidade`

Seguindo o padrão de `useAprovacoesFipeMenor`:
- `useCriarSolicitacaoElegibilidade` — insert + notificação para diretoria E supervisão
- `useListarAprovacoesElegibilidade(statusFilter)` — query com joins
- `useAprovarElegibilidade` / `useRecusarElegibilidade` — apenas quem tem `canApproveElegibilidade`
- `useDoubleCheckElegibilidade` — supervisão marca que revisou, seta `supervisor_check = true`

### 5. Componente `AlertaElegibilidadeNegada`

Banner vermelho/amarelo exibido acima dos cards quando `planosNegados.length > 0`:
- Lista os planos bloqueados com nome
- Texto: "X plano(s) indisponível(is) para este veículo por restrição de modelo"
- Botão "Solicitar autorização" → modal com campo de justificativa
- Após envio: toast de confirmação, botão muda para "Aguardando autorização"

Integrado em: `Cotador.tsx`, `EtapaResultado.tsx`, `CotacaoFormDialog.tsx`

### 6. Painel de aprovação (Diretoria + Supervisão)

Adicionar seção no painel existente de aprovações:
- **Diretoria** vê solicitações pendentes com botões Aprovar/Recusar + observação. Indicador visual se supervisão já fez double-check (badge verde "✓ Revisado pela supervisão")
- **Supervisão** vê as mesmas solicitações mas com botão "Confirmar revisão" (double-check) em vez de aprovar/recusar. Ao marcar, a diretoria recebe notificação de reforço

### 7. Notificações

- Ao criar solicitação → notifica usuários com `canApproveElegibilidade` (diretoria) **e** supervisão comercial
- Ao supervisão fazer double-check → notificação de reforço à diretoria: "Supervisão confirmou revisão da solicitação X"
- Ao diretoria aprovar/recusar → notifica consultor solicitante

### 8. Re-check na cotação

Quando uma aprovação é concedida para uma `cotacao_id` + `plano_id`, o hook `usePlanosCotacao` consulta `aprovacoes_elegibilidade` com status `'aprovado'` e inclui esse plano mesmo que a regra diga `'negado'`.

## Fluxo

```text
Consultor → Cotação → Motor detecta "negado"
  ↓
Alerta visível: "Plano X indisponível" [Solicitar Autorização]
  ↓
Consultor justifica → Registro criado → Notificação enviada
  ↓                                      ↓
Diretoria recebe                    Supervisão recebe
  ↓                                      ↓
  │                              Faz double-check ──→ Notificação reforço à Diretoria
  ↓
Diretoria aprova/recusa → Notifica consultor
  ↓
Se aprovado: plano liberado naquela cotação específica
```

