

# Plano: Landing Page Pública `/planos`

## Resumo

Criar uma landing page pública em `/planos` para captação de associados, com hero, números, planos dinâmicos do banco, passos, benefícios, CTA e footer. Mobile-first, cores azul escuro (#0A1628) e vermelho (#C41230).

## 1. Banco de Dados (SQL Migration)

Adicionar colunas à tabela `planos`:
- `visivel_landing` BOOLEAN DEFAULT false — controla quais planos aparecem na LP
- `imagem_landing_url` TEXT — URL da imagem do plano no Storage
- `descricao_landing` TEXT — descrição curta para a LP

Criar bucket público `landing-images` no Storage para as imagens hero e dos planos.

RLS: SELECT público (anon) na tabela `planos` para colunas necessárias (já existe read para authenticated; adicionar policy para anon filtrando `visivel_landing = true`).

## 2. Nova Página: `src/pages/public/LandingPlanos.tsx`

Página única com todas as 6 seções + footer. Usa `publicSupabase` (já existente) para queries sem autenticação.

### Seção 1 — Hero
- Fullscreen com imagem de fundo (placeholder gradient inicialmente, substituível por imagem do Storage)
- Logo usando `import logoFullLight` direto (sem ThemeProvider)
- Título, subtítulo, botão WhatsApp (`wa.me/5511953221644`, target `_blank`)

### Seção 2 — Números
- Faixa azul escuro com 4 cards: +10.000 Associados, +600 Instalações/Mês, Assistência 24h, Proteção Total

### Seção 3 — Planos
- Query `publicSupabase.from('planos').select('id, nome, descricao, coberturas, valor_adesao, destaque, imagem_landing_url, descricao_landing').eq('visivel_landing', true).eq('ativo', true).order('ordem_exibicao')`
- Cards verticais com nome, imagem, até 6 benefícios (do campo `coberturas`), botão WhatsApp com texto personalizado
- Fallback "Em breve" se nenhum plano visível

### Seção 4 — Como Funciona
- 3 passos horizontais (vertical no mobile): Fale com consultor, Vistoria, Proteção ativada

### Seção 5 — Benefícios Gerais
- Grid 3x2 (mobile 1 col) com 6 benefícios fixos com ícones Lucide

### Seção 6 — CTA Final
- Faixa gradiente azul/vermelho, botão WhatsApp

### Footer
- Logo, texto ABP Praticcar, links simples, copyright 2025

## 3. Roteamento (`App.tsx`)

- Import `LandingPlanos`
- Rota pública: `<Route path="/planos" element={<LandingPlanos />} />`
- Posicionar junto às outras rotas públicas (após linha ~431)

## 4. Imagens

As imagens serão placeholders iniciais (gradientes CSS). A geração por IA e upload ao Storage será feita em etapa posterior (LP02) quando o Diretor puder gerenciar imagens pela área de configurações.

## Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| SQL (migração) | ADD COLUMNS `visivel_landing`, `imagem_landing_url`, `descricao_landing` em `planos`; bucket `landing-images`; RLS anon |
| `src/pages/public/LandingPlanos.tsx` | **Novo** — página completa da LP |
| `src/App.tsx` | Rota pública `/planos` |

