// components/DashboardHeaderOption6.jsx

// 1. Import the Box icon from lucide-react
import { Box } from 'lucide-react';

const DashboardHeaderOption6 = () => {
  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-t-lg p-6 shadow-lg">
      <div className="flex items-center space-x-4">
        <div className="p-3 bg-slate-700 rounded-lg shadow-md">
          {/* 2. Use the Box icon component here */}
          <Box className="w-7 h-7 text-sky-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-slate-400">
            Your central hub for all activities.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeaderOption6;