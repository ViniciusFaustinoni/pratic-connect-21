# Sincronização SGA — diagnóstico das 33 placas + correção em 4 frentes

## Estado atual (após últimas migrações)

| Bucket | Qtd | Placas |
|---|---|---|
| ✅ Já no SGA (sem ação) | 13 | PYN0C82, KOA4D63, LSQ6E05, KYS4C01, KWX3G43, PPC8C61, ZZZ3366, RFV2A76, LLR6D25, FOM7A27, KXV3F40, QXV0H02, QPC3C40 |
| 🟡 Sincronizado parcial (`pendente_sga`) | 1 | RMF4F15 |
| ⛔ Plano sem `codigo_sga_plano` | 6 | KPD8B52, KRH5G81, KYB9G10, LUJ9I51, PUS6J49, RVD2H32 |
| 🐞 Bug TDZ no edge function | 3 | KQR2A87, SRL5G88, TUF2F28 (HUGO) |
| 🔁 Pendente recuperável (>10 tent.) | 4 | HAT3D43, KXD6881 (VITÓRIA), LRA9681, KWX4D43 |
| 🆕 Nunca enfileirado | 5 | KPJ4994, KPQ8J26, QUB1B14, TUB9C24, TUM3D59 |
| 👯 Duplicidade de chassi | 2 | KXD6881 (FABIO LENO), TUF2F28 (MATHEUS) |
| 👻 Não existe na base | 1 | RUP6G12 |

## Causas-raiz confirmadas

1. **Bug TDZ** em `supabase/functions/sga-hinova-sync/index.ts`: as linhas 895 e 903 usam `codigoAssociadoHinova` antes da declaração na linha 949 → erro `Cannot access 'codigoAssociadoHinova' before initialization` para todo veículo cujo contrato cai nos caminhos "vendedor sem código SGA" / "contrato sem vendedor".
2. **Planos "5%" sem `codigo_sga_plano`**: 17 planos têm `codigo_sga_plano = NULL`. A função aborta com `falha_permanente`/`plano_sem_codigo_sga`. Sem o código real do Hinova, **não é possível resolver via código** — depende da diretoria fornecer o mapeamento.
3. **Veículos órfãos da fila**: criados antes da fila existir ou por aprovação que não emitiu o evento. Precisam de inserção manual em `sga_sync_queue`.
4. **Duplicidade de chassi**: dois associados ativos com mesmo chassi. Operacional, não técnico.

## Ações que serão executadas (após aprovação)

### Frente 1 — Fix do bug TDZ (raiz)
Mover, em `sga-hinova-sync/index.ts`, a declaração `let codigoAssociadoHinova: number | null = (associado as any)?.codigo_hinova ?? null;` para o início do bloco (antes do PASSO 3.5, linha ~830) e remover a re-declaração com `let` na linha 949 (vira atribuição). Sem mudança de semântica.

### Frente 2 — Enfileirar os 5 órfãos
Migração que faz `INSERT … ON CONFLICT DO UPDATE` em `sga_sync_queue` para os veículos:
- KPJ4994 (cde763e9-eb0e-4c23-bbb2-8a38de21264b)
- KPQ8J26 (04a5ca1f-c01f-4a95-9d58-a4c8bf713d96)
- QUB1B14 (dc8c73bf-7bd9-45a8-9950-5453e23fe632)
- TUB9C24 (3d78f886-77f4-4db8-927b-820d905b1f26)
- TUM3D59 (55c2f9bc-9c16-4e63-a838-d2fbe143d5aa)

Status `pendente`, `tentativas=0`, `proximo_reenvio_em=now()`.

### Frente 3 — Resetar fila dos recuperáveis e disparar sync
Para HAT3D43, KXD6881 (VITÓRIA), LRA9681, KWX4D43, KQR2A87, SRL5G88, TUF2F28 (HUGO), RMF4F15 e os 5 órfãos da Frente 2: zerar `tentativas` e `proximo_reenvio_em=now()`. Em seguida, invocar a edge function `sga-hinova-sync` para cada `veiculo_id` (script único disparando em série, com log do resultado).

### Frente 4 — Bloqueios não-técnicos (relatório, sem ação automática)
- **6 placas com plano 5% sem código**: aguardando diretoria informar o `codigo_sga_plano` real de cada um dos 17 planos. Vou listar os planos no relatório final para vocês preencherem.
- **2 duplicidades de chassi**: precisa decisão de operações sobre qual associado é válido.
- **RUP6G12**: não existe na base — operações precisa investigar.

## Entregáveis após execução

1. Patch em `supabase/functions/sga-hinova-sync/index.ts` (movimento da `let`).
2. Migração SQL com os `INSERT/UPDATE` em `sga_sync_queue` (Frente 2 + reset da Frente 3).
3. Relatório final (no chat) mostrando, placa a placa, o resultado do disparo do `sga-hinova-sync`: quantas conseguiram subir, quantas voltaram com erro novo, e a lista dos bloqueios remanescentes para serem tratados manualmente no SGA pela operação.

## O que não será feito sem decisão da diretoria
- **Não** vou inventar `codigo_sga_plano` para os 17 planos 5%.
- **Não** vou cancelar/excluir as duplicidades de chassi.
- **Não** vou criar registro de RUP6G12.