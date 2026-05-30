# Desvinculação reversa Softruck/Rede — fechar gaps

## Diagnóstico do caso do anexo

Operador retirou o rastreador → desvinculou na **Softruck** às 15:06 de 28/05 → de madrugada (02:21 de 29/05) o sistema **re-vinculou sozinho**.

Reconstituí o fluxo:

```text
1. Retirada física do rastreador  →  nosso lado segue com veiculo_id preenchido,
                                     status='instalado', softruck_integration_status='PENDING'
2. Desvínculo manual no painel Softruck (15:06 28/05)
   • Webhook DEVICES.DISASSOCIATED da Softruck NÃO chegou
     (ou foi ignorado/atrasado) → nosso veiculo_id NÃO foi zerado
3. Cron `cron-softruck-reconciliar-pending` (cada 10 min) pega o rastreador:
   • veiculo_id != null  + status='instalado' + PENDING
   • chama `softruck-ativar-dispositivo` / `softruck-reconciliar-pending`
   • re-cria o vínculo na plataforma → "Associado em 02:21 29/05"
```

Hoje o sistema só reflete desvínculo remoto quando:
- **Softruck**: chega o webhook `DEVICES.DISASSOCIATED` (instável, ver memória), OU alguém aciona manualmente `rastreador-reconciliar-softruck` no drawer.
- **Rede Veículos**: cron `rede-veiculos-sync-cron` (30 min) processa os primeiros 50 associados — limit 50 hardcoded.

## Causa raiz

Os crons de reconciliação são **unidirecionais para a frente** (PENDING → vincular). Não fazem o probe inverso antes de re-vincular, então um desvínculo manual na plataforma é interpretado como "vínculo perdido — refazer".

## Plano (3 ajustes, ordem de importância)

### 1. Probe inverso obrigatório antes de re-vincular (Softruck)

Em `cron-softruck-reconciliar-pending` e `softruck-reconciliar-pending`, **antes** de chamar `softruck-ativar-dispositivo`/PATCH de associação:

- GET `/devices?imei=...` na Softruck.
- Se o device existe mas `relationships.vehicle` está vazio **E** nosso `veiculo_id` não-nulo já tem mais de N minutos sem mudança → tratar como desvínculo remoto: aplicar a mesma rotina canônica de `rastreador-reconciliar-softruck` (linhas 180–218): zerar `veiculo_id`, `plataforma_veiculo_id`, status → `estoque`, marcar `softruck_integration_status='RECONCILIADO_REMOTO'`, gravar `rastreadores_vinculo_historico` com `origem='auto_desvinculo_remoto_softruck'`.
- Notificar Monitoramento (`notificacoes_internas`) com severidade alta — operador precisa saber que houve mexida no painel externo.

### 2. Reconciliação Softruck cobrindo `instalado` "SUCCESS" também

Hoje o cron só olha `softruck_integration_status IN ('PENDING','pending')`. Rastreador que ficou em SUCCESS e foi desvinculado depois no painel **nunca é varrido**. Criar uma varredura paralela leve (mesmo cron, segundo lote, menor frequência — ex.: a cada hora) que pega N rastreadores Softruck `status='instalado'` + `SUCCESS` ordenados por `updated_at ASC`, faz o GET descrito acima e aplica desvínculo local quando o device está sem vehicle remoto. Isso fecha o gap "webhook DISASSOCIATED nunca chegou".

### 3. Cron Rede Veículos: subir o teto e priorizar mais antigos

`rede-veiculos-sync-cron` hoje limita a 50 associados sem ordenação determinística — associados além do 50º não recebem sync nunca. Mudar para:
- Ordenar por `veiculos.updated_at ASC` (mais antigos primeiro), ou usar uma coluna `rede_veiculos_last_sync_at` em `veiculos` (criar via migration) para round-robin real.
- Aumentar o batch para 200 e quebrar em chunks paralelos pequenos (não derruba o endpoint da Rede).

A função `rede-veiculos-sincronizar-status` já tem a lógica reversa correta (linhas 147–235 do edge) — só precisa ser disparada para todos os vinculados.

## Validação pós-deploy

1. Forçar manualmente um device Softruck "instalado/SUCCESS" → desvincular no painel da Softruck → aguardar ciclo do cron → confirmar:
   - `rastreadores.veiculo_id = NULL`, `status='estoque'`, `softruck_integration_status='RECONCILIADO_REMOTO'`
   - linha em `rastreadores_vinculo_historico` com `origem='auto_desvinculo_remoto_softruck'`
   - notificação em Monitoramento
2. Mesmo teste pela Rede Veículos — confirmar que associado fora dos primeiros 50 agora é alcançado.
3. Rever o caso do anexo: ao reaplicar o cenário (desvínculo manual no painel + esperar), o cron NÃO pode mais re-vincular.

## Pendência paralela já registrada (não entra nesta rodada)

- Investigar instabilidade do webhook Softruck `DEVICES.DISASSOCIATED` — quando chega/quando não chega. Sem o webhook estável, o polling é o fallback canônico, mas o ideal é entender por que o evento não dispara em desvínculos via painel.

## Fora de escopo

- Mudar o modelo de "device_id próprio IMEI placeholder" (não relacionado ao gap reverso).
- Backfill histórico de rastreadores que sofreram re-vinculação indevida — depende de auditoria caso a caso após a correção entrar.

Atualização de memória após implementação: refinar `mem://logic/operations/softtruck-desvinculo-bidirecional` para deixar explícito que cron faz probe inverso antes de re-vincular e que cobertura inclui status SUCCESS, não só PENDING.
