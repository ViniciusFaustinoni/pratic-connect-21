

## Ajuste — "Solicitar Documentos" alinhado ao fluxo real de autovistoria

### Problema

O botão **Solicitar Documentos** na análise da proposta (`/cadastro/propostas/:id`) abre um dialog com **17+ opções genéricas** (selfie com veículo, 4 lados, 4 pneus, banco dianteiro/traseiro, etc.) que **não existem** no fluxo real de autovistoria de Roubo e Furto. Hoje a autovistoria captura apenas:

- **Carro**: 2 fotos (chassi + motor) + 1 vídeo 360°
- **Moto**: 2 fotos (chassi + motor) + 1 vídeo 360°

Além disso, o botão se chama "Solicitar Documentos" mas serve também para pedir reenvio de fotos/vídeo — nome engana.

### Solução

**1. Renomear** o botão e o dialog para **"Solicitar Reenvio"** (título) / **"Solicitar novo envio"** (botão) — cobre documentos, fotos e vídeos.

**2. Reescrever a lista de itens** do `SolicitarDocumentosDialog.tsx` para espelhar **exatamente** o que a autovistoria/contratação real coleta, detectando o tipo de veículo (carro/moto) a partir da proposta.

Nova estrutura de categorias:

- **Documentos Pessoais** (sempre):
  - CNH
  - CRLV (documento do veículo)
  - Comprovante de Residência

- **Autovistoria — Roubo e Furto** (quando `isAutovistoria`):
  - `chassi` — Foto do chassi (carro ou moto, conforme veículo)
  - `motor` — Foto do motor
  - `video_360` — Vídeo 360° do veículo (NOVO tipo de item)

- **Fotos Técnicas do Instalador** (quando NÃO é autovistoria — instalação presencial ou vistoria na base, cobertura total):
  - Lista herdada do laudo real do instalador (frente, traseira, laterais, painel, odômetro, chassi, motor) — puxada do config `FOTOS_INSTALADOR` já existente no sistema, sem itens inventados.

- **Outros** (sempre, 1 item):
  - Outro (descrever nas observações)

Categorias exibidas são **condicionais** baseadas em `isAutovistoria` e no `tipo_veiculo` — o analista só vê o que o cliente realmente precisa reenviar.

**3. Detectar `tipoVeiculo`** no componente: novo prop `tipoVeiculo: 'carro' | 'moto'` passado de `PropostaAnalise.tsx`. Resolvido lendo `proposta.veiculo_marca`/`veiculo_modelo` → tabela `marcas_modelos.categoria` (já é a fonte oficial por memory `vehicle-type-detection-source`). Se não resolver, default = `'carro'` e ambos tipos ficam visíveis.

**4. Adicionar suporte ao tipo `video_360`** no mapa `DOCUMENTO_LABELS` de `usePropostasPendentes.ts` (linha 1433) para a mensagem WhatsApp ficar legível: `video_360 → "Vídeo 360° do Veículo"`.

**5. Botão e título** em `PropostaApprovalStepper.tsx` (linha 370) passam de **"Solicitar Documentos"** para **"Solicitar Reenvio"**. Título do dialog idem. `onSolicitarDocs` continua igual.

**6. Mensagem de ajuda no topo do dialog** fica:
> "Selecione os itens que o associado precisa **reenviar** (documentos, fotos ou vídeo). Ele será notificado via WhatsApp com o link de acompanhamento."

### Validação pós-deploy

1. Logar como `admin@teste.com` → `/cadastro/propostas/9efdeaad-7735-410a-b2d1-630abe00dc0a` → clicar **Solicitar Reenvio**.
2. Como é autovistoria de Roubo e Furto de carro, dialog mostra **somente**: Documentos Pessoais (3), Autovistoria Roubo e Furto (chassi, motor, vídeo 360°), Outros.
3. Não aparecem mais: selfie com veículo, pneus, bancos, laterais soltas.
4. Abrir uma proposta de **moto** com autovistoria → `chassi` e `motor` ficam rotulados conforme `FOTOS_AUTOVISTORIA_MOTO`.
5. Abrir uma proposta com **instalação presencial concluída** (não autovistoria) → dialog mostra a lista do instalador (frente, traseira, laterais, painel, odômetro, chassi, motor).
6. Selecionar `video_360` + CNH → confirmar → WhatsApp recebido pelo associado mostra linha `• Vídeo 360° do Veículo` e `• CNH`.
7. Texto do botão na zona de aprovação final lê "Solicitar Reenvio" em vez de "Solicitar Documentos".

### Arquivos alterados

- `src/components/cadastro/SolicitarDocumentosDialog.tsx` — reescrita da lista `CATEGORIAS_DOCUMENTOS` com detecção de contexto (`isAutovistoria`, `tipoVeiculo`), novo tipo `video_360`, título "Solicitar Reenvio".
- `src/components/cadastro/proposta/PropostaApprovalStepper.tsx` — label do botão vira "Solicitar Reenvio".
- `src/pages/cadastro/PropostaAnalise.tsx` — passa `isAutovistoria` e `tipoVeiculo` resolvido ao `SolicitarDocumentosDialog`.
- `src/hooks/usePropostasPendentes.ts` — adicionar `video_360` em `DOCUMENTO_LABELS`.
- (Opcional, só se necessário) `src/hooks/useVehicleCategory.ts` ou reuso do helper existente em `vehicle-type-detection-source` para resolver carro/moto via `marcas_modelos`.

Sem migração, sem mudança de schema, sem quebrar fluxos existentes.

