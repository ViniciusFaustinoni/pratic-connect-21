

## Correções das Funcionalidades Mobile no App do Vistoriador

### Análise do Estado Atual

Após inspeção completa do código, identifiquei os seguintes problemas funcionais no App do Vistoriador (tela mobile):

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ PROBLEMAS IDENTIFICADOS                                                     │
├────────────────────────────────────────────────────────────────────────────┤
│ 1. Itens do menu do Perfil não funcionam (onClick vazio)                   │
│ 2. Falta página de Configurações específica para instalador                │
│ 3. Falta página de Notificações para instalador                            │
│ 4. "Ajuda e Suporte" não leva a lugar nenhum                               │
│ 5. "Privacidade" não tem funcionalidade                                    │
│ 6. Vistoriador Base vê o ação "Ver no Mapa" mesmo sem acesso ao mapa       │
└────────────────────────────────────────────────────────────────────────────┘
```

### Solução Proposta

#### 1. Criar Página de Configurações do Instalador

Criar uma nova página `InstaladorConfiguracoes.tsx` para configurações específicas do profissional de campo:
- Preferências de notificações
- Configurações de localização
- Tema (claro/escuro)
- Versão do app

#### 2. Criar Página de Notificações do Instalador

Criar uma nova página `InstaladorNotificacoes.tsx` para listar as notificações:
- Notificações de novas tarefas
- Alertas do sistema
- Histórico de atribuições

#### 3. Criar Página de Ajuda e Suporte

Criar uma nova página `InstaladorAjuda.tsx`:
- Telefone do coordenador
- WhatsApp do suporte
- FAQs comuns
- Como usar o app

#### 4. Atualizar a Página de Perfil

Conectar todos os itens de menu às suas páginas correspondentes.

#### 5. Corrigir Ações Rápidas para Vistoriador Base

Na tela Home, ocultar o card "Ver no Mapa" para profissionais com role `vistoriador_base`.

### Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/pages/instalador/InstaladorConfiguracoes.tsx` | CRIAR | Página de configurações |
| `src/pages/instalador/InstaladorNotificacoes.tsx` | CRIAR | Página de notificações |
| `src/pages/instalador/InstaladorAjuda.tsx` | CRIAR | Página de ajuda e suporte |
| `src/pages/instalador/InstaladorPerfil.tsx` | MODIFICAR | Conectar menu items às páginas |
| `src/pages/instalador/InstaladorHome.tsx` | MODIFICAR | Ocultar mapa para vistoriador base |
| `src/App.tsx` | MODIFICAR | Adicionar novas rotas |

### Implementação Detalhada

#### InstaladorConfiguracoes.tsx

```text
┌───────────────────────────────────────────────────────────────┐
│ ⚙️ Configurações                                               │
├───────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ 🔔 Notificações                                           │ │
│ │    Receber alertas de novas tarefas          [   ON   ]  │ │
│ │    Receber alertas de encaixes urgentes      [   ON   ]  │ │
│ └───────────────────────────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ 📍 Localização                                            │ │
│ │    GPS de alta precisão                      [   ON   ]  │ │
│ │    Atualização em segundo plano              [   ON   ]  │ │
│ └───────────────────────────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ 🎨 Aparência                                              │ │
│ │    Tema escuro                               [   ON   ]  │ │
│ └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

#### InstaladorNotificacoes.tsx

```text
┌───────────────────────────────────────────────────────────────┐
│ 🔔 Notificações                                                │
├───────────────────────────────────────────────────────────────┤
│ Hoje                                                          │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ ✅ Nova tarefa atribuída                      10:30       │ │
│ │    Instalação - ABC-1234                                  │ │
│ └───────────────────────────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ ⚡ Encaixe urgente disponível                 09:15       │ │
│ │    Cliente reagendou para hoje                            │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                               │
│ Ontem                                                         │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ 📦 Tarefa concluída                          17:45       │ │
│ │    Vistoria - XYZ-5678                                    │ │
│ └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

#### InstaladorAjuda.tsx

```text
┌───────────────────────────────────────────────────────────────┐
│ ❓ Ajuda e Suporte                                             │
├───────────────────────────────────────────────────────────────┤
│ Precisa de ajuda?                                             │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ 📞 Ligar para Coordenador                                 │ │
│ │    (11) 99999-9999                                        │ │
│ └───────────────────────────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ 💬 WhatsApp Suporte                                       │ │
│ │    Enviar mensagem                                        │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                               │
│ Dúvidas Frequentes                                            │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ ▶ Como iniciar o serviço?                                 │ │
│ │ ▶ O que fazer se não tenho GPS?                           │ │
│ │ ▶ Como funciona o encaixe urgente?                        │ │
│ │ ▶ Como tirar fotos da vistoria?                           │ │
│ └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

#### Modificações em InstaladorPerfil.tsx

```typescript
const menuItems = [
  { 
    icon: Settings, 
    label: 'Configurações', 
    onClick: () => navigate('/instalador/configuracoes') 
  },
  { 
    icon: Bell, 
    label: 'Notificações', 
    onClick: () => navigate('/instalador/notificacoes') 
  },
  { 
    icon: HelpCircle, 
    label: 'Ajuda e Suporte', 
    onClick: () => navigate('/instalador/ajuda') 
  },
  { 
    icon: Shield, 
    label: 'Privacidade', 
    onClick: () => window.open('/politica-privacidade', '_blank')
  },
];
```

#### Modificações em InstaladorHome.tsx (Ocultar Mapa para Vistoriador Base)

```typescript
// Adicionar verificação de role
const { hasRole } = useAuth();
const isVistoriadorBase = hasRole('vistoriador_base') && !hasRole('instalador_vistoriador');

// Filtrar o card de mapa condicionalmente
{!isVistoriadorBase && (
  <Card onClick={() => navigate('/instalador/mapa')}>
    ...
  </Card>
)}
```

#### Novas Rotas no App.tsx

```typescript
// Dentro do bloco <Route element={<InstaladorLayout />}>
<Route path="/instalador/configuracoes" element={<InstaladorConfiguracoes />} />
<Route path="/instalador/notificacoes" element={<InstaladorNotificacoes />} />
<Route path="/instalador/ajuda" element={<InstaladorAjuda />} />
```

### Fluxo Corrigido

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ ANTES (PROBLEMA)                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ Menu Perfil:                                                               │
│   [Configurações]     → onClick: () => {}        ✗ Não faz nada            │
│   [Notificações]      → onClick: () => {}        ✗ Não faz nada            │
│   [Ajuda e Suporte]   → onClick: () => {}        ✗ Não faz nada            │
│   [Privacidade]       → onClick: () => {}        ✗ Não faz nada            │
│                                                                            │
│ Ações Rápidas (Vistoriador Base):                                          │
│   [Ver no Mapa]       → Mostra card              ✗ Não deveria aparecer    │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│ DEPOIS (CORRIGIDO)                                                          │
├────────────────────────────────────────────────────────────────────────────┤
│ Menu Perfil:                                                               │
│   [Configurações]     → /instalador/configuracoes   ✓ Nova página          │
│   [Notificações]      → /instalador/notificacoes    ✓ Nova página          │
│   [Ajuda e Suporte]   → /instalador/ajuda           ✓ Nova página          │
│   [Privacidade]       → Abre política em nova aba   ✓ Funcional            │
│                                                                            │
│ Ações Rápidas (Vistoriador Base):                                          │
│   [Ver no Mapa]       → Oculto                      ✓ Condicionalmente     │
└────────────────────────────────────────────────────────────────────────────┘
```

