

# Análise do Fluxo de Assistência 24h — Reboque

## Status Atual vs. Seu Fluxo Esperado

| Etapa | Sua Expectativa | Status Atual | Gaps |
|-------|----------------|-------------|------|
| **1. Associado solicita** | ✅ | ✅ Via app ou WhatsApp (IA Maya) | Nenhum |
| **2. IA ou humano cria o chamado** | ✅ | ✅ `criar-chamado-assistencia` cria o chamado e auto-dispara despacho para reboque/guincho | Nenhum |
| **3. IA dispara WhatsApp a TODOS os reboquistas ativos** | ✅ | ✅ `despacho-reboque-disparar` busca todos com `status=ativo`, `disponivel=true`, que atendem reboque e têm WhatsApp. Filtra os que já têm chamado ativo | Nenhum |
| **4. Mensagem com dados do chamado e valor sugerido** | ⚠️ Parcial | A mensagem atual **NÃO inclui o valor sugerido** na primeira mensagem. Mostra veículo, origem, destino e pede SIM/NÃO, mas **omite o valor**. O `valor_sugerido` existe na tabela `prestadores_assistencia_valores` e é buscado, mas só é exibido na etapa 3 (após localização) | **GAP: valor sugerido ausente na mensagem inicial** |
| **5. IA entende respostas, pede localização, calcula valor, mostra Top 3** | ✅ | ✅ Fluxo conversacional em 4 etapas: interesse → localização → confirmação de valor → ETA. Top 3 ranqueados por menor valor e menor distância no painel do analista | Nenhum |
| **6. Analista escolhe um resultado** | ✅ | ✅ Botão "Atribuir" no CardDespachoReboque para cada um dos Top 3 | Nenhum |
| **7. Reboque é atribuído** | ✅ | ✅ Atualiza despacho, chamado, cria atendimento e status log | Nenhum |
| **8. IA avisa associado e reboquista por WhatsApp com contato** | ⚠️ Parcial | O reboquista recebe "CHAMADO ATRIBUÍDO A VOCÊ" com valor. O associado recebe link de acompanhamento + nome e telefone do reboquista. **Mas o reboquista NÃO recebe os dados de contato do associado (nome/telefone)** | **GAP: reboquista não recebe contato do associado** |
| **9. Analista marca como concluído e anexa imagens** | ❌ Não implementado | O fluxo atual para na atribuição. Não há UI para o analista marcar conclusão do serviço de reboque nem anexar imagens | **GAP: falta tela de conclusão com anexo de imagens** |
| **10. Custo computado nos relatórios financeiros** | ❌ Não implementado | O valor fica registrado no atendimento (`valor_servico`), mas não há integração com módulo financeiro/relatórios | **GAP: falta integração financeira** |

---

## Resumo dos Gaps a Corrigir

### Gap 1 — Incluir valor sugerido na mensagem inicial
A mensagem disparada em `despacho-reboque-disparar` (linha 232-239) não inclui o `valor_sugerido`. O valor já é buscado da tabela `prestadores_assistencia_valores`, basta adicioná-lo à mensagem:

```
🚨 *NOVO CHAMADO - Reboque*
🚗 Veículo: Toyota Corolla 2013 — ABC1D23
📍 Origem: Rua A, 123
📍 Destino: Rua C, 456
💰 Valor sugerido: R$ 250,00

Tem interesse? Responda SIM ou NÃO.
```

**Arquivo**: `supabase/functions/despacho-reboque-disparar/index.ts` (linhas 226-239)

### Gap 2 — Reboquista receber contato do associado
Na atribuição manual (`CardDespachoReboque.tsx`, linha 252-261), a mensagem ao reboquista não inclui nome/telefone do associado. Precisamos buscar esses dados e incluir na mensagem.

**Arquivo**: `src/components/assistencia/CardDespachoReboque.tsx` (linhas 216-264)

### Gap 3 — Tela de conclusão do serviço com anexo de imagens
Criar funcionalidade para o analista:
- Marcar o serviço como "concluído"
- Anexar fotos/imagens recebidas via WhatsApp
- Salvar no registro do atendimento

**Arquivos novos**: componente de conclusão no `CardDespachoReboque` ou modal dedicado

### Gap 4 — Integração com relatórios financeiros
Registrar o custo do reboque como despesa operacional nos relatórios financeiros existentes.

---

## Plano de Implementação

### Fase 1 (imediata): Gaps 1 e 2
1. **Adicionar valor sugerido à mensagem inicial** — editar `despacho-reboque-disparar/index.ts` para incluir `💰 Valor sugerido: R$ X` quando disponível
2. **Enviar contato do associado ao reboquista** — editar a mutation de atribuição em `CardDespachoReboque.tsx` para buscar dados do associado e incluí-los na mensagem WhatsApp ao reboquista

### Fase 2 (posterior): Gaps 3 e 4
3. **UI de conclusão + anexo de imagens** — adicionar seção no CardDespachoReboque para quando `status=atribuido`, com botão "Concluir Serviço" e upload de imagens
4. **Integração financeira** — registrar o custo como despesa na tabela financeira ao concluir

Deseja que eu implemente a Fase 1 (gaps 1 e 2) agora?

