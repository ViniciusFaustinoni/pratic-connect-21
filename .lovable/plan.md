

# Pergunta de Reboque ao Criar Sinistro

## Objetivo
Sempre que um sinistro for criado (via app, IA ou painel), perguntar ao associado se precisa de reboque. Se sim, criar automaticamente um chamado de assistencia 24h do tipo "reboque".

## Pontos de Entrada Identificados

Existem 3 formas de criar sinistro no sistema:

1. **App do associado** - Edge function `criar-sinistro/index.ts`
2. **Aprovacao de solicitacao IA** - Edge function `aprovar-solicitacao-ia/index.ts`
3. **Painel administrativo** - Criacao manual (link em ChamadoDetalhe)

## Solucao

### 1. Banco de Dados
- Adicionar coluna `necessita_reboque` (boolean, default null) na tabela `sinistros`
- Adicionar coluna `chamado_assistencia_id` (uuid, FK opcional para `chamados_assistencia`) na tabela `sinistros` para vincular o chamado gerado

### 2. Edge Function `criar-sinistro/index.ts`
- Aceitar novo campo `necessita_reboque` no payload
- Se `necessita_reboque = true`: criar automaticamente um chamado de assistencia 24h do tipo "reboque" com os dados do sinistro (associado, veiculo, endereco do evento)
- Salvar o `chamado_assistencia_id` no sinistro
- Retornar na resposta que o chamado de reboque foi criado

### 3. Edge Function `aprovar-solicitacao-ia/index.ts`
- Verificar se `dados.necessita_reboque` esta presente
- Se sim, criar chamado de assistencia automaticamente ao aprovar o sinistro

### 4. App do Associado (tela de abertura de sinistro)
- Adicionar campo "Precisa de reboque?" (switch/toggle) no formulario de abertura de sinistro
- Enviar `necessita_reboque: true/false` no payload para a edge function
- Na tela de confirmacao, informar que o reboque foi solicitado

### 5. Hook `useSinistros.ts`
- Adicionar `necessita_reboque` na interface `CriarSinistroPayload`

### Logica de criacao do chamado de reboque (reutilizada nas edge functions)

```text
Protocolo: ASS-YYYYMMDD-XXXX
Associado: mesmo do sinistro
Veiculo: mesmo do sinistro
Tipo servico: reboque
Descricao: "Reboque solicitado junto ao sinistro [PROTOCOLO]"
Origem endereco: local do sinistro
Canal: app / ia (conforme origem)
Status: aberto
```

### Arquivos a modificar
- `supabase/functions/criar-sinistro/index.ts` - aceitar `necessita_reboque`, criar chamado
- `supabase/functions/aprovar-solicitacao-ia/index.ts` - criar chamado se `necessita_reboque`
- `src/hooks/useSinistros.ts` - adicionar campo no payload
- Tela do app de abertura de sinistro (identificar o componente correto)
- Migracao SQL para nova coluna

### Arquivos a criar
- Migracao SQL para `necessita_reboque` e `chamado_assistencia_id`

