## Estado atual KOU6D37 (banco local)

| Campo | Valor |
|---|---|
| `veiculos.associado_id` | MARCOS DATIVO (`9c05d3c4…`) |
| `veiculos.em_troca_titularidade` | `true` |
| `veiculos.status` | `instalacao_pendente` |
| `veiculos.codigo_hinova` | `36274` (já existiu no Hinova) |
| `veiculos.sincronizado_hinova` | `true` (flag local) |
| Solicitação troca `2ee5c642` | `aguardando_monitoramento`, `efetivada_em=NULL`, `sga_status=falha` |

Você reportou que **no SGA o veículo já não aparece mais sob o MARCOS DATIVO** (provavelmente removido manualmente no painel Hinova). Nosso lado local ainda tem MARCOS como dono e `codigo_hinova=36274` ativo — esse descasamento precisa ser corrigido.

---

## Parte 1 — Limpeza da troca (KOU6D37 → MARCUS VINICIUS)

Migration única em transação:

```text
1. UPDATE veiculos
   SET em_troca_titularidade=false,
       troca_titularidade_id=NULL,
       troca_titularidade_iniciada_em=NULL,
       cobertura_suspensa=false,
       cobertura_suspensa_motivo=NULL,
       cobertura_suspensa_em=NULL
   WHERE id='d5181403-22c0-4f2a-b22e-b6e7d821376c';

2. DELETE FROM solicitacoes_troca_titularidade
   WHERE id='2ee5c642-a095-4423-9a9d-06dc1282ea9d';

3. DELETE FROM contratos
   WHERE id='e5a02908-b5e3-482c-a063-365a92477d71';

4. DELETE FROM cotacoes
   WHERE id='97f3142d-273b-4438-a1aa-47a129c102ce';

5. DELETE FROM associados
   WHERE id='5e83b57a-04b9-433c-9a0b-dcd0e2ab0f49';  -- MARCUS VINICIUS
```

Resultado: MARCOS DATIVO continua dono local do KOU6D37, sem flag de troca, pronto para reteste.

---

## Parte 2 — Reenviar KOU6D37 para o SGA sob MARCOS DATIVO

Como o Hinova não tem mais o vínculo, o código antigo (`36274`) está obsoleto e o `buscar/veiculo` lá vai retornar 404. Precisamos forçar **recriação** no SGA.

### Passos:

1. **Zerar o snapshot Hinova local** (para que a sync trate como cadastro novo, não como update inexistente):

```text
UPDATE veiculos
   SET codigo_hinova=NULL,
       sincronizado_hinova=false,
       sincronizado_hinova_em=NULL,
       hinova_erro=NULL
 WHERE id='d5181403-22c0-4f2a-b22e-b6e7d821376c';
```

2. **Disparar a edge `sga-hinova-sync`** com `{ veiculo_id: 'd5181403-22c0-4f2a-b22e-b6e7d821376c', forcar: true }` (ou o action equivalente `sincronizar_veiculo`).

3. **Validar**:
   - Resposta da edge com `codigo` novo gerado no Hinova.
   - `veiculos.codigo_hinova` repopulado, `sincronizado_hinova=true`.
   - Confirmação no painel Hinova de que KOU6D37 voltou a aparecer sob a matrícula do MARCOS DATIVO.
   - Forçar situação PENDENTE (3) via `alterarSituacaoParaVeiculoHinova` logo após o cadastro (regra canônica — nunca enviar ATIVO).

### Observações importantes

- O contrato ativo atual do MARCOS para o KOU6D37 (status `ativo`, com `valor_mensal` e `dia_vencimento`) será a base do payload da sync.
- Se o contrato dele estiver com `dia_vencimento` ausente, a sync vai falhar (regra canônica SGA dia_vencimento). Antes de disparar, eu confirmo o `dia_vencimento` do contrato vivo do MARCOS.
- Saneamento pontual — **não** trocar nada no fluxo da edge `sga-hinova-sync`.

---

## Parte 3 — Plano da efetivação (próxima troca cancelar veículo do antigo)

Para a próxima troca já cancelar o veículo do titular antigo no SGA automaticamente, manter como **trabalho separado** (já planejado anteriormente: extrair o trecho `alterarSituacaoVeiculoHinova(cod, 3)` que hoje só existe no caminho `retry_sga` para também rodar no fluxo principal). Não executar nesta rodada — primeiro limpa e reenvia, depois trata.

---

## Ordem de execução

1. Migration da Parte 1 (limpeza) — **bloqueia** se algo der errado, sem risco para o MARCOS.
2. UPDATE de zerar snapshot Hinova + invocar `sga-hinova-sync` da Parte 2.
3. Confirmar no Hinova que o KOU6D37 voltou e está PENDENTE sob o MARCOS.
4. Você refaz a troca de titularidade do zero para reteste.
