import React, { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../utils/currency';
import Lottie from "lottie-react";
import { gamingLoaderAnimation, successAnimation } from "../assets/animations";
import {
  Phone, Package, DollarSign, Calendar, User, Plus, Search,
  Trash2, Edit3, CheckCircle, Clock, AlertCircle, CreditCard,
  TrendingUp, Users, Receipt, X, Save, PhoneCall, ShoppingBag
} from "lucide-react";

export default function DebtPage() {
  const { t, i18n } = useTranslation();
  const [debts, setDebts] = useState([]);
  const [form, setForm] = useState({
    phoneNumber: "",
    itemName: "",
    amount: "",
    notes: ""
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDebt, setEditingDebt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Load mock data on mount
  useEffect(() => {
    // Mock data for presentation
    const mockDebts = [
      {
        id: 1,
        phoneNumber: "+1234567890",
        customerName: "John Gamer",
        itemName: "PS5 Controller",
        amount: 69.99,
        date: new Date().toISOString(),
        status: "pending",
        notes: t('debts.willPayNextWeek')
      },
      {
        id: 2,
        phoneNumber: "+9876543210",
        customerName: "Sarah Player",
        itemName: "Gaming Headset",
        amount: 149.99,
        date: new Date(Date.now() - 86400000 * 2).toISOString(),
        status: "pending",
        notes: t('debts.regularCustomer')
      },
      {
        id: 3,
        phoneNumber: "+5551234567",
        customerName: "Mike Pro",
        itemName: "Xbox Game Pass",
        amount: 14.99,
        date: new Date(Date.now() - 86400000 * 5).toISOString(),
        status: "paid",
        notes: t('debts.paidViaCash')
      }
    ];
    setDebts(mockDebts);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      const newDebt = {
        id: Date.now(),
        phoneNumber: form.phoneNumber,
        customerName: "Customer " + Math.floor(Math.random() * 100),
        itemName: form.itemName,
        amount: parseFloat(form.amount) || 0,
        date: new Date().toISOString(),
        status: "pending",
        notes: form.notes
      };

      if (editingDebt) {
        setDebts(prev => prev.map(d => d.id === editingDebt.id ? { ...newDebt, id: editingDebt.id } : d));
        setEditingDebt(null);
      } else {
        setDebts(prev => [newDebt, ...prev]);
      }

      setForm({ phoneNumber: "", itemName: "", amount: "", notes: "" });
      setShowAddModal(false);
      setLoading(false);
      setSuccessMsg(editingDebt ? t('debts.debtUpdated') : t('debts.debtAdded'));
      setTimeout(() => setSuccessMsg(""), 3000);
    }, 500);
  };

  const handleDelete = (id) => {
    if (confirm(t('debts.confirmDeleteDebt'))) {
      setDebts(prev => prev.filter(d => d.id !== id));
      setSuccessMsg(t('debts.debtDeleted'));
      setTimeout(() => setSuccessMsg(""), 3000);
    }
  };

  const handleMarkPaid = (id) => {
    setDebts(prev => prev.map(d => 
      d.id === id ? { ...d, status: "paid", paidDate: new Date().toISOString() } : d
    ));
    setSuccessMsg(t('debts.markedAsPaid'));
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleEdit = (debt) => {
    setEditingDebt(debt);
    setForm({
      phoneNumber: debt.phoneNumber,
      itemName: debt.itemName,
      amount: debt.amount.toString(),
      notes: debt.notes
    });
    setShowAddModal(true);
  };

  const filteredDebts = debts.filter(debt => 
    debt.phoneNumber.includes(searchTerm) ||
    debt.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    debt.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalDebt = filteredDebts.filter(d => d.status === "pending").reduce((sum, d) => sum + d.amount, 0);
  const totalPaid = filteredDebts.filter(d => d.status === "paid").reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="min-h-screen bg-gaming-black p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gaming-gray rounded-xl border border-gaming-purple/30">
              <CreditCard className="text-gaming-yellow" size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gaming-yellow">{t('debts.title')}</h1>
              <p className="text-gaming-purple">{t('debts.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingDebt(null);
              setForm({ phoneNumber: "", itemName: "", amount: "", notes: "" });
              setShowAddModal(true);
            }}
            className="bg-gaming-yellow text-gaming-black font-bold px-6 py-3 rounded-lg hover:bg-gaming-yellow-dark transition-all flex items-center space-x-2 hover:animate-glow"
          >
            <Plus size={20} />
            <span>{t('debts.addDebt')}</span>
          </button>
        </div>

        {/* Success Message */}
        {successMsg && (
          <div className="mb-4 p-4 bg-green-900/30 border border-green-500/50 rounded-lg flex items-center space-x-2 animate-slide-in">
            <CheckCircle className="text-green-400" size={20} />
            <span className="text-green-400">{successMsg}</span>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gaming-gray border border-gaming-purple/30 rounded-lg p-4 hover:animate-glow transition-all">
            <div className="flex items-center justify-between mb-2">
              <Users className="text-gaming-purple" size={24} />
              <span className="text-gaming-purple text-sm">{t('debts.customers')}</span>
            </div>
            <p className="text-2xl font-bold text-gaming-yellow">
              {new Set(debts.map(d => d.phoneNumber)).size}
            </p>
            <p className="text-gaming-purple text-xs">{t('debts.totalDebtors')}</p>
          </div>

          <div className="bg-gaming-gray border border-gaming-purple/30 rounded-lg p-4 hover:animate-glow transition-all">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="text-red-400" size={24} />
              <span className="text-red-400 text-sm">{t('debts.pending')}</span>
            </div>
            <p className="text-2xl font-bold text-gaming-yellow">
              {formatPrice(totalDebt)}
            </p>
            <p className="text-gaming-purple text-xs">{t('debts.totalDebt')}</p>
          </div>

          <div className="bg-gaming-gray border border-gaming-purple/30 rounded-lg p-4 hover:animate-glow transition-all">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="text-green-400" size={24} />
              <span className="text-green-400 text-sm">{t('debts.collected')}</span>
            </div>
            <p className="text-2xl font-bold text-gaming-yellow">
              {formatPrice(totalPaid)}
            </p>
            <p className="text-gaming-purple text-xs">{t('debts.totalPaid')}</p>
          </div>

          <div className="bg-gaming-gray border border-gaming-purple/30 rounded-lg p-4 hover:animate-glow transition-all">
            <div className="flex items-center justify-between mb-2">
              <Receipt className="text-gaming-yellow" size={24} />
              <span className="text-gaming-yellow text-sm">{t('debts.active')}</span>
            </div>
            <p className="text-2xl font-bold text-gaming-yellow">
              {debts.filter(d => d.status === "pending").length}
            </p>
            <p className="text-gaming-purple text-xs">{t('debts.pendingDebts')}</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gaming-purple" size={20} />
          <input
            type="text"
            placeholder={t('debts.searchDebts')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gaming-gray border border-gaming-purple/30 rounded-lg text-gaming-yellow placeholder-gray-500 focus:border-gaming-yellow focus:outline-none"
          />
        </div>
      </div>

      {/* Debts List */}
      <div className="space-y-4">
        {filteredDebts.length === 0 ? (
          <div className="bg-gaming-gray border border-gaming-purple/30 rounded-xl p-12 text-center">
            <CreditCard className="text-gaming-purple mx-auto mb-4" size={48} />
            <h3 className="text-gaming-yellow text-xl font-bold mb-2">{t('debts.noDebtsFound')}</h3>
            <p className="text-gaming-purple">{t('debts.addNewDebtMessage')}</p>
          </div>
        ) : (
          filteredDebts.map((debt) => (
            <div
              key={debt.id}
              className="bg-gaming-gray border border-gaming-purple/30 rounded-xl p-6 hover:border-gaming-yellow/50 transition-all hover:animate-glow group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-gaming-black rounded-lg">
                      <PhoneCall className="text-gaming-yellow" size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-gaming-yellow font-bold text-lg">{debt.customerName}</h3>
                        <span className={`px-3 py-1 rounded-full border text-xs flex items-center space-x-1 ${
                          debt.status === "paid" 
                            ? "bg-green-900/30 text-green-400 border-green-500/50" 
                            : "bg-red-900/30 text-red-400 border-red-500/50"
                        }`}>
                          {debt.status === "paid" ? <CheckCircle size={14} /> : <Clock size={14} />}
                          <span>{debt.status === "paid" ? t('debts.paid') : t('debts.pending')}</span>
                        </span>
                      </div>
                      <p className="text-gaming-purple text-sm">{debt.phoneNumber}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="flex items-center space-x-2">
                      <ShoppingBag className="text-gaming-purple" size={16} />
                      <div>
                        <p className="text-gaming-purple text-xs">{t('debts.item')}</p>
                        <p className="text-gaming-yellow text-sm font-medium">{debt.itemName}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <DollarSign className="text-gaming-purple" size={16} />
                      <div>
                        <p className="text-gaming-purple text-xs">{t('debts.amount')}</p>
                        <p className="text-gaming-yellow text-sm font-bold">{formatPrice(debt.amount)}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Calendar className="text-gaming-purple" size={16} />
                      <div>
                        <p className="text-gaming-purple text-xs">{t('debts.date')}</p>
                        <p className="text-gaming-yellow text-sm">
                          {new Date(debt.date).toLocaleDateString('en-US')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <TrendingUp className="text-gaming-purple" size={16} />
                      <div>
                        <p className="text-gaming-purple text-xs">{t('debts.days')}</p>
                        <p className="text-gaming-yellow text-sm">
                          {Math.floor((Date.now() - new Date(debt.date)) / (1000 * 60 * 60 * 24))} {t('debts.days').toLowerCase()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {debt.notes && (
                    <div className="mt-3 p-3 bg-gaming-black/50 rounded-lg">
                      <p className="text-gaming-purple text-xs">{t('debts.notes')}</p>
                      <p className="text-gaming-yellow text-sm">{debt.notes}</p>
                    </div>
                  )}
                </div>

                <div className="flex space-x-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  {debt.status === "pending" && (
                    <button
                      onClick={() => handleMarkPaid(debt.id)}
                      className="p-2 bg-green-900/30 border border-green-500/50 rounded-lg hover:bg-green-900/50 transition-colors"
                      title={t('debts.markAsPaid')}
                    >
                      <CheckCircle className="text-green-400" size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(debt)}
                    className="p-2 bg-gaming-black border border-gaming-purple/30 rounded-lg hover:border-gaming-yellow transition-colors"
                    title={t('common.edit')}
                  >
                    <Edit3 className="text-gaming-purple hover:text-gaming-yellow" size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(debt.id)}
                    className="p-2 bg-gaming-black border border-red-500/30 rounded-lg hover:border-red-500 transition-colors"
                    title={t('common.delete')}
                  >
                    <Trash2 className="text-red-400 hover:text-red-300" size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gaming-gray border border-gaming-yellow/50 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gaming-yellow">
                {editingDebt ? t('debts.editDebtRecord') : t('debts.addNewDebt')}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gaming-purple hover:text-gaming-yellow transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-gaming-purple text-sm mb-2">
                  {t('debts.phoneNumber')} <span className="text-gaming-yellow">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 text-gaming-purple" size={18} />
                  <input
                    type="tel"
                    required
                    value={form.phoneNumber}
                    onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                    placeholder={t('debts.phonePlaceholder')}
                    className="w-full pl-10 pr-4 py-3 bg-gaming-black border border-gaming-purple/50 rounded-lg text-gaming-yellow placeholder-gray-600 focus:border-gaming-yellow focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gaming-purple text-sm mb-2">
                  {t('debts.itemName')} <span className="text-gaming-yellow">*</span>
                </label>
                <div className="relative">
                  <Package className="absolute left-3 top-3 text-gaming-purple" size={18} />
                  <input
                    type="text"
                    required
                    value={form.itemName}
                    onChange={(e) => setForm({ ...form, itemName: e.target.value })}
                    placeholder={t('debts.itemPlaceholder')}
                    className="w-full pl-10 pr-4 py-3 bg-gaming-black border border-gaming-purple/50 rounded-lg text-gaming-yellow placeholder-gray-600 focus:border-gaming-yellow focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gaming-purple text-sm mb-2">
                  {t('debts.amount')} ({t('products.optional')})
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 text-gaming-purple" size={18} />
                  <input
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder={t('debts.amountPlaceholder')}
                    className="w-full pl-10 pr-4 py-3 bg-gaming-black border border-gaming-purple/50 rounded-lg text-gaming-yellow placeholder-gray-600 focus:border-gaming-yellow focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gaming-purple text-sm mb-2">
                  {t('debts.notes')} ({t('products.optional')})
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder={t('debts.paymentDetails')}
                  rows="3"
                  className="w-full px-4 py-3 bg-gaming-black border border-gaming-purple/50 rounded-lg text-gaming-yellow placeholder-gray-600 focus:border-gaming-yellow focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-3 bg-gaming-black border border-gaming-purple/50 rounded-lg text-gaming-purple hover:border-gaming-purple transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-gaming-yellow text-gaming-black font-bold rounded-lg hover:bg-gaming-yellow-dark transition-colors flex items-center space-x-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-gaming-black border-t-transparent rounded-full animate-spin" />
                      <span>{t('common.saving')}</span>
                    </>
                  ) : (
                    <>
                      <Save size={20} />
                      <span>{editingDebt ? t('common.update') : t('common.add')} {t('debts.addDebt').split(' ')[1]}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}