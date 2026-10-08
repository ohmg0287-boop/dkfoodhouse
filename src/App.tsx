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
  const [invSubView, setInvSubView] = useState('platos'); // INICIA EN PLATOS POR DEFECTO
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

  // --- GENERAR REPORTE ---
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
          isGlobal: false,
          id: session.id,
          tasa_calculo: tasa,
          opened_at: new Date(session.opened_at).toLocaleString(),
          closed_at: session.closed_at ? new Date(session.closed_at).toLocaleString() : 'EN CURSO',
          opened_by: session.opened_by,
          closed_by: session.closed_by || 'N/A',
          base: session.base_amount,
          sales: dineroCobrado, 
          ventas_teoricas: totalVentasDespachadas,
          expenses: expensesTotal,
          net: dineroCobrado - expensesTotal,
          breakdown, cashInUsd, cashInBs, productCount, inventoryUsage, 
          sessionExpenses,
          allPayments: allPayments.map(pay => ({ 
              ...pay, 
              client_info: pay.orders?.info || 'Cliente/Abono'
          }))
      };

      setClosingData(report);
      setLoading(false);
      setTimeout(() => window.print(), 500);
  };

  const handleGenerateGlobalReport = async () => {
      if (!globalReportDates.start || !globalReportDates.end) return alert("Fechas requeridas");
      setLoading(true);

      const start = new Date(globalReportDates.start).toISOString();
      const end = new Date(globalReportDates.end);
      end.setHours(23, 59, 59, 999);
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
            rate_used: tasa, cashier: user.name, 
            session_id: currentSession.id
        }));
        
        if (paymentsToSave.length > 0) {
            await supabase.from('payments').insert(paymentsToSave);
        }

        const newStatus = remaining <= 0.05 ? 'pagado' : 'credito';
        await supabase.from('orders').update({ status: newStatus }).eq('id', selectedOrder.id);
        
        alert("Transacción Registrada ✅"); setSelectedOrder(null); setCurrentPayments([]); fetchOrders();
    } catch (e) { alert("Error: " + e.message); } finally { setProcessing(false); setLoading(false); }
  };

  const handleSendToCredit = async () => {
      if (!confirm("¿Enviar esta orden a Cuentas por Cobrar (Crédito)? El cliente no pagará nada en este momento.")) return;
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

  // --- NUEVAS FUNCIONES DE PLATOS ---
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

  // --- FUNCIONES DE INSUMOS Y RECETAS ---
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
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white">
      <h1 className="text-4xl font-bold mb-8 text-yellow-500">DK FOOD HOUSE</h1>
      <div className="grid grid-cols-2 gap-6 w-full max-w-md px-4">
        {['DUEÑO', 'GERENCIA', 'CAJA', 'MESERO'].map((role, idx) => (
          <button key={role} onClick={() => { const p = prompt(`PIN ${role}:`); if(p) login(p); }} className={`p-6 rounded-xl text-lg font-bold shadow-lg transform hover:scale-105 transition ${idx===0?'bg-yellow-600':idx===1?'bg-blue-600':idx===2?'bg-green-600':'bg-purple-600'}`}>🥩 {role}</button>
        ))}
        <button onClick={() => { const p = prompt("PIN Cocina:"); if(p) login(p); }} className="col-span-2 p-4 bg-gray-700 rounded-xl font-bold border border-gray-500">🍔 COCINA</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-20 bg-gray-100 font-sans">
      {/* ALERTA DE VERSION */}
      {showVersionAlert && (
        <div className="fixed top-0 left-0 w-full bg-green-500 text-white text-center p-2 font-bold z-[9999]">
          VERSIÓN ACTUALIZADA V4 - CRÉDITOS Y MÉTODOS DE PAGO + GESTOR DE PLATOS
        </div>
      )}

      <nav className="bg-gray-900 text-white p-4 flex justify-between items-center sticky top-0 z-50 shadow-lg no-print">
        <div className="flex flex-col">
            <div className="font-bold text-lg text-yellow-400">DK <span className="text-xs text-gray-400">({user.role})</span></div>
            <div className="text-xs flex items-center gap-1">
                {currentSession ? <span className="text-green-400 flex items-center gap-1"><Unlock size={10}/> ABIERTO #{currentSession.id}</span> : <span className="text-red-500 flex items-center gap-1"><Lock size={10}/> CERRADO</span>}
            </div>
        </div>
        <div className="flex gap-2">
            {['owner', 'manager'].includes(user.role) && <button onClick={() => setView('dashboard')} className={`p-2 rounded ${view==='dashboard'?'bg-yellow-600':'bg-gray-700'}`}><LayoutDashboard size={20}/></button>}
            {user.role === 'owner' && <button onClick={() => setView('inventario')} className={`p-2 rounded ${view==='inventario'?'bg-yellow-600':'bg-gray-700'}`}><Package size={20}/></button>}
            {['owner', 'manager'].includes(user.role) && <button onClick={() => setView('reportes')} className={`p-2 rounded ${view==='reportes'?'bg-yellow-600':'bg-gray-700'}`}><TrendingUp size={20}/></button>}
            <button onClick={() => setView('caja')} className={`p-2 rounded flex items-center gap-2 ${view==='caja'?'bg-yellow-600':'bg-gray-700'}`}><DollarSign size={20}/></button>
            {user.role !== 'cocina' && <button onClick={() => setView('pedidos')} className={`p-2 rounded ${view==='pedidos'?'bg-yellow-600':'bg-gray-700'}`}><ShoppingCart size={20}/></button>}
            <button onClick={() => window.location.reload()} className="p-2 bg-red-600 rounded"><LogOut size={20}/></button>
        </div>
      </nav>

      {view === 'dashboard' && (
          <div className="max-w-7xl mx-auto p-4 space-y-6">
              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-500 flex justify-between items-center">
                  <div>
                      <h3 className="font-bold text-lg">Control de Turno</h3>
                      {currentSession ? (<div className="text-sm text-gray-600">Abierto por: <strong>{currentSession.opened_by}</strong><br/>Base: <strong>${currentSession.base_amount}</strong></div>) : <p className="text-red-500 font-bold">Caja cerrada.</p>}
                  </div>
                  <div>
                      {!currentSession ? (
                          <button onClick={handleOpenSession} className="bg-green-600 text-white px-6 py-3 rounded font-bold hover:bg-green-700 flex items-center gap-2"><Unlock/> ABRIR CAJA</button>
                      ) : (
                          <button onClick={handleCloseSession} className="bg-red-600 text-white px-6 py-3 rounded font-bold hover:bg-red-700 flex items-center gap-2"><Lock/> CERRAR TURNO</button>
                      )}
                  </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-700">Tasa: <span className="text-green-600">1 USD = {tasa} Bs</span></h2>
                  <div className="flex gap-2"><input type="number" value={tasa} onChange={e => setTasa(e.target.value)} className="border p-2 rounded w-24" /><button onClick={async () => { await supabase.from('settings').upsert({ key:'tasa', value: { usd: tasa }}); alert("Guardado"); }} className="bg-blue-600 text-white p-2 rounded"><Save/></button></div>
              </div>
              
              {user.role === 'owner' && (
                  <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
                      <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><CreditCard className="text-blue-600"/> Métodos de Pago & Promociones</h3>
                      <div className="flex gap-2 mb-4 bg-gray-50 p-3 rounded items-end">
                          <div className="flex-1">
                              <label className="block text-xs font-bold mb-1">Nombre (Ej: Tarjeta VIP)</label>
                              <input value={newPayMethod.name} onChange={e => setNewPayMethod({...newPayMethod, name: e.target.value})} className="border p-2 rounded w-full" />
                          </div>
                          <div>
                              <label className="block text-xs font-bold mb-1">Moneda Base</label>
                              <select value={newPayMethod.currency} onChange={e => setNewPayMethod({...newPayMethod, currency: e.target.value})} className="border p-2 rounded w-full bg-white">
                                  <option value="USD">USD ($)</option>
                                  <option value="BS">Bs</option>
                                  <option value="OTRO">Otro (Obsequio/Canje)</option>
                              </select>
                          </div>
                          <button onClick={async () => { 
                              if(!newPayMethod.name) return;
                              await supabase.from('payment_methods').insert([newPayMethod]); 
                              setNewPayMethod({name: '', currency: 'USD'}); loadData(); 
                          }} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 h-10">+</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {paymentMethods.map(pm => (
                              <div key={pm.id} className="border p-3 rounded flex justify-between items-center bg-white shadow-sm">
                                  <div>
                                      <div className={`font-bold ${!pm.is_active ? 'line-through text-gray-400' : 'text-gray-800'}`}>{pm.name}</div>
                                      <div className="text-xs text-gray-500">{pm.currency}</div>
                                  </div>
                                  <button onClick={async () => { await supabase.from('payment_methods').update({is_active: !pm.is_active}).eq('id', pm.id); loadData(); }} className={`text-xs px-2 py-1 rounded font-bold ${pm.is_active ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                      {pm.is_active ? 'Desactivar' : 'Activar'}
                                  </button>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {user.role === 'owner' && (
                  <div className="bg-white p-6 rounded-lg shadow-md">
                      <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><TrendingDown className="text-red-500"/> Registrar Gasto</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded">
                          <input placeholder="Descripción..." className="border p-2 rounded w-full" value={newExpense.desc} onChange={e => setNewExpense({...newExpense, desc: e.target.value})} />
                          <div className="flex gap-2">
                              <input type="number" placeholder="Monto ($)" className="border p-2 rounded w-full" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} />
                              <select className="border p-2 rounded bg-white" value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value})}>
                                  <option>Nomina</option><option>Servicios</option><option>Otros</option><option value="Compra Inventario">Compra Inventario</option>
                              </select>
                          </div>
                          <div className="md:col-span-2 flex flex-wrap items-center gap-4 bg-white p-3 rounded border border-gray-200 shadow-sm">
                              <label className="flex items-center gap-2 font-bold text-sm text-gray-700 cursor-pointer">
                                  <input type="checkbox" checked={newExpense.isStock} onChange={e => setNewExpense({...newExpense, isStock: e.target.checked})} className="w-5 h-5 accent-blue-600" />
                                  ¿Es compra de insumo?
                              </label>
                              {newExpense.isStock && (
                                  <div className="flex gap-2 flex-1 min-w-[250px]">
                                      <select className="border p-2 rounded flex-1 bg-white" value={newExpense.ingredientId} onChange={e => setNewExpense({...newExpense, ingredientId: e.target.value})}>
                                          <option value="">Seleccione insumo...</option>
                                          {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                                      </select>
                                      <input type="number" placeholder="Cant." className="border p-2 rounded w-28" value={newExpense.quantity} onChange={e => setNewExpense({...newExpense, quantity: e.target.value})} />
                                  </div>
                              )}
                          </div>
                          <button onClick={registerExpenseTransaction} disabled={!currentSession} className="md:col-span-2 bg-red-600 text-white py-3 rounded font-bold shadow-md hover:bg-red-700 disabled:opacity-50 mt-2">Registrar Gasto</button>
                      </div>
                  </div>
              )}

              {user.role === 'owner' && (
                  <div className="bg-white p-6 rounded-lg shadow-md mt-6">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="font-bold text-lg flex items-center gap-2"><Users/> Personal</h3>
                          <button onClick={() => handleStaff('add', { name: prompt("Nombre:"), role: prompt("Rol:") })} className="bg-green-600 text-white px-3 py-1 rounded flex items-center gap-1 text-sm"><PlusCircle size={16}/> Nuevo</button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          {staffList.map(s => (
                              <div key={s.id} className="border p-3 rounded flex justify-between items-center bg-gray-50">
                                  <div><div className="font-bold">{s.name}</div><div className="text-xs text-gray-500 uppercase">{s.role}</div></div>
                                  <div className="flex gap-2">
                                      <button onClick={() => handleStaff('updatePin', s)} className="text-blue-500 hover:bg-blue-100 p-1 rounded font-bold text-xs">PIN</button>
                                      <button onClick={() => handleStaff('delete', s)} className="text-red-500 hover:bg-red-100 p-1 rounded"><Trash2 size={16}/></button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
          </div>
      )}

      {view === 'inventario' && (
            <div className="max-w-7xl mx-auto p-4 bg-white rounded shadow-lg">
                <div className="flex justify-between items-center mb-6 no-print">
                    <h2 className="text-2xl font-bold">Inventario</h2>
                    <div className="flex gap-4">
                        <button onClick={() => setInvSubView('platos')} className={`font-bold ${invSubView==='platos'?'text-yellow-600 border-b-2 border-yellow-600':''}`}>PLATOS</button>
                        <button onClick={() => setInvSubView('insumos')} className={`font-bold ${invSubView==='insumos'?'text-yellow-600 border-b-2 border-yellow-600':''}`}>INSUMOS</button>
                        <button onClick={() => setInvSubView('recetas')} className={`font-bold ${invSubView==='recetas'?'text-yellow-600 border-b-2 border-yellow-600':''}`}>RECETAS</button>
                    </div>
                </div>

                {invSubView === 'platos' && (
                    <div className="overflow-x-auto">
                        <div className="mb-4 flex justify-end">
                            <button onClick={handleAddProduct} className="bg-green-600 text-white px-3 py-1 rounded text-sm font-bold flex items-center gap-1"><PlusCircle size={16}/> Nuevo Plato</button>
                        </div>
                        <table className="w-full text-left border">
                            <thead><tr className="bg-gray-100 border-b"><th className="p-3">Plato</th><th className="p-3">Precio ($)</th>{user.role === 'owner' && <th className="p-3 no-print">Acciones</th>}</tr></thead>
                            <tbody>{products.map(p => (
                                <tr key={p.id} className="border-b hover:bg-gray-50">
                                    <td className="p-3 font-bold">{p.name}</td>
                                    <td className="p-3 text-green-600 font-bold">${p.price_usd}</td>
                                    {user.role === 'owner' && (
                                        <td className="p-3 no-print flex gap-2">
                                            <button onClick={async () => { const v = prompt("Nuevo Precio ($):", p.price_usd); if(v && !isNaN(v)) { await supabase.from('products').update({price_usd: parseFloat(v)}).eq('id', p.id); loadData(); }}} className="text-blue-600 hover:bg-blue-50 p-2 rounded"><Edit3 size={16}/></button>
                                            <button onClick={() => handleDeleteProduct(p.id)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={16}/></button>
                                        </td>
                                    )}
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                )}

                {invSubView === 'insumos' && (
                    <div className="overflow-x-auto">
                        <div className="mb-4 flex justify-end"><button onClick={handleAddIngredient} className="bg-green-600 text-white px-3 py-1 rounded text-sm font-bold flex items-center gap-1"><PlusCircle size={16}/> Nuevo Insumo</button></div>
                        <table className="w-full text-left border">
                            <thead><tr className="bg-gray-100 border-b"><th className="p-3">Item</th><th className="p-3">Stock</th><th className="p-3">Und</th>{user.role === 'owner' && <th className="p-3 no-print">Acciones</th>}</tr></thead>
                            <tbody>{ingredients.map(ing => (
                                <tr key={ing.id} className="border-b hover:bg-gray-50">
                                    <td className="p-3">{ing.name}</td>
                                    <td className={`p-3 font-bold ${ing.stock < 10 ? 'text-red-600' : 'text-gray-800'}`}>{Number(ing.stock).toFixed(2)}</td>
                                    <td className="p-3 text-sm">{ing.unit}</td>
                                    {user.role === 'owner' && (<td className="p-3 no-print flex gap-2"><button onClick={async () => { const v = prompt("Stock:", ing.stock); if(v) { await supabase.from('ingredients').update({stock:v}).eq('id', ing.id); loadData(); }}} className="text-blue-600 hover:bg-blue-50 p-2 rounded"><Edit3 size={16}/></button><button onClick={() => handleDeleteIngredient(ing.id)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={16}/></button></td>)}
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                )}

                {invSubView === 'recetas' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="border-r pr-4 max-h-[60vh] overflow-y-auto">{products.map(p => (<button key={p.id} onClick={() => setSelectedProductRecipe(p.name)} className={`w-full text-left p-3 rounded font-bold border-b ${selectedProductRecipe === p.name ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-700'}`}>{p.name}</button>))}</div>
                        <div className="md:col-span-2">{selectedProductRecipe ? (<><h3 className="font-bold mb-4 text-xl border-b pb-2">Receta: <span className="text-blue-600">{selectedProductRecipe}</span></h3><div className="bg-gray-50 p-3 rounded mb-4 flex gap-2 shadow-sm"><select className="flex-1 border p-2 rounded bg-white" value={newRecipeEntry.ingredientId} onChange={e => setNewRecipeEntry({...newRecipeEntry, ingredientId: e.target.value})}><option value="">Seleccione insumo...</option>{ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}</select><input type="number" placeholder="Cant." className="w-24 border p-2 rounded" value={newRecipeEntry.quantity} onChange={e => setNewRecipeEntry({...newRecipeEntry, quantity: e.target.value})} /><button onClick={handleAddIngredientToRecipe} className="bg-blue-600 text-white p-2 rounded font-bold"><PlusCircle/></button></div><table className="w-full text-md border"><tbody>{(recipes[selectedProductRecipe] || []).map(rItem => { const ing = ingredients.find(i => i.id === rItem.ingredientId); return (<tr key={rItem.id} className="border-b hover:bg-gray-50"><td className="p-3 font-bold">{ing?.name}</td><td className="p-3">{rItem.quantity} <span className="text-gray-500 text-sm">{ing?.unit}</span></td><td className="p-3 text-right"><button onClick={() => handleRemoveRecipeItem(rItem.id)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={16}/></button></td></tr>) })}</tbody></table></>) : <div className="text-gray-400 italic text-center mt-10">Selecciona un plato de la lista izquierda para editar su receta</div>}</div>
                    </div>
                )}
            </div>
        )}

      {view === 'pedidos' && (
          <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-6 h-[80vh]">
              <div className="md:col-span-2 overflow-y-auto bg-white p-4 rounded shadow-lg">
                  <h2 className="font-bold text-xl mb-4">Menú</h2>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                      {products.map(p => (
                          <div key={p.id} onClick={() => addToCart(p)} className="cursor-pointer border hover:border-yellow-500 p-4 rounded-lg bg-gray-50 hover:bg-yellow-50 transition transform hover:scale-105">
                              <h3 className="font-bold text-gray-800">{p.name}</h3><p className="text-green-600 font-bold">${p.price_usd}</p>
                          </div>
                      ))}
                  </div>
              </div>
              <div className="bg-white p-4 rounded shadow-lg flex flex-col h-full">
                  <h2 className="font-bold text-xl mb-2">Comanda</h2>
                  <div className="flex gap-2 mb-4"><select className="border p-2 rounded" onChange={e => setServiceInfo({...serviceInfo, type: e.target.value})}><option>Mesa</option><option>Para Llevar</option><option>Delivery</option></select><input placeholder="Cliente/Mesa" className="border p-2 rounded w-full" onChange={e => setServiceInfo({...serviceInfo, val: e.target.value})} value={serviceInfo.val} /></div>
                  <div className="flex-1 overflow-y-auto border-t py-2">{cart.map(item => (<div key={item.tempId} className="flex justify-between border-b py-2 text-sm"><div><span className="font-bold">{item.name}</span> <div className="text-xs text-gray-500">${item.price_usd}</div><input placeholder="Notas..." className="text-xs border-b w-full mt-1 bg-transparent" value={item.notes || ''} onChange={e => updateCartNote(item.tempId, e.target.value)} /></div><button onClick={() => removeFromCart(item.tempId)} className="text-red-500"><Trash2 size={16}/></button></div>))}</div>
                  <div className="pt-4 border-t"><button onClick={sendOrder} disabled={!currentSession} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold text-lg disabled:bg-gray-400">{!currentSession ? 'CAJA CERRADA' : 'ENVIAR A COCINA'}</button></div>
              </div>
          </div>
      )}

      {view === 'cocina' && (
          <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {orders.filter(o => o.status === 'pendiente').map(o => (
                  <div key={o.id} className="bg-white rounded-lg shadow-md overflow-hidden border-l-8 border-yellow-500">
                      <div className="bg-yellow-50 p-3 border-b border-yellow-100 flex justify-between items-center"><span className="font-bold text-lg text-gray-800">{o.service_type}</span><span className="text-sm font-bold bg-white px-2 rounded border">{o.info}</span></div>
                      <div className="p-4"><ul className="space-y-3">{o.order_items.map(item => (<li key={item.id} className="text-gray-800 leading-tight"><div className="font-bold text-lg">• {item.product_name}</div>{item.notes && <div className="text-red-600 text-sm bg-red-50 p-1 rounded mt-1">📝 {item.notes}</div>}</li>))}</ul></div>
                      <div className="flex">
                         <button onClick={async () => { await supabase.from('orders').update({status:'listo'}).eq('id', o.id); fetchOrders(); }} className="flex-1 bg-green-600 text-white font-bold py-3 hover:bg-green-700">MARCAR LISTO ✅</button>
                         <button onClick={() => { setTicketType('full'); setLastOrderTicket(o); setTimeout(()=>window.print(), 200); }} className="bg-gray-700 text-white px-4"><Printer size={20}/></button>
                      </div>
                  </div>
              ))}
          </div>
      )}

      {view === 'caja' && (
           <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              {!currentSession && (['owner', 'manager'].includes(user.role)) && (
                  <div className="col-span-2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-center"><strong className="font-bold">¡La caja está cerrada!</strong> <button onClick={() => setView('dashboard')} className="mt-2 bg-red-600 text-white px-4 py-2 rounded font-bold">IR AL DASHBOARD</button></div>
              )}
              
              <div className="bg-white p-4 rounded shadow">
                  <div className="flex gap-4 mb-4 border-b pb-2">
                      <button onClick={()=>{setCajaTab('activas'); setSelectedOrder(null);}} className={`font-bold pb-2 border-b-2 ${cajaTab==='activas'?'text-blue-600 border-blue-600':'text-gray-400 border-transparent'}`}>Mesas Activas</button>
                      <button onClick={()=>{setCajaTab('cobrar'); setSelectedOrder(null);}} className={`font-bold pb-2 border-b-2 ${cajaTab==='cobrar'?'text-orange-600 border-orange-600':'text-gray-400 border-transparent'}`}>Cuentas por Cobrar</button>
                  </div>
                  
                  {(() => {
                      const displayOrders = cajaTab === 'activas' 
                          ? orders.filter(o => o.status !== 'pagado' && o.status !== 'credito')
                          : orders.filter(o => o.status === 'credito');

                      if (displayOrders.length === 0) return <div className="text-gray-400 text-center mt-8 italic">No hay órdenes en esta sección.</div>;

                      return displayOrders.map(o => {
                          const prevPaid = o.payments?.reduce((s, p) => s + p.amount_usd, 0) || 0;
                          return (
                          <div key={o.id} onClick={() => { setSelectedOrder(o); setCurrentPayments([]); setIsEditingOrder(false); }} className={`p-4 border-b cursor-pointer hover:bg-blue-50 flex justify-between items-center ${selectedOrder?.id === o.id ? 'bg-blue-100 border-l-4 border-blue-600' : ''}`}>
                              <div>
                                  <div className="font-bold text-lg">{o.service_type} - {o.info}</div>
                                  <span className={`text-xs px-2 py-1 rounded ${o.status==='listo'?'bg-green-200 text-green-800': o.status==='credito'?'bg-orange-200 text-orange-800':'bg-yellow-100 text-yellow-800'}`}>{o.status.toUpperCase()}</span>
                                  {prevPaid > 0 && o.status === 'credito' && <div className="text-xs text-blue-600 font-bold mt-1">Abonado: ${prevPaid.toFixed(2)}</div>}
                              </div>
                              <div className="flex items-center gap-2">
                                  <div className="text-right"><div className="font-bold text-xl">${o.total_usd.toFixed(2)}</div></div>
                                  <button onClick={(e) => { e.stopPropagation(); setTicketType('full'); setLastOrderTicket(o); setTimeout(()=>window.print(), 200); }} className="bg-gray-200 p-2 rounded hover:bg-gray-300"><Printer size={16}/></button>
                                  {user.role === 'owner' && <button onClick={(e) => { e.stopPropagation(); handleDeleteOrder(o.id); }} className="bg-red-100 text-red-600 p-2 rounded hover:bg-red-200"><Trash2 size={16}/></button>}
                              </div>
                          </div>
                      )});
                  })()}
              </div>

              {selectedOrder && (
                  <div className="bg-white p-6 rounded shadow-lg h-fit sticky top-20">
                      <div className="flex justify-between border-b pb-2 mb-4">
                           {(['owner', 'manager', 'caja'].includes(user.role)) && (<button onClick={() => setIsEditingOrder(false)} className={`flex-1 py-2 font-bold ${!isEditingOrder ? 'border-b-4 border-blue-600 text-blue-800' : 'text-gray-400'}`}>COBRAR</button>)}
                           <button onClick={() => setIsEditingOrder(true)} className={`flex-1 py-2 font-bold ${isEditingOrder ? 'border-b-4 border-yellow-500 text-yellow-800' : 'text-gray-400'}`}>EDITAR</button>
                      </div>
                      {!isEditingOrder ? (
                          <>
                              <div className="mb-4 bg-gray-50 p-4 rounded text-center border">
                                  <div className="text-gray-500 text-sm">TOTAL DE LA CUENTA</div>
                                  <div className="text-4xl font-bold text-gray-900">${selectedOrder.total_usd.toFixed(2)}</div>
                                  {(() => {
                                      const prevPaid = selectedOrder.payments?.reduce((s, p) => s + p.amount_usd, 0) || 0;
                                      if (prevPaid > 0) return <div className="text-green-600 font-bold mt-2 text-sm bg-green-50 p-1 rounded">Pagado anteriormente: ${prevPaid.toFixed(2)}</div>;
                                      return null;
                                  })()}
                              </div>
                              <div className="mb-6 p-4 rounded border-2 text-center bg-white shadow-inner">
                                  {(() => {
                                      const previouslyPaid = selectedOrder.payments?.reduce((s, p) => s + p.amount_usd, 0) || 0;
                                      const paidNow = currentPayments.reduce((s, p) => s + p.amount_usd, 0);
                                      const remaining = selectedOrder.total_usd - previouslyPaid - paidNow;
                                      
                                      return remaining > 0.05 ? (
                                          <div className="text-red-600">
                                              <div className="text-xs font-bold uppercase">Saldo Pendiente a Cobrar</div>
                                              <div className="text-3xl font-bold">${remaining.toFixed(2)}</div>
                                              <div className="text-lg font-bold">Bs {(remaining * tasa).toFixed(2)}</div>
                                          </div>
                                      ) : (
                                          <div className="text-green-600 font-bold text-xl flex items-center justify-center gap-2">
                                              <div className="bg-green-100 p-2 rounded-full">✅</div> LISTO PARA SALDAR
                                          </div>
                                      );
                                  })()}
                              </div>
                              
                              <div className="mb-4 flex gap-2 justify-center">
                                  <button onClick={() => handleAddExtraToOrder('delivery')} className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-sm font-bold flex items-center gap-1 hover:bg-purple-200"><Bike size={16}/> + DELIVERY</button>
                                  <button onClick={() => handleAddExtraToOrder('propina')} className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded text-sm font-bold flex items-center gap-1 hover:bg-yellow-200"><Coins size={16}/> + PROPINA</button>
                              </div>
                              
                              <div className="mb-6">
                                  <div className="flex gap-2 mb-2">
                                      <input type="number" placeholder="Monto" className="border p-2 rounded flex-1 text-lg" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                                      <select className="border p-2 rounded bg-white" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                                          {paymentMethods.filter(pm => pm.is_active).map(pm => (
                                              <option key={pm.id} value={pm.name}>{pm.name}</option>
                                          ))}
                                      </select>
                                  </div>
                                  <button disabled={processing || !currentSession} onClick={() => { 
                                      const val = parseFloat(payAmount); 
                                      if (!val) return; 
                                      
                                      const methodObj = paymentMethods.find(m => m.name === payMethod);
                                      const isBs = methodObj?.currency === 'BS'; 
                                      const usdEquiv = isBs ? val / tasa : val; 
                                      
                                      setCurrentPayments([...currentPayments, { method: payMethod, amount_usd: usdEquiv, amount_bs: isBs ? val : 0 }]); 
                                      setPayAmount(''); 
                                  }} className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 disabled:opacity-50">Agregar Pago</button>
                              </div>

                              <div className="space-y-2 mb-6">
                                  {currentPayments.map((p, i) => (
                                      <div key={i} className="flex justify-between border-b pb-1 text-sm items-center">
                                          <span className="uppercase">{p.method}</span>
                                          <div className="flex items-center gap-2">
                                              <span>${p.amount_usd.toFixed(2)} {p.amount_bs > 0 && `(Bs ${p.amount_bs})`}</span>
                                              <button onClick={() => {const newP = [...currentPayments]; newP.splice(i, 1); setCurrentPayments(newP);}} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16}/></button>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                              
                              <div className="border-t pt-4">
                                  <button onClick={handlePayment} disabled={processing || !currentSession || (currentPayments.length === 0 && selectedOrder.status !== 'credito')} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold text-xl shadow-lg hover:bg-green-700 disabled:opacity-50 disabled:bg-gray-400 mb-2">
                                      {!currentSession ? 'CAJA CERRADA' : currentPayments.length > 0 ? 'REGISTRAR PAGO' : 'NADA QUE COBRAR'}
                                  </button>
                                  
                                  {selectedOrder.status !== 'credito' && (
                                      <button onClick={handleSendToCredit} disabled={processing || !currentSession} className="w-full bg-orange-100 text-orange-700 border-2 border-orange-500 py-2 rounded-xl font-bold hover:bg-orange-200">
                                          FIAR / ENVIAR A CRÉDITO
                                      </button>
                                  )}
                              </div>
                          </>
                      ) : (
                          <>
                              <div className="max-h-60 overflow-y-auto mb-4 border rounded">{selectedOrder.order_items?.map(item => (<div key={item.id} className="flex justify-between items-center p-2 border-b bg-white"><div><div className="font-bold text-sm">{item.product_name}</div><div className="text-xs text-gray-500">${item.price_at_time}</div></div><button onClick={() => handleRemoveItemFromOrder(item)} disabled={processing} className="text-red-500 hover:bg-red-50 p-2 rounded disabled:opacity-30"><XCircle size={20}/></button></div>))}</div>
                              <div className="border-t pt-4"><div className="flex items-center gap-2 mb-2"><Search className="text-gray-400"/><input className="border p-2 rounded w-full" placeholder="Buscar..." value={itemSearch} onChange={e => setItemSearch(e.target.value)} /></div><div className="grid grid-cols-2 gap-2 h-32 overflow-y-auto">{products.filter(p => p.name.toLowerCase().includes(itemSearch.toLowerCase())).map(p => (<button key={p.id} disabled={processing} onClick={() => handleAddItemToOrder(p)} className="text-xs p-2 border rounded hover:bg-green-50 text-left disabled:opacity-50"><div className="font-bold">{p.name}</div><div className="text-green-600">${p.price_usd}</div></button>))}</div></div>
                          </>
                      )}
                  </div>
              )}
          </div>
      )}

      {view === 'reportes' && (
          <div className="max-w-7xl mx-auto p-4 space-y-6">
              {user.role === 'owner' && (
                  <div className="bg-white p-6 rounded-lg shadow-md no-print border-l-4 border-indigo-500">
                      <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><TrendingUp className="text-indigo-600"/> Reporte Global</h3>
                      <div className="flex flex-wrap gap-4 items-end">
                          <div><label className="block text-sm font-bold mb-1">Desde</label><input type="date" className="border p-2 rounded" value={globalReportDates.start} onChange={e => setGlobalReportDates({...globalReportDates, start: e.target.value})} /></div>
                          <div><label className="block text-sm font-bold mb-1">Hasta</label><input type="date" className="border p-2 rounded" value={globalReportDates.end} onChange={e => setGlobalReportDates({...globalReportDates, end: e.target.value})} /></div>
                          <button onClick={handleGenerateGlobalReport} className="bg-indigo-600 text-white px-6 py-2 rounded font-bold hover:bg-indigo-700 flex gap-2 items-center"><FileText size={16}/> Generar</button>
                      </div>
                  </div>
              )}
              {currentSession && (<div className="bg-blue-50 p-6 rounded-lg border border-blue-200 flex justify-between items-center no-print"><div><h3 className="font-bold text-blue-900 text-lg">Turno Actual</h3><p className="text-sm text-blue-800">Ver corte sin cerrar.</p></div><button onClick={() => generateReportData(currentSession, false)} className="bg-blue-600 text-white px-4 py-2 rounded font-bold flex gap-2"><Eye/> VER CORTE PARCIAL</button></div>)}
              <div className="bg-white p-6 rounded-lg shadow-md no-print">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Calendar/> Historial (Últimos 20)</h3>
                  <table className="w-full text-left border-collapse">
                      <thead><tr className="bg-gray-100 border-b"><th className="p-3">ID</th><th className="p-3">Fecha</th><th className="p-3">Abierto Por</th><th className="p-3">Cerrado Por</th><th className="p-3">Acción</th></tr></thead>
                      <tbody>{sessionHistory.map(session => (<tr key={session.id} className="border-b hover:bg-gray-50"><td className="p-3 font-mono">#{session.id}</td><td className="p-3">{new Date(session.closed_at).toLocaleString()}</td><td className="p-3">{session.opened_by}</td><td className="p-3">{session.closed_by}</td><td className="p-3"><button onClick={() => generateReportData(session, true)} className="text-blue-600 hover:underline flex gap-1 items-center font-bold"><Printer size={16}/> Ver</button></td></tr>))}</tbody>
                  </table>
              </div>
          </div>
      )}

      {lastOrderTicket && !closingData && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-[100] flex items-center justify-center no-print">
            <div className="bg-white p-4 w-80 text-black font-mono text-sm shadow-2xl rounded-lg">
                <div className="text-center font-bold text-lg border-b border-dashed pb-2 mb-2">{ticketType === 'anexo' ? 'ANEXO / AGREGADO' : 'ORDEN CREADA'}</div>
                <div className="mb-2">MESA: <span className="font-bold">{lastOrderTicket.info}</span></div>
                <button onClick={() => window.print()} className="w-full bg-orange-600 text-white p-3 rounded mb-2 font-bold">IMPRIMIR</button>
                <button onClick={() => setLastOrderTicket(null)} className="w-full bg-gray-200 p-2 rounded">CERRAR</button>
            </div>
        </div>
      )}

      {lastOrderTicket && !closingData && (
        <div id="ticket-impresion">
          <div className="ticket-centrado ticket-grande">DONDE MANOLO</div>
          <div className="ticket-centrado">M&F</div>
          <div className="ticket-linea"></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{new Date().toLocaleDateString()}</span><span>{new Date().toLocaleTimeString()}</span></div>
          <div className="ticket-negrita" style={{ marginTop: '5px' }}>{lastOrderTicket.service_type}: {lastOrderTicket.info}</div>
          <div className="ticket-linea"></div>
          <div className="ticket-centrado ticket-negrita">{ticketType === 'anexo' ? '*** ANEXO ***' : 'COMANDA'}</div>
          <div className="ticket-linea"></div>
          {lastOrderTicket.items?.map((item, index) => (
            <div key={index} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="ticket-negrita" style={{ fontSize: '18px' }}>{item.quantity} x {item.product_name}</span></div>
                {item.notes && <div style={{ fontSize: '12px', fontStyle: 'italic' }}>(Nota: {item.notes})</div>}
            </div>
          ))}
          <div className="ticket-linea"></div>
        </div>
      )}

    {/* --- DOCUMENTOS DE IMPRESION SE MANTIENEN IGUAL --- */}
    {closingData && !closingData.isGlobal && (
        <div id="cierre-impresion" className="p-8 font-sans bg-white relative">
            <div className="no-print absolute top-0 right-0 p-4">
                <button onClick={() => setClosingData(null)} className="bg-red-600 text-white px-4 py-2 rounded font-bold">Cerrar Visualización</button>
            </div>
            
            <div className="border-b-2 border-black pb-4 mb-6 flex justify-between mt-8">
                <div>
                    <h1 className="text-3xl font-bold">REPORTE DETALLADO (V3)</h1>
                    <p className="text-gray-600">Donde Manolo - Control de Caja</p>
                    <p className="text-sm font-bold mt-2 bg-yellow-100 inline-block px-2 border border-yellow-300">
                        Tasa de Cambio: {closingData.tasa_calculo} Bs/$
                    </p>
                </div>
                <div className="text-right text-sm"><p><strong>Apertura:</strong> {closingData.opened_at}</p><p><strong>Cierre:</strong> {closingData.closed_at}</p><p><strong>ID Sesión:</strong> #{closingData.id}</p></div>
            </div>

            <div className="mb-6 border rounded p-4 bg-gray-50">
                <h3 className="font-bold text-lg mb-2 border-b border-gray-300">BALANCE GENERAL</h3>
                <div className="grid grid-cols-2 gap-4 text-lg">
                    <div>Base Inicial: <span className="font-bold">${Number(closingData.base).toFixed(2)}</span></div>
                    <div>+ Ventas Totales: <span className="font-bold text-green-700">${closingData.sales.toFixed(2)}</span></div>
                    <div>- Gastos Registrados: <span className="font-bold text-red-600">${closingData.expenses.toFixed(2)}</span></div>
                    <div className="border-t border-black pt-2 font-bold text-xl col-span-2">TOTAL EN CAJA: ${closingData.net.toFixed(2)}</div>
                </div>
            </div>

            {closingData.sessionExpenses && closingData.sessionExpenses.length > 0 && (
                <div className="mb-6">
                    <h3 className="font-bold text-lg mb-2 border-b">GASTOS / SALIDAS</h3>
                    <table className="w-full text-xs border">
                        <thead className="bg-gray-100"><tr><th className="p-2 text-left">Hora</th><th className="p-2 text-left">Descripción</th><th className="p-2 text-left">Categoría</th><th className="p-2 text-right">Monto</th></tr></thead>
                        <tbody>{closingData.sessionExpenses.map(e => (<tr key={e.id} className="border-b"><td className="p-2">{new Date(e.created_at || e.date).toLocaleTimeString()}</td><td className="p-2 font-bold">{e.description}</td><td className="p-2 uppercase">{e.category}</td><td className="p-2 text-right text-red-600 font-bold">${e.amount.toFixed(2)}</td></tr>))}</tbody>
                    </table>
                </div>
            )}

            <div className="mb-6">
                <h3 className="font-bold text-lg mb-2 border-b">DESGLOSE DE MEDIOS DE PAGO</h3>
                <table className="w-full text-sm border">
                    <thead className="bg-gray-100"><tr><th className="p-2 text-left">Método</th><th className="p-2 text-right">Monto USD</th><th className="p-2 text-right">Equivalente Bs</th></tr></thead>
                    <tbody>
                        {Object.entries(closingData.breakdown).map(([m, v]) => (
                            <tr key={m} className="border-b">
                                <td className="p-2 uppercase font-bold">{m.replace('_', ' ')}</td>
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
                    <h2 className="text-2xl font-bold mb-4 text-center bg-black text-white py-1">DETALLE CONFIDENCIAL (DUEÑO)</h2>
                    
                    <div className="grid grid-cols-2 gap-8 mb-6">
                         <div><h4 className="font-bold border-b mb-2">Ranking Productos</h4><table className="w-full text-xs"><thead><tr><th className="text-left">Producto</th><th className="text-right">Cant.</th></tr></thead><tbody>{Object.entries(closingData.productCount).map(([name, qty]) => (<tr key={name} className="border-b"><td>{name}</td><td className="text-right font-bold">{qty}</td></tr>))}</tbody></table></div>
                         <div><h4 className="font-bold border-b mb-2">Consumo Insumos</h4><table className="w-full text-xs"><thead><tr><th className="text-left">Insumo</th><th className="text-right">Aprox</th></tr></thead><tbody>{Object.entries(closingData.inventoryUsage).map(([name, qty]) => (<tr key={name} className="border-b"><td>{name}</td><td className="text-right font-bold">{qty.toFixed(2)}</td></tr>))}</tbody></table></div>
                    </div>

                    <h3 className="font-bold text-lg mb-2 border-b">AUDITORÍA DE MESAS Y COBROS</h3>
                    <table className="w-full text-xs border">
                        <thead className="bg-gray-200">
                            <tr>
                                <th className="p-1 text-left">Hora</th>
                                <th className="p-1 text-left">Mesa/Cliente</th>
                                <th className="p-1 text-left">Consumo (Orden)</th>
                                <th className="p-1 text-left">Método Pago</th>
                                <th className="p-1 text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {closingData.allPayments?.map((p, i) => (
                                <tr key={i} className="border-b hover:bg-gray-100">
                                    <td className="p-1">{new Date(p.created_at).toLocaleTimeString()}</td>
                                    <td className="p-1 font-bold">{p.client_info}</td>
                                    <td className="p-1 text-gray-600 italic">
                                        {p.items_detalle && p.items_detalle.length > 0 
                                            ? p.items_detalle.map(item => `${item.quantity} ${item.product_name}`).join(', ')
                                            : 'Sin detalle'}
                                    </td>
                                    <td className="p-1 uppercase">{p.method?.replace('_', ' ')}</td>
                                    <td className="p-1 text-right font-bold">${p.amount_usd.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            
            <div className="mt-12 flex justify-between text-center pt-8">
                <div className="w-1/3 border-t border-black"><p>Firma Cajero Entrante</p></div>
                <div className="w-1/3 border-t border-black"><p>Firma Cajero Saliente / Manager</p></div>
            </div>
        </div>
    )}

    {closingData && closingData.isGlobal && (
        <div id="cierre-impresion" className="p-8 font-sans bg-white relative">
            <div className="no-print absolute top-0 right-0 p-4">
                <button onClick={() => setClosingData(null)} className="bg-red-600 text-white px-4 py-2 rounded font-bold">Cerrar Visualización</button>
            </div>
            
            <div className="border-b-2 border-black pb-4 mb-6 flex justify-between mt-8">
                <div><h1 className="text-3xl font-bold">REPORTE CONSOLIDADO GLOBAL</h1><p className="text-gray-600">Donde Manolo - Gerencia</p></div>
                <div className="text-right text-sm"><p><strong>Desde:</strong> {closingData.startDate}</p><p><strong>Hasta:</strong> {closingData.endDate}</p><p><strong>Turnos Auditados:</strong> {closingData.sessionsCount}</p></div>
            </div>

            <div className="mb-6 border rounded p-4 bg-gray-50">
                <h3 className="font-bold text-lg mb-2 border-b border-gray-300">BALANCE CONSOLIDADO</h3>
                <div className="grid grid-cols-2 gap-4 text-lg">
                    <div>Ventas Totales: <span className="font-bold text-green-700">${closingData.sales.toFixed(2)}</span></div>
                    <div>Gastos Totales: <span className="font-bold text-red-600">${closingData.expenses.toFixed(2)}</span></div>
                    <div className="border-t border-black pt-2 font-bold text-xl col-span-2 text-center bg-indigo-50 py-2 rounded mt-2">UTILIDAD NETA: ${closingData.net.toFixed(2)}</div>
                </div>
            </div>

            <div className="mb-6">
                <h3 className="font-bold text-lg mb-2 border-b">INGRESOS POR MEDIOS DE PAGO</h3>
                <table className="w-full text-sm border">
                    <thead className="bg-gray-100"><tr><th className="p-2 text-left">Método</th><th className="p-2 text-right">Monto</th></tr></thead>
                    <tbody>{Object.entries(closingData.breakdown).map(([m, v]) => (<tr key={m} className="border-b"><td className="p-2 uppercase">{m.replace('_', ' ')}</td><td className="p-2 text-right font-bold">${v.toFixed(2)}</td></tr>))}</tbody>
                </table>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-6">
                 <div>
                    <h4 className="font-bold border-b mb-2">Top Productos Vendidos</h4>
                    <table className="w-full text-xs">
                        <thead><tr><th className="text-left">Producto</th><th className="text-right">Cant. Total</th></tr></thead>
                        <tbody>{Object.entries(closingData.productCount).sort((a,b)=>b[1]-a[1]).map(([name, qty]) => (<tr key={name} className="border-b"><td>{name}</td><td className="text-right font-bold text-indigo-700">{qty}</td></tr>))}</tbody>
                    </table>
                </div>
                <div>
                    <h4 className="font-bold border-b mb-2">Consumo Teórico de Insumos</h4>
                    <table className="w-full text-xs">
                        <thead><tr><th className="text-left">Insumo</th><th className="text-right">Gastado Aprox</th></tr></thead>
                        <tbody>{Object.entries(closingData.inventoryUsage).sort((a,b)=>b[1]-a[1]).map(([name, qty]) => (<tr key={name} className="border-b"><td>{name}</td><td className="text-right font-bold text-red-600">{qty.toFixed(2)}</td></tr>))}</tbody>
                    </table>
                </div>
            </div>

            {closingData.expensesList && closingData.expensesList.length > 0 && (
                <div className="mb-6 page-break">
                    <h3 className="font-bold text-lg mb-2 border-b">RESUMEN DE GASTOS / SALIDAS</h3>
                    <table className="w-full text-xs border">
                        <thead className="bg-gray-100">
                            <tr><th className="p-2 text-left">Fecha</th><th className="p-2 text-left">Descripción</th><th className="p-2 text-left">Categoría</th><th className="p-2 text-right">Monto</th></tr>
                        </thead>
                        <tbody>
                            {closingData.expensesList.map(e => (
                                <tr key={e.id} className="border-b hover:bg-gray-50">
                                    <td className="p-2">{new Date(e.created_at || e.date).toLocaleDateString()}</td>
                                    <td className="p-2 font-bold">{e.description}</td>
                                    <td className="p-2 uppercase">{e.category}</td>
                                    <td className="p-2 text-right text-red-600 font-bold">${e.amount.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )}

      <style>{`
        @media print { .no-print { display: none !important; } .page-break { page-break-before: always; } }
        #ticket-impresion { font-family: monospace; width: 80mm; padding: 5px; background: white; color: black; }
        .ticket-centrado { text-align: center; }
        .ticket-grande { font-size: 24px; font-weight: bold; }
        .ticket-negrita { font-weight: bold; }
        .ticket-linea { border-bottom: 1px dashed black; margin: 5px 0; }
      `}</style>
    </div>
  );
}
