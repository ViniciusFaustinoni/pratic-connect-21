## Diagnóstico

**Causa raiz**: Existe um link em `vistoria_prestador_links` para a vistoria do MARCUS (LTB4J74) com `status='aguardando'`, criado mais cedo hoje (durante teste anterior via curl, sem envio de WhatsApp e nunca aceito pelo prestador). O guard em `useAtribuicaoManual.ts` (linhas 654–662) bloqueia corretamente nova atribuição enquanto houver link ativo — mas a UI **não oferece nenhum caminho** para cancelar esse link "fantasma" de vistoria, então o serviço fica preso.

```text
servicos 66b21dc1 (vistoria_entrada, status=agendada, profissional_id=NULL)
   └─ vistoria 2101860d (status=agendada)
        └─ vistoria_prestador_links 5eda6b02 (status=aguardando, criado 15:21) ← BLOQUEIA
```

A UI atual só sabe cancelar `instalacao_prestador_links` (botão "Cancelar/Devolver" no drawer do serviço); para `vistoria_prestador_links` não há nada equivalente, porque toda essa via foi adicionada agora junto com o suporte a Vistoria Base via prestador.

---

## Plano de correção

### 1. Correção pontual de dados (ANA isolada)
- Cancelar o link `5eda6b02` (`status='cancelada'`, `cancelled_at=now()`, observação "[CORREÇÃO] link de teste sem envio — liberado para reatribuição") via migration de DML.
- Após isso, o KLEYTONN consegue atribuir o serviço ao prestador escolhido normalmente.

### 2. Correção de raiz — auto-substituição de link "aguardando"
Editar `useAtribuicaoManual.ts` no bloco de prestador externo (linhas 643–663) para:

- Se o link existente está em `'aguardando'` (nunca aceito):
  - Cancelar automaticamente o(s) link(s) antigo(s) (`status='cancelada'`, `cancelled_at=now()`, observação "Substituído por nova atribuição a {prestador}").
  - Continuar o fluxo e gerar o novo link normalmente.
- Se está em `'em_execucao'` / `'aceito'` (prestador já interagiu): **manter** o bloqueio com a mensagem atual, porque substituir nesse caso é destrutivo.

Aplicar a mesma regra para os dois ramos:
- `instalacao_prestador_links` (linhas 644–653).
- `vistoria_prestador_links` (linhas 654–663).

### 3. UI explícita de cancelamento de link de vistoria
No drawer/painel do serviço (componentes que hoje listam o link de prestador da instalação), adicionar suporte simétrico para `vistoria_prestador_links`:
- Mostrar badge "Link aguardando aceite — prestador X" quando houver link ativo.
- Botão "Cancelar link" que faz `update vistoria_prestador_links set status='cancelada'`.
- Reaproveitar o componente já usado para `instalacao_prestador_links` (mesma UX), apenas selecionando a tabela conforme o tipo de origem (instalação vs vistoria pura).

Arquivos prováveis: `src/components/monitoramento/ServicoDetalheDrawer.tsx` (e/ou irmãos que renderizam "Prestador atribuído"). Confirmo no momento da implementação.

### 4. Validação como admin
- Logar como admin (`admin@teste.com`).
- Confirmar que o serviço do MARCUS aparece como "Não atribuído" e pode ser atribuído ao KLEYTONN sem erro.
- Testar o caminho 2: criar um link, depois atribuir novamente ao mesmo serviço (deve substituir silenciosamente quando status='aguardando').
- Testar o caminho 3: simular link `em_execucao` (insert manual via SQL) e confirmar que o bloqueio persiste com mensagem.

---

## Detalhes técnicos

- Tabela `vistoria_prestador_links` não tem coluna `cancelled_at` nem `expires_at` — usar `updated_at` + log via `observacoes` ou criar coluna `cancelled_at` na migration (preferência: criar coluna para paridade com `instalacao_prestador_links`).
- Manter `servicos.status` inalterado no cancelamento do link (já é 'agendada' antes do link e deve voltar a 'agendada' / aguardando atribuição — confirmar no fluxo existente).
- Não tocar em `gerar-link-vistoriador-prestador` — o guard precisa permanecer no client para evitar race; o bloqueio só muda o que fazer com link `'aguardando'`.

## Resumo das mudanças

- 1 migration: cancela link 5eda6b02 + adiciona `cancelled_at TIMESTAMPTZ` em `vistoria_prestador_links`.
- `src/hooks/useAtribuicaoManual.ts`: lógica de auto-cancelamento de links em `'aguardando'`.
- 1 componente de drawer: botão "Cancelar link" para vistoria_prestador_links.

Confirma para eu implementar?
