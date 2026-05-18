## Estado real do FVW6H66 (Eduardo Fernando)

| Entidade | Estado | Observação |
|---|---|---|
| `instalacoes` | **concluida** 16/05 12:05 | Rastreador `356430073984725` instalado |
| `servicos` (instalacao) | **aprovada** | Decisão do instalador OK |
| `vistorias` (entrada, presencial) | **em_analise** | ⚠️ **aguardando Monitoramento aprovar** |
| `contratos.cadastro_aprovado` | `true` | Cadastro aprovou em 15/05 |
| `contratos.status` | `assinado` | Será promovido a `ativo` quando Monitoramento aprovar |
| `associados.status` | `em_analise` | Idem |
| `veiculos.status` | `ativo` | ⚠️ promovido **prematuramente** por trigger pós-instalação |
| `veiculos.cobertura_total` / `roubo_furto` / `suspensa` | **false / false / false** | Coberturas só são religadas no `ativar-associado` |

**Resumo**: a instalação física + vistoria foram feitas (as 36 fotos provam), mas o caso **ainda não passou pela aprovação final do Monitoramento**, que é quem chama `ativar-associado`. Esse é o único motivo das coberturas estarem todas `false`. O fluxo está correto — falta apenas o operador do Monitoramento aprovar.

## A divergência visual tem causa diferente

Dois componentes leem fontes diferentes:

- **Drawer do associado** (`AssociadoDetalhe.tsx:882-887`) renderiza **"Cobertura Ativa"** baseado **apenas em `v.status === 'ativo'`** → ignora as flags reais de cobertura. Por isso pinta verde falso.
- **Listagem `/cadastro/associados`** usa `BadgeCoberturaCompact` (`BadgeCobertura.tsx:93-166`) que lê `cobertura_total/roubo_furto/suspensa` → mostra "Sem Cobertura" (correto).

## Plano de correção

### Frente A — Concluir o caso FVW6H66 (operacional, sem código)

1. Operador abre **Monitoramento › Aprovações › Aprovação de Associados**.
2. Localiza Eduardo Fernando (FVW6H66) — ele estará lá porque `vistoria.status='em_analise'`.
3. Aprova. A edge `ativar-associado` é chamada e:
   - Promove `associados/contratos/veiculos` para `ativo` de forma sincronizada.
   - Religa `cobertura_total` (instalação concluída + rastreador presente).
4. As 36 fotos já estão materializadas — nada a fazer no storage.

> Nenhuma migração de saneamento é necessária para esse caso. O dado está coerente com "aguardando Monitoramento".

### Frente B — Corrigir o badge falso do drawer (código)

Substituir o IIFE em `src/pages/cadastro/AssociadoDetalhe.tsx` (linhas 873-890) por um único componente canônico que lê as flags reais.

Comportamento alvo (mesma matriz do `BadgeCoberturaCompact`):

| Condição | Badge |
|---|---|
| `veiculosInadimplentes` contém o veículo | "Cobertura Suspensa (Nd)" — vermelho (mantém) |
| `cobertura_suspensa = true` | "Suspensa" — vermelho |
| `cobertura_total = true` | "Proteção 360º" — verde |
| `cobertura_roubo_furto = true` | "Roubo/Furto" — amarelo |
| nenhuma das anteriores | "Sem Cobertura" — cinza |

Reaproveita o `<BadgeCobertura>` (versão com label) já existente. Some o ramo `status === 'ativo' → "Cobertura Ativa"`, que é a fonte do falso positivo.

### Frente C — Garantir consistência semântica (opcional, baixa prioridade)

`veiculos.status='ativo'` enquanto `associado=em_analise` e `cobertura_total=false` é um estado conceitualmente inconsistente, mesmo que momentâneo. Avaliar (sem mudar agora):

- Por que o trigger pós-instalação está promovendo `veiculos.status` para `ativo` antes do Monitoramento? Memória diz que **não deveria** ("Triggers de pós-instalação NÃO ativam cobertura nem promovem veículo a 'ativo'"). Pode haver regressão em alguma trigger/função recente.
- Se for regressão real, abrir item separado para investigar a função/trigger responsável.

Não bloqueia este pedido. A Frente B já resolve o que o usuário vê.

## Detalhes técnicos (Frente B)

Arquivo único: `src/pages/cadastro/AssociadoDetalhe.tsx`

```tsx
// antes (linhas 873-890): IIFE com ramo falso "Cobertura Ativa"
// depois: delegar a um único componente
{(() => {
  const veicInad = situacao.veiculosInadimplentes.find(vi => vi.veiculoId === v.id);
  if (veicInad) {
    return (
      <Badge variant="destructive" className="text-[10px]">
        <ShieldOff className="h-3 w-3 mr-1" /> Cobertura Suspensa ({veicInad.diasAtraso}d)
      </Badge>
    );
  }
  return (
    <BadgeCobertura
      coberturaTotal={(v as any).cobertura_total}
      coberturaRouboFurto={(v as any).cobertura_roubo_furto}
      coberturaSuspensa={(v as any).cobertura_suspensa}
      coberturaSuspensaMotivo={(v as any).cobertura_suspensa_motivo}
      className="text-[10px]"
    />
  );
})()}
```

Garantir que o hook que carrega `veiculos` no drawer (`useAssociadoDetalhe` ou similar) inclui as colunas `cobertura_total, cobertura_roubo_furto, cobertura_suspensa, cobertura_suspensa_motivo` no `.select()` — verificar e adicionar se ausentes.

## Confirmação antes de aplicar

Aplico a **Frente B** (correção do badge) agora? A **Frente A** é operacional — basta o operador aprovar no Monitoramento que tudo se resolve sozinho.
