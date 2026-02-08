import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserPlus, X, Wrench } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface RastreadorBatchActionsProps {
  selectedCount: number;
  onAssignPortador: () => void;
  onBatchMaintenance?: () => void;
  onClear: () => void;
}

export function RastreadorBatchActions({
  selectedCount,
  onAssignPortador,
  onBatchMaintenance,
  onClear,
}: RastreadorBatchActionsProps) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50"
        >
          <Card className="shadow-2xl border-primary/20 bg-background/95 backdrop-blur-sm">
            <CardContent className="flex items-center gap-4 py-3 px-5">
              <Badge variant="secondary" className="text-sm font-medium px-3 py-1">
                {selectedCount} selecionado{selectedCount > 1 ? 's' : ''}
              </Badge>
              
              <div className="h-6 w-px bg-border" />
              
              <Button
                size="sm"
                onClick={onAssignPortador}
                className="gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Atribuir Portador
              </Button>

              {onBatchMaintenance && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onBatchMaintenance}
                  className="gap-2 text-amber-600 hover:text-amber-700"
                >
                  <Wrench className="h-4 w-4" />
                  Manutenção em Lote
                </Button>
              )}
              
              <Button
                size="sm"
                variant="ghost"
                onClick={onClear}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Limpar
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
