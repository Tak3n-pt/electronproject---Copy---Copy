// File: src/components/AddProductPage.jsx
import { useState } from "react";

export default function AddProductPage() {
  const [form, setForm] = useState({
    name: "",
    price: "",
    category: "",
    description: "",
    quantity: "",
    supplier: "",
    sku: "",
    barcode: "",
    location: "",
    reorderLevel: "",
    autoOrder: false,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  };

  const handleAdd = async () => {
    await window.api.addProduct(form);
    setForm({
      name: "",
      price: "",
      category: "",
      description: "",
      quantity: "",
      supplier: "",
      sku: "",
      barcode: "",
      location: "",
      reorderLevel: "",
      autoOrder: false,
    });
  };

  return (
    <div>
      <div className="w-full bg-gradient-to-r from-blue-800 via-indigo-700 to-purple-700 py-10 px-8 shadow-lg rounded-none text-white">
        <h2 className="text-4xl font-bold">Add New Product</h2>
        <p className="mt-2 text-indigo-200 text-sm">
          Enter the details below to create a new inventory item.
        </p>
      </div>
      <div className="p-6 mt-6 bg-white rounded-xl shadow-lg space-y-4">
        {[
          "name",
          "price",
          "category",
          "description",
          "quantity",
          "supplier",
          "sku",
          "barcode",
          "location",
          "reorderLevel",
        ].map((field) => (
          <input
            key={field}
            name={field}
            type={
              ["price", "quantity", "reorderLevel"].includes(field)
                ? "number"
                : "text"
            }
            placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
            value={form[field]}
            onChange={handleChange}
            className="w-full p-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ))}
        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            name="autoOrder"
            checked={form.autoOrder}
            onChange={handleChange}
            className="w-5 h-5 text-blue-600 border-gray-300 rounded"
          />
          <span>Auto Order Enabled</span>
        </label>
      </div>
      <button
        onClick={handleAdd}
        className="mt-6 w-full md:w-auto bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-400 transition-all"
      >
        Add Product
      </button>
    </div>
  );
}
