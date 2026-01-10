import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Search, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfiguracoesBreadcrumb } from './ConfiguracoesBreadcrumb';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useState, useEffect } from 'react';
import { 
  User, Shield, Bell, Building2, Settings,
  Users, KeyRound, Plug, ScrollText
} from 'lucide-react';

const searchItems = [
  { path: '/configuracoes/meu-perfil', label: 'Meu Perfil', keywords: 'nome foto avatar email telefone', icon: User },
  { path: '/configuracoes/seguranca', label: 'Segurança', keywords: 'senha password autenticação 2fa sessões', icon: Shield },
  { path: '/configuracoes/notificacoes', label: 'Notificações', keywords: 'alertas email push avisos', icon: Bell },
  { path: '/configuracoes/usuarios', label: 'Usuários', keywords: 'equipe funcionários colaboradores criar editar', icon: Users },
  { path: '/configuracoes/perfis', label: 'Perfis e Permissões', keywords: 'roles acesso permissões matriz', icon: KeyRound },
  { path: '/configuracoes/logs', label: 'Logs de Auditoria', keywords: 'histórico ações registro auditoria', icon: ScrollText },
  { path: '/configuracoes/empresa', label: 'Empresa', keywords: 'cnpj razão social endereço dados', icon: Building2 },
  { path: '/configuracoes/integracoes', label: 'Integrações', keywords: 'api webhook asaas whatsapp', icon: Plug },
  { path: '/configuracoes/sistema', label: 'Sistema', keywords: 'tema preferências configurações gerais', icon: Settings },
];

export function ConfiguracoesHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);

  // Keyboard shortcut for search
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(open => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleBack = () => {
    // Navigate to previous page or dashboard
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <>
      <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Back Button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleBack}
                      className="shrink-0 h-9 w-9"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Voltar</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Title and Breadcrumb */}
              <div className="hidden sm:block">
                <ConfiguracoesBreadcrumb />
              </div>
              <h1 className="sm:hidden text-lg font-semibold">Configurações</h1>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Search Button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSearchOpen(true)}
                      className="hidden sm:flex items-center gap-2 text-muted-foreground"
                    >
                      <Search className="h-4 w-4" />
                      <span className="text-sm">Buscar...</span>
                      <kbd className="pointer-events-none ml-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                        <span className="text-xs">⌘</span>K
                      </kbd>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Buscar configurações (⌘K)</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Mobile Search */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchOpen(true)}
                className="sm:hidden h-9 w-9"
              >
                <Search className="h-4 w-4" />
              </Button>

              {/* Help */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      asChild
                    >
                      <a href="https://docs.pratic.com.br" target="_blank" rel="noopener noreferrer">
                        <HelpCircle className="h-4 w-4" />
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ajuda</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </header>

      {/* Search Dialog */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Buscar configurações..." />
        <CommandList>
          <CommandEmpty>Nenhuma configuração encontrada.</CommandEmpty>
          <CommandGroup heading="Configurações">
            {searchItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <CommandItem
                  key={item.path}
                  value={`${item.label} ${item.keywords}`}
                  onSelect={() => {
                    navigate(item.path);
                    setSearchOpen(false);
                  }}
                  className="flex items-center gap-3 py-3"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="ml-auto text-xs text-muted-foreground">Atual</span>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
