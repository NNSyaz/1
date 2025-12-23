// ../components/Main.tsx
import Analyze from "../pages/Analyze";
import Dashboard from "../pages/Dashboard";
import RobotManagement from "../pages/RobotManagement";
import Monitor from "../pages/Monitor";

interface MainProps {
  activePage: string;
}

const Main = ({ activePage }: MainProps) => {
  if (activePage === "dashboard") {
    return <Dashboard />;
  } else if (activePage === "analyze") {
    return <Analyze />;
  } else if (activePage === "robot") {
    return <RobotManagement />;
  } else if (activePage === "monitor") {
    return <Monitor />;
  }

  const pageLabels: Record<string, string> = {
    dashboard: "Dashboard",
    robot: "RobotManagement",
    monitor: "Monitor",
    analyze: "Analyze",
    setting: "Setting",
  };

  return (
    <div className="flex-1 px-4 py-8 overflow-auto bg-gray-100">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-gray-600">
            Content for{" "}
            <span className="font-semibold">{pageLabels[activePage]}</span> page
            goes here.
          </p>
          Click different sidebar item to navigate between pages.
        </div>
      </div>
    </div>
  );
};

export default Main;
