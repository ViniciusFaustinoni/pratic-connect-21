

# Botão "Regenerar imagem" nos cards de plano

## Resumo

Criar uma edge function `gerar-imagem-plano` que usa o AI Gateway para gerar imagens, faz upload no Storage bucket `documentos`, e retorna a URL pública. No frontend, adicionar botão "Regenerar imagem" em cada card da aba Planos.

## Arquivos

| Arquivo | Alteração |
|---|---|
| `supabase/functions/gerar-imagem-plano/index.ts` | **Novo** — Edge function que gera imagem via AI Gateway e faz upload no Storage |
| `src/pages/configuracoes/AgenteConsultorIA.tsx` | Adicionar botão "Regenerar imagem" com loading state |

## Detalhamento técnico

### 1. Edge Function `gerar-imagem-plano`

- Recebe `{ plano_id, nome, descricao }` via POST
- Gera prompt descritivo: imagem profissional para card de proteção veicular com o nome do plano
- Chama `ai.gateway.lovable.dev` com modelo `google/gemini-3.1-flash-image-preview` e `modalities: ["image", "text"]`
- Extrai base64 da resposta, converte para `Uint8Array`
- Faz upload no bucket `documentos` no path `planos/{plano_id}/{timestamp}.png`
- Obtém URL pública via `getPublicUrl`
- Atualiza `planos.imagem_landing_url` com a nova URL
- Retorna `{ url }` ao cliente
- Trata erros 429/402 com mensagens amigáveis

### 2. Frontend — AgenteConsultorIA.tsx

- Adicionar state `generatingImageId` para rastrear qual plano está gerando
- Ao lado do link "Ver imagem atual", adicionar botão pequeno com ícone de refresh + texto "Regenerar imagem"
- Se não houver imagem, mostrar o botão sozinho (sem o link "Ver imagem atual")
- Ao clicar: chamar `supabase.functions.invoke('gerar-imagem-plano', { body: { plano_id, nome, descricao } })`
- Durante loading: botão desabilitado com "Gerando..." e spinner
- Sucesso: `toast.success`, invalidar query `planos-agente-ia`
- Erro: `toast.error` com mensagem do backend

