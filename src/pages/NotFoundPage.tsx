import { Link } from "react-router-dom";
import { useTitle } from "../useTitle";

export function NotFoundPage() {
  useTitle("Página não encontrada");
  return (
    <div className="empty">
      <h1>Essa página não existe</h1>
      <Link className="btn primary" to="/">
        Voltar ao painel
      </Link>
    </div>
  );
}
