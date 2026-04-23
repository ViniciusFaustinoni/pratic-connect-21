

## Mover botões de sincronização financeira: Cadastro → Cobranças

### Resumo

Existem **3 pontos de sync financeiro SGA** espalhados hoje. Você quer concentrar tudo em **Cobranças**, removendo da área de **Cadastro**. Como o sync escreve em `cobrancas` (mesma tabela usada pelo módulo de Cadastro via `VeiculoFinanceiroSGA`), os dados continuam aparecendo lá automaticamente — só some o **botão de disparo**.

### Mapeamento atual

| Onde | Componente | Função |
|---|---|---|
| **Cadastro › Base Antiga** (header) | `<SgaBackfillFinanceiroDialog />` em `BaseAntiga.tsx:97` | Dialog completo (status fila, enfileirar, processar, reagendar erros) |
| **Cadastro › Veículo (modal) › aba Financeiro SGA** | Botão "Atualizar agora" em `VeiculoFinanceiroSGA.tsx:160-167` | Sync individual do veículo aberto |
| **Cobrança › Régua** | Botão "Sincronizar" por linha de falha SGA em `ReguaCobranca.tsx:216-254` | Já existe (mantém) |

### Alterações (3 arquivos)

**1. `src/pages/cadastro/BaseAntiga.tsx`** — remover linha 97 e import 16:
```tsx
// remover: import { SgaBackfillFinanceiroDialog } from '@/components/cadastro/SgaBackfillFinanceiroDialog';
// remover: {(isDiretor || isAdminMaster || isDesenvolvedor) && <SgaBackfillFinanceiroDialog />}
```

**2. `src/components/cadastro/VeiculoFinanceiroSGA.tsx`** — remover botão "Atualizar agora" e a `useMutation sincronizar` (linhas 74-89, 160-167). Substituir o header (linhas 139-168) por uma versão **apenas de leitura** com nota:
> "Para sincronizar, acesse Cobranças › [novo local]."

A query de cobranças (linha 60) e os totais permanecem — continuam refletindo o que vier de qualquer sync feito a partir do módulo de Cobranças.

**3. `src/pages/cobranca/CobrancaDashboard.tsx`** — adicionar `<SgaBackfillFinanceiroDialog />` no header (após linha 222), atrás do mesmo guard de role (`isDiretor || isAdminMaster || isDesenvolvedor`). Mover **fisicamente** o componente de `src/components/cadastro/SgaBackfillFinanceiroDialog.tsx` para `src/components/cobranca/SgaBackfillFinanceiroDialog.tsx` para manter a organização por domínio. Atualizar o import em `BaseAntiga.tsx` (já removido) — sem outros consumidores.

### O que NÃO muda

- Nenhuma edge function alterada — `sga-sync-financeiro-veiculo`, `sga-backfill-financeiro`, `sga-backfill-massa-orquestrador` continuam idênticas.
- Tabela `cobrancas` e trigger `trg_mirror_cobranca_sga` continuam populando dados para a aba "Financeiro SGA" do modal de Cadastro (só não há botão de disparar lá).
- `ReguaCobranca.tsx` mantém o botão "Sincronizar" por linha (é granular, contextual à falha — diferente do bulk).
- Permissões (Diretor/AdminMaster/Desenvolvedor) idênticas.

### Validação

1. Login `admin@teste.com / 123456789`.
2. Cadastro › Base Antiga: header sem botão "Sincronizar Financeiro". ✅
3. Cadastro › abrir veículo › aba "Financeiro SGA": sem botão "Atualizar agora", dados visíveis. ✅
4. Cobrança › Dashboard: novo botão "Sincronizar Financeiro" no header, abre dialog completo. ✅
5. Disparar sync pelo dialog → reabrir modal de cadastro do veículo → cobranças atualizadas. ✅

