import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Shield, Loader2, AlertCircle, LogIn } from 'lucide-react';

export function LoginPage() {
  const { login, isLoading, accessDeniedReason } = useAuth();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Guardian View</h1>
          <p className="text-muted-foreground mt-2">
            Centre des Opérations de Sécurité Azure
          </p>
        </div>

        {/* Login Card */}
        <div className="card-soc p-8">
          <h2 className="text-xl font-semibold text-center mb-6">
            Connexion
          </h2>

          {/* Access Denied Message */}
          {accessDeniedReason && (
            <div className="mb-6 p-4 rounded-lg bg-critical/10 border border-critical/30">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-critical flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-critical">Accès refusé</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {accessDeniedReason}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Login Button */}
          <Button
            onClick={login}
            disabled={isLoading}
            className="w-full h-12 text-base"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Connexion en cours...
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5 mr-2" />
                Se connecter avec Microsoft 365
              </>
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Utilisez votre compte Microsoft 365 professionnel pour vous connecter.
          </p>

          {/* Info about groups */}
          <div className="mt-6 p-4 rounded-lg bg-muted/30 border border-border">
            <p className="text-sm text-muted-foreground">
              <strong>Note :</strong> Vous devez être membre d'un des groupes suivants pour accéder à l'application :
            </p>
            <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside">
              <li><code className="text-primary">GR_ACCES_SOC</code> - Accès utilisateur (lecture seule)</li>
              <li><code className="text-primary">GR_ADMIN_ACCES_SOC</code> - Accès administrateur (contrôle total)</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-8">
          © {new Date().getFullYear()} Guardian View SOC
        </p>
      </div>
    </div>
  );
}
