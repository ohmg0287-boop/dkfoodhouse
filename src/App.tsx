import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ShoppingCart, LayoutDashboard, DollarSign, Users, Package, Trash2, Printer, LogOut, Edit3, TrendingDown, TrendingUp, PlusCircle, Save, FileText, Search, XCircle, Lock, Unlock, Calendar, Eye, Bike, Coins, CreditCard } from 'lucide-react';

// --- CONEXIÓN ---
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

export default function DondeManoloApp() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showVersionAlert, setShowVersionAlert] = useState(true);

  // --- ESTADO DE SESIÓN ---
  const [currentSession, setCurrentSession] = useState(null); 
  const [sessionHistory, setSessionHistory] = useState([]);
  const [tasa, setTasa] = useState(() => {
    const saved = localStorage.getItem('tasa_bcv');
    return saved ? parseFloat(saved) : 0;
  });

  // Datos Generales
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState({});
  const [orders, setOrders] = useState([]); 
  const [expenses, setExpenses] = useState([]); 
  const [staffList, setStaffList] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]); 
  const [newPayMethod, setNewPayMethod] = useState({ name: '', currency: 'USD' });

  // Editor de Inventario / Recetas
  const [invSubView, setInvSubView] = useState('platos');
  const [selectedProductRecipe, setSelectedProductRecipe] = useState('');
  const [newRecipeEntry, setNewRecipeEntry] = useState({ ingredientId: '', quantity: '' });

  // Operativo
  const [cart, setCart] = useState([]);
  const [serviceInfo, setServiceInfo] = useState({ type: 'Mesa', val: '' });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [lastOrderTicket, setLastOrderTicket] = useState(null);
  const [ticketType, setTicketType] = useState('full'); 
  const [closingData, setClosingData] = useState(null);

  // Reporte Global
  const [globalReportDates, setGlobalReportDates] = useState({ start: '', end: '' });

  // Caja
  const [cajaTab, setCajaTab] = useState('activas'); 
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('');
  const [currentPayments, setCurrentPayments] = useState([]);
  const [isEditingOrder, setIsEditingOrder] = useState(false); 
  const [itemSearch, setItemSearch] = useState('');

  // Gastos
  const [newExpense, setNewExpense] = useState({ desc: '', amount: '', category: 'Otros', isStock: false, ingredientId: '', quantity: '' });

  const fetchOrdersRef = useRef();
  useEffect(() => {
      fetchOrdersRef.current = fetchOrders;
  });
  
  useEffect(() => {
    const timer = setTimeout(() => setShowVersionAlert(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
      if (['cocina', 'caja', 'owner', 'manager', 'mesero'].includes(user.role)) {
        const i = setInterval(() => { if (fetchOrdersRef.current) fetchOrdersRef.current(); }, 5000); 
        return () => clearInterval(i);
      }
    }
  }, [user]);

  useEffect(() => {
      if (view === 'reportes') loadHistory();
  }, [view]);

  // --- CARGA DE DATOS ---
  const fetchRate = async () => {
    const { data } = await supabase.from('settings').select('value').eq('key', 'tasa').maybeSingle();
    if (data?.value?.usd) { setTasa(data.value.usd); localStorage.setItem('tasa_bcv', data.value.usd); }
  };

  const loadData = async () => {
    setLoading(true);
    await fetchRate();
    const { data: sessionData } = await supabase.from('cash_sessions').select('*').eq('status', 'open').maybeSingle();
    setCurrentSession(sessionData || null);

    const pm = await supabase.from('payment_methods').select('*').order('name');
    if (pm.data) {
        setPaymentMethods(pm.data);
        const activeMethod = pm.data.find(m => m.is_active);
        if (activeMethod && !payMethod) setPayMethod(activeMethod.name);
    }

    const p = await supabase.from('products').select('*').order('name');
    const i = await supabase.from('ingredients').select('*').order('name');
    const r = await supabase.from('recipes').select('*');
    
    const recipesMap = {};
    if (r.data) {
        r.data.forEach(row => {
            if (!recipesMap[row.product_name]) recipesMap[row.product_name] = [];
            recipesMap[row.product_name].push({ id: row.id, ingredientId: row.ingredient_id, quantity: parseFloat(row.quantity) });
        });
    }
    setRecipes(recipesMap);

    if (sessionData) {
        const o = await supabase.from('orders')
            .select('*, order_items(*), payments(*)')
            .or(`session_id.eq.${sessionData.id},status.eq.credito`)
            .order('created_at', { ascending: false });
        
        const e = await supabase.from('expenses').select('*').eq('session_id', sessionData.id).order('created_at', { ascending: false });
        if (o.data) setOrders(o.data);
        if (e.data) setExpenses(e.data);
    } else {
        setOrders([]); setExpenses([]);
    }

    if (user && user.role === 'owner') {
        const s = await supabase.from('staff').select('*').order('name');
        if (s.data) setStaffList(s.data);
    }
    
    if (p.data) setProducts(p.data);
    if (i.data) setIngredients(i.data);
    setLoading(false);
  };

  const loadHistory = async () => {
      const { data } = await supabase.from('cash_sessions').select('*').eq('status', 'closed').order('closed_at', { ascending: false }).limit(20);
      if (data) setSessionHistory(data);
  };

  const fetchOrders = async () => {
    if (!currentSession) return;
    const { data } = await supabase.from('orders')
        .select('*, order_items(*), payments(*)')
        .or(`session_id.eq.${currentSession.id},status.eq.credito`)
        .order('created_at', { ascending: false });
    if (data) setOrders(data);
    if (selectedOrder) {
        const updated = data?.find(o => o.id === selectedOrder.id);
        if (updated) setSelectedOrder(updated);
    }
  };

  // --- GESTIÓN DE SESIÓN ---
  const handleOpenSession = async () => {
      const base = prompt("Ingrese Monto Base en Caja ($ Efectivo):", "0");
      if (base === null) return;
      setLoading(true);
      const { error } = await supabase.from('cash_sessions').insert([{ opened_by: user.name, base_amount: parseFloat(base), status: 'open' }]);
      if (error) alert("Error: " + error.message); else { alert("¡Caja Abierta!"); loadData(); }
      setLoading(false);
  };

  const generateReportData = async (session, isHistorical = false) => {
      setLoading(true);
      const o = await supabase.from('orders').select('*, order_items(*)').eq('session_id', session.id);
      const e = await supabase.from('expenses').select('*').eq('session_id', session.id);
      const p = await supabase.from('payments').select('*, orders(info)').eq('session_id', session.id);
      
      const sessionOrders = o.data || [];
      const sessionExpenses = e.data || [];
      const allPayments = p.data || [];

      const totalVentasDespachadas = sessionOrders.reduce((sum, o) => sum + o.total_usd, 0);
      const dineroCobrado = allPayments.reduce((sum, pay) => sum + pay.amount_usd, 0);
      
      const breakdown = allPayments.reduce((acc, curr) => {
          acc[curr.method] = (acc[curr.method] || 0) + curr.amount_usd;
          return acc;
      }, {});
      
      const expensesTotal = sessionExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      const cashInUsd = (breakdown['$ Efectivo'] || 0) + parseFloat(session.base_amount);
      const cashInBs = allPayments.filter(pay => pay.method === 'Bs Efectivo').reduce((s, pay) => s + pay.amount_bs, 0);

      const productCount = {};
      sessionOrders.forEach(ord => {
          ord.order_items.forEach(item => { productCount[item.product_name] = (productCount[item.product_name] || 0) + item.quantity; });
      });
      
      const inventoryUsage = {};
      for (const [prodName, qty] of Object.entries(productCount)) {
          const recipe = recipes[prodName];
          if (recipe) {
              recipe.forEach(rItem => {
                  const ing = ingredients.find(i => i.id === rItem.ingredientId);
                  if (ing) inventoryUsage[ing.name] = (inventoryUsage[ing.name] || 0) + (rItem.quantity * qty);
              });
          }
      }

      const report = {
          isGlobal: false, id: session.id, tasa_calculo: tasa,
          opened_at: new Date(session.opened_at).toLocaleString(),
          closed_at: session.closed_at ? new Date(session.closed_at).toLocaleString() : 'EN CURSO',
          opened_by: session.opened_by, closed_by: session.closed_by || 'N/A',
          base: session.base_amount, sales: dineroCobrado, ventas_teoricas: totalVentasDespachadas,
          expenses: expensesTotal, net: dineroCobrado - expensesTotal,
          breakdown, cashInUsd, cashInBs, productCount, inventoryUsage, sessionExpenses,
          allPayments: allPayments.map(pay => ({ ...pay, client_info: pay.orders?.info || 'Cliente/Abono' }))
      };

      setClosingData(report);
      setLoading(false);
      setTimeout(() => window.print(), 500);
  };

  const handleGenerateGlobalReport = async () => {
      if (!globalReportDates.start || !globalReportDates.end) return alert("Fechas requeridas");
      setLoading(true);

      const start = new Date(globalReportDates.start).toISOString();
      const end = new Date(globalReportDates.end); end.setHours(23, 59, 59, 999);
      const endIso = end.toISOString();
      
      const { data: sessions } = await supabase.from('cash_sessions').select('*').eq('status', 'closed').gte('closed_at', start).lte('closed_at', endIso);
      if (!sessions || sessions.length === 0) { alert("No hay turnos."); setLoading(false); return; }
      
      const sessionIds = sessions.map(s => s.id);
      const { data: allOrders } = await supabase.from('orders').select('*, order_items(*)').in('session_id', sessionIds);
      const { data: allExpenses } = await supabase.from('expenses').select('*').in('session_id', sessionIds);
      const { data: allPayments } = await supabase.from('payments').select('*').in('session_id', sessionIds);

      const dineroCobrado = (allPayments || []).reduce((sum, p) => sum + p.amount_usd, 0);
      const totalExpenses = (allExpenses || []).reduce((sum, e) => sum + e.amount, 0);
      const net = dineroCobrado - totalExpenses;
      
      const breakdown = (allPayments || []).reduce((acc, curr) => {
          acc[curr.method] = (acc[curr.method] || 0) + curr.amount_usd;
          return acc;
      }, {});
      
      const productCount = {};
      (allOrders || []).forEach(o => { o.order_items.forEach(item => { productCount[item.product_name] = (productCount[item.product_name] || 0) + item.quantity; }); });
      
      const inventoryUsage = {};
      for (const [prodName, qty] of Object.entries(productCount)) {
          const recipe = recipes[prodName];
          if (recipe) {
              recipe.forEach(rItem => {
                  const ing = ingredients.find(i => i.id === rItem.ingredientId);
                  if (ing) inventoryUsage[ing.name] = (inventoryUsage[ing.name] || 0) + (rItem.quantity * qty);
              });
          }
      }

      const report = { isGlobal: true, startDate: globalReportDates.start, endDate: globalReportDates.end, sessionsCount: sessions.length, sales: dineroCobrado, expenses: totalExpenses, net, breakdown, productCount, inventoryUsage, expensesList: allExpenses || [] };
      setClosingData(report);
      setLoading(false);
      setTimeout(() => window.print(), 500);
  };

  const handleCloseSession = async () => {
      if (!confirm("¿CERRAR LA CAJA Y GENERAR REPORTE FINAL?")) return;
      await generateReportData(currentSession, false); 
      await supabase.from('cash_sessions').update({ status: 'closed', closed_at: new Date(), closed_by: user.name }).eq('id', currentSession.id);
      setCurrentSession(null);
  };

  const sendOrder = async () => {
    if (!currentSession) return alert("CAJA CERRADA");
    if (processing || cart.length === 0 || !serviceInfo.val) return alert("Falta info");
    setProcessing(true); setLoading(true);
    try {
        const total = cart.reduce((sum, item) => sum + item.price_usd, 0);
        const { data: order, error } = await supabase.from('orders').insert([{ total_usd: total, service_type: serviceInfo.type, info: serviceInfo.val, created_by: user.name, status: 'pendiente', session_id: currentSession.id }]).select().single();
        if (error) throw error;
        const items = cart.map(i => ({ order_id: order.id, product_name: i.name, quantity: 1, price_at_time: i.price_usd, notes: i.notes || '' }));
        await supabase.from('order_items').insert(items);
        
        const inventoryUsage = {};
        for (let item of cart) {
            const productRecipe = recipes[item.name];
            if (productRecipe) { 
                for (let ingItem of productRecipe) { inventoryUsage[ingItem.ingredientId] = (inventoryUsage[ingItem.ingredientId] || 0) + ingItem.quantity; } 
            }
        }
        for (const [ingId, qtyDeduct] of Object.entries(inventoryUsage)) {
            const { data: freshData } = await supabase.from('ingredients').select('stock').eq('id', ingId).single();
            if (freshData) { await supabase.from('ingredients').update({ stock: parseFloat(freshData.stock) - qtyDeduct }).eq('id', ingId); }
        }
        setTicketType('full'); setLastOrderTicket({ ...order, items: items }); 
        setCart([]); setServiceInfo({ type: 'Mesa', val: '' }); loadData();
        if(confirm("¿Imprimir Ticket de Comanda?")) { setTimeout(() => window.print(), 500); }
    } catch (e) { alert("Error: " + e.message); } finally { setProcessing(false); setLoading(false); }
  };

  const handleAddExtraToOrder = async (type) => {
      const amount = prompt(`Monto del ${type} ($):`);
      if (!amount || isNaN(amount)) return;
      setProcessing(true);
      try {
          await supabase.from('order_items').insert([{ order_id: selectedOrder.id, product_name: type.toUpperCase(), quantity: 1, price_at_time: parseFloat(amount), notes: 'CARGO ADICIONAL' }]);
          await supabase.from('orders').update({ total_usd: selectedOrder.total_usd + parseFloat(amount) }).eq('id', selectedOrder.id);
          fetchOrders(); 
      } catch (e) { alert("Error: " + e.message); } finally { setProcessing(false); }
  };

  const handlePayment = async () => {
    if (!currentSession) return alert("Caja Cerrada");
    if (processing) return;
    
    const previouslyPaid = selectedOrder.payments?.reduce((s, p) => s + p.amount_usd, 0) || 0;
    const totalPaidNow = currentPayments.reduce((s, p) => s + p.amount_usd, 0);
    const remaining = selectedOrder.total_usd - previouslyPaid - totalPaidNow;

    if (remaining > 0.05 && selectedOrder.status !== 'credito') {
        if (!confirm(`Faltan $${remaining.toFixed(2)}. ¿Deseas registrar este pago como un ABONO PARCIAL (Cuenta por cobrar)?`)) return;
    }

    setProcessing(true); setLoading(true);
    try {
        const paymentsToSave = currentPayments.map(p => ({ 
            order_id: selectedOrder.id, method: p.method, amount_usd: p.amount_usd, amount_bs: p.amount_bs, 
            rate_used: tasa, cashier: user.name, session_id: currentSession.id
        }));
        
        if (paymentsToSave.length > 0) { await supabase.from('payments').insert(paymentsToSave); }

        const newStatus = remaining <= 0.05 ? 'pagado' : 'credito';
        await supabase.from('orders').update({ status: newStatus }).eq('id', selectedOrder.id);
        
        alert("Transacción Registrada ✅"); setSelectedOrder(null); setCurrentPayments([]); fetchOrders();
    } catch (e) { alert("Error: " + e.message); } finally { setProcessing(false); setLoading(false); }
  };

  const handleSendToCredit = async () => {
      if (!confirm("¿Enviar esta orden a Cuentas por Cobrar (Crédito)?")) return;
      await supabase.from('orders').update({ status: 'credito' }).eq('id', selectedOrder.id);
      setSelectedOrder(null); fetchOrders();
  };

  const handleDeleteOrder = async (orderId) => {
      if (user.role !== 'owner') return alert("Solo Dueño");
      if (!confirm("PELIGRO: ¿Eliminar orden? Se devolverá el inventario.")) return;
      setLoading(true);
      try {
          const { data: items } = await supabase.from('order_items').select('*').eq('order_id', orderId);
          if (items) {
              const inventoryToReturn = {};
              for (let item of items) {
                  const productRecipe = recipes[item.product_name];
                  if (productRecipe) {
                      for (let ingItem of productRecipe) { inventoryToReturn[ingItem.ingredientId] = (inventoryToReturn[ingItem.ingredientId] || 0) + ingItem.quantity; }
                  }
              }
              for (const [ingId, qtyReturn] of Object.entries(inventoryToReturn)) {
                  const { data: freshData } = await supabase.from('ingredients').select('stock').eq('id', ingId).single();
                  if (freshData) { await supabase.from('ingredients').update({ stock: parseFloat(freshData.stock) + qtyReturn }).eq('id', ingId); }
              }
          }
          await supabase.from('payments').delete().eq('order_id', orderId);
          await supabase.from('order_items').delete().eq('order_id', orderId);
          await supabase.from('orders').delete().eq('id', orderId);
          alert("Eliminada"); setSelectedOrder(null); fetchOrders();
      } catch (e) { alert("Error: " + e.message); } finally { setLoading(false); }
  };

  const registerExpenseTransaction = async () => {
    if (!currentSession) return alert("Caja Cerrada");
    if (!newExpense.desc || !newExpense.amount) return alert("Faltan datos");
    setLoading(true);
    await supabase.from('expenses').insert([{ description: newExpense.desc, amount: parseFloat(newExpense.amount), category: newExpense.isStock ? 'Compra Inventario' : newExpense.category, registered_by: user.name, session_id: currentSession.id }]);
    if (newExpense.isStock && newExpense.ingredientId && newExpense.quantity) {
        const { data: freshData } = await supabase.from('ingredients').select('stock').eq('id', newExpense.ingredientId).single();
        if (freshData) { await supabase.from('ingredients').update({ stock: parseFloat(freshData.stock) + parseFloat(newExpense.quantity) }).eq('id', newExpense.ingredientId); }
    }
    setNewExpense({ desc: '', amount: '', category: 'Otros', isStock: false, ingredientId: '', quantity: '' });
    loadData(); setLoading(false);
  };

  const handleStaff = async (action, staffData) => {
    if (user.role !== 'owner') return alert("Solo Dueño");
    if (action === 'add') {
        const pin = prompt("PIN:");
        if (!pin || !staffData.name) return;
        await supabase.from('staff').insert([{ name: staffData.name, role: staffData.role, pin }]);
    } else if (action === 'delete') {
        if (confirm("¿Eliminar?")) await supabase.from('staff').delete().eq('id', staffData.id);
    } else if (action === 'updatePin') {
        const newPin = prompt("Nuevo PIN:");
        if (newPin) await supabase.from('staff').update({ pin: newPin }).eq('id', staffData.id);
    }
    loadData();
  };

  const handleAddProduct = async () => {
      const n = prompt("Nombre del Plato:");
      if (n) {
          const p = prompt("Precio ($):");
          if (p && !isNaN(p)) {
              setLoading(true);
              await supabase.from('products').insert([{ name: n, price_usd: parseFloat(p) }]);
              loadData();
              setLoading(false);
          }
      }
  };

  const handleDeleteProduct = async (id) => {
      if (user.role !== 'owner') return;
      if (!confirm("¿Eliminar plato?")) return;
      setLoading(true);
      await supabase.from('products').delete().eq('id', id);
      loadData();
      setLoading(false);
  };

  const handleAddIngredient = async () => { const n = prompt("Nombre:"); if(n) { const u = prompt("Unidad:"); await supabase.from('ingredients').insert([{ name:n, unit:u, stock: 0 }]); loadData(); }};
  const handleDeleteIngredient = async (id) => { if (user.role !== 'owner') return; if (!confirm("¿Eliminar insumo?")) return; setLoading(true); await supabase.from('ingredients').delete().eq('id', id); loadData(); setLoading(false); };
  const handleAddIngredientToRecipe = async () => { if (!selectedProductRecipe || !newRecipeEntry.ingredientId) return; setLoading(true); await supabase.from('recipes').insert([{ product_name: selectedProductRecipe, ingredient_id: newRecipeEntry.ingredientId, quantity: parseFloat(newRecipeEntry.quantity) }]); setNewRecipeEntry({ ingredientId: '', quantity: '' }); loadData(); setLoading(false); };
  const handleRemoveRecipeItem = async (id) => { if (confirm("¿Eliminar?")) { setLoading(true); await supabase.from('recipes').delete().eq('id', id); loadData(); setLoading(false); }};
  
  const login = async (pin) => {
    const { data, error } = await supabase.from('staff').select('*').eq('pin', pin).maybeSingle();
    if (error || !data) { alert("PIN Incorrecto"); return; }
    setUser(data);
    if (['owner', 'manager'].includes(data.role)) setView('dashboard');
    else if (data.role === 'caja') setView('caja'); else if (data.role === 'mesero') setView('pedidos'); else if (data.role === 'cocina') setView('cocina');
  };

  const handleAddItemToOrder = async (product) => { 
      if (!selectedOrder || processing) return;
      if (!confirm(`¿Agregar ${product.name}?`)) return;
      setProcessing(true); setLoading(true);
      try {
          await supabase.from('order_items').insert([{ order_id: selectedOrder.id, product_name: product.name, quantity: 1, price_at_time: product.price_usd, notes: 'ANEXO' }]);
          await supabase.from('orders').update({ total_usd: selectedOrder.total_usd + product.price_usd, status: selectedOrder.status === 'credito' ? 'credito' : 'pendiente' }).eq('id', selectedOrder.id);
          const productRecipe = recipes[product.name];
          if (productRecipe) { 
              for (let ingItem of productRecipe) { 
                  const { data: freshData } = await supabase.from('ingredients').select('stock').eq('id', ingItem.ingredientId).single();
                  if (freshData) { await supabase.from('ingredients').update({ stock: parseFloat(freshData.stock) - ingItem.quantity }).eq('id', ingItem.ingredientId); }
              } 
          }
          alert("Agregado");
          if(confirm("¿Imprimir Ticket?")) { setTicketType('anexo'); setLastOrderTicket({ ...selectedOrder, items: [{ product_name: product.name, quantity: 1, notes: 'ANEXO' }] }); setTimeout(() => window.print(), 500); }
          fetchOrders();
      } catch (e) { alert("Error: " + e.message); } finally { setProcessing(false); setLoading(false); }
  };

  const handleRemoveItemFromOrder = async (item) => { 
      if (processing || !confirm(`¿Eliminar ${item.product_name}?`)) return;
      setProcessing(true); setLoading(true);
      try {
        await supabase.from('order_items').delete().eq('id', item.id);
        await supabase.from('orders').update({ total_usd: Math.max(0, selectedOrder.total_usd - item.price_at_time) }).eq('id', selectedOrder.id);
        const productRecipe = recipes[item.product_name];
        if (productRecipe) { 
            for (let ingItem of productRecipe) { 
                const { data: freshData } = await supabase.from('ingredients').select('stock').eq('id', ingItem.ingredientId).single();
                if (freshData) { await supabase.from('ingredients').update({ stock: parseFloat(freshData.stock) + ingItem.quantity }).eq('id', ingItem.ingredientId); }
            } 
        }
        fetchOrders();
        } catch (e) { alert("Error: " + e.message); } finally { setProcessing(false); setLoading(false); }
  };

  const addToCart = (product) => setCart(prev => [...prev, { ...product, tempId: Date.now() + Math.random() }]);
  const removeFromCart = (tempId) => setCart(prev => prev.filter(item => item.tempId !== tempId));
  const updateCartNote = (tempId, note) => setCart(prev => prev.map(item => item.tempId === tempId ? { ...item, notes: note } : item));
  
  if (!user) return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex flex-col items-center justify-center text-white font-sans selection:bg-amber-500 selection:text-black">
      <div className="mb-12 text-center">
        <h1 className="text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-600 drop-shadow-lg">DK FOOD HOUSE</h1>
        <div className="h-1 w-24 bg-amber-500 mx-auto mt-4 rounded-full"></div>
      </div>
      <div className="grid grid-cols-2 gap-4 w-full max-w-lg px-6">
        {['DUEÑO', 'GERENCIA', 'CAJA', 'MESERO'].map((role, idx) => (
          <button key={role} onClick={() => { const p = prompt(`PIN ${role}:`); if(p) login(p); }} 
            className={`p-6 rounded-2xl text-lg font-bold shadow-xl border border-gray-800 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-amber-500/20 
            ${idx === 0 ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white border-amber-500/50' : 'bg-gray-800/80 hover:bg-gray-700 text-gray-200'}`}>
            {role === 'DUEÑO' ? '👑' : '🥩'} {role}
          </button>
        ))}
        <button onClick={() => { const p = prompt("PIN Cocina:"); if(p) login(p); }} 
          className="col-span-2 p-5 bg-gray-800/80 rounded-2xl font-bold border border-gray-700 hover:border-amber-500 text-gray-200 transition-all hover:bg-gray-700 shadow-lg">
          🍔 ÁREA DE COCINA
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-20 bg-[#F8F9FA] font-sans text-gray-800 selection:bg-amber-500 selection:text-black">
      {/* ALERTA DE VERSION */}
      {showVersionAlert && (
        <div className="fixed top-0 left-0 w-full bg-amber-500 text-black text-center p-2 font-bold z-[9999] shadow-md animate-pulse">
          SISTEMA PREMIUM - DK FOOD HOUSE (VERSIÓN ACTUALIZADA)
        </div>
      )}

      {/* NAVBAR ELEGANTE */}
      <nav className="bg-black text-white p-4 flex justify-between items-center sticky top-0 z-50 shadow-xl border-b border-gray-800 no-print">
        <div className="flex flex-col">
            <div className="font-black text-xl tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-600">
                DK <span className="text-xs text-gray-400 font-normal tracking-normal">| {user.role.toUpperCase()}</span>
            </div>
            <div className="text-[11px] font-medium flex items-center gap-1 mt-1">
                {currentSession ? <span className="text-emerald-400 flex items-center gap-1 bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-800/50"><Unlock size={10}/> TURNO #{currentSession.id}</span> : <span className="text-rose-500 flex items-center gap-1 bg-rose-900/30 px-2 py-0.5 rounded-full border border-rose-800/50"><Lock size={10}/> CERRADO</span>}
            </div>
        </div>
        <div className="flex gap-2">
            {['owner', 'manager'].includes(user.role) && <button onClick={() => setView('dashboard')} className={`p-2.5 rounded-xl transition-all ${view==='dashboard'?'bg-amber-500 text-black shadow-lg shadow-amber-500/30':'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}><LayoutDashboard size={20}/></button>}
            {user.role === 'owner' && <button onClick={() => setView('inventario')} className={`p-2.5 rounded-xl transition-all ${view==='inventario'?'bg-amber-500 text-black shadow-lg shadow-amber-500/30':'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}><Package size={20}/></button>}
            {['owner', 'manager'].includes(user.role) && <button onClick={() => setView('reportes')} className={`p-2.5 rounded-xl transition-all ${view==='reportes'?'bg-amber-500 text-black shadow-lg shadow-amber-500/30':'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}><TrendingUp size={20}/></button>}
            <button onClick={() => setView('caja')} className={`p-2.5 rounded-xl transition-all ${view==='caja'?'bg-amber-500 text-black shadow-lg shadow-amber-500/30':'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}><DollarSign size={20}/></button>
            {user.role !== 'cocina' && <button onClick={() => setView('pedidos')} className={`p-2.5 rounded-xl transition-all ${view==='pedidos'?'bg-amber-500 text-black shadow-lg shadow-amber-500/30':'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}><ShoppingCart size={20}/></button>}
            <div className="w-px h-8 bg-gray-800 mx-1"></div>
            <button onClick={() => window.location.reload()} className="p-2.5 bg-rose-600/10 text-rose-500 border border-rose-600/20 rounded-xl hover:bg-rose-600 hover:text-white transition-all"><LogOut size={20}/></button>
        </div>
      </nav>

      {view === 'dashboard' && (
          <div className="max-w-7xl mx-auto p-6 space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-4">
                      <div className={`p-4 rounded-full ${currentSession ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                          {currentSession ? <Unlock size={24}/> : <Lock size={24}/>}
                      </div>
                      <div>
                          <h3 className="font-black text-xl text-gray-900">Estado de Caja</h3>
                          {currentSession ? (<div className="text-sm text-gray-500 mt-1">Responsable: <span className="font-bold text-gray-800">{currentSession.opened_by}</span> | Fondo: <span className="font-bold text-gray-800">${currentSession.base_amount}</span></div>) : <p className="text-rose-500 font-bold mt-1">Requiere apertura de turno.</p>}
                      </div>
                  </div>
                  <div>
                      {!currentSession ? (
                          <button onClick={handleOpenSession} className="bg-amber-500 text-black px-8 py-3.5 rounded-xl font-bold hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20 flex items-center gap-2">ABRIR TURNO</button>
                      ) : (
                          <button onClick={handleCloseSession} className="bg-black text-white px-8 py-3.5 rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-lg flex items-center gap-2">CERRAR TURNO</button>
                      )}
                  </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                  <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2"><DollarSign className="text-amber-500"/> Tasa de Cambio</h2>
                  <div className="flex gap-2">
                      <div className="relative">
                          <span className="absolute left-3 top-2.5 font-bold text-gray-400">Bs</span>
                          <input type="number" value={tasa} onChange={e => setTasa(e.target.value)} className="border border-gray-200 p-2 pl-9 rounded-xl w-32 focus:ring-2 focus:ring-amber-500 outline-none font-bold text-gray-800" />
                      </div>
                      <button onClick={async () => { await supabase.from('settings').upsert({ key:'tasa', value: { usd: tasa }}); alert("Tasa Actualizada"); }} className="bg-black text-white px-4 rounded-xl font-bold hover:bg-gray-800 transition-colors">Guardar</button>
                  </div>
              </div>
              
              {user.role === 'owner' && (
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                      <h3 className="font-black text-lg mb-5 flex items-center gap-2 text-gray-900"><CreditCard className="text-amber-500"/> Billeteras y Promociones</h3>
                      <div className="flex flex-col md:flex-row gap-3 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100 items-end">
                          <div className="flex-1 w-full">
                              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Nombre del Método</label>
                              <input value={newPayMethod.name} placeholder="Ej: Zelle Luis" onChange={e => setNewPayMethod({...newPayMethod, name: e.target.value})} className="border border-gray-200 p-2.5 rounded-xl w-full focus:ring-2 focus:ring-amber-500 outline-none" />
                          </div>
                          <div className="w-full md:w-48">
                              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Moneda</label>
                              <select value={newPayMethod.currency} onChange={e => setNewPayMethod({...newPayMethod, currency: e.target.value})} className="border border-gray-200 p-2.5 rounded-xl w-full bg-white focus:ring-2 focus:ring-amber-500 outline-none font-medium">
                                  <option value="USD">Dólares ($)</option><option value="BS">Bolívares (Bs)</option><option value="OTRO">Canje / Interno</option>
                              </select>
                          </div>
                          <button onClick={async () => { if(!newPayMethod.name) return; await supabase.from('payment_methods').insert([newPayMethod]); setNewPayMethod({name: '', currency: 'USD'}); loadData(); }} className="bg-black text-white px-6 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition-colors w-full md:w-auto">Agregar</button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {paymentMethods.map(pm => (
                              <div key={pm.id} className="border border-gray-100 p-4 rounded-xl flex justify-between items-center bg-white shadow-sm hover:border-amber-200 transition-colors">
                                  <div>
                                      <div className={`font-bold text-sm ${!pm.is_active ? 'line-through text-gray-400' : 'text-gray-900'}`}>{pm.name}</div>
                                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">{pm.currency}</div>
                                  </div>
                                  <button onClick={async () => { await supabase.from('payment_methods').update({is_active: !pm.is_active}).eq('id', pm.id); loadData(); }} className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${pm.is_active ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}>
                                      {pm.is_active ? 'Ocultar' : 'Activar'}
                                  </button>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {user.role === 'owner' && (
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                      <h3 className="font-black text-lg mb-5 flex items-center gap-2 text-gray-900"><TrendingDown className="text-rose-500"/> Salida de Caja (Gastos)</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-5 rounded-xl border border-gray-100">
                          <input placeholder="Concepto del gasto..." className="border border-gray-200 p-3 rounded-xl w-full focus:ring-2 focus:ring-amber-500 outline-none" value={newExpense.desc} onChange={e => setNewExpense({...newExpense, desc: e.target.value})} />
                          <div className="flex gap-3">
                              <div className="relative flex-1">
                                  <span className="absolute left-3 top-3 font-bold text-gray-400">$</span>
                                  <input type="number" placeholder="0.00" className="border border-gray-200 p-3 pl-8 rounded-xl w-full focus:ring-2 focus:ring-amber-500 outline-none font-bold" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} />
                              </div>
                              <select className="border border-gray-200 p-3 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 outline-none font-medium flex-1" value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value})}>
                                  <option>Operativo</option><option>Nomina</option><option>Servicios</option><option value="Compra Inventario">Reposición Inventario</option>
                              </select>
                          </div>
                          <div className="md:col-span-2 flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                              <label className="flex items-center gap-2 font-bold text-sm text-gray-700 cursor-pointer whitespace-nowrap">
                                  <input type="checkbox" checked={newExpense.isStock} onChange={e => setNewExpense({...newExpense, isStock: e.target.checked})} className="w-5 h-5 accent-amber-500 rounded" />
                                  Vincular al inventario
                              </label>
                              {newExpense.isStock && (
                                  <div className="flex gap-2 w-full animate-fade-in">
                                      <select className="border border-gray-200 p-2.5 rounded-xl flex-1 bg-white focus:ring-2 focus:ring-amber-500 outline-none text-sm" value={newExpense.ingredientId} onChange={e => setNewExpense({...newExpense, ingredientId: e.target.value})}>
                                          <option value="">Seleccionar insumo exacto...</option>
                                          {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                                      </select>
                                      <input type="number" placeholder="Cant." className="border border-gray-200 p-2.5 rounded-xl w-24 focus:ring-2 focus:ring-amber-500 outline-none text-sm font-bold" value={newExpense.quantity} onChange={e => setNewExpense({...newExpense, quantity: e.target.value})} />
                                  </div>
                              )}
                          </div>
                          <button onClick={registerExpenseTransaction} disabled={!currentSession} className="md:col-span-2 bg-rose-600 text-white py-3.5 rounded-xl font-bold shadow-md shadow-rose-600/20 hover:bg-rose-700 disabled:opacity-50 transition-colors mt-2">Extraer de Caja</button>
                      </div>
                  </div>
              )}

              {user.role === 'owner' && (
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                      <div className="flex justify-between items-center mb-5">
                          <h3 className="font-black text-lg flex items-center gap-2 text-gray-900"><Users className="text-amber-500"/> Accesos del Personal</h3>
                          <button onClick={() => handleStaff('add', { name: prompt("Nombre:"), role: prompt("Rol (owner, manager, caja, mesero, cocina):") })} className="bg-black text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-gray-800 transition-colors"><PlusCircle size={16}/> Alta</button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {staffList.map(s => (
                              <div key={s.id} className="border border-gray-100 p-4 rounded-xl flex justify-between items-center bg-gray-50 hover:border-amber-200 transition-colors">
                                  <div>
                                      <div className="font-bold text-gray-900 text-sm">{s.name}</div>
                                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">{s.role}</div>
                                  </div>
                                  <div className="flex gap-1">
                                      <button onClick={() => handleStaff('updatePin', s)} className="text-gray-400 hover:text-amber-600 hover:bg-amber-50 p-2 rounded-lg transition-colors"><Lock size={16}/></button>
                                      <button onClick={() => handleStaff('delete', s)} className="text-gray-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
          </div>
      )}

      {view === 'inventario' && (
            <div className="max-w-7xl mx-auto p-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="border-b border-gray-100 bg-gray-50/50 p-6 flex flex-col sm:flex-row justify-between items-center gap-4 no-print">
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Gestión de Menú</h2>
                        <div className="flex p-1 bg-gray-200/50 rounded-xl">
                            {['platos', 'insumos', 'recetas'].map(tab => (
                                <button key={tab} onClick={() => setInvSubView(tab)} className={`px-5 py-2 rounded-lg font-bold text-sm capitalize transition-all ${invSubView === tab ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="p-6">
                        {invSubView === 'platos' && (
                            <div className="animate-fade-in">
                                <div className="mb-6 flex justify-end">
                                    <button onClick={handleAddProduct} className="bg-amber-500 text-black px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-amber-400 shadow-lg shadow-amber-500/20 transition-all"><PlusCircle size={18}/> Crear Plato</button>
                                </div>
                                <div className="border border-gray-100 rounded-xl overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead><tr className="bg-gray-50 border-b border-gray-100"><th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Descripción</th><th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Precio</th>{user.role === 'owner' && <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right no-print">Acción</th>}</tr></thead>
                                        <tbody className="divide-y divide-gray-100">{products.map(p => (
                                            <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="p-4 font-bold text-gray-900">{p.name}</td>
                                                <td className="p-4 font-black text-gray-900">${p.price_usd}</td>
                                                {user.role === 'owner' && (
                                                    <td className="p-4 no-print flex gap-2 justify-end">
                                                        <button onClick={async () => { const v = prompt("Nuevo Precio ($):", p.price_usd); if(v && !isNaN(v)) { await supabase.from('products').update({price_usd: parseFloat(v)}).eq('id', p.id); loadData(); }}} className="text-gray-400 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-colors"><Edit3 size={18}/></button>
                                                        <button onClick={() => handleDeleteProduct(p.id)} className="text-gray-400 hover:text-rose-600 p-2 rounded-lg hover:bg-rose-50 transition-colors"><Trash2 size={18}/></button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {invSubView === 'insumos' && (
                            <div className="animate-fade-in">
                                <div className="mb-6 flex justify-end"><button onClick={handleAddIngredient} className="bg-black text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-gray-800 shadow-lg transition-all"><PlusCircle size={18}/> Registrar Insumo</button></div>
                                <div className="border border-gray-100 rounded-xl overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead><tr className="bg-gray-50 border-b border-gray-100"><th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Materia Prima</th><th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Stock</th><th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Medida</th>{user.role === 'owner' && <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right no-print">Acción</th>}</tr></thead>
                                        <tbody className="divide-y divide-gray-100">{ingredients.map(ing => (
                                            <tr key={ing.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="p-4 font-medium text-gray-800">{ing.name}</td>
                                                <td className={`p-4 font-black ${ing.stock < 10 ? 'text-rose-600 bg-rose-50/50 w-fit px-2 rounded' : 'text-gray-900'}`}>{Number(ing.stock).toFixed(2)}</td>
                                                <td className="p-4 text-xs font-bold text-gray-400 uppercase">{ing.unit}</td>
                                                {user.role === 'owner' && (
                                                    <td className="p-4 no-print flex gap-2 justify-end">
                                                        <button onClick={async () => { const v = prompt("Ajuste Stock:", ing.stock); if(v) { await supabase.from('ingredients').update({stock:v}).eq('id', ing.id); loadData(); }}} className="text-gray-400 hover:text-amber-600 p-2 rounded-lg hover:bg-amber-50 transition-colors"><Edit3 size={18}/></button>
                                                        <button onClick={() => handleDeleteIngredient(ing.id)} className="text-gray-400 hover:text-rose-600 p-2 rounded-lg hover:bg-rose-50 transition-colors"><Trash2 size={18}/></button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {invSubView === 'recetas' && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
                                <div className="border border-gray-100 rounded-xl p-2 bg-gray-50/30 max-h-[60vh] overflow-y-auto space-y-1">
                                    {products.map(p => (
                                        <button key={p.id} onClick={() => setSelectedProductRecipe(p.name)} className={`w-full text-left p-3.5 rounded-lg font-bold text-sm transition-colors ${selectedProductRecipe === p.name ? 'bg-black text-white shadow-md' : 'hover:bg-white text-gray-600 border border-transparent hover:border-gray-200'}`}>{p.name}</button>
                                    ))}
                                </div>
                                <div className="lg:col-span-2">
                                    {selectedProductRecipe ? (
                                        <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
                                            <h3 className="font-black text-xl border-b border-gray-100 pb-4 mb-6 text-gray-900">Estructura de Costo: <span className="text-amber-600">{selectedProductRecipe}</span></h3>
                                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6 flex flex-col sm:flex-row gap-3">
                                                <select className="flex-1 border border-gray-200 p-3 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 outline-none font-medium text-sm" value={newRecipeEntry.ingredientId} onChange={e => setNewRecipeEntry({...newRecipeEntry, ingredientId: e.target.value})}>
                                                    <option value="">Seleccione insumo para descontar...</option>
                                                    {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                                                </select>
                                                <div className="flex gap-2">
                                                    <input type="number" placeholder="Cant." className="w-24 border border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none font-bold text-center" value={newRecipeEntry.quantity} onChange={e => setNewRecipeEntry({...newRecipeEntry, quantity: e.target.value})} />
                                                    <button onClick={handleAddIngredientToRecipe} className="bg-amber-500 hover:bg-amber-400 text-black p-3 rounded-lg font-bold transition-colors shadow-md shadow-amber-500/20"><PlusCircle size={20}/></button>
                                                </div>
                                            </div>
                                            <div className="border border-gray-100 rounded-lg overflow-hidden">
                                                <table className="w-full text-sm">
                                                    <tbody className="divide-y divide-gray-100">
                                                        {(recipes[selectedProductRecipe] || []).map(rItem => { 
                                                            const ing = ingredients.find(i => i.id === rItem.ingredientId); 
                                                            return (
                                                                <tr key={rItem.id} className="hover:bg-gray-50 transition-colors">
                                                                    <td className="p-4 font-bold text-gray-800">{ing?.name}</td>
                                                                    <td className="p-4 font-medium">{rItem.quantity} <span className="text-xs font-bold text-gray-400 uppercase ml-1">{ing?.unit}</span></td>
                                                                    <td className="p-4 text-right"><button onClick={() => handleRemoveRecipeItem(rItem.id)} className="text-gray-300 hover:text-rose-500 p-2 rounded-lg transition-colors"><XCircle size={18}/></button></td>
                                                                </tr>
                                                            ) 
                                                        })}
                                                        {(!recipes[selectedProductRecipe] || recipes[selectedProductRecipe].length === 0) && (
                                                            <tr><td colSpan="3" className="p-8 text-center text-gray-400 italic font-medium">Este plato no descontará inventario al venderse.</td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-full border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center p-12 text-center text-gray-400 font-medium">Selecciona un plato del menú lateral para configurar su consumo interno de ingredientes.</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

      {view === 'pedidos' && (
          <div className="max-w-[1400px] mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 h-[85vh]">
              {/* CARTA MENÚ */}
              <div className="lg:col-span-8 overflow-y-auto bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h2 className="font-black text-2xl mb-6 text-gray-900 tracking-tight">Selección</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                      {products.map(p => (
                          <div key={p.id} onClick={() => addToCart(p)} className="cursor-pointer border border-gray-100 p-5 rounded-2xl bg-white hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/10 transition-all group flex flex-col justify-between min-h-[120px]">
                              <h3 className="font-bold text-gray-800 group-hover:text-black leading-tight">{p.name}</h3>
                              <p className="text-amber-600 font-black text-lg mt-2">${p.price_usd}</p>
                          </div>
                      ))}
                  </div>
              </div>
              
              {/* TICKET / CARRITO */}
              <div className="lg:col-span-4 bg-white p-6 rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col h-full relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-yellow-600"></div>
                  <h2 className="font-black text-xl mb-4 text-gray-900">Comanda Actual</h2>
                  <div className="flex flex-col gap-3 mb-5">
                      <select className="border border-gray-200 p-3 rounded-xl bg-gray-50 focus:ring-2 focus:ring-amber-500 outline-none font-medium" onChange={e => setServiceInfo({...serviceInfo, type: e.target.value})}>
                          <option>Mesa</option><option>Para Llevar</option><option>Delivery</option>
                      </select>
                      <input placeholder="Nombre Cliente o N° Mesa" className="border border-gray-200 p-3 rounded-xl bg-gray-50 focus:ring-2 focus:ring-amber-500 outline-none font-bold placeholder-gray-400" onChange={e => setServiceInfo({...serviceInfo, val: e.target.value})} value={serviceInfo.val} />
                  </div>
                  
                  <div className="flex-1 overflow-y-auto border-t border-b border-gray-100 py-3 mb-4 pr-2 space-y-3">
                      {cart.map(item => (
                          <div key={item.tempId} className="flex gap-3 text-sm group bg-white">
                              <div className="flex-1">
                                  <div className="flex justify-between items-start">
                                      <span className="font-bold text-gray-900 leading-tight">{item.name}</span>
                                      <span className="font-black text-gray-900 ml-2">${item.price_usd}</span>
                                  </div>
                                  <input placeholder="Sin cebolla, extra salsa..." className="text-xs border-b border-dashed border-gray-200 w-full mt-1.5 py-1 text-gray-500 focus:text-black focus:border-amber-400 outline-none" value={item.notes || ''} onChange={e => updateCartNote(item.tempId, e.target.value)} />
                              </div>
                              <button onClick={() => removeFromCart(item.tempId)} className="text-gray-300 hover:text-rose-500 transition-colors mt-0.5"><XCircle size={20}/></button>
                          </div>
                      ))}
                      {cart.length === 0 && <div className="h-full flex items-center justify-center text-gray-400 italic font-medium text-sm">El carrito está vacío</div>}
                  </div>
                  
                  <div className="pt-2">
                      <div className="flex justify-between items-center mb-4 px-1">
                          <span className="font-bold text-gray-500 uppercase tracking-wider text-xs">Total Parcial</span>
                          <span className="font-black text-3xl text-gray-900">${cart.reduce((sum, item) => sum + item.price_usd, 0).toFixed(2)}</span>
                      </div>
                      <button onClick={sendOrder} disabled={!currentSession || cart.length === 0} className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg disabled:bg-gray-200 disabled:text-gray-400 hover:bg-gray-800 transition-all shadow-lg shadow-black/10">
                          {!currentSession ? 'CAJA CERRADA' : 'CONFIRMAR Y ENVIAR'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {view === 'cocina' && (
          <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {orders.filter(o => o.status === 'pendiente').map(o => (
                  <div key={o.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                      <div className="bg-black text-white p-4 flex justify-between items-center">
                          <span className="font-black text-sm uppercase tracking-wider text-amber-500">{o.service_type}</span>
                          <span className="text-sm font-bold bg-white/10 px-3 py-1 rounded-full">{o.info}</span>
                      </div>
                      <div className="p-5 flex-1 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-gray-50/50">
                          <ul className="space-y-4">
                              {o.order_items.map(item => (
                                  <li key={item.id} className="text-gray-900">
                                      <div className="font-black text-lg flex items-start gap-2"><span className="text-amber-500">×</span> {item.product_name}</div>
                                      {item.notes && <div className="text-rose-700 text-sm bg-rose-50 border border-rose-100 p-2 rounded-lg mt-1.5 font-medium ml-4 uppercase">ATENCIÓN: {item.notes}</div>}
                                  </li>
                              ))}
                          </ul>
                      </div>
                      <div className="flex border-t border-gray-100 p-2 gap-2 bg-white">
                         <button onClick={async () => { await supabase.from('orders').update({status:'listo'}).eq('id', o.id); fetchOrders(); }} className="flex-1 bg-emerald-500 text-white font-black py-3 rounded-xl hover:bg-emerald-600 transition-colors shadow-sm">DESPACHAR ✅</button>
                         <button onClick={() => { setTicketType('full'); setLastOrderTicket(o); setTimeout(()=>window.print(), 200); }} className="bg-gray-100 text-gray-600 px-4 rounded-xl hover:bg-gray-200 transition-colors"><Printer size={20}/></button>
                      </div>
                  </div>
              ))}
              {orders.filter(o => o.status === 'pendiente').length === 0 && <div className="col-span-full py-20 text-center text-gray-400 font-bold text-xl">NO HAY ORDENES PENDIENTES</div>}
          </div>
      )}

      {view === 'caja' && (
           <div className="max-w-[1400px] mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {!currentSession && (['owner', 'manager'].includes(user.role)) && (
                  <div className="lg:col-span-12 bg-rose-50 border border-rose-200 text-rose-800 px-6 py-4 rounded-2xl flex justify-between items-center shadow-sm">
                      <span className="font-bold flex items-center gap-2"><Lock/> CAJA CERRADA. NO SE PUEDEN PROCESAR PAGOS.</span> 
                      <button onClick={() => setView('dashboard')} className="bg-black text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors">ABRIR AHORA</button>
                  </div>
              )}
              
              <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <div className="flex gap-2 mb-6 bg-gray-100/50 p-1 rounded-xl w-fit">
                      <button onClick={()=>{setCajaTab('activas'); setSelectedOrder(null);}} className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${cajaTab==='activas'?'bg-white text-gray-900 shadow-sm border border-gray-200':'text-gray-500 hover:text-gray-700'}`}>Mesas Activas</button>
                      <button onClick={()=>{setCajaTab('cobrar'); setSelectedOrder(null);}} className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${cajaTab==='cobrar'?'bg-white text-gray-900 shadow-sm border border-gray-200':'text-gray-500 hover:text-gray-700'}`}>Por Cobrar (Fiado)</button>
                  </div>
                  
                  <div className="space-y-3">
                      {(() => {
                          const displayOrders = cajaTab === 'activas' ? orders.filter(o => o.status !== 'pagado' && o.status !== 'credito') : orders.filter(o => o.status === 'credito');
                          if (displayOrders.length === 0) return <div className="text-gray-400 text-center py-12 font-medium bg-gray-50 rounded-xl border border-dashed border-gray-200">No hay cuentas en esta sección.</div>;

                          return displayOrders.map(o => {
                              const prevPaid = o.payments?.reduce((s, p) => s + p.amount_usd, 0) || 0;
                              return (
                              <div key={o.id} onClick={() => { setSelectedOrder(o); setCurrentPayments([]); setIsEditingOrder(false); }} className={`p-4 rounded-xl border cursor-pointer transition-all flex justify-between items-center group ${selectedOrder?.id === o.id ? 'bg-black text-white border-black shadow-lg shadow-black/10' : 'bg-white border-gray-100 hover:border-amber-300 hover:shadow-sm'}`}>
                                  <div>
                                      <div className={`font-black text-lg ${selectedOrder?.id === o.id ? 'text-white' : 'text-gray-900'}`}>{o.service_type} - {o.info}</div>
                                      <div className="flex items-center gap-2 mt-1">
                                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${o.status==='listo'?'bg-emerald-100 border-emerald-200 text-emerald-700': o.status==='credito'?'bg-rose-100 border-rose-200 text-rose-700':'bg-amber-100 border-amber-200 text-amber-700'}`}>{o.status}</span>
                                          {prevPaid > 0 && o.status === 'credito' && <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">Abonado: ${prevPaid.toFixed(2)}</span>}
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                      <div className={`font-black text-2xl ${selectedOrder?.id === o.id ? 'text-amber-400' : 'text-gray-900'}`}>${o.total_usd.toFixed(2)}</div>
                                      <div className="flex flex-col gap-1">
                                          <button onClick={(e) => { e.stopPropagation(); setTicketType('full'); setLastOrderTicket(o); setTimeout(()=>window.print(), 200); }} className={`p-1.5 rounded-lg transition-colors ${selectedOrder?.id === o.id ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-500'}`}><Printer size={16}/></button>
                                          {user.role === 'owner' && <button onClick={(e) => { e.stopPropagation(); handleDeleteOrder(o.id); }} className={`p-1.5 rounded-lg transition-colors ${selectedOrder?.id === o.id ? 'bg-rose-500/20 hover:bg-rose-500/40 text-rose-300' : 'bg-rose-50 hover:bg-rose-100 text-rose-500'}`}><Trash2 size={16}/></button>}
                                      </div>
                                  </div>
                              </div>
                          )});
                      })()}
                  </div>
              </div>

              {selectedOrder && (
                  <div className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 lg:sticky lg:top-24">
                      <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
                           {(['owner', 'manager', 'caja'].includes(user.role)) && (<button onClick={() => setIsEditingOrder(false)} className={`flex-1 py-2 font-bold text-sm rounded-lg transition-colors ${!isEditingOrder ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>TERMINAL DE PAGO</button>)}
                           <button onClick={() => setIsEditingOrder(true)} className={`flex-1 py-2 font-bold text-sm rounded-lg transition-colors ${isEditingOrder ? 'bg-amber-500 text-black shadow-sm' : 'text-gray-500'}`}>AGREGAR / EDITAR</button>
                      </div>
                      
                      {!isEditingOrder ? (
                          <div className="animate-fade-in">
                              <div className="mb-6 p-6 rounded-2xl border border-gray-100 bg-gray-50 text-center relative overflow-hidden">
                                  <div className="absolute top-0 left-0 w-full h-1 bg-gray-200"></div>
                                  <div className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-1">Total Consumo</div>
                                  <div className="text-4xl font-black text-gray-900">${selectedOrder.total_usd.toFixed(2)}</div>
                                  {(() => {
                                      const prevPaid = selectedOrder.payments?.reduce((s, p) => s + p.amount_usd, 0) || 0;
                                      if (prevPaid > 0) return <div className="inline-block mt-3 bg-white border border-gray-200 px-3 py-1 rounded-full text-xs font-bold text-gray-500">Ya pagó: <span className="text-emerald-600">${prevPaid.toFixed(2)}</span></div>;
                                      return null;
                                  })()}
                              </div>
                              
                              <div className="mb-6">
                                  {(() => {
                                      const previouslyPaid = selectedOrder.payments?.reduce((s, p) => s + p.amount_usd, 0) || 0;
                                      const paidNow = currentPayments.reduce((s, p) => s + p.amount_usd, 0);
                                      const remaining = selectedOrder.total_usd - previouslyPaid - paidNow;
                                      
                                      return remaining > 0.05 ? (
                                          <div className="flex items-center justify-between p-4 bg-rose-50 border border-rose-100 rounded-xl">
                                              <div>
                                                  <div className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-0.5">Saldo Restante</div>
                                                  <div className="text-sm font-bold text-rose-800">Bs {(remaining * tasa).toFixed(2)}</div>
                                              </div>
                                              <div className="text-3xl font-black text-rose-600">${remaining.toFixed(2)}</div>
                                          </div>
                                      ) : (
                                          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-700 font-black text-lg flex items-center justify-center gap-2">
                                              <div className="bg-emerald-500 text-white p-1 rounded-full"><Unlock size={16}/></div> CUENTA SALDADA
                                          </div>
                                      );
                                  })()}
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3 mb-6">
                                  <button onClick={() => handleAddExtraToOrder('delivery')} className="py-2.5 bg-white border border-gray-200 hover:border-amber-400 hover:shadow-sm text-gray-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"><Bike size={16} className="text-amber-500"/> + DELIVERY</button>
                                  <button onClick={() => handleAddExtraToOrder('propina')} className="py-2.5 bg-white border border-gray-200 hover:border-amber-400 hover:shadow-sm text-gray-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"><Coins size={16} className="text-amber-500"/> + PROPINA</button>
                              </div>
                              
                              <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Ingresar Pago</label>
                                  <div className="flex gap-2 mb-3">
                                      <div className="relative flex-1">
                                          <span className="absolute left-3 top-3 font-bold text-gray-400">$</span>
                                          <input type="number" placeholder="0.00" className="w-full border border-gray-200 p-3 pl-8 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 outline-none font-bold text-lg" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                                      </div>
                                      <select className="border border-gray-200 p-3 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 outline-none font-bold text-sm w-32" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                                          {paymentMethods.filter(pm => pm.is_active).map(pm => (
                                              <option key={pm.id} value={pm.name}>{pm.name}</option>
                                          ))}
                                      </select>
                                  </div>
                                  <button disabled={processing || !currentSession || !payAmount} onClick={() => { 
                                      const val = parseFloat(payAmount); 
                                      if (!val) return; 
                                      const methodObj = paymentMethods.find(m => m.name === payMethod);
                                      const isBs = methodObj?.currency === 'BS'; 
                                      const usdEquiv = isBs ? val / tasa : val; 
                                      setCurrentPayments([...currentPayments, { method: payMethod, amount_usd: usdEquiv, amount_bs: isBs ? val : 0, tempId: Date.now() }]); 
                                      setPayAmount(''); 
                                  }} className="w-full bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-black transition-colors text-sm">AGREGAR MÉTODO</button>
                              </div>

                              {currentPayments.length > 0 && (
                                  <div className="space-y-2 mb-6 border border-gray-100 rounded-xl p-3 bg-white">
                                      {currentPayments.map((p) => (
                                          <div key={p.tempId} className="flex justify-between p-2 bg-gray-50 rounded-lg text-sm items-center border border-gray-100">
                                              <span className="font-bold text-gray-700">{p.method}</span>
                                              <div className="flex items-center gap-3">
                                                  <span className="font-black text-gray-900">${p.amount_usd.toFixed(2)} {p.amount_bs > 0 && <span className="text-gray-400 text-xs font-normal"> (Bs {p.amount_bs})</span>}</span>
                                                  <button onClick={() => setCurrentPayments(currentPayments.filter(cp => cp.tempId !== p.tempId))} className="text-gray-400 hover:text-rose-500 bg-white p-1 rounded-md shadow-sm border border-gray-200 transition-colors"><Trash2 size={14}/></button>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              )}
                              
                              <div className="flex flex-col gap-3">
                                  <button onClick={handlePayment} disabled={processing || !currentSession || (currentPayments.length === 0 && selectedOrder.status !== 'credito')} className="w-full bg-amber-500 text-black py-4 rounded-xl font-black text-lg shadow-lg shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-30 disabled:shadow-none transition-all">
                                      {!currentSession ? 'CAJA CERRADA' : currentPayments.length > 0 ? 'PROCESAR PAGO' : 'NADA QUE COBRAR'}
                                  </button>
                                  
                                  {selectedOrder.status !== 'credito' && (
                                      <button onClick={handleSendToCredit} disabled={processing || !currentSession} className="w-full bg-white border-2 border-gray-900 text-gray-900 py-3 rounded-xl font-bold hover:bg-gray-50 transition-colors text-sm">
                                          GUARDAR COMO CUENTA POR COBRAR (FIAR)
                                      </button>
                                  )}
                              </div>
                          </div>
                      ) : (
                          <div className="animate-fade-in flex flex-col h-[600px]">
                              <div className="flex-1 overflow-y-auto mb-4 border border-gray-100 rounded-xl bg-gray-50 p-2 space-y-2">
                                  {selectedOrder.order_items?.map(item => (
                                      <div key={item.id} className="flex justify-between items-center p-3 border border-gray-100 bg-white rounded-lg shadow-sm">
                                          <div><div className="font-bold text-sm text-gray-900">{item.product_name}</div><div className="text-xs font-bold text-amber-600">${item.price_at_time}</div></div>
                                          <button onClick={() => handleRemoveItemFromOrder(item)} disabled={processing} className="text-gray-300 hover:text-rose-500 transition-colors"><XCircle size={22}/></button>
                                      </div>
                                  ))}
                              </div>
                              <div className="pt-4 border-t border-gray-100">
                                  <div className="relative mb-3">
                                      <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
                                      <input className="w-full border border-gray-200 p-3 pl-10 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 outline-none text-sm font-medium" placeholder="Buscar plato para agregar..." value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 h-40 overflow-y-auto pr-1">
                                      {products.filter(p => p.name.toLowerCase().includes(itemSearch.toLowerCase())).map(p => (
                                          <button key={p.id} disabled={processing} onClick={() => handleAddItemToOrder(p)} className="p-3 border border-gray-100 rounded-xl hover:border-amber-400 hover:shadow-md bg-white text-left transition-all group">
                                              <div className="font-bold text-sm text-gray-800 group-hover:text-black leading-tight mb-1">{p.name}</div>
                                              <div className="text-xs font-black text-amber-600">${p.price_usd}</div>
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>
              )}
          </div>
      )}

      {view === 'reportes' && (
          <div className="max-w-7xl mx-auto p-6 space-y-8">
              {user.role === 'owner' && (
                  <div className="bg-black text-white p-8 rounded-2xl shadow-xl no-print relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500 rounded-full blur-3xl opacity-10 translate-x-1/2 -translate-y-1/2"></div>
                      <h3 className="font-black text-2xl mb-6 flex items-center gap-3 relative z-10"><TrendingUp className="text-amber-500" size={28}/> Consolidado Gerencial</h3>
                      <div className="flex flex-col md:flex-row gap-5 items-end relative z-10">
                          <div className="w-full md:w-auto"><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Fecha Inicio</label><input type="date" className="w-full border-none bg-gray-800 p-3.5 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-white font-medium color-scheme-dark" value={globalReportDates.start} onChange={e => setGlobalReportDates({...globalReportDates, start: e.target.value})} /></div>
                          <div className="w-full md:w-auto"><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Fecha Fin</label><input type="date" className="w-full border-none bg-gray-800 p-3.5 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-white font-medium color-scheme-dark" value={globalReportDates.end} onChange={e => setGlobalReportDates({...globalReportDates, end: e.target.value})} /></div>
                          <button onClick={handleGenerateGlobalReport} className="w-full md:w-auto bg-amber-500 text-black px-8 py-3.5 rounded-xl font-bold hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20 flex gap-2 items-center justify-center"><FileText size={18}/> Generar PDF</button>
                      </div>
                  </div>
              )}
              
              {currentSession && (
                  <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 rounded-2xl border border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4 no-print shadow-lg">
                      <div><h3 className="font-black text-white text-xl">Monitor en Vivo (Turno Actual)</h3><p className="text-sm text-gray-400 mt-1">Imprimir un precierre X sin cerrar la caja.</p></div>
                      <button onClick={() => generateReportData(currentSession, false)} className="bg-white text-black px-6 py-3 rounded-xl font-bold flex gap-2 items-center hover:bg-gray-100 transition-colors"><Eye size={18}/> CORTE X (VISTA PREVIA)</button>
                  </div>
              )}

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 no-print">
                  <h3 className="font-black text-xl mb-6 flex items-center gap-2 text-gray-900"><Calendar className="text-amber-500"/> Historial de Cierres Z</h3>
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                      <table className="w-full text-left">
                          <thead><tr className="bg-gray-50 border-b border-gray-100"><th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Turno ID</th><th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Fecha de Cierre</th><th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cajero</th><th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Documento</th></tr></thead>
                          <tbody className="divide-y divide-gray-100">{sessionHistory.map(session => (
                              <tr key={session.id} className="hover:bg-gray-50/50 transition-colors">
                                  <td className="p-4 font-black text-gray-900">#{session.id}</td>
                                  <td className="p-4 font-medium text-gray-600">{new Date(session.closed_at).toLocaleString()}</td>
                                  <td className="p-4 font-bold text-gray-800">{session.closed_by || session.opened_by}</td>
                                  <td className="p-4 flex justify-end"><button onClick={() => generateReportData(session, true)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors text-sm"><Printer size={16}/> Copia Z</button></td>
                              </tr>
                          ))}</tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* MODALES E IMPRESIÓN SE MANTIENEN IGUAL (Lógica Intacta) */}
      {lastOrderTicket && !closingData && (
        <div className="fixed inset-0 bg-gray-900/90 backdrop-blur-sm z-[100] flex items-center justify-center no-print p-4">
            <div className="bg-white p-6 w-full max-w-sm text-gray-900 font-sans shadow-2xl rounded-2xl border border-gray-100">
                <div className="text-center font-black text-xl border-b-2 border-dashed border-gray-200 pb-3 mb-4 text-black">{ticketType === 'anexo' ? 'TICKET DE ANEXO' : 'NUEVA COMANDA'}</div>
                <div className="mb-6 bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Identificador</span>
                    <span className="font-black text-2xl text-amber-500">{lastOrderTicket.info}</span>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setLastOrderTicket(null)} className="flex-1 bg-gray-100 text-gray-700 p-3 rounded-xl font-bold hover:bg-gray-200 transition-colors">CERRAR</button>
                    <button onClick={() => window.print()} className="flex-1 bg-black text-white p-3 rounded-xl font-bold shadow-lg hover:bg-gray-800 transition-colors">🖨️ IMPRIMIR</button>
                </div>
            </div>
        </div>
      )}

      {lastOrderTicket && !closingData && (
        <div id="ticket-impresion">
          <div className="ticket-centrado ticket-grande">DK FOOD HOUSE</div>
          <div className="ticket-centrado">Premium Grill & Food</div>
          <div className="ticket-linea"></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span>{new Date().toLocaleDateString()}</span><span>{new Date().toLocaleTimeString()}</span></div>
          <div className="ticket-negrita" style={{ marginTop: '5px', fontSize: '14px' }}>{lastOrderTicket.service_type}: {lastOrderTicket.info}</div>
          <div className="ticket-linea"></div>
          <div className="ticket-centrado ticket-negrita" style={{ fontSize: '16px' }}>{ticketType === 'anexo' ? '*** ANEXO ***' : 'COMANDA DE COCINA'}</div>
          <div className="ticket-linea"></div>
          {lastOrderTicket.items?.map((item, index) => (
            <div key={index} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="ticket-negrita" style={{ fontSize: '16px' }}>{item.quantity} x {item.product_name}</span></div>
                {item.notes && <div style={{ fontSize: '13px', fontStyle: 'italic', paddingLeft: '10px' }}>--> Nota: {item.notes}</div>}
            </div>
          ))}
          <div className="ticket-linea"></div>
          <div className="ticket-centrado" style={{ fontSize: '10px', marginTop: '10px' }}>Sistema DK V4</div>
        </div>
      )}

      {closingData && !closingData.isGlobal && (
          <div id="cierre-impresion" className="p-8 font-sans bg-white relative max-w-4xl mx-auto">
              {/* Plantilla de Impresión de Reportes Oculta (Se mantiene igual para asegurar compatibilidad de impresión) */}
              <div className="no-print absolute top-0 right-0 p-4">
                  <button onClick={() => setClosingData(null)} className="bg-red-600 text-white px-4 py-2 rounded font-bold">Cerrar Visualización</button>
              </div>
              
              <div className="border-b-2 border-black pb-4 mb-6 flex justify-between mt-8">
                  <div>
                      <h1 className="text-3xl font-bold">REPORTE DETALLADO Z</h1>
                      <p className="text-gray-600">DK FOOD HOUSE</p>
                      <p className="text-sm font-bold mt-2 bg-gray-100 inline-block px-3 py-1 border border-gray-300 rounded">
                          Tasa de Cambio Base: {closingData.tasa_calculo} Bs/$
                      </p>
                  </div>
                  <div className="text-right text-sm"><p><strong>Apertura:</strong> {closingData.opened_at}</p><p><strong>Cierre:</strong> {closingData.closed_at}</p><p><strong>ID Sesión:</strong> #{closingData.id}</p></div>
              </div>
  
              <div className="mb-6 border rounded p-4 bg-gray-50">
                  <h3 className="font-bold text-lg mb-2 border-b border-gray-300">BALANCE GENERAL</h3>
                  <div className="grid grid-cols-2 gap-4 text-lg">
                      <div>Base Inicial: <span className="font-bold">${Number(closingData.base).toFixed(2)}</span></div>
                      <div>+ Cobranza Total: <span className="font-bold">${closingData.sales.toFixed(2)}</span></div>
                      <div>- Gastos / Retiros: <span className="font-bold">${closingData.expenses.toFixed(2)}</span></div>
                      <div className="border-t border-black pt-2 font-bold text-xl col-span-2">TOTAL ESPERADO EN CAJA: ${closingData.net.toFixed(2)}</div>
                  </div>
              </div>
  
              {closingData.sessionExpenses && closingData.sessionExpenses.length > 0 && (
                  <div className="mb-6">
                      <h3 className="font-bold text-lg mb-2 border-b">RETIROS Y GASTOS</h3>
                      <table className="w-full text-xs border">
                          <thead className="bg-gray-100"><tr><th className="p-2 text-left">Hora</th><th className="p-2 text-left">Descripción</th><th className="p-2 text-left">Categoría</th><th className="p-2 text-right">Monto</th></tr></thead>
                          <tbody>{closingData.sessionExpenses.map(e => (<tr key={e.id} className="border-b"><td className="p-2">{new Date(e.created_at || e.date).toLocaleTimeString()}</td><td className="p-2 font-bold">{e.description}</td><td className="p-2 uppercase">{e.category}</td><td className="p-2 text-right font-bold">${e.amount.toFixed(2)}</td></tr>))}</tbody>
                      </table>
                  </div>
              )}
  
              <div className="mb-6">
                  <h3 className="font-bold text-lg mb-2 border-b">DESGLOSE DE MEDIOS DE PAGO</h3>
                  <table className="w-full text-sm border">
                      <thead className="bg-gray-100"><tr><th className="p-2 text-left">Método</th><th className="p-2 text-right">Monto USD</th><th className="p-2 text-right">Equivalente Bs (Referencial)</th></tr></thead>
                      <tbody>
                          {Object.entries(closingData.breakdown).map(([m, v]) => (
                              <tr key={m} className="border-b">
                                  <td className="p-2 uppercase font-bold">{m}</td>
                                  <td className="p-2 text-right font-bold">${v.toFixed(2)}</td>
                                  <td className="p-2 text-right text-gray-600 font-mono">Bs {(v * closingData.tasa_calculo).toFixed(2)}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
  
              <div className="mb-6 border-2 border-black p-4 rounded bg-white">
                  <h3 className="font-bold text-center text-xl mb-4">💰 ARQUEO DE EFECTIVO</h3>
                  <div className="flex justify-around text-center">
                      <div><div className="text-sm text-gray-500">EFECTIVO USD (Inc. Base)</div><div className="text-4xl font-bold">${closingData.cashInUsd.toFixed(2)}</div></div>
                      <div><div className="text-sm text-gray-500">EFECTIVO BOLIVARES</div><div className="text-4xl font-bold">Bs {closingData.cashInBs.toFixed(2)}</div></div>
                  </div>
              </div>
              
              {user.role === 'owner' && (
                  <div className="mt-8 border-t-4 border-black pt-4 page-break">
                      <h2 className="text-xl font-bold mb-4 text-center bg-black text-white py-2 uppercase">Anexo Confidencial Gerencia</h2>
                      
                      <div className="grid grid-cols-2 gap-8 mb-6">
                           <div><h4 className="font-bold border-b mb-2">Desempeño de Platos</h4><table className="w-full text-xs"><thead><tr><th className="text-left">Producto</th><th className="text-right">Cant. Vendida</th></tr></thead><tbody>{Object.entries(closingData.productCount).map(([name, qty]) => (<tr key={name} className="border-b"><td>{name}</td><td className="text-right font-bold">{qty}</td></tr>))}</tbody></table></div>
                           <div><h4 className="font-bold border-b mb-2">Insumos Descontados (Teórico)</h4><table className="w-full text-xs"><thead><tr><th className="text-left">Insumo</th><th className="text-right">Unidades</th></tr></thead><tbody>{Object.entries(closingData.inventoryUsage).map(([name, qty]) => (<tr key={name} className="border-b"><td>{name}</td><td className="text-right font-bold">{qty.toFixed(2)}</td></tr>))}</tbody></table></div>
                      </div>
  
                      <h3 className="font-bold text-lg mb-2 border-b">AUDITORÍA DE PAGOS INDIVIDUALES</h3>
                      <table className="w-full text-xs border">
                          <thead className="bg-gray-200">
                              <tr>
                                  <th className="p-1 text-left">Hora</th>
                                  <th className="p-1 text-left">Mesa/Cliente</th>
                                  <th className="p-1 text-left">Método Aplicado</th>
                                  <th className="p-1 text-right">Monto Procesado</th>
                              </tr>
                          </thead>
                          <tbody>
                              {closingData.allPayments?.map((p, i) => (
                                  <tr key={i} className="border-b">
                                      <td className="p-1">{new Date(p.created_at).toLocaleTimeString()}</td>
                                      <td className="p-1 font-bold">{p.client_info}</td>
                                      <td className="p-1 uppercase">{p.method}</td>
                                      <td className="p-1 text-right font-bold">${p.amount_usd.toFixed(2)}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              )}
              
              <div className="mt-16 flex justify-between text-center pt-8">
                  <div className="w-1/3 border-t border-black"><p className="mt-2 text-sm font-bold">Firma Cajero Entrante</p></div>
                  <div className="w-1/3 border-t border-black"><p className="mt-2 text-sm font-bold">Firma Cajero Saliente / Autorizado</p></div>
              </div>
          </div>
      )}
  
      {closingData && closingData.isGlobal && (
          <div id="cierre-impresion" className="p-8 font-sans bg-white relative max-w-4xl mx-auto">
              <div className="no-print absolute top-0 right-0 p-4">
                  <button onClick={() => setClosingData(null)} className="bg-red-600 text-white px-4 py-2 rounded font-bold">Cerrar Visualización</button>
              </div>
              
              <div className="border-b-2 border-black pb-4 mb-6 flex justify-between mt-8">
                  <div><h1 className="text-3xl font-bold">CONSOLIDADO GLOBAL</h1><p className="text-gray-600 font-bold uppercase">DK FOOD HOUSE</p></div>
                  <div className="text-right text-sm"><p><strong>Desde:</strong> {closingData.startDate}</p><p><strong>Hasta:</strong> {closingData.endDate}</p><p><strong>Turnos Consolidados:</strong> {closingData.sessionsCount}</p></div>
              </div>
  
              <div className="mb-6 border border-black rounded p-4">
                  <h3 className="font-bold text-lg mb-4 border-b border-gray-300">ESTADO DE RESULTADOS (PERÍODO)</h3>
                  <div className="grid grid-cols-2 gap-4 text-xl">
                      <div>Cobranza Total Real: <span className="font-bold">${closingData.sales.toFixed(2)}</span></div>
                      <div>Gastos Totales Registrados: <span className="font-bold">${closingData.expenses.toFixed(2)}</span></div>
                      <div className="border-t-2 border-black pt-4 font-black text-2xl col-span-2 text-center py-2 rounded mt-2 uppercase tracking-wide">
                          FLUJO NETO: ${closingData.net.toFixed(2)}
                      </div>
                  </div>
              </div>
  
              <div className="mb-6">
                  <h3 className="font-bold text-lg mb-2 border-b border-black">TOTALIZACIÓN DE INGRESOS POR MEDIOS DE PAGO</h3>
                  <table className="w-full text-sm border border-black">
                      <thead className="bg-gray-200 border-b border-black"><tr><th className="p-2 text-left border-r border-black">Método Administrativo</th><th className="p-2 text-right">Monto USD Recaudado</th></tr></thead>
                      <tbody>{Object.entries(closingData.breakdown).map(([m, v]) => (<tr key={m} className="border-b border-black"><td className="p-2 uppercase border-r border-black font-bold">{m}</td><td className="p-2 text-right font-bold">${v.toFixed(2)}</td></tr>))}</tbody>
                  </table>
              </div>
  
              <div className="grid grid-cols-2 gap-8 mb-6 mt-8">
                   <div>
                      <h4 className="font-bold border-b border-black mb-2">Top Platos Despachados</h4>
                      <table className="w-full text-xs">
                          <thead><tr className="bg-gray-100"><th className="text-left p-1">Producto</th><th className="text-right p-1">Volumen</th></tr></thead>
                          <tbody>{Object.entries(closingData.productCount).sort((a,b)=>b[1]-a[1]).map(([name, qty]) => (<tr key={name} className="border-b"><td className="p-1">{name}</td><td className="text-right p-1 font-bold">{qty}</td></tr>))}</tbody>
                      </table>
                  </div>
                  <div>
                      <h4 className="font-bold border-b border-black mb-2">Descuento Global Insumos</h4>
                      <table className="w-full text-xs">
                          <thead><tr className="bg-gray-100"><th className="text-left p-1">Insumo Base</th><th className="text-right p-1">Descontado</th></tr></thead>
                          <tbody>{Object.entries(closingData.inventoryUsage).sort((a,b)=>b[1]-a[1]).map(([name, qty]) => (<tr key={name} className="border-b"><td className="p-1">{name}</td><td className="text-right p-1 font-bold">{qty.toFixed(2)}</td></tr>))}</tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      <style>{`
        @media print { 
            .no-print { display: none !important; } 
            .page-break { page-break-before: always; } 
            body { background: white !important; }
        }
        #ticket-impresion { font-family: 'Courier New', Courier, monospace; width: 80mm; padding: 5px; background: white; color: black; line-height: 1.2; }
        .ticket-centrado { text-align: center; }
        .ticket-grande { font-size: 22px; font-weight: 900; letter-spacing: 1px; }
        .ticket-negrita { font-weight: bold; }
        .ticket-linea { border-bottom: 2px dashed black; margin: 8px 0; }
        
        /* Animaciones UI */
        .animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
