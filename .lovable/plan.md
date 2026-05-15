# Causa-raiz

O WhatsApp de suspensão chegou ao THYAGO (KZL9153) **mesmo com o contrato `ativo` e a vistoria/instalação já concluída**. Investigação dos dados:

- Contrato `548cf476…` — `status='ativo'`, `data_ativacao=2026-05-15 13:42`, UF=RJ (prazo 48h).
- Veículo `cdb3d209…` — `status='ativo'` (foi ativado às 13:42), mas o cron rodou às 17:07 e setou `cobertura_suspensa=true`.
- Tabela `instalacoes` para esse contrato → **vazia**.
- Tabela `servicos` para o veículo → 1 linha: `tipo='vistoria_entrada'`, `status='aprovada'`, `concluida_em=2026-05-13 20:01`.

A função `cron-suspender-cobertura-inativacao` tem dois problemas:

1. O **fallback em `servicos`** procura `tipo='instalacao' AND status='concluida'`. Pelo padrão canônico do projeto (`mem://logic/operations/vistoria-entrada-equivale-instalacao`), `vistoria_entrada` é o mesmo evento físico de instalação e o status terminal aceito é `aprovada`/`concluida`/`concluida_em IS NOT NULL`. Como a fila usou `vistoria_entrada` + `aprovada`, o cron **não viu a instalação concluída** e suspendeu indevidamente.
2. Não há **guarda de segurança** para contrato já em `status='ativo'` com `data_ativacao` preenchida — um contrato ativado pelo `ativar-associado` jamais deveria ser suspenso por este cron.

# Correção

### 1. `supabase/functions/cron-suspender-cobertura-inativacao/index.ts`

- Selecionar somente `status='assinado'` (remover `'ativo'` da lista) **e** ignorar contratos com `data_ativacao` setada — contrato ativado já passou por monitoramento/instalação completa.
- Trocar o fallback em `servicos` para reconhecer o par canônico:
  ```
  .in('tipo', ['instalacao','vistoria_entrada'])
  .or('status.in.(concluida,aprovada),concluida_em.not.is.null')
  ```
- Adicionar guarda extra: ler `veiculos.status`; se já estiver `'ativo'`, registrar em `ignorados` e não suspender.

### 2. Migration de saneamento (caso pontual KZL9153)

Reverter a suspensão indevida e religar cobertura:
```sql
UPDATE veiculos
   SET cobertura_suspensa = false,
       cobertura_suspensa_motivo = NULL,
       cobertura_suspensa_em = NULL,
       cobertura_total = true,
       cobertura_roubo_furto = true
 WHERE id = 'cdb3d209-a498-4093-96f1-a240dbdee170';

INSERT INTO logs_auditoria (acao, modulo, descricao, dados_novos)
VALUES ('reativacao_cobertura_correcao_bug','monitoramento',
        'Cobertura religada manualmente — falso-positivo do cron de suspensão por não-instalação (vistoria_entrada não reconhecida).',
        jsonb_build_object('veiculo_id','cdb3d209-a498-4093-96f1-a240dbdee170','placa','KZL9153'));
```

Não disparar template de “cobertura religada” para evitar nova mensagem confusa — apenas reverter silenciosamente.

### 3. Atualizar memória

`mem://logic/operations/suspensao-cobertura-nao-instalacao-escopo`: acrescentar que o cron deve respeitar `vistoria_entrada ≡ instalacao` e nunca tocar contratos já ativados (`data_ativacao IS NOT NULL`).

# Não escopo

- Recurso de apagar cotações órfãs e fluxo de troca de titularidade (já entregue em mensagens anteriores).
- Mudanças no template Meta — o template em si está correto; o problema é o gatilho.
