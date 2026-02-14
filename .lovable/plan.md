

# Alinhar "Registrar Sinistro" com o Fluxo Completo

## Problema

O botao "Registrar Sinistro" na pagina de Gestao de Sinistros (`NovoSinistroModal.tsx`) faz apenas um `INSERT` direto na tabela, pulando varias etapas criticas que a edge function `criar-sinistro` executa quando o sinistro vem pelo app do associado.

### O que o modal faz hoje:
1. Seleciona associado e veiculo
2. Insere sinistro com status "comunicado"
3. Registra historico
4. Cria chamado de reboque (se necessario)
5. Tenta notificar via edge function

### O que esta FALTANDO (presente na edge function):
1. **Verificar sinistro em aberto** -- impedir duplicatas no mesmo veiculo
2. **Validar cobertura** -- checar `cobertura_roubo_furto` e `cobertura_total` do veiculo
3. **Flag `alerta_recem_ativado`** -- marcar sinistros de associados sem rastreador
4. **Capturar posicao do rastreador** -- evidencia do momento da abertura
5. **Criar documentos pendentes** -- tabela `sinistro_documentos` baseada no tipo
6. **Notificar analistas** -- criar notificacoes para analistas_sinistros/diretores
7. **Notificar associado** -- criar notificacao no sistema
8. **Agendar contato D+1** -- chamar `agendar-contato-sinistro`
9. **Enviar email para equipe** -- email para sinistros@praticprotect.com.br

## Solucao

Reescrever a mutation do `NovoSinistroModal.tsx` para replicar todas as etapas da edge function, adaptadas para o contexto administrativo (onde o usuario logado e o operador, nao o associado).

Nao podemos reutilizar a edge function diretamente porque ela busca o associado pelo `user_id` do token JWT (assume que quem chama e o proprio associado).

## Alteracoes Tecnicas

### Arquivo: `src/components/eventos/NovoSinistroModal.tsx`

**1. Adicionar verificacao de sinistro em aberto (antes do insert):**
```typescript
const { data: sinistroExistente } = await supabase
  .from('sinistros')
  .select('id, protocolo, status')
  .eq('veiculo_id', selectedVeiculo)
  .in('status', ['comunicado','em_analise','documentacao_pendente','em_regulacao'])
  .maybeSingle();

if (sinistroExistente) {
  throw new Error(`Ja existe sinistro em aberto: ${sinistroExistente.protocolo}`);
}
```

**2. Adicionar validacao de cobertura e flag alerta_recem_ativado:**
```typescript
const { data: veiculoCompleto } = await supabase
  .from('veiculos')
  .select('status, cobertura_roubo_furto, cobertura_total')
  .eq('id', selectedVeiculo)
  .single();

const isRouboFurto = ['roubo','furto'].includes(formData.tipo);
let alertaRecemAtivado = false;

if (!veiculoCompleto.cobertura_total && !isRouboFurto) {
  throw new Error('Veiculo sem cobertura total para este tipo de sinistro');
}
if (isRouboFurto && !veiculoCompleto.cobertura_total) {
  alertaRecemAtivado = true;
}
```

**3. Incluir `alerta_recem_ativado` no insert**

**4. Criar documentos pendentes apos o insert:**
Usar a mesma tabela de documentos obrigatorios por tipo (definir constante `DOCUMENTOS_OBRIGATORIOS` no arquivo).

**5. Notificar analistas:**
Buscar usuarios com role `analista_sinistros` ou `diretor` e inserir em `notificacoes`.

**6. Notificar associado:**
Buscar `user_id` do associado e criar notificacao.

**7. Agendar contato D+1:**
Chamar `supabase.functions.invoke('agendar-contato-sinistro')`.

**8. Enviar email para equipe:**
Chamar `supabase.functions.invoke('send-email')`.

## Resumo das Etapas Adicionadas

```text
ANTES DO INSERT:
  [NOVO] Verificar sinistro em aberto no veiculo
  [NOVO] Validar cobertura do veiculo
  [NOVO] Calcular flag alerta_recem_ativado

NO INSERT:
  [NOVO] Campo alerta_recem_ativado

APOS O INSERT:
  [existente] Registrar historico
  [existente] Criar chamado de reboque
  [NOVO] Criar documentos pendentes (sinistro_documentos)
  [NOVO] Notificar analistas (notificacoes)
  [NOVO] Notificar associado (notificacoes)
  [NOVO] Agendar contato D+1 (edge function)
  [NOVO] Enviar email para equipe (edge function)
  [existente] Notificar via notificar-sinistro
```

## Arquivos Afetados

| Acao | Arquivo |
|---|---|
| Modificar | `src/components/eventos/NovoSinistroModal.tsx` |

Nenhum outro arquivo precisa ser alterado.

