## Diagnóstico

Estado atual no banco para placa `KRF8B74` (cotação `b50180dc-…`, contrato `226eacc0-…`, veículo `7719dcaa-…`, instalação `e31076b8-…`):

| Entidade | Campo | Valor atual | Valor esperado |
|---|---|---|---|
| `contratos` | `cadastro_aprovado` | `true` (aprovado_por=cefd786a, 19/05 18:12) | `false` |
| `veiculos` | `cobertura_roubo_furto` | `true` | `false` |
| `veiculos` | `status` | `instalacao_pendente` | `instalacao_pendente` (mantém) |
| `vistorias` | `status` (autovistoria enxuta) | `aprovada` | `pendente` |
| `servicos` (vistoria_entrada autovistoria) | `status` | `concluida` | `em_analise` |
| `servicos` | `concluida_em` | 19/05 19:21 | `NULL` |
| `instalacoes` (data_agendada 20/05) | `status` | `concluida` | `agendada` |
| `cotacoes` | `status_contratacao` | `pagamento_ok` | `aguardando_aprovacao_cadastro` |
| `associados` | `status` | `aguardando_instalacao` | `aguardando_aprovacao_cadastro` |

A autovistoria enxuta acima FIPE (Honda CG 150, FIPE R$ 12.474 ≥ R$ 9k mínimo de moto) com 2 fotos + vídeo 360° entrega o caso à fila de **Cadastro › Propostas Pendentes** para a etapa **"Liberar Roubo & Furto"** do `PropostaApprovalStepper` (regra canônica `cadastro-escopo-canonico` — `cadastroAvaliaFotos=true`). Marllon nunca passou por essa etapa: a sanitação manual anterior gravou `cadastro_aprovado=true`, `vistorias.status='aprovada'`, `veiculos.cobertura_roubo_furto=true`, fechou o serviço de autovistoria como `concluida` e promoveu a instalação a `concluida` antes da hora — por isso a tela `/cadastro/instalacoes/.../ativar` está oferecendo Ativar diretamente, sem que a R/F tenha sido decidida no Cadastro.

## Causa raiz

Duas camadas:

1. **Sanitação manual anterior** (turno passado) foi além do necessário: além de sincronizar `vistorias.video_360_url` (correto), também liberou R/F, aprovou cadastro e fechou serviço + instalação. Isso pulou a fila canônica do Cadastro.
2. **Sem trava no DB**: hoje é possível promover `instalacoes.status='concluida'` e `servicos.status='concluida'` (vistoria_entrada autovistoria) sem que `contratos.cadastro_aprovado=true` tenha sido obtido pelo caminho canônico. Não há guard que impeça reescrita manual avulsa.

## Plano de correção

### 1. Rewind do Marllon (migração de saneamento)

Migração SQL transacional revertendo todas as colunas acima e gravando trilha:

```sql
BEGIN;

UPDATE contratos
   SET cadastro_aprovado = false, aprovado_por = NULL, aprovado_em = NULL
 WHERE id = '226eacc0-1938-4b5e-9ae1-fa9c209875d8';

UPDATE veiculos
   SET cobertura_roubo_furto = false
 WHERE id = '7719dcaa-d842-483a-b8d4-b92e30880c70';

UPDATE vistorias
   SET status = 'pendente', analisado_em = NULL, analisado_por = NULL
 WHERE id = '9cf4aafa-b870-4b01-99b7-4c1aaafe88b8';

UPDATE servicos
   SET status = 'em_analise', concluida_em = NULL,
       analisado_em = NULL, analisado_por = NULL,
       observacoes_analise = NULL
 WHERE id = 'a003b188-3867-4f8d-9c71-64afe6a9dd43';

UPDATE instalacoes
   SET status = 'agendada', concluida_em = NULL
 WHERE id = 'e31076b8-fafd-489b-a015-57c17e4ffbef';

UPDATE cotacoes
   SET status_contratacao = 'aguardando_aprovacao_cadastro'
 WHERE id = 'b50180dc-e4f0-420f-8f08-a07175ef0212';

UPDATE associados
   SET status = 'aguardando_aprovacao_cadastro'
 WHERE id = 'd7b2d4c7-bf15-4c94-838f-0c6bb9db1463';

INSERT INTO associados_historico (associado_id, contrato_id, tipo, descricao, metadata)
VALUES ('d7b2d4c7-bf15-4c94-838f-0c6bb9db1463','226eacc0-1938-4b5e-9ae1-fa9c209875d8',
        'rewind_manual',
        'Caso devolvido à fila Cadastro › Propostas Pendentes para Aprovação de Roubo/Furto da autovistoria enxuta (regra canônica cadastro-escopo-canonico). Sanitação anterior havia liberado R/F sem decisão do Cadastro.',
        jsonb_build_object('placa','KRF8B74','cotacao_id','b50180dc-e4f0-420f-8f08-a07175ef0212'));

COMMIT;
```

Após o rewind, Marllon reaparece em **Cadastro › Propostas Pendentes** com a etapa "Liberar Roubo & Furto" pendente; um analista revisa fotos + vídeo e libera (ou recusa).

### 2. Correção na raiz — guards no DB

Para impedir que essa sequência se repita por sanitação manual ou bug futuro:

- **Trigger `trg_guard_instalacao_concluida_exige_cadastro_aprovado`** em `instalacoes BEFORE UPDATE`: se `NEW.status='concluida'` e o contrato vinculado tem `cadastro_aprovado=false`, levanta exceção `cadastro_nao_aprovado`.
- **Trigger `trg_guard_servico_autovistoria_concluida`** em `servicos BEFORE UPDATE`: bloqueia transição para `concluida` quando `tipo='vistoria_entrada' AND modalidade='autovistoria'` sem `vistorias.status='aprovada'` correspondente. Estado terminal correto da autovistoria enxuta após Cadastro liberar R/F é `aprovada` (já é o que `aprovar-proposta` faz no caminho canônico).
- **Trigger `trg_guard_cobertura_rf_exige_decisao_cadastro`** em `veiculos BEFORE UPDATE`: se `OLD.cobertura_roubo_furto=false` e `NEW.cobertura_roubo_furto=true`, exige que exista `vistorias.status='aprovada'` para o veículo OU que o contrato esteja `cadastro_aprovado=true`. Bloqueia atualizações avulsas.

Os três guards funcionam como rede de segurança — não alteram o caminho feliz (Cadastro libera via stepper → `aprovar-proposta` grava tudo na ordem certa), só impedem regressão por update direto.

### 3. Saneamento histórico (opcional, mesmo turno)

Query de auditoria para detectar outros casos com o mesmo perfil:

```sql
SELECT c.id, c.numero, v.placa, v.cobertura_roubo_furto, c.cadastro_aprovado
  FROM contratos c
  JOIN veiculos v ON v.id = c.veiculo_id
  JOIN vistorias vi ON vi.contrato_id = c.id
                   AND vi.modalidade = 'autovistoria'
 WHERE v.cobertura_roubo_furto = true
   AND vi.status <> 'aprovada';
```

Lista é apresentada para decisão (rewind em lote ou caso-a-caso) — fora do escopo desta correção automática.

### 4. Memória

Atualizar `mem://logic/operations/autovistoria-acima-fipe-libera-rf-nao-conclui-vistoria` com a nota: "R/F só pode ser liberado pelo Cadastro via stepper de Propostas Pendentes; sanitação manual NUNCA pode escrever `cobertura_roubo_furto=true` direto — os guards `trg_guard_*` bloqueiam".

## Detalhes técnicos

- A trigger guard `trg_protege_cadastro_aprovado` já existe contra regressão de `cadastro_aprovado=true→false`; precisamos permitir o UPDATE da sanitação. Solução: o UPDATE do passo 1 é executado como migration (admin / postgres role), e a trigger é ajustada para ignorar quando `current_setting('app.allow_rewind', true) = 'on'`, setado dentro da transação.
- Nenhum dado de PII ou financeiro é alterado; só fluxo operacional.
- Nenhuma mudança em frontend é necessária — `PropostasPendentes` já lê o filtro pelo estado revertido.

## Arquivos / migrações

- 1 migração SQL: rewind do Marllon + 3 triggers guard + ajuste em `trg_protege_cadastro_aprovado`.
- 1 atualização em `mem://logic/operations/autovistoria-acima-fipe-libera-rf-nao-conclui-vistoria` + index.

## Fora de escopo

- Refactor do `aprovar-proposta` (caminho feliz já está correto).
- UI nova de "Aprovação de R/F" separada — a etapa já existe dentro do `PropostaApprovalStepper`.
- Rewind em lote de outros casos suspeitos (depende de revisão humana da query do passo 3).