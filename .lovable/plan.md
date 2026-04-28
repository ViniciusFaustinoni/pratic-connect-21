# Fix: Realocar (erro de tipo) + duplicidade na tela de Serviços de Campo

## Causa raiz dos problemas

### 1. Erro `type "periodo_atendimento" does not exist`
A RPC `realocar_servico` (migração `20260428125905`) faz cast para `periodo_atendimento::periodo_atendimento` em duas linhas, mas esse enum **não existe** no banco. Os enums reais, verificados via `information_schema`, são:

| Tabela | Coluna | Enum real |
|---|---|---|
| `public.servicos` | `periodo` | `periodo_servico` |
| `public.instalacoes` | `periodo` | `periodo_instalacao` |

Ambos têm os mesmos labels (`manha`, `tarde`, `noite`), mas são tipos distintos. Por isso qualquer reatribuição/realocação que passe pelo update de `servicos` ou `instalacoes` quebra com o erro mostrado no print.

### 2. Botões duplicados no `ServicoDetailModal`
Hoje o cabeçalho do modal mostra três ações que se sobrepõem semanticamente para o operador:

- **Realocar** → abre `RealocarInstalacaoDialog` (fila/rota/base) — chama `realocar_servico`.
- **Devolver à fila** (`DevolverFilaButton`) → mesma operação que “Realocar → Fila”, só que com UI separada.
- **Liberar serviço** (`LiberarServicoButton`) → chama `liberar_servico_admin`, que **cancela** o serviço (status `cancelada`). Tecnicamente diferente, mas o nome confunde com “liberar para outro técnico”.

A consequência é a percepção de duplicidade e o bug do usuário (ele clicou em “Reatribuir” do diálogo do Devolver e recebeu o erro de tipo).

## Correções (raiz)

### A) Migração SQL — corrigir os casts
Nova migração que recria `realocar_servico` substituindo:

```sql
periodo = _periodo_alvo::periodo_atendimento   -- ❌ tipo inexistente
```
por:
```sql
-- em servicos:
periodo = _periodo_alvo::periodo_servico
-- em instalacoes:
periodo = _periodo_alvo::periodo_instalacao
```

Sem mudança de assinatura, sem mudança de comportamento — apenas corrige o cast. Os wrappers `liberar_servico_para_reatribuicao` e `reatribuir_servico_admin` continuam funcionando porque só repassam parâmetros.

### B) Modal — eliminar duplicidade real e renomear ação destrutiva
Em `src/components/servicos-campo/ServicoDetailModal.tsx`:

1. **Remover o botão `DevolverFilaButton`** do cabeçalho. A funcionalidade “devolver à fila” já está coberta pela aba “Fila” do `RealocarInstalacaoDialog` (botão Realocar). Fonte única.
2. **Renomear “Liberar serviço” → “Cancelar serviço”** (e ícone para algo destrutivo, ex.: `Ban`/`XCircle`), com `variant="destructive"` discreto. Isso alinha o rótulo à ação real (cancelamento administrativo) e elimina a confusão com a ação de realocação.
3. Manter `ConcluirPrestadorExternoButton` como está (caso distinto: marcar como feito).

Em `src/components/servicos-campo/LiberarServicoButton.tsx`:
- Trocar texto do botão para “Cancelar serviço”.
- Trocar texto do diálogo: título “Cancelar serviço administrativamente?”, descrição enfatizando que isso **cancela** o serviço e libera o técnico (sem reatribuir).
- Comportamento e RPC (`liberar_servico_admin`) **inalterados** — já faz exatamente isso.

### C) Limpeza opcional (sem remover arquivo)
`DevolverFilaButton.tsx` deixa de ser referenciado pelo modal. Mantemos o arquivo por enquanto (a aba `AtribuicaoManualTab` ainda pode usar para destravar tarefas em massa). Se grep mostrar zero usos após a remoção, removemos numa segunda passada.

## Arquivos afetados

- **Nova migração** `supabase/migrations/<timestamp>_fix_realocar_servico_periodo_cast.sql` — recria `realocar_servico` com casts corretos.
- `src/components/servicos-campo/ServicoDetailModal.tsx` — remove `DevolverFilaButton` do header.
- `src/components/servicos-campo/LiberarServicoButton.tsx` — renomeia para “Cancelar serviço” e ajusta copy do diálogo.

## O que não muda (garantias)

- Assinatura das RPCs `realocar_servico`, `liberar_servico_admin`, `liberar_servico_para_reatribuicao`, `reatribuir_servico_admin`.
- Hook unificado `useRealocarInstalacao` e seus aliases em `useAtribuicaoManual`.
- Fluxos de instalação, manutenção, vistoria base e vistoria agendada (nenhuma lógica de execução é tocada).
- `DevolverFilaButton` continua disponível para a aba de atribuição manual (não é apagado).

Após aprovação, aplico a migração e os dois ajustes de UI.