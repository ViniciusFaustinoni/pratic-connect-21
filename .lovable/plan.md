

## Plano: Prestador Parceiro com Fluxo Idêntico ao Técnico Interno

### Estado Atual
- Existe `vistoria_prestador_links` com token + checklist + fotos (UI já é similar ao técnico interno).
- Existe `gerar-link-vistoriador-prestador` que envia WhatsApp (texto + fallback). **Não usa template Meta oficial.**
- **Não há captura de localização** do prestador (a tabela `vistoriadores_localizacao` exige `vistoriador_id` que é um `profiles.id`, não funciona para prestador externo).
- **Mapa de Atribuições** consulta `useVistoriadoresRealtime` (apenas `vistoriadores_localizacao` com profiles) e desenha rotas com base em `servicos`. Prestadores externos não aparecem.
- A tela pública `VistoriaPrestador.tsx` já replica checklist + fotos + assinatura. O que falta: **gestão de localização, status (aguardando aceite → aceito → em rota → em execução → concluído) e exibição no mapa**.

### Mudanças

#### 1. Migration SQL — suporte a localização e ciclo de vida do prestador
- Em `vistoria_prestador_links`, adicionar:
  - `latitude double precision`, `longitude double precision`, `precisao_metros double precision`, `localizacao_atualizada_em timestamptz`
  - `aceito_em timestamptz`, `recusado_em timestamptz`, `recusa_motivo text`
  - `em_rota_em timestamptz`, `iniciada_em timestamptz`
  - Status passa a aceitar: `aguardando` → `aceito` → `em_rota` → `em_execucao` → `concluida` (manter `aguardando` como default)
- Mesmo conjunto em `instalacao_prestador_links` (legacy de instalação simples).
- Habilitar realtime (`alter publication supabase_realtime add table ...`).

#### 2. Template Meta WhatsApp — `prestador_nova_tarefa_v1`
- Atualizar `gerar-link-vistoriador-prestador` para invocar `whatsapp-send-text` com `template_nome: 'prestador_nova_tarefa_v1'` e variáveis (1=nome, 2=veículo, 3=cidade, 4=link).
- Manter `mensagem_fallback` como texto formatado atual + `allow_text: true`.
- (Cliente cadastra o template aprovado na Meta separadamente; sistema apenas envia.)

#### 3. Tela Pública do Prestador — adicionar etapas espelhadas ao técnico interno
Em `VistoriaPrestador.tsx` (e por simetria em `PrestadorInstalacao.tsx`):
- **Ao abrir o link**: solicitar geolocalização (`navigator.geolocation.watchPosition`). Salvar `lat/lng/precisao` em `vistoria_prestador_links` a cada ~30s enquanto a aba estiver aberta.
- **Tela 1 (status `aguardando`)**: substituir auto-marcar `em_execucao` por botão **"Aceitar Tarefa"** / **"Recusar"** (com motivo). Ao aceitar → status `aceito` + `aceito_em`.
- **Tela 2 (status `aceito`)**: botão **"Iniciar Rota"** → status `em_rota` + `em_rota_em`.
- **Tela 3 (status `em_rota`)**: botão **"Cheguei / Iniciar Vistoria"** → status `em_execucao` + `iniciada_em`. (mostrar dados básicos enquanto navega).
- **Tela 4 (status `em_execucao`)**: checklist + fotos + assinatura (já existente).
- **Tela 5 (status `concluida`)**: parar `watchPosition`, exibir tela final.

#### 4. Hook `usePrestadoresAtivosMapa` (novo)
- Query realtime em `vistoria_prestador_links` + `instalacao_prestador_links` filtrando `status IN ('aceito','em_rota','em_execucao')` e com `latitude/longitude` recentes (<15min).
- Join com `vistoriadores_prestadores` para nome/telefone e com `instalacoes` para coordenadas de destino.
- Mapear para o mesmo shape de `VistoriadorLocalizacao` mas com flag `is_prestador: true`.

#### 5. `MapaVistoriasContent.tsx` — renderizar prestadores
- Importar `usePrestadoresAtivosMapa`.
- Renderizar `Marker` para cada prestador ativo usando ícone diferenciado (cor laranja/amarelo + badge "P") via `createVistoriadorMarkerSvg`.
- Para prestadores em `em_rota` ou `em_execucao`, desenhar `RotaPolyline` da posição atual até `[instalacao.latitude, instalacao.longitude]` (mesma lógica de `linhasDeRota`, exibindo distância e tempo).
- Popup do marker: nome do prestador, status, telefone (com botão WhatsApp), nome do associado.
- `useVistoriadoresRealtime` permanece intacto — apenas adicionamos uma camada paralela.

#### 6. `MapaVistoriasContent` — contagem na legenda
- Adicionar contador "Prestadores em campo: N" ao lado de "Equipe em campo".

### Arquivos

| Arquivo | Ação |
|---------|------|
| Nova migration SQL | Adicionar lat/lng/timestamps de ciclo de vida em `vistoria_prestador_links` e `instalacao_prestador_links`; realtime |
| `supabase/functions/gerar-link-vistoriador-prestador/index.ts` | Trocar template para `prestador_nova_tarefa_v1` |
| `supabase/functions/gerar-link-prestador/index.ts` | Idem |
| `src/pages/public/VistoriaPrestador.tsx` | Captura de localização + ciclo aceitar/em rota/em execução |
| `src/pages/public/PrestadorInstalacao.tsx` | Mesmas etapas (paridade) |
| `src/hooks/usePrestadoresAtivosMapa.ts` (novo) | Query realtime de prestadores com posição |
| `src/components/mapa/MapaVistoriasContent.tsx` | Markers + rotas dos prestadores |

### Fora de escopo (não muda)
- Tela do técnico interno (`InstaladorTarefas`, `useTarefaAtual`, etc.) — segue intacta.
- Tabelas `servicos` e `agendamentos_base` — sem mudanças.
- `useVistoriadoresRealtime` — sem alterações.

