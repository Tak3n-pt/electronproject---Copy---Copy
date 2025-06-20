// File: src/components/ProductListPage.jsx
import { useEffect, useState } from "react";
import { PackageCheck } from "lucide-react";

export default function ProductListPage() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    window.api.getProducts().then((data) => setProducts(data));
  }, []);

  return (
    <div>
      <div className="w-full bg-gradient-to-r from-blue-800 via-indigo-700 to-purple-700 py-10 px-8 shadow-lg rounded-none text-white">
        <h2 className="text-4xl font-bold flex items-center gap-3">
          <PackageCheck size={32} /> Product List
        </h2>
        <p className="mt-2 text-indigo-200 text-sm">
          Browse all products currently in your inventory.
        </p>
      </div>

      <div className="p-6 mt-6 bg-white rounded-xl shadow-lg overflow-x-auto">
        {products.length === 0 ? (
          <p className="text-gray-600">No products found.</p>
        ) : (
          <table className="min-w-full text-sm text-left table-auto border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-700">
                <th className="p-3 font-semibold">Name</th>
                <th className="p-3 font-semibold">Price</th>
                <th className="p-3 font-semibold">Category</th>
                <th className="p-3 font-semibold">Quantity</th>
                <th className="p-3 font-semibold">Supplier</th>
                <th className="p-3 font-semibold">SKU</th>
                <th className="p-3 font-semibold">Barcode</th>
                <th className="p-3 font-semibold">Location</th>
                <th className="p-3 font-semibold">Reorder Level</th>
                <th className="p-3 font-semibold">Auto Order</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="p-3">{p.name}</td>
                  <td className="p-3">${parseFloat(p.price).toFixed(2)}</td>
                  <td className="p-3">{p.category}</td>
                  <td className="p-3">{p.quantity}</td>
                  <td className="p-3">{p.supplier}</td>
                  <td className="p-3">{p.sku}</td>
                  <td className="p-3">{p.barcode}</td>
                  <td className="p-3">{p.location}</td>
                  <td className="p-3">{p.reorderLevel}</td>
                  <td className="p-3">{p.autoOrder ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
