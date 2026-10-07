import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { DataProvider } from "./lib/data";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Kanban from "./pages/Kanban";
import Aguardando from "./pages/Aguardando";
import Leads from "./pages/Leads";
import Relatorios from "./pages/Relatorios";
import Dashboard from "./pages/Dashboard";
import Configuracoes from "./pages/Configuracoes";
import { Spinner } from "./components/ui";

function Protegido() {
  const { session, profile, loading, isAdmin, pode } = useAuth();
  if (loading)
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <Spinner />
      </div>
    );
  if (!session) return <Login />;
  if (profile?.status !== "ativo") return <Aguardando />;

  return (
    <DataProvider>
      <Routes>
        <Route
          path="*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={<Navigate to="/pipelines" replace />} />
                <Route path="/pipelines/:pipelineId?" element={<Kanban />} />
                <Route path="/leads" element={<Leads />} />
                <Route path="/relatorios" element={<Relatorios />} />
                <Route path="/configuracoes/:secao?" element={<Configuracoes />} />
                <Route path="/equipe" element={<Navigate to="/configuracoes/membros" replace />} />
                <Route
                  path="/dashboard"
                  element={pode("ver_painel") ? <Dashboard /> : <Navigate to="/" replace />}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </DataProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Protegido />
      </AuthProvider>
    </BrowserRouter>
  );
}
