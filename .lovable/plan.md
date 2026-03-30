

# Dropdown Dinâmico de Tipos baseado no Plano + IA WhatsApp

## Contexto

Hoje os modais de criação de sinistro e assistência usam listas hardcoded de tipos (`TIPO_SINISTRO_OPTIONS`, `TIPOS_SERVICO`). O pedido é que:

1. O dropdown de tipo só apareça **após** selecionar associado/veículo
2. O dropdown mostre **apenas** coberturas/benefícios vinculados ao plano do associado
3. A IA do WhatsApp também entenda e use as coberturas/benefícios do plano
4. Ao criar o evento, já registre quais coberturas/benefícios foram acionados (tabela `sinistro_coberturas_utilizadas`)

## Mapeamento entre coberturas e tipos

As coberturas no catálogo global (`coberturas`) possuem `codigo` (ex: `COB-COL`, `COB-RF`, `COB-INC`, `COB-VID`). Os benefícios (`benefits`) possuem `name` (ex: `Assistência 24h`, `Carro Reserva`). Será necessário criar um mapeamento entre esses códigos e os tipos de sinistro/assistência do sistema.

## Alterações

### 1. Hook: `useCoberturasBeneficiosPlano(associadoId)`

Novo hook que, dado um `associado_id`:
- Busca `plano_id` do associado
- Busca coberturas via `planos_coberturas` + join `coberturas`
- Busca benefícios via `planos_beneficios` + join `benefits`
- Retorna lista formatada com `{ id, nome, tipo: 'cobertura'|'beneficio', codigo }`

### 2. `NovoSinistroModal.tsx` — Dropdown dinâmico

- Mover a seção "Dados do Sinistro" (tipo, data, local) para **depois** da seleção de veículo
- Ocultar campos de tipo quando `!selectedVeiculo`
- Substituir `TIPO_SINISTRO_OPTIONS` hardcoded por coberturas do plano do associado
- Mapeamento: `COB-COL → colisao`, `COB-RF → roubo`, `COB-INC → incendio`, etc.
- Manter opção "Outro" como fallback
- Ao submeter, inserir automaticamente em `sinistro_coberturas_utilizadas` a cobertura selecionada

### 3. `NovoChamadoModal.tsx` — Dropdown dinâmico

- Mover o campo "Tipo de Serviço" para **depois** da seleção de veículo
- Ocultar quando `!veiculoSelecionado`
- Substituir `TIPOS_SERVICO` hardcoded por benefícios do plano que sejam de assistência (Reboque, Chaveiro, etc.)
- Mapeamento: `Assistência 24h → reboque/chaveiro/etc.` ou listar os benefícios diretamente
- Manter "Outros" como fallback
- Em modo manual, manter a lista completa (não tem plano para filtrar)

### 4. `whatsapp-webhook/index.ts` — Contexto do plano na IA

**Em `getAssociadoContext`**: Adicionar busca de coberturas e benefícios do plano:
```
## COBERTURAS DO PLANO
- Colisão (COB-COL)
- Roubo/Furto (COB-RF)
- Vidros e Faróis (COB-VID)

## BENEFÍCIOS DO PLANO
- Assistência 24h (Guincho, Chaveiro, Pane)
- Carro Reserva 7 dias
```

**No system prompt**: Adicionar regra para a IA verificar se o tipo de sinistro solicitado está nas coberturas do plano antes de criar.

**No tool `criar_solicitacao_sinistro`**: Após criar o sinistro, inserir automaticamente em `sinistro_coberturas_utilizadas` a cobertura correspondente ao tipo.

**No tool `criar_solicitacao_assistencia`**: Idem para benefícios de assistência.

### 5. Inserção automática de coberturas utilizadas

Tanto no modal manual quanto na IA do WhatsApp, ao criar sinistro/assistência:
- Buscar a cobertura/benefício correspondente ao tipo selecionado
- Inserir registro em `sinistro_coberturas_utilizadas` com `valor: 0` (custo real será preenchido na conclusão)

## Fluxo visual

```text
Modal Sinistro:
  1. Selecionar associado
  2. Selecionar veículo
  3. → Sistema carrega coberturas do plano
  4. → Dropdown "Tipo" aparece com apenas as coberturas do plano
  5. Preencher demais dados
  6. → Ao salvar: cria sinistro + registra cobertura utilizada

IA WhatsApp:
  1. Associado relata evento
  2. → IA consulta contexto (com coberturas do plano)
  3. → IA identifica tipo baseado nas coberturas disponíveis
  4. → Ao criar sinistro via tool: registra cobertura utilizada
```

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/hooks/useCoberturasBeneficiosPlano.ts` | Novo hook para buscar coberturas/benefícios do plano |
| `src/components/eventos/NovoSinistroModal.tsx` | Dropdown dinâmico, ocultar até veículo selecionado, inserir cobertura utilizada |
| `src/components/assistencia/NovoChamadoModal.tsx` | Dropdown dinâmico, ocultar até veículo selecionado |
| `supabase/functions/whatsapp-webhook/index.ts` | Enriquecer contexto com coberturas/benefícios; inserir cobertura ao criar sinistro/assistência |

