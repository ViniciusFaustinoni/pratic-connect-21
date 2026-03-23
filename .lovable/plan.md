

# Plano: Mapa de Atendimento — Inteligência Geográfica por Município

## Resumo

Criar tabela `municipios_atendimento` com classificação por tipo (volante/viagem/prestador/fora de cobertura), nova aba "Mapa de Atendimento" na Gestão Comercial da Diretoria, pré-carga dos municípios do RJ, e acoplamento na Cotação e no Cadastro.

---

## PARTE 1 — Tabela `municipios_atendimento`

```sql
CREATE TABLE municipios_atendimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  uf text NOT NULL DEFAULT 'RJ',
  tipo_atendimento text NOT NULL CHECK (tipo_atendimento IN ('volante','viagem','prestador','fora_cobertura')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(nome, uf)
);
ALTER TABLE municipios_atendimento ENABLE ROW LEVEL SECURITY;
-- select para authenticated, insert/update/delete para admins
```

---

## PARTE 2 — Nova aba "Mapa de Atendimento" na Gestão Comercial

**Novo arquivo**: `src/components/gestao-comercial/MapaAtendimento.tsx`

- Lista de municípios da tabela `municipios_atendimento`
- Busca por nome + filtro por tipo de atendimento
- Cada linha: nome, UF, seletor de tipo (volante/viagem/prestador/fora_cobertura) com update inline
- Botão "Adicionar Município" para inserir novo
- Quando lista vazia: card com botão "Importar classificação padrão RJ" que insere os ~84 municípios com classificação pré-definida (hardcoded no componente)
- Toast de sucesso ao salvar

**Arquivos editados**:
- `TabNavigation.tsx`: adicionar aba 8 "Mapa de Atendimento" (icon: `Globe`)
- `GestaoComercial.tsx`: `{activeTab === 8 && <MapaAtendimento />}`

---

## PARTE 3 — Acoplamento na Cotação (`Cotador.tsx`)

Após o campo de região (linha ~1354), quando o consultor preencher dados do veículo/associado, buscar o município na tabela `municipios_atendimento`:

- Hook/query simples: `useQuery` buscando `municipios_atendimento` por nome+UF
- Baseado no `tipo_atendimento` retornado, exibir Alert inline:
  - `fora_cobertura`: Alert destrutivo vermelho, bloquear botão de salvar cotação
  - `prestador`: Alert amarelo informativo
  - `viagem`: Alert laranja com SLA 72h
  - `volante`: sem alerta

Problema: o Cotador atual usa seletor de "região" (rj/lagos/sp), não município. Adicionar campo opcional "Município do associado" (input com autocomplete da tabela `municipios_atendimento`) abaixo do campo de região. A verificação só ocorre se preenchido.

---

## PARTE 4 — Badge no Cadastro (`AssociadoDetalhe.tsx`)

Na linha "Cidade / UF" (linha 466), após o valor, buscar classificação do município na tabela e exibir Badge inline:

- Cinza: "Volante"
- Laranja: "Viagem"
- Amarelo: "Prestador"
- Vermelho: "Fora de cobertura"

Query condicional: só executa se `associado.cidade` e `associado.uf` existirem.

---

## Arquivos afetados

| Arquivo | Alteração |
|---|---|
| DB migration | Tabela `municipios_atendimento` + RLS |
| `src/components/gestao-comercial/MapaAtendimento.tsx` | **Novo** — CRUD + importação RJ |
| `src/components/gestao-comercial/TabNavigation.tsx` | Aba 8 |
| `src/pages/diretoria/GestaoComercial.tsx` | Render aba 8 |
| `src/pages/vendas/Cotador.tsx` | Campo município + alertas por tipo |
| `src/pages/cadastro/AssociadoDetalhe.tsx` | Badge tipo atendimento |

