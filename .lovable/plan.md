
## Ajuste — Adicionar Dados do Associado + Galerias de Fotos ao Drawer de Instalação

Mantendo o drawer de **Detalhes da Instalação** como está (sem unificar com a tela de associado), **adicionar** três blocos novos ao final do conteúdo existente:

1. **Dados do Associado** — campos da aba "Associado" de `/cadastro/associados`.
2. **Galeria de Autovistoria** — fotos enviadas pelo associado (`cotacoes_vistoria_fotos`), quando houver.
3. **Galeria do Instalador** — fotos da instalação (`vistoria_fotos`) + vídeo 360 quando houver.

### Onde ficam os novos blocos

Inseridos em `InstalacaoDetailDrawer.tsx`, após as seções existentes (Agendamento, Veículo, Endereço, Prestador, Presença GPS, Recusas, Observações) e **antes** dos botões de Ação de Status.

```
Detalhes da Instalação                              [Status] ×
├─ Agendamento / Veículo / Endereço / Prestador …   (já existe)
├─ ▼ Dados do Associado                             ← NOVO
│   ├─ Identificação (nome, CPF, RG, nascimento, estado civil, profissão)
│   ├─ Contato (telefone, telefone 2, e-mail)
│   ├─ Endereço residencial
│   ├─ Status + data de cadastro + plano + mensalidade
│   └─ CNH (quando houver)
├─ ▼ Galeria de Autovistoria                        ← NOVO (quando aplicável)
│   └─ Grid de thumbnails agrupadas por categoria
├─ ▼ Galeria do Instalador                          ← NOVO (quando aplicável)
│   ├─ Grid de thumbnails agrupadas (exterior / identificação / interior)
│   └─ Vídeo 360 (quando houver)
└─ Ações de status                                  (já existe)
```

Cada galeria só renderiza se tiver ≥ 1 foto. Clicar em qualquer thumbnail abre o `VisualizadorFoto` (componente já existente em `src/components/analise/VisualizadorFoto.tsx`) com navegação, zoom, rotação e suporte a vídeo.

### Implementação

1. **`InstalacaoDetailDrawer.tsx`** — adicionar:
   - `useQuery` para `associados` (campos: nome, cpf_cnpj, rg, data_nascimento, estado_civil, profissao, nacionalidade, telefone, telefone_secundario, email, endereco, numero, complemento, bairro, cidade, estado, cep, status, created_at, cnh_numero, cnh_categoria, cnh_validade).
   - `useQuery` para plano vigente via `contratos` → `planos` (nome do plano, mensalidade, data de adesão) filtrando pelo `associado_id` + `veiculo_id` da instalação.
   - Hook `useFotosVistoriaUnificada({ contratoId: instalacao.contrato_id, cotacaoId: <quando houver> })` — **já existe** em `src/hooks/useFotosAutovistoria.ts`.
   - Para descobrir `cotacao_id`: consultar `contratos.cotacao_id` via o próprio `useQuery` de plano (mesma chamada já traz isso).
   - Renderizar os três blocos com estado vazio gracioso (card some quando não há dado).
   - Thumbnails em grid responsivo (`grid-cols-3 sm:grid-cols-4 md:grid-cols-6`), `aspect-square`, `object-cover`.
   - Estado local `visualizadorAberto` + `fotoIndex` + `fotosAtivas` para controlar o `VisualizadorFoto`.

2. **Sem mudanças** em hooks compartilhados, RLS, schema, rotas, buckets ou no componente `VisualizadorFoto`.
3. **RLS**: `associados`, `contratos`, `planos`, `cotacoes_vistoria_fotos` e `vistoria_fotos` já permitem leitura para staff (policy de `vistoria_fotos` foi adicionada na migração anterior).

### Validação pós-deploy

1. `/monitoramento/instalacoes` → abrir detalhes de instalação concluída com fotos de instalador → ver bloco "Dados do Associado" preenchido + "Galeria do Instalador" com thumbnails + vídeo 360 (quando houver).
2. Clicar em thumbnail → `VisualizadorFoto` abre, navega entre as fotos, zoom e rotação funcionam.
3. Instalação cujo associado fez autovistoria → aparece também "Galeria de Autovistoria".
4. Instalação agendada sem fotos ainda → apenas "Dados do Associado" aparece; os dois cards de galeria ficam ocultos.
5. Associado sem CNH → subcard de CNH some; demais campos continuam.
6. Mobile 400px → grids empilham para 3 colunas, modal continua navegável.
7. Perfil `analista_cadastro` → vê tudo (policies já cobrem).

### Arquivo tocado

- `src/components/instalacoes/InstalacaoDetailDrawer.tsx` — único arquivo alterado. Adiciona queries de associado/plano, integra `useFotosVistoriaUnificada` e `VisualizadorFoto`, renderiza os três novos blocos.

Sem migração, sem novo hook, sem mudança em outras telas.
