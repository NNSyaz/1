// src/components/Main.tsx - UPDATED
import Analyze from "../pages/Analyze";
import Dashboard from "../pages/Dashboard";
import RobotManagement from "../pages/RobotManagement";
import Monitor from "../pages/Monitor";
import Tasks from "../pages/Tasks";
import Settings from "../pages/Settings";

interface MainProps {
  activePage: string;
}

const Main = ({ activePage }: MainProps) => {
  switch (activePage) {
    case "dashboard":
      return <Dashboard />;
    case "robot":
      return <RobotManagement />;
    case "monitor":
      return <Monitor />;
    case "analyze":
      return <Analyze />;
    case "tasks":
      return <Tasks />;
    case "setting":
      return <Settings />;
    default:
      return (
        <div className="flex-1 px-4 py-8 overflow-auto bg-gray-100">
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-lg shadow-md p-6">
              <p className="text-gray-600">Page not found</p>
            </div>
          </div>
        </div>
      );
  }
};

export default Main;