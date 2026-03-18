

## Plano: Reorganizar botões de ação na tabela de Cotações

### Arquivo
`src/components/cotacoes/CotacoesTable.tsx`

### Mudança

**Botões visíveis (ícones diretos):**
1. **Acessar Link** (ExternalLink) — abre link público em nova aba
2. **Copiar Link** (Link2) — copia link público para clipboard
3. **Baixar PDF** (FileDown) — já existe

**Menu "..." (DropdownMenu):**
1. Ver Detalhes
2. Copiar para WhatsApp (move o atual botão de ClipboardCopy para cá)
3. Duplicar (se permitido)
4. Excluir (se permitido)

### Detalhes técnicos

- Linhas 508-601: Reorganizar a seção de ações
- Mover o botão WhatsApp (ClipboardCopy, linhas 510-527) para dentro do DropdownMenu
- Mover "Acessar Link" e "Copiar Link" (linhas 556-573) do DropdownMenu para fora como botões de ícone com Tooltip
- Os botões de link só aparecem se `cotacao.token_publico` existir
- Aumentar largura da coluna de ações de `w-[110px]` para `w-[140px]` para acomodar os 4 ícones

