import { EmptyState, useDocumentTitle } from "@/components/ui";
import { Link } from "@/lib/router";

export default function NotFound() {
  useDocumentTitle("Página não encontrada");
  return (
    <div className="page container">
      <EmptyState
        icon="compass"
        title="Esta página saiu para a praia"
        text="O endereço pode ter mudado ou o conteúdo não existe mais."
        action={
          <div className="form-actions">
            <Link to="/" className="btn btn-primary">
              Voltar ao início
            </Link>
            <Link to="/explorar" className="btn btn-outline">
              Explorar estadias
            </Link>
          </div>
        }
      />
    </div>
  );
}
