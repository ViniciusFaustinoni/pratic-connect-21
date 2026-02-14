
# Wizard de 3 Etapas - Pagina Publica do Evento de Colisao

## Resumo

Transformar a pagina placeholder `EventoColisao.tsx` em um wizard funcional de 3 etapas mobile-first. O associado acessa pelo link unico, completa as etapas uma a uma (auto vistoria, B.O., relato) e o progresso e salvo individualmente. Fotos e arquivos sao enviados ao Supabase Storage via edge function (pois o usuario nao esta autenticado).

---

## 1. Banco de Dados

### Bucket de Storage: `sinistro-eventos`

Criar um novo bucket dedicado para uploads da pagina publica, com politica RLS que permite upload anonimo organizado por `link_id`:

```text
sinistro-eventos/
  {link_id}/
    etapa1/
      foto-001.jpg
      foto-002.jpg
    etapa2/
      bo-001.pdf
    etapa3/
      audio-relato.webm
```

Politica: anon pode INSERT no bucket `sinistro-eventos`. Authenticated pode ALL.

---

## 2. Edge Function: `salvar-etapa-evento`

Nova edge function publica (verify_jwt = false) que recebe:

- `token` - para validar o link
- `etapa` - 1, 2 ou 3
- `dados` - objeto JSON com os dados da etapa
- `arquivos` - FormData com fotos/PDFs/audio (multipart)

Logica:
1. Valida o token (link ativo + nao expirado)
2. Verifica que a etapa anterior ja foi completada
3. Faz upload dos arquivos para `sinistro-eventos/{link_id}/etapa{N}/`
4. Salva os dados no campo `dados_etapa{N}` do link (URLs dos arquivos, textos, etc.)
5. Atualiza `etapa_atual` e `etapa{N}_completada_em`
6. Se etapa 3, muda status do link para `completado` e atualiza status do sinistro para `documentacao_enviada`

---

## 3. Componentes Frontend

### Reestruturacao do `EventoColisao.tsx`

A pagina atual sera refatorada para funcionar como container do wizard:
- Valida token (logica existente)
- Mostra header com info do sinistro + stepper visual (3 bolinhas)
- Renderiza o componente da etapa atual
- Se todas etapas completadas, mostra tela de sucesso (read-only)

### Novos Componentes

| Componente | Descricao |
|---|---|
| `EventoEtapa1Vistoria.tsx` | Grid de fotos (3 colunas mobile), min 5 / max 15 fotos, upload com preview, compressao via imageCompressor existente |
| `EventoEtapa2BO.tsx` | Upload de arquivo (foto/PDF), campos "Numero do B.O." e "Resumo do B.O.", validacao minima |
| `EventoEtapa3Relato.tsx` | Textarea relato, gravador de audio (MediaRecorder API), data/hora do evento, local (rua + numero), checkbox terceiro com campos condicionais |
| `EventoStepper.tsx` | Indicador visual de progresso (3 bolinhas coloridas + labels) |
| `EventoSucesso.tsx` | Tela final de confirmacao com resumo read-only |
| `AudioRecorder.tsx` | Componente reutilizavel de gravacao de audio com cronometro, play/pause, regravar |

### Etapa 1 - Auto Vistoria

- Grid 3 colunas com slots de camera
- Clique abre camera do celular (accept="image/*" capture="environment")
- Miniatura com X para remover
- Contador "5 de 15 fotos"
- Botao "Proxima Etapa" habilitado quando >= 5 fotos
- Ao avancar: comprime fotos, envia via `salvar-etapa-evento`, salva URLs

### Etapa 2 - Boletim de Ocorrencia

- Area de upload drag-and-drop (foto, imagem, PDF)
- Preview do arquivo enviado
- Campo texto "Numero do B.O." (obrigatorio)
- Campo textarea "Resumo do B.O." (opcional)
- Botao habilitado quando: >= 1 arquivo + numero preenchido
- Flag `validacao_pendente: true` no dados_etapa2

### Etapa 3 - Relato Completo

- Textarea grande para relato escrito
- Botao de gravacao de audio (MediaRecorder API, formato webm)
  - Cronometro durante gravacao
  - Player para ouvir apos gravar
  - Botao regravar
- Campo data/hora do evento (input datetime-local)
- Campos local: rua + numero/referencia
- Checkbox "Houve terceiro envolvido?" com campos condicionais:
  - Nome, placa, telefone do terceiro
  - Seletor culpa: Sim / Nao / Nao sei
- Botao "Finalizar Envio"
- Ao finalizar: salva tudo, muda status para `documentacao_enviada`

### Tela de Sucesso

- Icone de check verde
- Mensagem: "Tudo certo! Recebemos todas as informacoes..."
- Prazo de 7 dias uteis
- Resumo read-only do que foi enviado (fotos, B.O., relato)
- Link continua acessivel mas sem edicao

---

## 4. Upload Strategy

Como o associado nao esta logado, os uploads nao podem ir direto ao Storage (RLS bloqueia anon). A estrategia:

- Fotos sao comprimidas no client (usando `compressImage` existente)
- Enviadas como FormData para a edge function `salvar-etapa-evento`
- A edge function usa `SUPABASE_SERVICE_ROLE_KEY` para fazer upload ao bucket `sinistro-eventos`
- Retorna as URLs publicas dos arquivos salvos

---

## 5. Gravacao de Audio

Componente `AudioRecorder`:
- Usa `navigator.mediaDevices.getUserMedia({ audio: true })`
- `MediaRecorder` para gravar em webm/opus
- Cronometro visual durante gravacao
- Apos parar: cria blob, mostra player `<audio>` para review
- Botao regravar descarta anterior
- Audio enviado como File no FormData da etapa 3

---

## 6. Salvamento de Progresso

Cada etapa salva individualmente ao clicar "Proxima Etapa" ou "Finalizar":
1. Upload dos arquivos via edge function
2. Edge function atualiza `sinistro_evento_links` com `dados_etapa{N}` e `etapa_atual`
3. Se o associado sair e voltar, a pagina carrega o estado atual do link
4. Etapas ja completadas mostram resumo read-only
5. Etapa atual mostra o formulario para preencher

---

## 7. Arquivos a Criar

| Arquivo | Descricao |
|---|---|
| Migration SQL | Bucket `sinistro-eventos` + politicas storage |
| `supabase/functions/salvar-etapa-evento/index.ts` | Upload de arquivos + salvamento de dados por etapa |
| `src/components/evento/EventoStepper.tsx` | Stepper visual 3 etapas |
| `src/components/evento/EventoEtapa1Vistoria.tsx` | Upload de fotos dos danos |
| `src/components/evento/EventoEtapa2BO.tsx` | Upload B.O. + campos |
| `src/components/evento/EventoEtapa3Relato.tsx` | Relato + audio + local + terceiro |
| `src/components/evento/EventoSucesso.tsx` | Tela de conclusao |
| `src/components/evento/AudioRecorder.tsx` | Gravador de audio reutilizavel |

## 8. Arquivos a Modificar

| Arquivo | Mudanca |
|---|---|
| `src/pages/public/EventoColisao.tsx` | Refatorar para wizard com etapas reais em vez de placeholder |
| `supabase/config.toml` | Adicionar `verify_jwt = false` para `salvar-etapa-evento` |

---

## 9. Detalhes Tecnicos

### Compressao de fotos
Reutilizar `src/lib/imageCompressor.ts` existente com config: maxWidth 1920, quality 0.75, maxSizeKB 800.

### FormData para edge function
As fotos sao enviadas como FormData (nao base64) para evitar problemas de memoria no celular. A edge function faz parse do multipart e faz upload ao storage.

### Validacao na edge function
- Etapa 1: exige pelo menos 5 arquivos de imagem
- Etapa 2: exige pelo menos 1 arquivo + numero_bo no body
- Etapa 3: exige relato_texto OU audio no body

### Atualizacao de status do sinistro
Ao completar etapa 3, a edge function:
1. Muda `sinistro_evento_links.status` para `completado`
2. Atualiza `sinistros.status` para `documentacao_enviada`
3. Registra timestamp em `etapa3_completada_em`
