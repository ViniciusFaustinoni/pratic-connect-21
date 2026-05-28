## Estado atual confirmado (28/05 ~16:39)

**Local (banco):**
- `rastreadores` (IMEI `865011032275324`): `status=instalado`, `veiculo_id=4e67…3575` (RFH7G28), `plataforma=rede_veiculos`, **`id_plataforma=NULL`**, `plataforma_device_id=NULL`.
- `veiculos` (RFH7G28): `status=em_analise`, `cobertura_roubo_furto=true`, `codigo_hinova=36384`, **`rede_veiculos_cliente_id=NULL`**, **`rede_veiculos_veiculo_id=NULL`**.
- `associados` JOHNSON: `codigo_hinova=30546`, CPF `05453793775`.

**Rede Veículos (via edge `rede-veiculos-obter-status-cliente`):**
- Cliente JOHNSON: `veiculosVinculados: 1`, `veiculosInativos: 1`, `veiculosAtivos: 0`.
- Vínculo do IMEI **existe** lá (confirma o que você viu na plataforma), mas o veículo está **inativo** na Rede.
- O endpoint não retorna `idCliente`/`idVeiculo` nesse modo agregado. Pra preencher localmente preciso desses 2 (3 com o equipamento) números.

**Diagnóstico:** o card "Ativar Rastreador" aparece porque a UI checa `id_plataforma IS NULL` (rastreador) e `rede_veiculos_veiculo_id IS NULL` (veículo). É só esse buraco de dados — não tem nada de errado na Rede. Saneando essas 3 colunas o card some.

## Plano de saneamento

### Fase 1 — Coleta dos IDs reais da Rede (manual, você)

No painel Rede Veículos, com o CPF `05453793775` (JOHNSON) ou IMEI `865011032275324`, abrir o registro e me passar:

1. **`idCliente`** (ID interno do cliente JOHNSON na Rede)
2. **`idVeiculo`** (ID interno do veículo RFH7G28 na Rede)
3. **`idEquipamento`** (ID interno do rastreador / IMEI na Rede) — se a tela exibir

Sem esses números o saneamento fica "fake" (preencheria com placeholder e quebraria sincronizações futuras tipo `rede-veiculos-atualizar-equipamento`).

> ⚠️ Já fica registrado o risco lateral: o veículo está **INATIVO na Rede**. Depois do saneamento + aprovação do Monitoramento, o fluxo precisa rodar `rede-veiculos-ativar-veiculo` para mudar o estado lá. Isso é da etapa de aprovação, não desse saneamento.

### Fase 2 — Aplicação do saneamento (eu, via insert tool)

Quando você me passar os IDs, eu rodo um único bloco transacional:

```sql
-- 1. Veículo: registrar os IDs da Rede
UPDATE veiculos
SET rede_veiculos_cliente_id  = :idCliente,
    rede_veiculos_veiculo_id  = :idVeiculo,
    updated_at = now()
WHERE id = '4e675f45-8190-4401-b0d6-e4f26cbd3575';

-- 2. Rastreador: registrar id_plataforma (faz o card fantasma sumir)
UPDATE rastreadores
SET id_plataforma         = :idEquipamento_ou_idVeiculo,
    plataforma_device_id  = :idEquipamento,
    dados_extras = COALESCE(dados_extras, '{}'::jsonb) || jsonb_build_object(
      'saneamento_manual', true,
      'saneamento_motivo', 'bypass_vinculo_pulou_monitoramento_caso_JOHNSON_RFH7G28',
      'saneamento_em', now()
    ),
    updated_at = now()
WHERE id = '096341f0-54e8-48cd-a83b-abe7cd91d09e';

-- 3. Veículo: voltar status p/ instalacao_pendente para reentrar na fila normal
--    (LEANDRO tinha mudado para 'em_analise' às 12:54, isso o tirou do gate canônico)
UPDATE veiculos
SET status = 'instalacao_pendente'
WHERE id = '4e675f45-8190-4401-b0d6-e4f26cbd3575';

-- 4. Auditoria
INSERT INTO logs_auditoria (acao, modulo, tabela, registro_id, descricao, usuario_nome, dados_novos)
VALUES (
  'editar', 'rastreadores', 'rastreadores',
  '096341f0-54e8-48cd-a83b-abe7cd91d09e',
  'Saneamento manual — JOHNSON / RFH7G28 / IMEI 865011032275324: rastreador já vinculado na Rede, IDs locais preenchidos manualmente para destravar fluxo no Monitoramento.',
  'Sistema (saneamento manual)',
  jsonb_build_object(
    'rede_veiculos_cliente_id', :idCliente,
    'rede_veiculos_veiculo_id', :idVeiculo,
    'id_plataforma', :idEquipamento_ou_idVeiculo
  )
);
```

### Fase 3 — Validação (você, depois do meu UPDATE)

1. Abrir Monitoramento › Rastreadores → procurar IMEI `865011032275324`. **Card "Ativar Rastreador" deve ter sumido.**
2. Abrir o drawer do rastreador → aba "Gestão" deve carregar dados da Rede agora (com `id_plataforma` preenchido).
3. O veículo deve aparecer na fila **Monitoramento › Aprovações › Aprovação de Associados** (status `instalacao_pendente` + rastreador vinculado). A partir daí o fluxo canônico de aprovação dispara o `ativar-associado`, que sincroniza o SGA com docs/fotos.

## O que **NÃO** estou fazendo neste saneamento

- ❌ Não estou chamando `rede-veiculos-vincular-cliente` (daria erro de novo — vínculo já existe lá).
- ❌ Não estou tocando em status do cliente/veículo na Rede (a ativação na Rede acontece via `rede-veiculos-ativar-veiculo` quando o Monitoramento aprovar).
- ❌ Não estou mexendo em `contratos.cadastro_aprovado` nem chamando `ativar-associado` — é o Monitoramento que decide isso.
- ❌ Não estou implementando o guard estrutural (Fase B da investigação anterior) — esse fica para uma próxima rodada e exige aprovação separada.

## Próximo passo solicitado

Me passe `idCliente`, `idVeiculo` e (se possível) `idEquipamento` da Rede Veículos para o JOHNSON / RFH7G28, e eu executo a Fase 2 já.
