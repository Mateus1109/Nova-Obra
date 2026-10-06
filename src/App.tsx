import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { DataProvider } from "./lib/data";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Kanban from "./pages/Kanban";
import CadastroObra from "./pages/CadastroObra";
import Visitas from "./pages/Visitas";
import Vendedores from "./pages/Vendedores";
import Relatorios from "./pages/Relatorios";
import Dashboard from "./pages/Dashboard";
import RotaPrint from "./pages/RotaPrint";
import { Spinner } from "./components/ui";

function Protegido() {
  const { session, loading, isAdmin } = useAuth();
  if (loading)
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <Spinner />
      </div>
    );
  if (!session) return <Login />;

  return (
    <DataProvider>
      <Routes>
        {/* rota de impressão sem layout */}
        <Route path="/visitas/rota/:vendedorId/:data" element={<RotaPrint />} />
        <Route
          path="*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={<Kanban />} />
                <Route path="/obras/nova" element={<CadastroObra />} />
                <Route path="/visitas" element={<Visitas />} />
                <Route path="/relatorios" element={<Relatorios />} />
                <Route
                  path="/vendedores"
                  element={isAdmin ? <Vendedores /> : <Navigate to="/" replace />}
                />
                <Route
                  path="/dashboard"
                  element={isAdmin ? <Dashboard /> : <Navigate to="/" replace />}
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
