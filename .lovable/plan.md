# Auditoria Completa: Planos, Benefícios e Precificação

## Resumo

A maioria dos fluxos de planos/benefícios já é dinâmica. Restam 4 áreas pendentes: `pricing.ts` estático, `formatarMoeda` duplicada/espalhada, valores FIPE/idade hardcoded, e níveis hardcoded em `EscolhaPlano.tsx`.

---

## ✅ CORRIGIDO (não mexer)

- `PlanosAdmin.tsx` — CRUD dinâmico de planos, benefícios, coberturas, linhas
- `usePlanosCotacao.ts` — Hook principal dinâmico
- `useCalcularCotacao.ts` — Busca planos e tabelas_preco do banco
- `CotacaoDetalhe.tsx` — Dados do hook
- `PlanoCardComparativo` / `PlanoDetalhesModal` — Props dinâmicas
- `ContratoDetalhe.tsx` — Dinâmico
- `Cotador.tsx` — Usa PlanoCotacao direto
- `AppPlano.tsx` — Benefícios/coberturas do banco via planos_beneficios + benefits
- `CardPlano.tsx` — Recebe benefícios/coberturas como props
- `useMyData.ts` — Select expandido com coberturas + planos_beneficios
- `ComparadorNiveis.tsx` — Dinâmico (usa `usePlans` + `useProductLines` do banco)
- `CotacaoPublicaCompleta.tsx` — Dinâmico (define `formatarMoeda` local, sem pricing.ts)

---

## 🟡 PENDENTE

### 1. ✅ `pricing.ts` — REMOVIDO

Arquivo `src/data/planosPrecos.ts` deletado. Todos os dados migrados para `configuracoes` (JSON) e hooks dinâmicos em `useConteudosSistema.ts`.

### 2. ✅ `formatarMoeda` duplicada — CORRIGIDO

Centralizada em `src/utils/format.ts`.

### 3. ✅ Valores FIPE/idade hardcoded — CORRIGIDO

### 4. ✅ Níveis hardcoded em `EscolhaPlano.tsx` — CORRIGIDO

### 5. ✅ Veículo Blindado — CORRIGIDO

### 6. ✅ Benefícios/preços hardcoded em StepBeneficios + StepFinanceiro — CORRIGIDO

Hook `useBeneficiosAdicionaisCotacao` busca de `beneficios_adicionais`. Taxa de substituição via `useTaxaSubstituicao()` lê de `configuracoes`.

### 7. ✅ Regiões/fallbacks hardcoded em usePlanosCotacao — CORRIGIDO

Multiplicador de região via `useRegioesAtivas()`. Fallbacks via `useTaxaFallbackCarro/Moto()`. Decomposição via `useConfigDecomposicao()`. Todos leem de `configuracoes`.

### 8. ✅ Fallback hardcoded em useCalcularCotacao — CORRIGIDO

Busca `taxa_fallback_carro` de `configuracoes` em paralelo com planos.

### 9. ✅ Categorização hardcoded em Cotacoes.tsx — CORRIGIDO

Removido mapa CATEGORIAS_BENEFICIOS de 35 termos. Substituído por função `categorizarPorTermo()` simplificada.

### 10. ✅ restricoesCategorias.ts — SIMPLIFICADO

### 12. ✅ Linhas de produto hardcoded — MIGRADO PARA BANCO

`LINHAS_PLANO` em `PlanosConfig.tsx` substituído por `useProductLines()`. Linha "Select One" adicionada à tabela `product_lines`.

### 13. ✅ Regiões hardcoded — MIGRADO PARA BANCO

`REGIOES` em `EtapaDadosVeiculo.tsx`, `EtapaCriteriosCotacao.tsx`, `EtapaResultado.tsx` substituídos por `useRegioesAtivas()`.

### 14. ✅ Lógica de negócio hardcoded em usePlanosCotacao — CORRIGIDO

- `linha === 'advanced'` → `vehicle_type` da tabela `product_lines`
- `linha === 'lancamento'` → `requires_recent_year` da tabela `product_lines`
- Ordenação `linha === 'select'` → `sort_priority` da tabela `product_lines`
- Mapeamento manual de códigos de região removido (usa `regioes.codigo` diretamente)

### 15. ✅ LINHA_CORES hardcoded em PlanoCardSelecao — CORRIGIDO

`gradient_class` adicionado à tabela `product_lines`. Fallback mantido no componente.

### 16. ✅ CATEGORIAS_VEICULO hardcoded — MIGRADO PARA BANCO

Categorias inseridas na tabela `configuracoes` (chave `categorias_veiculo`). Hook `useCategoriasVeiculo()` criado. `VehicleCategorySelect` agora busca do banco com fallback.

### 17. ✅ OBSERVACOES_CATEGORIA hardcoded — MIGRADO PARA BANCO

Observações inseridas na tabela `configuracoes` (chave `observacoes_categoria`). Hook `useObservacoesCategoria()` criado.

### 18. ✅ Template WhatsApp hardcoded — MIGRADO PARA BANCO

Template de benefícios inserido na tabela `configuracoes` (chave `template_whatsapp_cotacao`). Hook `useTemplateWhatsappCotacao()` criado.

Removido `RESTRICOES_CATEGORIA` estático. Todas as funções agora usam apenas dados do banco (`benefit_category_exclusions`).

### 11. ✅ Dados de referência (glossário, regras, contatos, veículos aceitos) — MIGRADOS

Todos inseridos como JSON em `configuracoes`. Hooks: `useGlossario()`, `useRegrasImportantes()`, `useCotasTaxas()`, `useTaxasProcedimentos()`, `useContatos()`, `useVeiculosAceitos()`, `useMotosAceitas()`.

### 3. ✅ Valores FIPE/idade hardcoded — CORRIGIDO

Criado hook `useConfigLimitesVeiculo` que lê 4 chaves da tabela `configuracoes`:
- `fipe_limite_autorizacao` (120000) — usado em StepNovoVeiculo, SubstituicoesPendentesPage, SubstituicaoDetalhePage
- `perfil_veiculo_idade_limite` (15), `perfil_veiculo_fipe_minimo` (15000), `perfil_veiculo_fipe_maximo` (500000) — VeiculoPerfilAlert


### 4. ✅ Níveis hardcoded em `EscolhaPlano.tsx` — CORRIGIDO

Refatorado para usar mapa extensível `NIVEL_CONFIG` com fallback automático para novos níveis. Tipos `nivel` flexibilizados de union literal para `string`. Novos níveis adicionados ao mapa são automaticamente suportados sem alterar componentes.

### 5. ✅ Veículo Blindado — Autorização da Diretoria — CORRIGIDO

Blindado deixou de ser aditivo contratual e passou a exigir autorização da diretoria:
- Coluna `blindado` (boolean) adicionada à tabela `veiculos`
- Chave `aceitar_blindado` = `autorizar` inserida na tabela `configuracoes`
- Hook `useConfigLimitesVeiculo` atualizado com `blindadoPolicy`
- Toggle "Veículo blindado?" adicionado no `StepNovoVeiculo.tsx` com alerta
- Alerta + checkbox de confirmação adicionado no `SubstituicaoDetalhePage.tsx`
- Removido `veiculo_blindado` do sistema de aditivos (tipo, hook, form, labels, edge function)
- Corrigido `GerarTermo.tsx` que passava `blindado: false` hardcoded


---

## ❌ NÃO FAZER AGORA

- Tabelas novas de regras de aceitação — complexidade alta, sem demanda imediata
- Página de autorizações da diretoria — depende das tabelas acima
- Campos de vistoria (rebaixado/turbinado) — escopo separado
- Módulo financeiro completo para custos de reboque (tabela dedicada de despesas operacionais)

---

## 📋 ORDEM DE EXECUÇÃO SUGERIDA

1. **Unificar `formatarMoeda`** → cria `src/utils/format.ts`, substitui 5+ locais (rápido, zero risco)
2. **Migrar `pricing.ts`** → refatorar `QuoteCalculatorModal` + `useCotacaoAvancada` para hooks dinâmicos
3. **Dinamizar limites FIPE/idade** → inserir chaves em `configuracoes`, criar hook, substituir hardcoded
4. **Níveis `EscolhaPlano`** → mover metadata de nível para banco (se necessário)

---

# Visibilidade por Equipe — Supervisor de Vendas

## ✅ CORRIGIDO

### Tabela `equipes_comerciais`
- Criada com `supervisor_id` e `vendedor_id` (refs auth.users), UNIQUE constraint
- RLS: supervisor/vendedor veem seus vínculos; gerência vê todos; apenas gerência pode INSERT/DELETE

### Função `is_supervisor_of(_vendedor_id)`
- SECURITY DEFINER, verifica se `auth.uid()` é supervisor do vendedor
- Converte `vendedor_id` (profile.id) → `user_id` via subquery no uso RLS

### RLS de `leads` atualizada
- SELECT: `is_gerencia OR vendedor_id = get_my_profile_id() OR vendedor_id IS NULL OR is_supervisor_of(user_id do vendedor)`
- UPDATE/DELETE: mesma lógica (sem vendedor_id IS NULL)

### RLS de `cotacoes` atualizada
- UPDATE agora inclui `has_role(auth.uid(), 'supervisor_vendas')`

### Hook `useEquipeComercial`
- `useMinhaEquipe()` — retorna membros da equipe do supervisor logado com nomes
- `useMinhaEquipeProfileIds()` — retorna profile IDs para filtro client-side
- `useEquipesComerciais()` — retorna todos os vínculos (para gerência)
- Mutations: `useAdicionarVendedorEquipe`, `useRemoverVendedorEquipe`

### `usePermissions` atualizado
- Adicionado `isSupervisorVendas` e `canManageEquipe`

### `useVendasMetricas` atualizado
- Aceita `equipeProfileIds` opcional para filtrar métricas por equipe do supervisor

### KanbanCard com badge do vendedor
- Prop `showVendedor` no `LeadKanbanCard` e `KanbanBoard`
- Exibe badge `👤 NomeVendedor` quando supervisor ou gerência está visualizando

---

## 🟡 PENDENTE

### Tela de gerenciamento de equipe
- UI para vincular/desvincular vendedores a supervisores
- Acessível em configurações ou rota dedicada

---

# Fluxo de Assistência 24h — Reboque

## ✅ CORRIGIDO

### Gap 1 — Valor sugerido na mensagem inicial
Edge function `despacho-reboque-disparar` agora inclui `💰 Valor sugerido: R$ X` na mensagem broadcast quando disponível.

### Gap 2 — Contato do associado para o reboquista
Na atribuição, o reboquista agora recebe nome e telefone do associado na mensagem WhatsApp.

### Gap 3 — Tela de conclusão com anexo de imagens
Seção "Concluir Serviço" adicionada ao `CardDespachoReboque.tsx`:
- Upload múltiplo de fotos usando `useFotosReboquista`
- Campo de observação
- Atualiza status do chamado para `concluido`
- Registra no histórico e no status log do reboque

### Gap 4 — Integração financeira (parcial)
O `valor_atribuido` já está registrado no `despacho_reboque`. A conclusão atualiza o status para `concluido`, visível nos relatórios existentes. Integração com módulo financeiro completo adiada.
