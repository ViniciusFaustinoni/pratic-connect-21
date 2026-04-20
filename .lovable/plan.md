

## Adicionar Dados do Associado + Galerias de Fotos ao Drawer de Instalação

### Objetivo
Estender `InstalacaoDetailDrawer.tsx` com 3 novos blocos no final do conteúdo (antes das ações de status), sem unificar com a tela de associado e sem tocar em outros arquivos.

### Layout final do drawer

```text
Detalhes da Instalação                              [Status] ×
├─ Agendamento / Veículo / Endereço / Prestador …   (já existe)
├─ ▼ Dados do Associado                             ← NOVO
│   ├─ Identificação (nome, CPF, RG, nascimento, estado civil, profissão)
│   ├─ Contato (telefone, telefone 2, e-mail)
│   ├─ Endereço residencial
│   ├─ Status + data de cadastro + plano + mensalidade
│   └─ CNH (quando houver)
├─ ▼ Galeria de Autovistoria                        ← NOVO (só se ≥1 foto)
│   └─ Grid de thumbnails agrupadas por categoria
├─ ▼ Galeria do Instalador                          ← NOVO (só se ≥1 foto)
│   ├─ Grid de thumbnails (exterior / identificação / interior)
│   └─ Vídeo 360 (quando houver)
└─ Ações de status                                  (já existe)
```

### Implementação técnica

**Arquivo único alterado:** `src/components/instalacoes/InstalacaoDetailDrawer.tsx`

1. **Query do associado** (`useQuery` em `associados`):
   campos `nome, cpf_cnpj, rg, data_nascimento, estado_civil, profissao, nacionalidade, telefone, telefone_secundario, email, endereco, numero, complemento, bairro, cidade, estado, cep, status, created_at, cnh_numero, cnh_categoria, cnh_validade`.

2. **Query do plano vigente** (`useQuery` em `contratos → planos`):
   filtrar por `associado_id + veiculo_id` da instalação. Mesma chamada já retorna `contratos.cotacao_id` para alimentar a galeria de autovistoria.
   Select: `cotacao_id, data_adesao, planos ( nome, valor_mensalidade )`.

3. **Hook de fotos** — reaproveitar `useFotosVistoriaUnificada({ contratoId: instalacao.contrato_id, cotacaoId })` de `src/hooks/useFotosAutovistoria.ts`. Retorna `fotosInstalador`, `fotosAutovistoria`, `video360Url`. Agrupar com `agruparFotosPorCategoria()` e formatar labels com `formatarTipoFoto()`.

4. **Galerias** — grid responsivo `grid-cols-3 sm:grid-cols-4 md:grid-cols-6`, thumbnails `aspect-square object-cover`, separador visual por categoria. Vídeo 360 renderizado inline com tag `<video controls>` no topo da galeria do instalador.

5. **Visualizador** — estado local `{ visualizadorAberto, fotoIndex, fotosAtivas }`. Clicar numa thumbnail seta `fotosAtivas` (lista mapeada para `{ url, label, tipo }`) e abre o `VisualizadorFoto` já existente em `src/components/analise/VisualizadorFoto.tsx`.

6. **Estado vazio gracioso** — cada um dos 2 cards de galeria some quando o array correspondente é vazio. Card "Dados do Associado" sempre aparece (com loader enquanto carrega). Subcard CNH some se `cnh_numero` for nulo.

### O que NÃO muda
Sem migração, sem novo hook, sem alteração em RLS/schema/rotas/buckets, sem mudanças no `VisualizadorFoto`. RLS já cobre staff em todas as tabelas envolvidas.

### Validação pós-deploy
1. `/monitoramento/instalacoes` → abrir instalação concluída com fotos do instalador → ver "Dados do Associado" + "Galeria do Instalador" + vídeo 360 (quando houver).
2. Clicar em thumbnail → `VisualizadorFoto` abre com navegação, zoom e rotação.
3. Instalação cujo associado fez autovistoria → aparece também "Galeria de Autovistoria".
4. Instalação agendada sem fotos → só "Dados do Associado" aparece; cards de galeria ocultos.
5. Associado sem CNH → subcard de CNH some.
6. Mobile 400px → grids empilham para 3 colunas, modal continua navegável.
7. Perfil `analista_cadastro` → vê tudo.

