
# Plano: Nova página "PDF de Cotação" no menu Documentos

## Resumo

Criar subitem "PDF de Cotação" em Documentos, com página de configuração visual que persiste no banco. Não altera o gerador de PDF.

## 1. Banco de Dados (SQL Migration)

Nova tabela `cotacao_pdf_config`:

```sql
CREATE TABLE public.cotacao_pdf_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cor_primaria TEXT NOT NULL DEFAULT '#14376E',
  cor_secundaria TEXT NOT NULL DEFAULT '#C81E41',
  logo_url TEXT,
  nome_empresa TEXT NOT NULL DEFAULT 'PRATICCAR Proteção Veicular',
  mensagem_encerramento TEXT NOT NULL DEFAULT 'Será um prazer ter você como nosso associado. Estaremos aqui para o que precisar.',
  mostrar_validade BOOLEAN NOT NULL DEFAULT true,
  mostrar_dados_solicitante BOOLEAN NOT NULL DEFAULT true,
  mostrar_dados_veiculo BOOLEAN NOT NULL DEFAULT true,
  mostrar_mensagem_encerramento BOOLEAN NOT NULL DEFAULT true,
  mostrar_whatsapp_rodape BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);
```

RLS: SELECT para authenticated, UPDATE/INSERT restrito a Diretor via `has_role`.

Inserir 1 registro padrão com valores atuais do PDF hardcoded.

## 2. Nova Página: `src/pages/documentos/CotacaoPdfConfig.tsx`

Página com cards no padrão visual existente:

**Card 1 — Identidade Visual**
- Input cor primária (color picker + hex) — default `#14376E`
- Input cor secundária (color picker + hex) — default `#C81E41`
- Upload de logo (componente `UploadLogo` já existente)
- Input nome da empresa — default "PRATICCAR Proteção Veicular"

**Card 2 — Texto do PDF**
- Textarea mensagem de encerramento — default "Será um prazer ter você como nosso associado..."

**Card 3 — Seções Visíveis**
- Toggle: Barra de validade
- Toggle: Dados do solicitante
- Toggle: Dados do veículo
- Toggle: Mensagem institucional
- Toggle: WhatsApp do vendedor no rodapé (comparativo)

**Botão "Salvar configurações"** — upsert na tabela.

Carrega config existente no mount; se não houver registro, exibe defaults.

## 3. Roteamento e Navegação

| Arquivo | Alteração |
|---------|-----------|
| `src/App.tsx` | Rota `/documentos/pdf-cotacao` |
| `src/components/layout/AppSidebar.tsx` | Subitem "PDF de Cotação" com ícone `FileBarChart` |
| `src/components/layout/GlobalBreadcrumb.tsx` | Breadcrumb `/documentos/pdf-cotacao` |

## Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| SQL (migração) | Criar tabela `cotacao_pdf_config` com RLS |
| `src/pages/documentos/CotacaoPdfConfig.tsx` | **Novo** — página de configuração |
| `src/App.tsx` | Nova rota |
| `src/components/layout/AppSidebar.tsx` | Novo subitem no menu |
| `src/components/layout/GlobalBreadcrumb.tsx` | Breadcrumb |
