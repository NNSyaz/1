// src/components/Sidebar.tsx - UPDATED
import {
  Bot,
  Network,
  LayoutDashboard,
  Monitor,
  Settings2Icon,
  ListTodo,

} from "lucide-react";
import roboLogo from "../assets/roboLogo.png";

interface SidebarProps {
  activePage: string;
  setActivePage: (page: string) => void;
}

const Sidebar = ({ activePage, setActivePage }: SidebarProps) => {
  const menuItems = [
    { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { id: "robot", icon: Bot, label: "Robots" },
    { id: "monitor", icon: Monitor, label: "Monitor" },
    { id: "tasks", icon: ListTodo, label: "Tasks" },
    { id: "analyze", icon: Network, label: "Analyze" },
    { id: "setting", icon: Settings2Icon, label: "Settings" },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-60 bg-black text-white flex flex-col">
        <div className="p-6 border-b border-stone-600">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <img
              src={roboLogo}
              alt="ROBOFleet Logo"
              className="w-7 h-7 object-contain"
            />
            ROBOFleet
          </h1>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => setActivePage(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive
                        ? "text-red-600 shadow-lg"
                        : "text-slate-300 hover:bg-slate-700 hover:text-white"
                    }`}
                  >
                    <Icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;