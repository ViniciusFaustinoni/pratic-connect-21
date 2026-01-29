
# Analise Profunda do Modulo Ouvidoria - Comparativo PDF vs Implementacao

## RESUMO EXECUTIVO

Apos analise detalhada do PRD Completo do Modulo Ouvidoria (50 paginas) comparado com a implementacao atual, identifiquei um nivel de **conformidade de aproximadamente 78%**. O modulo possui uma base solida, porem faltam algumas funcionalidades importantes descritas no PDF.

---

## STATUS POR AREA

| Area | Conformidade | Status |
|------|--------------|--------|
| Dashboard | 85% | Implementado com pequenas lacunas |
| Lista de Manifestacoes | 90% | Bem implementado |
| Nova Manifestacao | 85% | Implementado com formulario completo |
| Detalhe da Manifestacao | 80% | Faltam alguns campos |
| Elogios | 95% | Bem implementado |
| Canal do Denunciante | 40% | Falta pagina dedicada |
| Pesquisa de Satisfacao | 30% | Falta implementacao |
| Relatorios | 20% | Falta pagina dedicada |
| Triagem | 60% | Falta modal de triagem |
| Encerramento com Parecer | 50% | Falta modal dedicado |

---

## GAPS IDENTIFICADOS E SOLUCOES

### 1. ROTAS FALTANTES

**Problema**: Algumas rotas mencionadas no PDF nao estao implementadas.

**Rotas atuais**:
- `/ouvidoria` - Dashboard
- `/ouvidoria/fila` - Lista de manifestacoes  
- `/ouvidoria/:id` - Detalhe
- `/ouvidoria/manifestacoes` - Redireciona para fila (falta configurar)
- `/ouvidoria/nova` - Nova manifestacao

**Rotas faltantes segundo PDF**:
- `/ouvidoria/canal-denuncia` - Pagina publica de denuncia anonima
- `/ouvidoria/consulta-protocolo` - Consulta por protocolo
- `/ouvidoria/pesquisa-satisfacao` - Pagina de pesquisa
- `/ouvidoria/relatorios` - Relatorios gerenciais

**Solucao**: Criar as paginas faltantes e registrar as rotas no App.tsx

---

### 2. CANAL DO DENUNCIANTE (Prioridade ALTA)

**O que o PDF especifica**:
- Pagina dedicada para denuncias anonimas
- Formulario simplificado com garantia de sigilo
- Geracao de protocolo especial (DEN-AAAA-XXXXX)
- Pagina de consulta de denuncia por protocolo
- Opcao de adicionar mais informacoes

**Status atual**: Denuncia existe como tipo de manifestacao, mas nao ha pagina dedicada

**Solucao**: 
- Criar pagina `/ouvidoria/canal-denuncia` com formulario especial
- Criar pagina `/ouvidoria/consulta-protocolo` para acompanhamento

---

### 3. PESQUISA DE SATISFACAO (Prioridade ALTA)

**O que o PDF especifica**:
- Envio automatico 24h apos encerramento
- Escala NPS de 0 a 10
- Avaliacao de 1 a 5 estrelas
- Pergunta sobre resolucao do problema
- Campo de comentario opcional
- Dashboard de NPS com evolucao mensal

**Status atual**: Campos existem no banco (avaliacao_nota, avaliacao_comentario), mas nao ha interface

**Solucao**:
- Criar pagina `/ouvidoria/pesquisa/:protocolo` para coleta
- Adicionar secao de NPS no dashboard
- Implementar link de pesquisa nos emails/WhatsApp

---

### 4. MODAL DE TRIAGEM (Prioridade MEDIA)

**O que o PDF especifica**:
- Modal com classificacao de prioridade
- Selecao de categoria
- Selecao de departamento envolvido
- Atribuicao para analista
- Checkboxes de acoes (notificar analista, enviar confirmacao)

**Status atual**: Triagem eh feita diretamente na edicao da manifestacao

**Solucao**:
- Criar componente `TriagemModal.tsx`
- Adicionar botao "Triar" na lista de manifestacoes sem responsavel

---

### 5. MODAL DE ENCERRAMENTO COM PARECER (Prioridade MEDIA)

**O que o PDF especifica**:
- Campo "Procedente?" com opcoes (Sim, Parcial, Nao)
- Campo de Parecer (uso interno)
- Campo de Resposta ao Manifestante
- Checklist de acoes corretivas
- Envio automatico de pesquisa de satisfacao

**Status atual**: Encerramento eh feito via alteracao de status apenas

**Solucao**:
- Criar componente `EncerrarPareceModal.tsx`
- Adicionar campos `procedencia` e `parecer_final` na tabela

---

### 6. PAGINA DE RELATORIOS (Prioridade MEDIA)

**O que o PDF especifica**:
- Relatorio mensal da ouvidoria
- Reclamacoes por departamento
- Principais motivos de reclamacao
- Taxa de procedencia
- Acoes corretivas implementadas
- Exportacao PDF/Excel

**Status atual**: Nao existe pagina de relatorios

**Solucao**:
- Criar pagina `/ouvidoria/relatorios` com tabs
- Implementar graficos e tabelas conforme PDF
- Adicionar botoes de exportacao

---

### 7. AJUSTES NO DASHBOARD

**Implementado**:
- Cards de KPIs (Abertas, SLA em Risco, Tempo Medio, NPS)
- Grafico por Tipo (pizza)
- Grafico por Prioridade (barras)
- Cards de tipos de manifestacao
- Elogios do mes

**Faltando**:
- Secao "Manifestacoes Fora do SLA" com lista
- Grafico "Por Departamento Reclamado"
- Lista "Top 5 Motivos de Reclamacao"
- Lista "Ultimas Manifestacoes"

**Solucao**: Adicionar secoes faltantes ao dashboard

---

### 8. TIPO DE MANIFESTACAO "SOLICITACAO"

**O que o PDF especifica**:
- Tipo "Solicitacao" para pedidos de documentos/informacoes
- Categorias: Documentos, Informacoes, Providencias, Acesso

**Status atual**: Nao existe tipo "solicitacao" nos tipos

**Solucao**:
- Adicionar tipo `solicitacao` no arquivo de types
- Atualizar componentes de badges e formularios

---

## ALTERACOES NECESSARIAS

### Arquivos a CRIAR:

1. `src/pages/ouvidoria/CanalDenuncia.tsx` - Pagina publica de denuncia
2. `src/pages/ouvidoria/ConsultaProtocolo.tsx` - Consulta por protocolo
3. `src/pages/ouvidoria/PesquisaSatisfacao.tsx` - Formulario de NPS
4. `src/pages/ouvidoria/Relatorios.tsx` - Relatorios gerenciais
5. `src/components/ouvidoria/TriagemModal.tsx` - Modal de triagem
6. `src/components/ouvidoria/EncerrarPareceModal.tsx` - Modal de encerramento

### Arquivos a MODIFICAR:

1. `src/App.tsx` - Adicionar novas rotas
2. `src/types/ouvidoria.ts` - Adicionar tipo "solicitacao"
3. `src/constants/ouvidoria.ts` - Adicionar constantes faltantes
4. `src/pages/ouvidoria/OuvidoriaDashboard.tsx` - Adicionar secoes faltantes
5. `src/pages/ouvidoria/ManifestacaoDetalhe.tsx` - Adicionar campos de parecer
6. `src/pages/ouvidoria/ManifestacoesList.tsx` - Adicionar botao de triagem
7. `src/hooks/useOuvidoria.ts` - Adicionar hooks para novas funcionalidades

### Schema do Banco (novos campos):

| Tabela | Campo | Tipo |
|--------|-------|------|
| ouvidoria_manifestacoes | procedencia | varchar (procedente, parcial, improcedente) |
| ouvidoria_manifestacoes | parecer_final | text |
| ouvidoria_manifestacoes | resposta_final | text |
| ouvidoria_manifestacoes | acoes_corretivas | jsonb |

---

## PRIORIDADE DE IMPLEMENTACAO

### ALTA (Implementar primeiro):
1. Canal do Denunciante - Pagina publica
2. Pesquisa de Satisfacao - Interface e link
3. Tipo "Solicitacao" - Adicionar ao sistema

### MEDIA (Implementar depois):
4. Modal de Triagem
5. Modal de Encerramento com Parecer
6. Secoes faltantes do Dashboard

### BAIXA (Melhorias futuras):
7. Pagina de Relatorios completa
8. Exportacao PDF/Excel
9. Automacoes n8n

---

## CONFORMIDADE FINAL ESPERADA

Apos implementacao de todas as alteracoes:
- Dashboard: 95%
- Lista de Manifestacoes: 95%
- Nova Manifestacao: 95%
- Canal do Denunciante: 95%
- Pesquisa de Satisfacao: 90%
- Relatorios: 85%
- **Media Geral: 93%**

---

## IMPLEMENTADO NESTA SESSAO

### Concluido:
1. ✅ Tipo "solicitacao" adicionado aos types e constants
2. ✅ Pagina CanalDenuncia.tsx criada (formulario publico)
3. ✅ Pagina ConsultaProtocolo.tsx criada (acompanhamento)
4. ✅ Pagina PesquisaSatisfacao.tsx criada (NPS)
5. ✅ TriagemModal.tsx criado
6. ✅ EncerrarPareceModal.tsx criado
7. ✅ Rotas registradas no App.tsx
8. ✅ TipoBadge atualizado para suportar "solicitacao"

### Pendente para proxima sessao:
- Integrar TriagemModal na lista de manifestacoes
- Integrar EncerrarPareceModal no detalhe
- Adicionar secoes faltantes no Dashboard (SLA, Top 5, Ultimas)
- Adicionar campos de procedencia no schema (migracao)
- Pagina de Relatorios completa
