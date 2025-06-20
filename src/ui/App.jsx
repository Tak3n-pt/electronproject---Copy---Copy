// File: src/ui/App.jsx
import { useState } from "react";
import AddProductPage from "./components/AddProductPage";
import ProductListPage from "./components/ViewProductsPage";
import DashboardHeaderOption7 from "./components/DashboardHeaderOption7";
import { PlusSquare, List, Settings, Package } from "lucide-react";
import "../index.css";

export default function App() {
  const [selectedPage, setSelectedPage] = useState("add");

  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-gradient-to-br from-blue-800 via-indigo-700 to-purple-700 text-white shadow-lg">
        <DashboardHeaderOption7 />
        <ul className="p-4 space-y-4">
          <li>
            <button
              onClick={() => setSelectedPage("add")}
              className="flex items-center gap-2 w-full px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition"
            >
              <PlusSquare size={20} /> Add Product
            </button>
          </li>
          <li>
            <button
              onClick={() => setSelectedPage("list")}
              className="flex items-center gap-2 w-full px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition"
            >
              <List size={20} /> Product List
            </button>
          </li>
          <li>
            <button
              disabled
              className="flex items-center gap-2 w-full px-4 py-3 rounded-lg text-white/50 cursor-not-allowed"
            >
              <Package size={20} /> Orders
            </button>
          </li>
          <li>
            <button
              disabled
              className="flex items-center gap-2 w-full px-4 py-3 rounded-lg text-white/50 cursor-not-allowed"
            >
              <Settings size={20} /> Settings
            </button>
          </li>
        </ul>
      </div>
      <div className="flex-1 bg-gray-100 p-6">
        {selectedPage === "add" && <AddProductPage />}
        {selectedPage === "list" && <ProductListPage />}
      </div>
    </div>
  );
}
