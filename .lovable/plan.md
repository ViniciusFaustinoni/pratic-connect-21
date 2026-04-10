

## Plano: Melhorar modal de retirada com contatos, WhatsApp e endereço

### Situação atual
O modal `AbrirRetiradaModal` já existe com calendário, encaixe e dados do associado. Porém falta:
1. **Botao WhatsApp** para contato direto com o associado
2. **Endereço completo** visível no modal (atualmente só usado internamente)
3. O serviço criado (`vistoria_retirada`) já aparece no mapa e atribuições via a seção "SERVICOS DIRETOS" da `view_vistorias_mapa` -- sem mudança necessária aqui.

### Mudanças (1 arquivo)

**`src/components/monitoramento/retirada/AbrirRetiradaModal.tsx`**

Na seção "Dados do Associado" (linhas 344-367):
- Adicionar **botão WhatsApp** verde ao lado do telefone, abrindo `https://wa.me/55{telefone}` em nova aba
- Exibir **endereço completo** do associado (logradouro, numero, bairro, cidade/UF, CEP) abaixo dos dados de contato
- Mostrar telefone e WhatsApp (se diferente) como dados clicáveis

Importar `Phone`, `MessageCircle`, `MapPin` do lucide-react.

### Resultado
O coordenador de monitoramento ao clicar "Retirar Rastreador" verá:
- Dados do rastreador (status online/offline)
- Contatos do associado com botão WhatsApp
- Endereço completo
- Calendário com seleção de data/período e opção de encaixe
- A tarefa criada aparece automaticamente no mapa, atribuições e serviços de campo (já funciona)

