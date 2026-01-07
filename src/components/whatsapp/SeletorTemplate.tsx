import { useState } from 'react';
import { FileText, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { useWhatsAppTemplates, processarTemplate } from '@/hooks/useWhatsAppTemplates';
import type { WhatsAppTemplate, WhatsAppTemplateCategoria } from '@/types/whatsapp';

interface SeletorTemplateProps {
  categoria?: WhatsAppTemplateCategoria;
  variaveis?: Record<string, string>;
  onSelect: (mensagem: string, template: WhatsAppTemplate) => void;
  disabled?: boolean;
}

const categoriaLabels: Record<WhatsAppTemplateCategoria, string> = {
  vendas: '💼 Vendas',
  cadastro: '📋 Cadastro',
  cobranca: '💰 Cobrança',
  monitoramento: '🔧 Monitoramento',
  eventos: '🚨 Eventos',
  assistencia: '🆘 Assistência',
  geral: '📱 Geral',
};

export function SeletorTemplate({ 
  categoria, 
  variaveis = {}, 
  onSelect,
  disabled = false,
}: SeletorTemplateProps) {
  const [open, setOpen] = useState(false);
  const { data: templates, isLoading } = useWhatsAppTemplates(categoria);

  const handleSelect = (template: WhatsAppTemplate) => {
    const mensagemProcessada = processarTemplate(template.mensagem, variaveis);
    onSelect(mensagemProcessada, template);
    setOpen(false);
  };

  // Agrupar templates por categoria
  const templatesPorCategoria = templates?.reduce((acc, t) => {
    if (!acc[t.categoria]) acc[t.categoria] = [];
    acc[t.categoria].push(t);
    return acc;
  }, {} as Record<WhatsAppTemplateCategoria, WhatsAppTemplate[]>);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={disabled || isLoading}
        >
          <FileText className="h-4 w-4" />
          Usar Template
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar template..." />
          <CommandList>
            <CommandEmpty>Nenhum template encontrado.</CommandEmpty>
            
            {templatesPorCategoria && Object.entries(templatesPorCategoria).map(([cat, temps]) => (
              <CommandGroup 
                key={cat} 
                heading={categoriaLabels[cat as WhatsAppTemplateCategoria]}
              >
                {temps.map((template) => (
                  <CommandItem
                    key={template.id}
                    value={`${template.nome} ${template.descricao || ''}`}
                    onSelect={() => handleSelect(template)}
                    className="cursor-pointer flex flex-col items-start gap-1 py-2"
                  >
                    <span className="font-medium">{template.nome}</span>
                    {template.descricao && (
                      <span className="text-xs text-muted-foreground">
                        {template.descricao}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
