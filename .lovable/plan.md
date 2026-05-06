## Causa raiz

A edge `rastreador-auth` espera o campo `plataforma` no body (`{ plataforma: 'rede_veiculos' | 'softruck' }`). Porém, **todas as edges `rede-veiculos-*`** estão enviando `plataforma_codigo` (nome antigo), o que faz a validação cair em "Plataforma inválida. Use: rede_veiculos ou softruck".

Por isso a ativação dos associados (Erico Moraes e Rodolfo da Silva Lira) falha na etapa de vincular cliente na Rede Veículos — o token nunca é obtido.

## Correção

1. **rastreador-auth/index.ts**: aceitar ambos os nomes (`plataforma` e `plataforma_codigo`) para retro‑compatibilidade — evita quebrar qualquer chamador legado.
2. **Atualizar callers** que ainda usam `plataforma_codigo` para usar `plataforma`:
   - rede-veiculos-vincular-cliente
   - rede-veiculos-atualizar-cliente
   - rede-veiculos-atualizar-veiculo
   - rede-veiculos-ativar-veiculo
   - rede-veiculos-inativar-veiculo
   - rede-veiculos-informar-inadimplente
   - rede-veiculos-informar-adimplente
   - rede-veiculos-obter-status-cliente
   - rede-veiculos-obter-status-veiculo
   - rede-veiculos-sincronizar-status
   - rastreador-redefinir-senha (usa `plataforma_codigo: plataforma.plataforma`)
3. Fazer deploy das functions alteradas.
4. Validar reativando o associado Erico (RIR1B37) pelo painel de Aprovações do Monitoramento.

Sem migrations, sem mudanças de UI, sem mudança de schema.