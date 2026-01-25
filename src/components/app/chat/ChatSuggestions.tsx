import { Button } from '@/components/ui/button';
import { FileText, Car, LifeBuoy, AlertTriangle, History, HelpCircle } from 'lucide-react';

interface ChatSuggestionsProps {
  onSelect: (message: string) => void;
  disabled?: boolean;
}

const suggestions = [
  {
    icon: FileText,
    label: 'Ver boletos pendentes',
    message: 'Quais são meus boletos pendentes?',
  },
  {
    icon: History,
    label: 'Histórico de pagamentos',
    message: 'Me mostre meu histórico de pagamentos',
  },
  {
    icon: Car,
    label: 'Status do veículo',
    message: 'Qual o status do meu veículo?',
  },
  {
    icon: LifeBuoy,
    label: 'Assistência 24h',
    message: 'Preciso de assistência 24 horas',
  },
  {
    icon: AlertTriangle,
    label: 'Abrir sinistro',
    message: 'Quero registrar um sinistro',
  },
  {
    icon: HelpCircle,
    label: 'Tirar dúvidas',
    message: 'Quais serviços vocês oferecem?',
  },
];

export function ChatSuggestions({ onSelect, disabled }: ChatSuggestionsProps) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="text-center">
        <h3 className="font-semibold text-lg">Como posso ajudar?</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione uma opção ou digite sua mensagem
        </p>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        {suggestions.map((suggestion) => (
          <Button
            key={suggestion.label}
            variant="outline"
            className="h-auto flex-col gap-2 p-4 text-left"
            onClick={() => onSelect(suggestion.message)}
            disabled={disabled}
          >
            <suggestion.icon className="h-5 w-5 text-primary" />
            <span className="text-xs font-medium text-center leading-tight">
              {suggestion.label}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}
