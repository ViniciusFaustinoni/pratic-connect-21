# Área de Tutoriais para Consultores

## Objetivo
Criar uma seção dedicada de **Tutoriais de Uso** acessível a todos os tipos de consultores (vendedor, supervisor, gerente, agência), começando pelo passo a passo completo: **Cotação → Ativação do Associado**.

## Localização
- Novo item no sidebar lateral: **"Tutoriais"** (ícone `BookOpen` ou `GraduationCap`).
- Rota: `/tutoriais` (lista) e `/tutoriais/:slug` (detalhe).
- Visível para qualquer usuário com role comercial (vendedor, supervisor_vendas, gerente_vendas, agencia, diretor, admin).

## Estrutura da Página

### `/tutoriais` — Listagem
- Cards agrupados por categoria (inicialmente apenas "Operação Comercial").
- Cada card mostra: título, descrição curta, nº de passos, tempo estimado, badge "Novo".
- Primeiro tutorial: **"Da Cotação à Ativação do Associado"**.

### `/tutoriais/cotacao-ate-ativacao` — Detalhe
Layout em duas colunas (desktop) / acordeão (mobile):
- **Esquerda**: índice navegável dos passos (sticky).
- **Direita**: conteúdo do passo selecionado — título, descrição em texto, screenshot grande, dicas e "atalhos do sistema" (links clicáveis para a tela real, ex.: `/cotacoes/nova`).
- Navegação Anterior / Próximo no rodapé + barra de progresso.

### Passos do tutorial inicial (esqueleto a preencher)
1. Criar Lead / Identificar cliente
2. Iniciar nova Cotação (escolher veículo, FIPE, plano)
3. Aplicar descontos / Regra do 1% / Deságio
4. Enviar proposta ao cliente (WhatsApp / link público)
5. Cliente assina (Autentique facial)
6. Aprovação de Cadastro
7. Agendamento de Instalação / Autovistoria
8. Conclusão da Instalação
9. Aprovação de Monitoramento
10. Ativação final do Associado (edge `ativar-associado`) e sync SGA

## Arquitetura Técnica
- **Conteúdo hardcoded** em arquivos TypeScript (sem banco, sem CMS).
- `src/data/tutoriais/index.ts` — array de tutoriais (id, slug, título, categoria, descrição, steps[]).
- `src/data/tutoriais/cotacao-ate-ativacao.ts` — conteúdo do primeiro tutorial.
- Tipo `Tutorial { id, slug, titulo, descricao, categoria, tempoEstimadoMin, steps: TutorialStep[] }`.
- Tipo `TutorialStep { numero, titulo, descricao, imagem?, dicas?: string[], links?: { label, url }[] }`.
- Imagens em `src/assets/tutoriais/` (placeholders inicialmente; usuário substitui depois).

## Componentes a Criar
- `src/pages/tutoriais/TutoriaisLista.tsx` — grid de cards.
- `src/pages/tutoriais/TutorialDetalhe.tsx` — leitor de passos.
- `src/components/tutoriais/TutorialCard.tsx`
- `src/components/tutoriais/TutorialStepView.tsx`
- `src/components/tutoriais/TutorialIndex.tsx` (sidebar de passos)

## Integrações
- Adicionar item no `AppSidebar` (grupo apropriado, visível para roles comerciais + diretoria).
- Registrar rotas em `src/App.tsx` dentro do `AppLayout` interno, protegidas por `ProtectedRoute allowedTipos={['funcionario','agencia']}`.
- Sem migrations, sem edge functions, sem alterações em hooks de dados.

## Fora de Escopo (próximas iterações)
- Editor admin / CMS.
- Vídeos embedados.
- Walkthrough interativo (overlay).
- Tracking de progresso por usuário.
- Tutoriais adicionais (substituição, sinistro, troca de titularidade) — estrutura pronta para receber depois.

## Critérios de Aceite
- Item "Tutoriais" aparece no menu lateral para qualquer consultor.
- `/tutoriais` lista pelo menos 1 tutorial ("Da Cotação à Ativação").
- Detalhe renderiza os 10 passos com texto + placeholder de imagem.
- Navegação anterior/próximo e índice funcionam.
- Responsivo em mobile.
