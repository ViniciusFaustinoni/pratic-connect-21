

# Adicionar Etapas do Reparo ao Modal de Orcamento

## Resumo

Adicionar uma secao "Etapas Necessarias para o Reparo" no modal de orcamento do regulador (`VistoriaEventoOrcamento.tsx`), permitindo selecionar uma ou mais etapas de uma lista fixa e ordenada. As etapas selecionadas serao salvas junto com os demais dados no campo JSONB `dados_vistoria`.

---

## Arquivos a modificar

### 1. `src/components/regulador/VistoriaEventoOrcamento.tsx`

**Adicionar estado para etapas:**
- Novo estado `etapasReparo` (array de strings) para armazenar as etapas selecionadas

**Constante com lista fixa de etapas:**
```text
ETAPAS_REPARO = [
  { id: 'lanternagem', nome: 'Lanternagem', descricao: 'Chaparia e estrutura da carroceria...' },
  { id: 'pintura', nome: 'Pintura', descricao: 'Aplicacao de primer, tinta e verniz...' },
  { id: 'mecanica', nome: 'Mecanica', descricao: 'Reparos no motor, cambio, suspensao...' },
  { id: 'eletrica', nome: 'Eletrica', descricao: 'Fiacao, modulos, sensores, farois...' },
  { id: 'polimento', nome: 'Polimento', descricao: 'Acabamento final da pintura...' },
  { id: 'lavagem', nome: 'Lavagem', descricao: 'Limpeza completa antes da entrega' },
]
```

**Nova secao no modal** (entre "Diagnostico" e "Itens do Orcamento"):
- Titulo "Etapas Necessarias para o Reparo"
- 6 checkboxes, cada uma mostrando nome e descricao breve
- A ordem e sempre fixa (1 a 6), independente da ordem de clique
- Resumo visual da sequencia selecionada com setas: "Lanternagem -> Pintura -> Polimento -> Lavagem"
- A secao aparece apenas quando `tipoDano === 'parcial'` (perda total nao tem reparo)

**Validacao:**
- Quando dano parcial, obrigatorio selecionar pelo menos 1 etapa
- Adicionar check em `handleFinalizar`

**Salvar no payload:**
- Adicionar `etapas_reparo: etapasReparo` ao objeto `dados` enviado na finalizacao

### 2. `supabase/functions/salvar-vistoria-regulador/index.ts`

**Adicionar campo na acao "finalizar":**
- Na construcao de `dadosFinais` (linha ~181-190), incluir:
  `etapas_reparo: dados.etapas_reparo || []`

---

## Detalhes de implementacao

**Logica de ordenacao:** Ao renderizar a sequencia visual, filtrar `ETAPAS_REPARO` pelas selecionadas mantendo a ordem original da constante. A Lavagem sempre fica por ultimo naturalmente pois ja e a ultima na lista.

**UI da secao:**
- Checkboxes usando o componente `Checkbox` do shadcn
- Cada checkbox com label (nome em negrito) + descricao em texto menor
- Abaixo dos checkboxes, um resumo visual com badges conectadas por setas

**Sem migracao de banco:** O campo `etapas_reparo` sera armazenado dentro do JSONB `dados_vistoria` que ja existe, sem necessidade de alterar schema.

## Arquivos afetados

| Acao | Arquivo |
|---|---|
| Modificar | `src/components/regulador/VistoriaEventoOrcamento.tsx` |
| Modificar | `supabase/functions/salvar-vistoria-regulador/index.ts` |

