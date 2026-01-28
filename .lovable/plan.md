
# Analise de Conformidade: Sistema Atual vs PRD

## Resumo Executivo

Apos investigacao detalhada do codigo-fonte, o sistema esta **parcialmente conforme** com o PRD descrito. Os tres modulos principais (Assistencia 24h, Eventos/Sinistros e Oficinas) estao implementados, mas existem lacunas funcionais importantes na integracao entre eles.

---

## 1. MODULO ASSISTENCIA 24H

### Status: CONFORME (85%)

**O que esta implementado:**

| Funcionalidade | Status | Localizacao |
|----------------|--------|-------------|
| Pipeline de Status | OK | `src/pages/assistencia/ChamadosList.tsx` |
| Tipos de Servico (guincho, chaveiro, pane, bateria, troca pneu) | OK | `supabase/functions/criar-chamado-assistencia/index.ts` |
| Protocolo automatico (ASS-YYYYMMDD-XXXX) | OK | Edge function `criar-chamado-assistencia` |
| Historico de atendimento | OK | Tabela `chamados_assistencia_historico` |
| Atribuicao de prestadores | OK | `src/components/assistencia/AtribuirPrestadorModal.tsx` |
| Notificacao via WhatsApp | OK | Integrado na edge function |

**Status disponiveis no sistema:**
```
aberto -> aguardando_prestador -> prestador_despachado -> 
prestador_a_caminho -> em_atendimento -> concluido

Excecoes: cancelado_associado, cancelado_sistema
```

**O que falta:**

| Gap | Impacto | Prioridade |
|-----|---------|------------|
| Botao para "Transferir para Sinistro" | Nao existe link direto da Assistencia para criar Evento quando surge dano relevante | ALTA |
| Campo `sinistro_id` na tabela de chamados | Nao ha FK vinculando chamado a sinistro gerado | MEDIA |

---

## 2. MODULO EVENTOS (SINISTROS)

### Status: CONFORME (80%)

**O que esta implementado:**

| Funcionalidade | Status | Localizacao |
|----------------|--------|-------------|
| Pipeline de Status | OK | `src/types/sinistros.ts` (WORKFLOW_SINISTRO) |
| Tipos de Evento | OK | colisao, roubo, furto, incendio, fenomeno_natural, terceiros, vidros |
| Protocolo automatico (SIN-YYYYMMDD-XXXX) | OK | `supabase/functions/criar-sinistro/index.ts` |
| Abertura via App | OK | `src/pages/app/AppSinistroNovo.tsx` |
| Abertura via IA | OK | `supabase/functions/aprovar-solicitacao-ia/index.ts` |
| Documentos obrigatorios por tipo | OK | Gerados automaticamente na criacao |
| Historico de mudanca de status | OK | Tabela `sinistro_historico` |
| Valores FIPE/Indenizacao/Pago | OK | Campos na tabela `sinistros` |
| Vinculo com processo juridico | OK | `src/components/sinistros/ModalVincularProcesso.tsx` |
| Solicitar guincho junto com sinistro | OK | `src/components/app/SinistroFormDialog.tsx` |
| Timeline de historico | OK | `src/components/eventos/SinistroTimeline.tsx` |

**Status disponiveis no sistema:**
```
comunicado -> em_analise -> documentacao_pendente
                        |-> aguardando_vistoria -> em_vistoria -> aguardando_parecer
                        |-> aprovado -> em_regulacao -> em_reparo -> aguardando_pagamento -> pago
                        |-> negado -> encerrado
cancelado (qualquer ponto)
```

**Tipos de Sinistro PRD vs Sistema:**

| Tipo PRD | Sistema | Status |
|----------|---------|--------|
| Colisao | colisao | OK |
| Roubo | roubo | OK |
| Furto | furto | OK |
| Incendio | incendio | OK |
| Alagamento | alagamento (tipos) | OK |
| Fenomenos Naturais | fenomeno_natural | OK |
| Terceiros | terceiros | OK |
| Vidros | vidros | OK |

**O que falta:**

| Gap | Impacto | Prioridade |
|-----|---------|------------|
| Botao "Criar OS" direto na tela do sinistro | Usuario precisa ir ao modulo Oficinas e buscar sinistro manualmente | ALTA |
| Status "SINDICANCIA" | Nao existe no enum de status | MEDIA |
| Campo tipo_dano (parcial/perda_total) | Nao ha distincao explicita no banco | MEDIA |
| Calculo automatico 75% FIPE | Nao implementado | MEDIA |
| Termo de Anuencia de pecas | Nao existe fluxo | BAIXA |
| Gestao de salvados | Nao implementado | BAIXA |

---

## 3. MODULO OFICINAS (OS)

### Status: CONFORME (90%)

**O que esta implementado:**

| Funcionalidade | Status | Localizacao |
|----------------|--------|-------------|
| Cadastro de oficinas credenciadas | OK | `src/pages/oficinas/Oficinas.tsx` |
| Dados bancarios (banco, agencia, conta, PIX) | OK | Interface `Oficina` em `types/database.ts` |
| Especialidades (funilaria, pintura, mecanica, eletrica, vidros) | OK | Campo array na tabela |
| Pipeline de OS | OK | 11 status definidos |
| Numero automatico (OS-YYYY-XXXXX) | OK | Trigger `gerar_numero_os` |
| Itens do orcamento (peca, mao_de_obra, servico_terceiro) | OK | `src/hooks/useOrdensServico.ts` |
| Fotos da OS (entrada, execucao, conclusao) | OK | Tipo `TipoFotoOS` |
| Historico de mudancas | OK | Tabela `ordens_servico_historico` |
| Vinculo com sinistro (sinistro_id) | OK | FK na tabela `ordens_servico` |
| Calculo automatico do total | OK | Trigger `trigger_atualizar_valor_os` |
| Pagamento de oficinas | OK | Interface `OficinaPagamento` |

**Pipeline de OS no sistema:**
```
rascunho -> aguardando_orcamento -> orcamento_enviado -> 
aguardando_aprovacao -> aprovado -> em_execucao -> 
[aguardando_peca] -> concluido -> aguardando_pagamento -> pago

cancelado (qualquer ponto)
```

**O que falta:**

| Gap | Impacto | Prioridade |
|-----|---------|------------|
| Regulagem de pecas (original/paralela/mercado verde) | Campo existe mas workflow nao esta implementado | MEDIA |
| Vistoria de saida | Nao existe fluxo especifico | BAIXA |
| Test drive do associado | Nao implementado | BAIXA |
| Termo de Quitacao | Nao implementado | BAIXA |
| Garantia 90 dias | Nao existe controle | BAIXA |

---

## 4. CORRELACOES ENTRE MODULOS

### Assistencia -> Evento
| Regra PRD | Sistema | Status |
|-----------|---------|--------|
| Chamado pode virar sinistro quando surge dano | Nao existe link/botao direto | NAO CONFORME |
| Guincho pode ir junto com sinistro | Implementado via Switch no formulario | CONFORME |

### Evento -> Oficina
| Regra PRD | Sistema | Status |
|-----------|---------|--------|
| Sinistro aprovado gera OS para reparo | OS pode vincular sinistro, mas fluxo nao e automatico | PARCIAL |
| Criar OS a partir da tela do sinistro | Nao existe botao na tela de detalhes | NAO CONFORME |
| Perda total nao gera OS (vai para indenizacao) | Nao ha regra impedindo | NAO CONFORME |

### Assistencia -> Oficina (reboque direto)
| Regra PRD | Sistema | Status |
|-----------|---------|--------|
| Reboque pode levar direto para oficina | Nao existe integracao direta | NAO CONFORME |

---

## 5. GAPS CRITICOS IDENTIFICADOS

### 5.1 Falta link "Assistencia -> Sinistro"

**Problema:** Quando um chamado de assistencia revela dano que precisa analise de cobertura, o operador nao tem botao para criar sinistro vinculado.

**Onde adicionar:**
- `src/pages/assistencia/ChamadoDetalhe.tsx` - Menu de acoes

**Sugestao de implementacao:**
```typescript
<DropdownMenuItem onClick={() => navigate(`/eventos/sinistros/novo?chamado_id=${chamado.id}&associado_id=${chamado.associado_id}&veiculo_id=${chamado.veiculo_id}`)}>
  <AlertTriangle className="h-4 w-4 mr-2" />
  Abrir Sinistro
</DropdownMenuItem>
```

### 5.2 Falta link "Sinistro -> OS"

**Problema:** Na tela de detalhe do sinistro aprovado, nao existe botao para criar OS vinculada.

**Onde adicionar:**
- `src/pages/eventos/SinistroDetalhe.tsx` - Menu de acoes (apos aprovacao)

**Sugestao de implementacao:**
```typescript
{['aprovado', 'em_regulacao', 'em_reparo'].includes(sinistro.status) && (
  <DropdownMenuItem onClick={() => navigate(`/oficina/ordens-servico?novo=true&sinistro_id=${sinistro.id}`)}>
    <Wrench className="h-4 w-4 mr-2" />
    Criar Ordem de Servico
  </DropdownMenuItem>
)}
```

### 5.3 Falta status "Sindicancia"

**Problema:** O PRD menciona status SINDICANCIA/JURIDICO para investigacao especial, mas nao existe no enum.

**Onde adicionar:**
- `src/types/sinistros.ts` - Adicionar ao tipo StatusSinistro
- Criar migracao para adicionar ao enum no banco

---

## 6. RESUMO DE CONFORMIDADE

| Modulo | Conformidade | Observacao |
|--------|--------------|------------|
| Assistencia 24h | 85% | Falta link para criar sinistro |
| Eventos (Sinistros) | 80% | Falta link para criar OS e status sindicancia |
| Oficinas (OS) | 90% | Bem completo, falta alguns fluxos pos-reparo |
| **Integracao entre modulos** | **60%** | **Gaps criticos na correlacao** |

---

## 7. RECOMENDACOES PRIORIZADAS

### Alta Prioridade

1. **Adicionar botao "Abrir Sinistro" na tela de Chamado**
   - Arquivo: `ChamadoDetalhe.tsx`
   - Passar dados do chamado para pre-preencher formulario

2. **Adicionar botao "Criar OS" na tela de Sinistro**
   - Arquivo: `SinistroDetalhe.tsx`
   - Visivel apenas quando status permite (aprovado, em_regulacao)

3. **Adicionar campo `chamado_origem_id` na tabela sinistros**
   - Permite rastrear sinistros originados de assistencia

### Media Prioridade

4. **Adicionar status "em_sindicancia" ao enum**
   - Migracao de banco necessaria

5. **Implementar calculo de dano parcial vs perda total**
   - Regra: se valor estimado >= 75% do FIPE = perda total

6. **Bloquear criacao de OS para sinistros com perda total**
   - Validacao no modal NovaOSModal

### Baixa Prioridade

7. Implementar termo de anuencia de pecas
8. Implementar vistoria de saida
9. Implementar controle de garantia 90 dias
10. Implementar gestao de salvados

---

## Conclusao

O sistema possui uma **base solida** com os tres modulos bem implementados individualmente. O principal gap esta na **integracao/correlacao** entre eles, que nao segue o fluxo descrito no PRD. Com as melhorias de alta prioridade (estimativa: 2-3 horas de desenvolvimento), o sistema atingiria ~95% de conformidade com o PRD.
