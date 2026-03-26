

# Reconfigurar Gestao Comercial — Interface Clean para Linhas, Planos, Coberturas e Beneficios

## Visao Geral

Reorganizar a area de Gestao Comercial em 4 secoes claras, substituindo a interface atual (complexa, com muitos campos tecnicos) por uma abordagem minimalista com paineis laterais (Sheet/Drawer), formularios simples e valor do plano em tempo real.

## Estrutura de Navegacao

Substituir os itens atuais "Planos & Precos", "Linhas de Produto" e "Coberturas & Beneficios" por:

1. **Coberturas e Beneficios** (catalogo global)
2. **Linhas e Planos** (hierarquia com expansao)
3. **Tabelas de Apoio** (CRUDs simples)
4. **Marcas, Modelos e Combustiveis** (CRUDs com importacao em lote)

## Secao 1 — Catalogo de Coberturas e Beneficios

Reescrever `BeneficiosCoberturas.tsx` com interface clean:

- Duas abas: "Coberturas" e "Beneficios"
- Lista simples: nome, descricao resumida, valor (R$), botoes editar/desativar (Switch)
- Sem botao excluir — apenas desativar
- Botao "+ Novo" abre **Sheet** lateral com 3 campos: Nome, Descricao, Valor (R$)
- Reescrever `CoberturaUnificadaFormModal` e `BeneficioFormModal` como Sheet em vez de Dialog
- Remover campos tecnicos: codigo, slug, icon, categoria, ordem, elegibilidade (no catalogo)
- Adicionar campo `valor` (decimal) — **nova coluna** nas tabelas `coberturas` e `benefits`

### Migration necessaria
```sql
ALTER TABLE coberturas ADD COLUMN IF NOT EXISTS valor NUMERIC(10,2) DEFAULT 0;
ALTER TABLE benefits ADD COLUMN IF NOT EXISTS valor NUMERIC(10,2) DEFAULT 0;
```

## Secao 2 — Linhas e Planos

Reescrever o componente principal como `LinhasPlanos.tsx`:

- Cards de linhas em lista vertical
- Cada card mostra: nome da linha + lista de planos com valor mensal calculado
- Clique na linha expande/colapsa para mostrar planos
- Clique no plano abre Sheet lateral de edicao
- Botao "+ Nova Linha" abre Sheet com campo: nome (apenas)
- Dentro de cada linha: botao "+ Novo Plano"

### Formulario de Plano (Sheet lateral, scroll vertical)

Tres blocos visuais separados por divisores:

**Bloco 1 — Identificacao**
- Nome do plano
- Descricao curta (opcional)
- Badge grande com valor mensal em tempo real (soma dos itens selecionados)

**Bloco 2 — Coberturas e Beneficios Incluidos**
- Dois grupos: "Coberturas" e "Beneficios"
- Itens ativos do catalogo como checkboxes/chips selecionaveis
- Ao marcar, valor do item soma ao total do Bloco 1
- Vinculo via `planos_coberturas` e `planos_beneficios` existentes

**Bloco 3 — Regras de Elegibilidade**
- Campos opcionais de selecao multipla:
  - Regioes (do CRUD Tabelas de Apoio)
  - Tipo de Veiculo (do CRUD Tabelas de Apoio)
  - Modalidade de Uso (do CRUD Tabelas de Apoio)
  - Marcas e Modelos (do CRUD Secao 4)
  - Tipo de Placa (do CRUD Tabelas de Apoio) — **novo CRUD**
  - Combustivel (do CRUD Secao 4)
- Resumo visual no final: "Este plano sera exibido para: [Regiao: RJ, SP] · [Veiculo: Carro]..."
- Botoes "Salvar Plano" e "Cancelar"

**Secao Template de Contrato** (final do formulario)
- Campo select com templates do Autentique (placeholder, integracao futura)

## Secao 3 — Tabelas de Apoio

Reescrever `CadastrosBase.tsx` com 4 abas (expandindo das 4 atuais para 5):

- **Regioes** (ja existe)
- **Tipos de Veiculo** (ja existe como "Categorias de Veiculo")
- **Modalidades de Uso** (ja existe como "Tipos de Uso")
- **Tipos de Placa** — **novo CRUD**

Cada aba: lista com linhas simples + Sheet lateral com campo nome.

### Migration para Tipos de Placa
```sql
INSERT INTO configuracoes (chave, valor)
VALUES ('tipos_placa', '[]'::jsonb)
ON CONFLICT (chave) DO NOTHING;
```

## Secao 4 — Marcas, Modelos e Combustiveis

Novo componente `MarcasModelosCombustiveis.tsx`:

### Marcas e Modelos
- Lista expansivel de marcas
- Expandir marca mostra modelos vinculados
- "+ Nova Marca" (campo nome)
- Dentro da marca: "+ Novo Modelo" (campo nome)
- "Importar em Lote" — upload CSV com preview antes de confirmar

### Combustiveis
- Lista simples + "+ Novo" + "Importar em Lote"

### Migration
```sql
CREATE TABLE IF NOT EXISTS marcas_modelos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marca TEXT NOT NULL,
  modelo TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE marcas_modelos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read marcas_modelos" 
  ON marcas_modelos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Directors can manage marcas_modelos"
  ON marcas_modelos FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));
```

Os combustiveis ja existem como configuracao JSON — manter.

## Motor de Cotacao

Atualizar `usePlanosCotacao.ts` para respeitar os novos filtros de elegibilidade:
- Verificar regiao, tipo veiculo, modalidade uso, marca/modelo (similaridade), tipo placa, combustivel
- Manter backward compatibility com `entity_eligibility_rules`
- Calcular valor do plano como soma dos valores dos itens vinculados

## Regras de Interface

- Todas as criacoes/edicoes em Sheet lateral (nunca Dialog fullscreen)
- Sem IDs, slugs, codigos ou campos tecnicos visiveis
- Sem exclusao permanente — apenas desativacao via Switch
- Valor do plano sempre visivel e atualizado em tempo real
- Itens desativados nao aparecem como opcao em planos ou cotacoes

## Arquivos a Criar/Editar

| Arquivo | Acao |
|---|---|
| Migration | `valor` em coberturas/benefits, tabela `marcas_modelos`, config `tipos_placa` |
| `src/components/gestao-comercial/CatalogoCoberturasSheet.tsx` | Novo — Sheet de criacao/edicao cobertura (3 campos) |
| `src/components/gestao-comercial/CatalogoBeneficiosSheet.tsx` | Novo — Sheet de criacao/edicao beneficio (3 campos) |
| `src/components/gestao-comercial/BeneficiosCoberturas.tsx` | Reescrever — interface clean com valor |
| `src/components/gestao-comercial/LinhasPlanos.tsx` | Novo — cards expansiveis + Sheet de plano |
| `src/components/gestao-comercial/PlanoFormSheet.tsx` | Novo — 3 blocos, valor em tempo real |
| `src/components/gestao-comercial/MarcasModelosCombustiveis.tsx` | Novo — CRUDs com importacao |
| `src/components/gestao-comercial/CadastrosBase.tsx` | Editar — adicionar aba Tipos de Placa |
| `src/components/gestao-comercial/TabNavigation.tsx` | Editar — reorganizar itens |
| `src/pages/diretoria/GestaoComercial.tsx` | Editar — mapear novas secoes |
| `src/hooks/useMarcasModelos.ts` | Novo — CRUD hook |
| `src/hooks/useConteudosSistema.ts` | Editar — adicionar `useTiposPlaca` |

## Ordem de Execucao

1. Migration (valor, marcas_modelos, tipos_placa)
2. Secao 1: catalogo clean
3. Secao 3: tabelas de apoio (tipos de placa)
4. Secao 4: marcas/modelos/combustiveis
5. Secao 2: linhas e planos com formulario de 3 blocos
6. Navegacao e integracao final

