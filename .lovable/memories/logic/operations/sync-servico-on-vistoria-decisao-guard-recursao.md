---
name: sync-servico-on-vistoria-decisao guard re-entrância
description: Guard anti-recursão em sync_servico_on_vistoria_decisao + bloqueio do fallback por cotacao_id em status cancelada/reprovada — evita cancelamento espúrio da instalação recém-criada
type: feature
---

`sync_servico_on_vistoria_decisao` (trigger AFTER UPDATE em `vistorias`) agora checa a GUC `praticcar.in_vistoria_servico_sync='on'` no topo e retorna sem propagar — espelha o guard já existente no inverso `fn_sync_vistoria_on_servico_decisao`. Sem isso, a cadeia abaixo cancelava a instalação que `criar-instalacao-pos-pagamento` acabara de criar:

1. INSERT servico tipo='instalacao'
2. `cancelar_vistoria_entrada_orfa_servico` cancela o servico vistoria_entrada antigo
3. `fn_sync_vistoria_on_servico_decisao` cancela a vistoria de origem (seta GUC='on')
4. `sync_servico_on_vistoria_decisao` ignorava a GUC, caía no fallback `instalacoes WHERE cotacao_id LIMIT 1` e cancelava A NOVA instalação
5. `cancelar_servicos_ao_cancelar_instalacao` em cascata cancelava o servico de instalação

Defesa em profundidade adicional: o fallback por `cotacao_id LIMIT 1` agora é pulado quando `NEW.status IN ('cancelada','reprovada')` — só roda para aprovação (caminho legítimo de vincular vistoria à instalação).

Sintoma no link público: banner "Detectamos uma inconsistência no seu agendamento" + toast "Vistoria completa agendada com sucesso!" (cotação fica com `vistoria_data_agendada` preenchido mas sem instalação/serviço/agendamento_base vivos). Caso COT-20260605-091629949-127 (MARCELO/LTD7E79, 05/06/2026).
