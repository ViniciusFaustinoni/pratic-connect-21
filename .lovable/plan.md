
# Plano: Remover Itens do Modal de Confirmação de Aprovação

## Contexto

O modal "Confirmar Aprovação" na página de análise de proposta exibe uma lista de 4 ações que serão realizadas ao aprovar. O usuário solicita a remoção de 2 itens que não são mais aplicáveis:

1. **"Criar instalação pendente (rastreador)"** - A instalação já foi efetuada pelo vistoriador
2. **"Gerar primeira cobrança"** - O sistema não criará nova cobrança neste momento

## Alteração

### Arquivo: `src/pages/cadastro/PropostaAnalise.tsx`

**Localização:** Linhas 944-956

**Itens a REMOVER:**
- Item "Criar instalação pendente (rastreador)" (ícone de chave inglesa azul)
- Item "Gerar primeira cobrança" (ícone de cartão amarelo)

**Itens que PERMANECEM:**
- "Ativar o associado no sistema" (ícone de usuário verde)
- "Liberar acesso ao App do Associado" (ícone de smartphone roxo)

## Resultado Visual Esperado

O modal passará de 4 itens para 2 itens:

| Antes | Depois |
|-------|--------|
| Ativar o associado no sistema | Ativar o associado no sistema |
| Criar instalação pendente (rastreador) | ~~removido~~ |
| Gerar primeira cobrança | ~~removido~~ |
| Liberar acesso ao App do Associado | Liberar acesso ao App do Associado |
