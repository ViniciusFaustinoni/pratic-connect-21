
# Automatizar Pos-Aprovacao de Sinistro

## Problema

Quando o diretor aprova um sinistro na tela "Solicitacoes IA", o sistema apenas cria o registro na tabela `sinistros` com status `comunicado` e para ali. Nao gera link de auto-vistoria, nao notifica o associado, e nao agenda vistoria do regulador.

## O que sera feito

Adicionar 4 acoes automaticas no bloco de sinistro da edge function `aprovar-solicitacao-ia`, logo apos a criacao do sinistro (depois da linha 258):

### 1. Gerar link de auto-vistoria de eventos

Chamar internamente a edge function `gerar-link-evento` passando o `sinistro_id` recem-criado. Isso cria o registro em `sinistro_evento_links` com token unico e validade de 72h.

### 2. Enviar link via WhatsApp ao associado

Buscar dados do associado (nome, whatsapp/telefone) e enviar mensagem explicando as 3 etapas:
- Etapa 1: Enviar no minimo 5 fotos do veiculo danificado
- Etapa 2: Enviar Boletim de Ocorrencia e numero do B.O.
- Etapa 3: Relato escrito ou em audio sobre o ocorrido

A mensagem incluira o link publico de auto-vistoria (formato: `https://{preview_url}/evento/{token}`).

### 3. Agendar vistoria do regulador

Inserir na tabela `servicos` com:
- `tipo`: `vistoria_sinistro`
- `tipo_servico`: `vistoria_sinistro`
- `status`: `pendente`
- `data_agendada`: 3 dias uteis a partir de hoje
- `sinistro_id`: o sinistro recem-criado
- `associado_id` e `veiculo_id`: do sinistro
- `origem`: `sinistro_ia`
- `observacoes`: referencia ao protocolo

### 4. Atualizar status do sinistro para `em_analise`

Apos todas as acoes, atualizar o sinistro de `comunicado` para `em_analise` e registrar no historico.

---

## Arquivo a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/aprovar-solicitacao-ia/index.ts` | Adicionar bloco pos-criacao no case `sinistro` (linhas 258+) |

## Detalhes Tecnicos

**Calculo de 3 dias uteis:**
```typescript
function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}
```

**Fluxo apos criar sinistro (linhas 258+):**
```
1. Gerar link evento via fetch para gerar-link-evento
2. Buscar associado (nome, whatsapp, telefone)
3. Montar URL do link: {SITE_URL}/evento/{token}
4. Enviar WhatsApp com instrucoes e link
5. Inserir servico tipo vistoria_sinistro (data_agendada = +3 dias uteis)
6. Atualizar sinistro status -> em_analise
7. Registrar historico da mudanca de status
```

Todas as acoes pos-criacao serao envolvidas em try/catch individual para nao bloquear a aprovacao caso alguma falhe.
