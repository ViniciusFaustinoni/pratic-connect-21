

# Atribuir Coberturas/Benefícios Utilizados ao Concluir Evento

## Contexto

Quando um evento (sinistro) é concluído, o analista precisa registrar quais coberturas e benefícios do plano do associado foram acionados naquele evento, junto com o custo de cada um. Hoje essa informação não existe no sistema.

## Alterações

### 1. Migration — Nova tabela `sinistro_coberturas_utilizadas`

```sql
CREATE TABLE public.sinistro_coberturas_utilizadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sinistro_id uuid NOT NULL REFERENCES sinistros(id) ON DELETE CASCADE,
  cobertura_id uuid REFERENCES coberturas(id) ON DELETE SET NULL,
  benefit_id uuid REFERENCES benefits(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('cobertura', 'beneficio')),
  nome text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  observacao text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT chk_referencia CHECK (cobertura_id IS NOT NULL OR benefit_id IS NOT NULL)
);

ALTER TABLE sinistro_coberturas_utilizadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage sinistro_coberturas"
  ON sinistro_coberturas_utilizadas FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### 2. `AtualizarStatusModal.tsx` — Formulário de coberturas ao concluir

Quando o analista selecionar status final (`concluido`, `finalizado`, `encerrado`, `entregue`), exibir uma seção adicional:

- Buscar coberturas e benefícios vinculados ao plano do associado (via `sinistros.associado_id` → `contratos.associado_id` → `planos_coberturas` + `planos_beneficios`)
- Exibir lista com checkboxes de coberturas/benefícios disponíveis
- Para cada item marcado, campo de valor (custo real do evento)
- Ao confirmar, inserir registros em `sinistro_coberturas_utilizadas`

O modal precisará receber o `associado_id` do sinistro (ou buscá-lo ao abrir).

### 3. Visualização no detalhe do sinistro

Criar componente `SinistroCoberturaUtilizada.tsx` que lista as coberturas/benefícios registrados para aquele evento, com nome, tipo e valor. Exibir na página de detalhe do sinistro.

### 4. Interface props

O `AtualizarStatusModal` atualmente recebe `{ id, protocolo, status }`. Será expandido para incluir o `associado_id` e `plano_id` (ou buscá-los internamente via query ao sinistro).

## Fluxo

```text
Analista clica "Atualizar Status"
  → Seleciona status final (concluído/finalizado/encerrado/entregue)
  → Sistema carrega coberturas + benefícios do plano do associado
  → Analista marca quais foram usados e informa o custo de cada
  → Ao confirmar: atualiza status + insere coberturas utilizadas
```

## Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar tabela `sinistro_coberturas_utilizadas` com RLS |
| `src/components/eventos/AtualizarStatusModal.tsx` | Adicionar seção de coberturas/benefícios quando status é final |
| `src/components/eventos/SinistroCoberturaUtilizada.tsx` | Novo componente para exibir coberturas usadas no detalhe |
| Página de detalhe do sinistro | Integrar o novo componente de visualização |

