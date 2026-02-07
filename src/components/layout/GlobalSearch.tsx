import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LayoutDashboard, Users, UserPlus, Calculator, Plus, FileText, DollarSign, BarChart3, Wrench, Car, ClipboardList, Megaphone, Briefcase, Scale, Settings, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const pages = [
  { name: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, keywords: 'inicio home principal' },
  { name: 'Associados', url: '/cadastro/associados', icon: Users, keywords: 'clientes membros pessoas' },
  { name: 'Veículos', url: '/cadastro/veiculos', icon: Car, keywords: 'carros motos auto' },
  { name: 'Leads', url: '/vendas/leads', icon: UserPlus, keywords: 'prospectos contatos vendas' },
  { name: 'Cotações', url: '/vendas/cotacoes', icon: Calculator, keywords: 'cotacao preco valor orcamento' },
  { name: 'Kanban', url: '/vendas/kanban', icon: ClipboardList, keywords: 'pipeline funil vendas' },
  { name: 'Instalações', url: '/operacional/instalacoes', icon: Wrench, keywords: 'agendamento tecnico rastreador' },
  { name: 'Assistência 24h', url: '/operacional/assistencia', icon: HelpCircle, keywords: 'guincho socorro chamado' },
  { name: 'Financeiro', url: '/financeiro', icon: DollarSign, keywords: 'pagamentos boletos cobranca' },
  { name: 'Marketing', url: '/marketing', icon: Megaphone, keywords: 'campanhas leads indicacoes' },
  { name: 'RH', url: '/rh', icon: Briefcase, keywords: 'funcionarios folha ponto' },
  { name: 'Jurídico', url: '/juridico', icon: Scale, keywords: 'processos advogados contratos' },
  { name: 'Relatórios', url: '/relatorios', icon: BarChart3, keywords: 'graficos metricas dados' },
  { name: 'Documentos', url: '/cadastro/documentos', icon: FileText, keywords: 'arquivos upload anexos' },
  { name: 'Configurações', url: '/configuracoes', icon: Settings, keywords: 'sistema opcoes preferencias' },
];

const quickActions = [
  { name: 'Nova Cotação', url: '/vendas/cotacoes?novo=true', icon: Calculator, keywords: 'criar cotacao nova' },
  { name: 'Novo Lead', url: '/vendas/leads', icon: Plus, keywords: 'adicionar lead novo' },
  { name: 'Agendar Instalação', url: '/operacional/instalacoes', icon: Wrench, keywords: 'agendar instalacao nova' },
  { name: 'Novo Associado', url: '/cadastro/associados', icon: UserPlus, keywords: 'cadastrar associado novo' },
];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Atalho Ctrl+K / ⌘+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = (url: string) => {
    navigate(url);
    setOpen(false);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <Search className="h-4 w-4" />
            <span className="sr-only">Buscar</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Buscar <kbd className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs">⌘K</kbd></p>
        </TooltipContent>
      </Tooltip>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar páginas, ações..." />
        <CommandList>
          <CommandEmpty>
            <div className="py-6 text-center text-sm text-muted-foreground">
              Nenhum resultado encontrado.
            </div>
          </CommandEmpty>

          <CommandGroup heading="Páginas">
            {pages.map((page) => (
              <CommandItem
                key={page.url}
                value={`${page.name} ${page.keywords}`}
                onSelect={() => handleSelect(page.url)}
                className="cursor-pointer"
              >
                <page.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{page.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Ações Rápidas">
            {quickActions.map((action) => (
              <CommandItem
                key={`action-${action.name}`}
                value={`${action.name} ${action.keywords}`}
                onSelect={() => handleSelect(action.url)}
                className="cursor-pointer"
              >
                <action.icon className="mr-2 h-4 w-4 text-primary" />
                <span>{action.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
