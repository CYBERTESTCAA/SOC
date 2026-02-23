import { Construction } from 'lucide-react';

interface PlaceholderViewProps {
  title: string;
  description: string;
}

export function PlaceholderView({ title, description }: PlaceholderViewProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center animate-fade-in">
      <div className="p-4 rounded-full bg-muted/50 mb-4">
        <Construction className="w-12 h-12 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-muted-foreground max-w-md">
        {description}
      </p>
      <p className="text-sm text-muted-foreground mt-4">
        Cette vue sera disponible avec l'intégration Microsoft Graph API
      </p>
    </div>
  );
}
