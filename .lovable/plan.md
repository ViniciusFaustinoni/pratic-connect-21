

# Locais de Instalação Dinâmicos (Gerenciáveis)

## Problema

Os locais de instalação do rastreador ("Painel", "Sob o banco", etc.) estão **hardcoded** em `InstaladorChecklist.tsx`. Não é possível adicionar novos locais sem alterar código.

## Solução

Criar uma tabela no banco para armazenar os locais de instalação, com CRUD acessível pela área administrativa, e atualizar o checklist do instalador para buscar da tabela.

## Alterações

### 1. Migration — Tabela `locais_instalacao`

```sql
CREATE TABLE locais_instalacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  tipo_veiculo text NOT NULL DEFAULT 'ambos', -- 'carro', 'moto', 'ambos'
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE locais_instalacao ENABLE ROW LEVEL SECURITY;

-- Todos autenticados podem ler
CREATE POLICY "Authenticated read" ON locais_instalacao FOR SELECT TO authenticated USING (true);
-- Apenas admins podem inserir/atualizar
CREATE POLICY "Admin insert" ON locais_instalacao FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update" ON locais_instalacao FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Seed com os locais atuais
INSERT INTO locais_instalacao (value, label, tipo_veiculo, ordem) VALUES
  ('painel', 'Painel', 'carro', 1),
  ('sob_banco', 'Sob o banco', 'ambos', 2),
  ('parachoque_dianteiro', 'Para-choque dianteiro', 'carro', 3),
  ('parachoque_traseiro', 'Para-choque traseiro', 'carro', 4),
  ('caixa_roda', 'Caixa de roda', 'carro', 5),
  ('vao_motor', 'Vão do motor', 'carro', 6),
  ('console_central', 'Console central', 'carro', 7),
  ('porta_malas', 'Porta-malas', 'carro', 8),
  ('carenagem_lateral', 'Carenagem lateral', 'moto', 9),
  ('caixa_filtro_ar', 'Caixa do filtro de ar', 'moto', 10),
  ('compartimento_ferramentas', 'Compartimento de ferramentas', 'moto', 11),
  ('sob_tanque', 'Sob o tanque', 'moto', 12),
  ('rabeta', 'Rabeta/Cola', 'moto', 13),
  ('paralama', 'Paralama', 'moto', 14),
  ('outro', 'Outro', 'ambos', 99);
```

### 2. Hook `src/hooks/useLocaisInstalacao.ts`

- `useLocaisInstalacao(tipoVeiculo?)` — busca locais ativos, filtra por tipo
- `useCreateLocalInstalacao()` — mutation para adicionar novo local
- `useToggleLocalInstalacao()` — mutation para ativar/desativar

### 3. Atualizar `src/pages/instalador/InstaladorChecklist.tsx`

- Remover arrays hardcoded `LOCAIS_INSTALACAO_CARRO` e `LOCAIS_INSTALACAO_MOTO`
- Usar `useLocaisInstalacao()` para buscar opções dinamicamente
- Adicionar botão "+" ao lado do select para o técnico sugerir/adicionar novo local inline (abre pequeno dialog com input de nome)

### 4. Gestão administrativa (onde couber — ex: Monitoramento > Rastreadores ou Config)

- Pequena seção ou modal para listar, adicionar e desativar locais de instalação
- Tabela simples com label, tipo veículo, toggle ativo/inativo

## Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar tabela `locais_instalacao` + seed |
| `src/hooks/useLocaisInstalacao.ts` | Novo — hook de leitura e mutations |
| `src/pages/instalador/InstaladorChecklist.tsx` | Substituir arrays hardcoded por dados do hook + botão adicionar |
| `src/components/monitoramento/GerenciarLocaisInstalacao.tsx` | Novo — UI admin para gerenciar locais |
| Página admin (ex: config ou rastreadores) | Renderizar componente de gestão |

