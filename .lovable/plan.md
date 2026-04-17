

## O que muda

No modal **`CalendarioDiaModal.tsx`**, na **aba Rota**, adicionar um aviso explicativo (banner) no topo informando que a atribuição de tarefas de rota **não é feita aqui** — deve ser feita no **Mapa** ou em **Serviços de Campo** —, com dois botões/links de redirecionamento. A aba **Base** continua exatamente como está hoje (com botões "Atribuir" / "Reatribuir" funcionando), pois a regra é: "atribuição por este modal é apenas para tarefas na base".

## Mudança técnica

**Arquivo único: `src/components/monitoramento/CalendarioDiaModal.tsx`**

1. Importar `useNavigate` de `react-router-dom`, e os ícones `MapIcon` e `Wrench` (lucide-react).
2. Dentro de `<TabsContent value="rota">` (linhas 417–469), inserir, **acima** do `rotaItems.length === 0 ? ...`, um bloco fixo:

```tsx
<div className="rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-3 mb-3">
  <div className="flex items-start gap-3">
    <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
    <div className="flex-1 space-y-2">
      <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
        Atribuição de tarefas de rota
      </p>
      <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
        Tarefas de rota não são atribuídas por este modal.
        Use o <strong>Mapa de Atribuições</strong> (visual, com técnicos em campo)
        ou <strong>Serviços de Campo</strong> (lista completa).
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-1.5"
          onClick={() => { onClose(); navigate('/monitoramento/mapa'); }}>
          <MapIcon className="h-3.5 w-3.5" /> Abrir Mapa
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5"
          onClick={() => { onClose(); navigate('/diretoria/vistorias-instalacoes'); }}>
          <Wrench className="h-3.5 w-3.5" /> Serviços de Campo
        </Button>
      </div>
    </div>
  </div>
</div>
```

3. (Opcional, leve) Na lista de cards da aba Rota, manter como está (apenas leitura). O texto "Não atribuído" já aparece na coluna do técnico — fica claro que o usuário precisa ir para os locais corretos.

## Validação

1. Logar como diretor.
2. Ir em **Monitoramento → Calendário** → clicar em um dia com tarefas de rota.
3. Aba **Rota**: deve aparecer o banner azul com explicação + 2 botões. Clicar em "Abrir Mapa" → navega para `/monitoramento/mapa` e fecha modal. Clicar em "Serviços de Campo" → navega para `/diretoria/vistorias-instalacoes`.
4. Aba **Base**: nada muda — botões "Atribuir/Reatribuir" continuam funcionando.

## Arquivos a editar

- `src/components/monitoramento/CalendarioDiaModal.tsx` (único)

