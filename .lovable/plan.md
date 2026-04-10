

## Plano: Adicionar tipo de servico REVISTORIA ao sistema de campo

### Contexto
O sistema possui um enum `tipo_servico` no Postgres com 7 valores. Precisamos adicionar `revistoria` como novo tipo. Na visao do tecnico, a revistoria segue o mesmo fluxo da vistoria de instalacao (mesmas fotos, checklist), mas SEM instalar rastreador. O coordenador de monitoramento agenda manualmente, como qualquer outro servico de campo.

### Alteracoes

**1. Migracao SQL** — Adicionar valor ao enum
```sql
ALTER TYPE tipo_servico ADD VALUE 'revistoria';
```

**2. `src/hooks/useServicos.ts`** — Registrar tipo no TypeScript
- Adicionar `'revistoria'` ao union type `TipoServico`
- Adicionar label: `revistoria: 'Revistoria'` em `TIPO_SERVICO_LABELS`
- Criar helper `isRevistoria(tipo)` que retorna `tipo === 'revistoria'`

**3. `src/components/vistoriador/TarefaAtualCard.tsx`** — Roteamento do tecnico
- No `handleExecutar`, tratar `isRevistoria` redirecionando para `/instalador/vistoria/:id` (fluxo de vistoria completa, mesmas fotos, sem instalar rastreador)

**4. `src/types/servicos-rota.ts`** — Adicionar ao tipo de servico de rotas
- Incluir `'revistoria'` no union `TipoServico` e nos maps de labels/cores/icones

**5. `src/components/monitoramento/AtribuicaoManualTab.tsx`** e demais listagens
- Atualizar condicoes que fazem `tipo === 'instalacao' ? ... : 'Vistoria'` para incluir revistoria com label proprio

**6. Demais pontos de referencia** (labels, badges, filtros):
- `src/components/monitoramento/estoque/DetalhesRastreadorDialog.tsx` — adicionar revistoria ao map de labels
- Views de mapa e filtros que referenciam tipos — incluir revistoria como tipo valido
- `src/components/ui/SlaIndicador.tsx` — mapear SLA da revistoria (mesmo prazo de instalacao)

### Na visao do tecnico
A revistoria usa o fluxo `/instalador/vistoria/:id` (ExecutarVistoriaCompleta) — mesmas fotos e checklist de uma vistoria de instalacao. A diferenca e que NAO ha etapa de instalar rastreador (que ja e tratada apenas no fluxo `/instalador/instalacao/:id`).

### Criacao manual pelo coordenador
O coordenador ja possui mecanismos para criar servicos de outros tipos (manutencao, retirada). A revistoria seguira o mesmo padrao — sera incluida como opcao nos modais/formularios de criacao manual de servico no modulo de monitoramento.

