// ../App.tsx
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Main from "./components/Main";
import { useState } from "react";

function App() {
  const [activePage, setActivePage] = useState("dashboard");

  const pageLabels: Record<string, string> = {
    dashboard: "Dashboard",
    robot: "Robot",
    monitor: "Monitor",
    analyze: "Analyze",
    setting: "Setting",
  };

  return (
    <div className="flex h-screen ">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />

      <div className="flex-1 flex flex-col">
        <Header currentPage={pageLabels[activePage]} />
        <Main activePage={activePage} />
      </div>
    </div>
  );
}

export default App;
