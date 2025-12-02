import React, { useState, useEffect } from 'react';
import { Calculator, AlertCircle, CheckCircle, Banknote, CreditCard, Fuel, ShoppingBag, Coins, Wallet, Sparkles, ArrowRight, Download, Calendar, Lock, Users, Plus, Trash2, Package, X, Smartphone, TrendingUp, FileText, PieChart, ShieldCheck, Home, UserMinus, ArrowLeft, Cloud, RefreshCw, PlusCircle, MinusCircle, Clock, AlertTriangle, UserPlus, RefreshCcw, StickyNote, Box, Search, ListChecks, ChevronRight, Briefcase, Save, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Firebase Imports
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, getDocs } from 'firebase/firestore';

// --- TUE CHIAVI FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBvmtYnaj-Rp9BBv5HoBDmuIIeQSVJRhFE",
  authDomain: "stazione-ip.firebaseapp.com",
  projectId: "stazione-ip",
  storageBucket: "stazione-ip.firebasestorage.app",
  messagingSenderId: "867138523308",
  appId: "1:867138523308:web:aaeaee8efb940e7ba28f09"
};

// --- INIZIALIZZAZIONE SICURA ---
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "gestionale-cassa-v2"; 

const App = () => {
  // --- STATE ---
  const [user, setUser] = useState(null);
  const [shopId, setShopId] = useState(() => { try { return localStorage.getItem('shopId') || ''; } catch (e) { return ''; } });
  const [isShopIdLocked, setIsShopIdLocked] = useState(() => { try { return !!localStorage.getItem('shopId'); } catch (e) { return false; } });

  const [appVersion] = useState("v3.5 Stabile"); 
  
  const [currentView, setCurrentView] = useState('menu'); 
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().slice(0,10));
  const [connectionStatus, setConnectionStatus] = useState("disconnected"); 
  const [dataLoaded, setDataLoaded] = useState(false);

  // --- AUTH ---
  useEffect(() => {
    const initAuth = async () => { try { await signInAnonymously(auth); } catch (err) { console.error(err); setConnectionStatus("error"); } };
    initAuth();
    onAuthStateChanged(auth, (u) => { setUser(u); if (u) setConnectionStatus("connected"); });
  }, []);

  // --- DATA DEFAULTS ---
  const defaultData = { incassoGiornaliero: 0, crediti: 0, pos: 0, riscossioni: 0, buoniCarburante: 0, ricariche: 0, totaleMonete: 0, totaleAssegni: 0, soldiLasciatiMattina: 0 };
  const defaultBreakdown = { 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0 };

  const [data, setData] = useState(defaultData);
  const [cashBreakdown, setCashBreakdown] = useState(defaultBreakdown);
  const [products, setProducts] = useState([]); 
  const [globalCatalog, setGlobalCatalog] = useState([]); 
  const [debtors, setDebtors] = useState([]);
  const [investors, setInvestors] = useState([]);

  // Stati Modali & Variabili
  const [searchTerm, setSearchTerm] = useState("");
  
  const [showProductModal, setShowProductModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [monthlyStats, setMonthlyStats] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  
  // Modali Debitori / Investitori
  const [activeContext, setActiveContext] = useState('debtors'); 
  const [showAddEntityModal, setShowAddEntityModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState(null);

  const [newEntityName, setNewEntityName] = useState("");
  const [newEntityAmount, setNewEntityAmount] = useState("");
  const [newEntityDate, setNewEntityDate] = useState(new Date().toISOString().slice(0,10));
  const [newEntityNote, setNewEntityNote] = useState("");

  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionData, setTransactionData] = useState({ id: null, type: 'add', amount: "" });

  // Modali Inventario
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemAgio, setNewItemAgio] = useState("");
  const [newItemStock, setNewItemStock] = useState("");

  // Checklist State
  const [checklist, setChecklist] = useState({ debtors: false, cash: false });

  // --- SYNC ---
  useEffect(() => {
    if (!user || !shopId) return;
    // 1. Catalogo
    const unsubCatalog = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'catalogs', shopId), (snap) => {
        if (snap.exists()) setGlobalCatalog(snap.data().items || []);
    });
    // 2. Debitori
    const unsubDebtors = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'debtors', shopId), (snap) => {
        if (snap.exists()) { const list = snap.data().list; setDebtors(Array.isArray(list) ? list : []); } else { setDebtors([]); }
    });
    // 3. Investitori
    const unsubInvestors = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'investors', shopId), (snap) => {
        if (snap.exists()) { const list = snap.data().list; setInvestors(Array.isArray(list) ? list : []); } else { setInvestors([]); }
    });
    // 4. Cassa Giornaliera
    const docId = `${shopId}_${currentDate}`;
    const unsubDaily = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'daily_sheets', docId), (docSnap) => {
      if (docSnap.exists()) {
        const remote = docSnap.data();
        setData(prev => ({ ...prev, ...remote.data }));
        setCashBreakdown(prev => ({ ...prev, ...remote.cashBreakdown }));
        if (remote.products && Array.isArray(remote.products)) setProducts(remote.products);
        else setProducts([]);
      } else {
        setData(defaultData);
        setCashBreakdown(defaultBreakdown);
        setProducts([]);
      }
      setDataLoaded(true);
    });

    return () => { unsubCatalog(); unsubDebtors(); unsubInvestors(); unsubDaily(); };
  }, [user, shopId, currentDate]); 

  // --- SAVE FUNCTIONS ---
  const saveToCloud = async (newData, newBreakdown, newProducts) => {
    if (!user || !shopId || !dataLoaded) return;
    setConnectionStatus("syncing");
    const docId = `${shopId}_${currentDate}`;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'daily_sheets', docId), {
        data: newData, cashBreakdown: newBreakdown, products: newProducts,
        lastUpdated: new Date().toISOString(), updatedBy: user.uid
      }, { merge: true });
      setTimeout(() => setConnectionStatus("connected"), 500);
    } catch (err) { setConnectionStatus("error"); }
  };

  const updateGlobalCatalog = async (list) => {
      if (!user || !shopId) return;
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'catalogs', shopId), { items: list }, { merge: true });
  };

  const saveDebtors = async (list) => {
      if (!user || !shopId) return;
      const safeList = Array.isArray(list) ? list : [];
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'debtors', shopId), { list: safeList }, { merge: true });
  };

  const saveInvestors = async (list) => {
      if (!user || !shopId) return;
      const safeList = Array.isArray(list) ? list : [];
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'investors', shopId), { list: safeList }, { merge: true });
  };

  // --- PDF GENERATION ---
  const generateDebtorsPDF = () => {
    const doc = new jsPDF();
    const isDebtors = activeContext === 'debtors';
    const list = isDebtors ? debtors : investors;
    const title = isDebtors ? "LISTA DEBITORI" : "LISTA INVESTITORI";
    const color = isDebtors ? [225, 29, 72] : [124, 58, 237]; 

    doc.setFontSize(20); doc.setTextColor(...color); doc.text(shopId, 14, 20);
    doc.setFontSize(14); doc.setTextColor(40); doc.text(title, 14, 30);
    doc.setFontSize(10); doc.text(`Data estrazione: ${new Date().toLocaleDateString('it-IT')}`, 14, 36);

    const tableColumn = ["Nome", "Data Inizio", "Note", "Importo (€)"];
    const tableRows = [];
    let total = 0;

    const sortedList = [...list].sort((a, b) => a.name.localeCompare(b.name));
    sortedList.forEach(item => {
        const itemData = [item.name, new Date(item.date).toLocaleDateString('it-IT'), item.note || "-", formatEUR(item.amount)];
        tableRows.push(itemData);
        total += parseFloat(item.amount) || 0;
    });

    tableRows.push(["", "", "TOTALE:", formatEUR(total)]);
    autoTable(doc, {
        head: [tableColumn], body: tableRows, startY: 45, theme: 'grid',
        headStyles: { fillColor: color, textColor: 255, fontStyle: 'bold' },
        columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } }
    });
    doc.save(`${title}_${shopId}.pdf`);
  };

  // --- BACKUP JSON ---
  const downloadDebtorsBackup = () => {
    const list = activeContext === 'debtors' ? debtors : investors;
    if (list.length === 0) { alert("Nessun dato da salvare."); return; }
    const dataStr = JSON.stringify(list, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BACKUP_${activeContext}_${shopId}.json`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // --- HANDLERS GENERICI ---
  const handleChange = (field, value) => {
    const cleanVal = value.toString().replace(',', '.');
    const newData = { ...data, [field]: parseFloat(cleanVal) || 0 };
    setData(newData); saveToCloud(newData, cashBreakdown, products);
  };
  const handleCashChange = (denom, qty) => {
    const newBreakdown = { ...cashBreakdown, [denom]: parseInt(qty) || 0 };
    setCashBreakdown(newBreakdown); saveToCloud(data, newBreakdown, products);
  };

  // --- HANDLERS ACCESSORI ---
  const addProductToDay = (catalogItem = null) => {
    const newProduct = catalogItem 
        ? { ...catalogItem, id: Date.now(), qty: 1 } 
        : { id: Date.now(), name: '', price: 0, agio: 0, qty: 1 }; 
    const newProds = [...products, newProduct];
    setProducts(newProds); saveToCloud(data, cashBreakdown, newProds);
  };
  const updateProductDay = (id, field, val) => {
    const cleanVal = val.toString().replace(',', '.');
    const newProds = products.map(p => p.id === id ? { ...p, [field]: parseFloat(cleanVal) || val } : p);
    setProducts(newProds); saveToCloud(data, cashBreakdown, newProds);
  };
  const removeProductDay = (id) => {
    const newProds = products.filter(p => p.id !== id);
    setProducts(newProds); saveToCloud(data, cashBreakdown, newProds);
  };

  // --- HANDLERS INVENTARIO ---
  const addNewInventoryItem = () => {
      if(!newItemName) return;
      const price = parseFloat(newItemPrice.toString().replace(',','.')) || 0;
      const agio = parseFloat(newItemAgio.toString().replace(',','.')) || 0;
      const stock = parseInt(newItemStock) || 0;
      const newItem = { id: Date.now(), name: newItemName, price, agio, stock };
      const newCatalog = [...globalCatalog, newItem];
      updateGlobalCatalog(newCatalog);
      setNewItemName(""); setNewItemPrice(""); setNewItemAgio(""); setNewItemStock(""); setShowInventoryModal(false);
  };
  const updateInventoryStock = (id, delta) => {
      const newCatalog = globalCatalog.map(item => {
          if(item.id === id) return { ...item, stock: Math.max(0, (item.stock || 0) + delta) };
          return item;
      });
      updateGlobalCatalog(newCatalog);
  };
  const removeInventoryItem = (id) => {
      if(!confirm("Eliminare definitivamente?")) return;
      const newCatalog = globalCatalog.filter(i => i.id !== id);
      updateGlobalCatalog(newCatalog);
  };

  // --- HANDLERS ENTITA' ---
  const openAddEntityModal = (context) => { 
      setActiveContext(context); 
      setNewEntityName(""); setNewEntityAmount(""); setNewEntityDate(new Date().toISOString().slice(0,10)); setNewEntityNote("");
      setShowAddEntityModal(true); 
  };
  const confirmAddEntity = () => {
    if (!newEntityName.trim()) return;
    const cleanAmount = newEntityAmount.toString().replace(',', '.');
    const amount = parseFloat(cleanAmount) || 0;
    
    const list = activeContext === 'debtors' ? debtors : investors;
    let updatedList = [...list];
    const existingIndex = updatedList.findIndex(d => d.name.toLowerCase() === newEntityName.trim().toLowerCase());
    const newTransaction = { id: Date.now(), date: newEntityDate, amount: amount, note: newEntityNote, type: 'add' };

    if (existingIndex >= 0) {
        const item = updatedList[existingIndex];
        const history = item.history ? [...item.history, newTransaction] : [newTransaction];
        const newTotal = history.reduce((acc, t) => t.type === 'add' ? acc + t.amount : acc - t.amount, 0);
        updatedList[existingIndex] = { ...item, amount: newTotal, lastUpdated: new Date().toISOString(), history: history };
        alert(`Aggiornato ${item.name}. Totale: ${formatEUR(newTotal)}`);
    } else {
        updatedList.push({ id: Date.now(), name: newEntityName.trim(), amount: amount, date: newEntityDate, lastUpdated: new Date().toISOString(), history: [newTransaction] });
    }
    if (activeContext === 'debtors') { setDebtors(updatedList); saveDebtors(updatedList); } else { setInvestors(updatedList); saveInvestors(updatedList); }
    setShowAddEntityModal(false);
  };
  const openTransactionModal = (id, type, context) => { setActiveContext(context); setTransactionData({ id, type, amount: "" }); setShowTransactionModal(true); };
  const confirmTransaction = () => {
     const { id, type, amount } = transactionData;
     const cleanAmount = amount.toString().replace(',', '.');
     const val = parseFloat(cleanAmount);
     if (isNaN(val) || val <= 0) return;
     const list = activeContext === 'debtors' ? debtors : investors;
     const updatedList = list.map(d => {
         if (d.id === id) {
             const newTransaction = { id: Date.now(), date: new Date().toISOString().slice(0,10), amount: val, note: type === 'add' ? 'Aggiunta' : 'Pagamento/Prelievo', type: type === 'add' ? 'add' : 'sub' };
             const history = d.history ? [...d.history, newTransaction] : [newTransaction];
             let newTotal = d.amount; if (type === 'add') newTotal += val; else newTotal -= val;
             return { ...d, amount: Math.max(0, newTotal), lastUpdated: new Date().toISOString(), history: history };
         }
         return d;
     }).filter(d => d.amount > 0.01);
     if (activeContext === 'debtors') { setDebtors(updatedList); saveDebtors(updatedList); } else { setInvestors(updatedList); saveInvestors(updatedList); }
     setShowTransactionModal(false);
  };
  const removeEntity = (id, context) => { 
      if(!confirm("Eliminare definitivamente?")) return; 
      const list = context === 'debtors' ? debtors : investors;
      const updatedList = list.filter(d => d.id !== id);
      if (context === 'debtors') { setDebtors(updatedList); saveDebtors(updatedList); } else { setInvestors(updatedList); saveInvestors(updatedList); }
  };
  const openHistory = (item) => { setSelectedEntity(item); setShowHistoryModal(true); };

  // --- CALCOLI ---
  const totaleAccessori = products.reduce((acc, p) => acc + (parseFloat(p.price || 0) * parseFloat(p.qty || 0)), 0);
  const totaleBanconote = Object.keys(cashBreakdown).reduce((acc, k) => acc + (parseFloat(k) * cashBreakdown[k]), 0);
  const soldiIncassatiTotali = totaleBanconote + data.totaleMonete + data.totaleAssegni + data.soldiLasciatiMattina;
  const totaleContanteTeorico = data.incassoGiornaliero + data.riscossioni + data.ricariche + totaleAccessori - data.crediti - data.pos - data.buoniCarburante;
  const differenza = soldiIncassatiTotali - totaleContanteTeorico;

  const formatEUR = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val || 0);
  const formatNum = (val) => new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0);

  const downloadCSV = () => {
    if (!checklist.debtors) { alert("⚠️ Segna i debitori nella checklist prima di scaricare!"); return; }
    let csv = "data:text/csv;charset=utf-8,DATA;VOCE;IMPORTO\n";
    csv += `${currentDate};Incasso Base;${formatNum(data.incassoGiornaliero)}\n${currentDate};Ricariche;${formatNum(data.ricariche)}\n${currentDate};Accessori Tot;${formatNum(totaleAccessori)}\n${currentDate};Teorico;${formatNum(totaleContanteTeorico)}\n${currentDate};Reale;${formatNum(soldiIncassatiTotali)}\n${currentDate};DIFFERENZA;${formatNum(differenza)}\n`;
    products.forEach(p => csv += `${currentDate};PROD: ${p.name};${p.price} x ${p.qty}\n`);
    const link = document.createElement("a"); link.href = encodeURI(csv); link.download = `Cassa_${shopId}_${currentDate}.csv`; document.body.appendChild(link); link.click(); link.remove();
  };
  
  // --- RENDER ---
  if (!isShopIdLocked) return (<div className="min-h-screen bg-blue-900 flex items-center justify-center p-4"><div className="bg-white p-8 rounded-3xl w-full max-w-sm text-center shadow-2xl"><div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-yellow-400"><Fuel className="w-10 h-10 text-blue-600"/></div><h2 className="text-2xl font-black text-blue-900 mb-2">ANDRIVAL</h2><p className="text-sm text-blue-400 mb-6 font-bold uppercase tracking-wider">{appVersion}</p><input type="text" placeholder="Codice Stazione" value={shopId} onChange={(e) => setShopId(e.target.value.toUpperCase().replace(/\s/g, '-'))} className="w-full p-4 border-2 border-blue-100 rounded-xl text-center text-lg font-bold mb-4 uppercase text-blue-900 placeholder-blue-200 focus:border-yellow-400 outline-none"/><button onClick={() => {if(shopId.length>2) {localStorage.setItem('shopId', shopId); setIsShopIdLocked(true)}}} className="w-full bg-yellow-400 text-blue-900 py-4 rounded-xl font-black hover:bg-yellow-300 shadow-lg transform transition hover:-translate-y-1">ENTRA</button></div></div>);

  if (currentView === 'menu') return (
    <div className="min-h-screen bg-slate-100 p-4 font-sans flex flex-col items-center justify-center">
        <div className="w-full max-w-md space-y-4">
            <div className="text-center mb-8"><div className="inline-block p-4 rounded-full bg-blue-600 border-4 border-yellow-400 shadow-xl mb-4"><Fuel className="w-12 h-12 text-yellow-400" /></div><h1 className="text-3xl font-black text-blue-900 tracking-tight">ANDRIVAL</h1><p className="text-blue-600 font-bold opacity-70">{shopId}</p></div>
            <button onClick={() => setCurrentView('daily')} className="w-full bg-white p-6 rounded-2xl shadow-lg border-l-8 border-blue-600 flex items-center gap-4 active:scale-95 transition-transform"><div className="bg-blue-100 p-3 rounded-xl"><Calculator className="w-8 h-8 text-blue-600" /></div><div className="text-left flex-1"><h3 className="font-bold text-xl text-slate-800">Cassa</h3><p className="text-sm text-slate-400 font-medium">Chiusura giornaliera</p></div><ArrowRight className="text-blue-200" /></button>
            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setCurrentView('debtors')} className="bg-white p-5 rounded-2xl shadow-md border-l-8 border-rose-500 flex flex-col items-center gap-2 active:scale-95 transition-transform"><div className="bg-rose-100 p-3 rounded-full"><Users className="w-6 h-6 text-rose-600" /></div><h3 className="font-bold text-slate-700">Debitori</h3></button>
                <button onClick={() => setCurrentView('investors')} className="bg-white p-5 rounded-2xl shadow-md border-l-8 border-violet-500 flex flex-col items-center gap-2 active:scale-95 transition-transform"><div className="bg-violet-100 p-3 rounded-full"><Briefcase className="w-6 h-6 text-violet-600" /></div><h3 className="font-bold text-slate-700">Investitori</h3></button>
            </div>
            <button onClick={() => setCurrentView('inventory')} className="w-full bg-white p-5 rounded-2xl shadow-md border-l-8 border-amber-500 flex items-center gap-4 active:scale-95 transition-transform"><div className="bg-amber-100 p-3 rounded-xl"><Package className="w-6 h-6 text-amber-600" /></div><div className="text-left flex-1"><h3 className="font-bold text-slate-700">Magazzino</h3><p className="text-sm text-slate-400">Gestione Accessori</p></div></button>
            <div className="flex gap-2 mt-6"><button onClick={() => {if(confirm('Uscire?')){localStorage.removeItem('shopId'); setIsShopIdLocked(false)}}} className="flex-1 py-3 text-slate-400 text-xs font-bold hover:text-red-500 uppercase tracking-wider">Esci</button><button onClick={() => window.location.reload()} className="flex-1 py-3 text-blue-600 text-xs font-bold hover:text-blue-800 flex justify-center gap-1 uppercase tracking-wider"><RefreshCcw size={14}/> Aggiorna</button></div>
        </div>
    </div>
  );

  if (currentView === 'inventory') return (
    <div className="min-h-screen bg-slate-50 font-sans p-4 pb-20">
       <div className="max-w-2xl mx-auto">
          <div className="bg-white p-4 rounded-xl shadow-sm mb-4 sticky top-0 z-20 flex justify-between items-center border-b border-slate-100"><button onClick={() => setCurrentView('menu')} className="p-2 bg-slate-100 rounded-lg text-slate-600"><Home size={20}/></button><h2 className="font-bold text-lg text-slate-700">Magazzino</h2><button onClick={() => setShowInventoryModal(true)} className="p-2 bg-amber-100 text-amber-700 rounded-lg"><Plus size={20}/></button></div>
          <div className="grid gap-3">{globalCatalog.length === 0 && <div className="text-center py-10 text-slate-400"><Box size={48} className="mx-auto mb-2 opacity-30"/><p>Inventario vuoto.</p></div>}{globalCatalog.map(item => (<div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center"><div><h3 className="font-bold text-slate-800">{item.name}</h3><div className="text-xs text-slate-400 flex gap-2 mt-1"><span>Prezzo: {formatEUR(item.price)}</span><span>Agio: {formatEUR(item.agio)}</span></div></div><div className="flex flex-col items-end gap-1"><span className="text-[10px] text-slate-400 uppercase font-bold">Giacenza</span><div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1 border border-slate-200"><button onClick={() => updateInventoryStock(item.id, -1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 font-bold">-</button><span className={`font-bold w-6 text-center ${item.stock < 5 ? 'text-red-500' : 'text-slate-700'}`}>{item.stock || 0}</span><button onClick={() => updateInventoryStock(item.id, 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 font-bold">+</button></div><button onClick={() => removeInventoryItem(item.id)} className="text-[10px] text-red-300 hover:text-red-500 mt-1">Elimina</button></div></div>))}</div>
          {showInventoryModal && (<div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 animate-in zoom-in"><div className="flex justify-between items-center border-b pb-2"><h3 className="font-bold text-lg">Nuovo Articolo</h3><X onClick={() => setShowInventoryModal(false)} className="cursor-pointer"/></div><div><label className="text-xs font-bold text-slate-500">Nome Prodotto</label><input className="w-full border p-2 rounded-lg font-bold" value={newItemName} onChange={e => setNewItemName(e.target.value)} /></div><div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-bold text-slate-500">Prezzo (€)</label><input type="number" className="w-full border p-2 rounded-lg" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} /></div><div><label className="text-xs font-bold text-slate-500">Agio (€)</label><input type="number" className="w-full border p-2 rounded-lg" value={newItemAgio} onChange={e => setNewItemAgio(e.target.value)} /></div></div><div><label className="text-xs font-bold text-slate-500">Giacenza Iniziale (Pezzi)</label><input type="number" className="w-full border p-2 rounded-lg" value={newItemStock} onChange={e => setNewItemStock(e.target.value)} /></div><button onClick={addNewInventoryItem} className="w-full bg-amber-500 text-white py-3 rounded-xl font-bold">Aggiungi a Inventario</button></div></div>)}
       </div>
    </div>
  );

  if (currentView === 'debtors' || currentView === 'investors') return renderEntityList(currentView === 'debtors' ? debtors : investors, currentView);

  // --- MODALI CONDIVISE ---
  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20 md:pb-0"> 
      <div className="max-w-7xl mx-auto md:p-6 p-2">
        {/* Header Cassa */}
        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 mb-4 flex flex-col gap-3 sticky top-0 z-30">
            <div className="flex justify-between items-center"><div className="flex items-center gap-2"><button onClick={() => setCurrentView('menu')} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg mr-1"><ArrowLeft size={18}/></button><div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div><div className="font-bold text-sm">{shopId}</div></div><div className="flex gap-2"><button onClick={downloadCSV} className="p-2 bg-slate-100 rounded-lg text-slate-600"><Download size={18}/></button></div></div>
            <div className="flex gap-2"><div className="flex flex-1 items-center justify-between bg-slate-100 rounded-lg p-1"><button onClick={() => {const d=new Date(currentDate); d.setDate(d.getDate()-1); setCurrentDate(d.toISOString().slice(0,10))}} className="p-2 text-slate-500"><ArrowLeft size={16}/></button><input type="date" value={currentDate} onChange={(e) => setCurrentDate(e.target.value)} className="bg-transparent font-bold text-sm outline-none"/><button onClick={() => {const d=new Date(currentDate); d.setDate(d.getDate()+1); setCurrentDate(d.toISOString().slice(0,10))}} className="p-2 text-slate-500"><ArrowRight size={16}/></button></div><button onClick={generateMonthlyReport} className="px-3 bg-indigo-600 text-white rounded-lg shadow-sm flex items-center justify-center active:scale-95 transition-transform"><PieChart size={20} /></button></div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Banknote size={14}/> Entrate</h3>
                <div className="mb-4"><label className="text-xs font-bold text-slate-500">Incasso Base</label><input type="number" inputMode="decimal" value={data.incassoGiornaliero||''} onChange={e => handleChange('incassoGiornaliero', e.target.value)} className="w-full border rounded-lg p-2 font-bold text-xl"/></div>
                <div className="mb-4 p-3 bg-indigo-50 rounded-lg border border-indigo-100"><div className="flex justify-between items-center mb-2"><span className="text-sm font-bold text-indigo-700">Accessori</span><span className="font-bold">{formatEUR(totaleAccessori)}</span></div><select className="w-full p-2 mb-2 text-sm rounded border" onChange={(e) => {if(e.target.value === "") return; const item = globalCatalog.find(i => i.id.toString() === e.target.value); if(item) addProductToDay(item); e.target.value = "";}}><option value="">+ Aggiungi da Inventario...</option>{globalCatalog.map(i => <option key={i.id} value={i.id}>{i.name} ({formatEUR(i.price)}) - Giac: {i.stock}</option>)}</select><button onClick={() => addProductToDay(null)} className="w-full text-xs bg-white border border-indigo-200 py-1 rounded text-indigo-500">O crea nuovo manuale</button><div className="mt-2 space-y-1">{products.map(p => (<div key={p.id} className="flex justify-between items-center text-xs bg-white p-1 rounded border border-indigo-100"><span>{p.name}</span><div className="flex items-center gap-2"><span>{formatEUR(p.price)}</span><input type="number" className="w-8 text-center border rounded" value={p.qty} onChange={e => updateProductDay(p.id, 'qty', e.target.value)} /><Trash2 size={12} className="text-red-400 cursor-pointer" onClick={() => removeProductDay(p.id)}/></div></div>))}</div></div>
                <div className="space-y-2">{[{l:"Ricariche",f:"ricariche",c:"text-emerald-600"},{l:"Riscossioni",f:"riscossioni",c:"text-emerald-600"},{l:"Crediti",f:"crediti",c:"text-red-500"},{l:"POS",f:"pos",c:"text-red-500"},{l:"Buoni",f:"buoniCarburante",c:"text-red-500"}].map(i => (<div key={i.f} className="flex justify-between items-center"><span className={`text-sm font-bold ${i.c}`}>{i.l}</span><input type="number" inputMode="decimal" className="w-24 text-right font-bold border-b outline-none" value={data[i.f]||''} onChange={e => handleChange(i.f, e.target.value)} /></div>))}</div>
             </div>

             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                 <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3">Conteggio</h3>
                 <div className="grid grid-cols-1 gap-2">{[500,200,100,50,20,10,5].map(d => <div key={d} className="flex justify-between bg-slate-50 p-1 rounded"><span className="font-bold text-slate-500">€{d}</span><input type="number" inputMode="numeric" className="w-16 text-center bg-transparent font-bold" placeholder="0" value={cashBreakdown[d]||''} onChange={e => handleCashChange(d, e.target.value)}/></div>)}</div>
                 <div className="mt-4 grid grid-cols-3 gap-2">
                     <div className="col-span-1"><label className="text-[10px] font-bold text-slate-500 block mb-1">Monete</label><input type="number" inputMode="decimal" className="w-full border rounded p-1 text-center font-bold" value={data.totaleMonete||''} onChange={e => handleChange('totaleMonete', e.target.value)}/></div>
                     <div className="col-span-1"><label className="text-[10px] font-bold text-slate-500 block mb-1">Assegni</label><input type="number" inputMode="decimal" className="w-full border rounded p-1 text-center font-bold" value={data.totaleAssegni||''} onChange={e => handleChange('totaleAssegni', e.target.value)}/></div>
                     <div className="col-span-1"><label className="text-[10px] font-bold text-emerald-600 block mb-1">Mattina</label><input type="number" inputMode="decimal" className="w-full border border-emerald-200 bg-emerald-50 rounded p-1 text-center font-bold text-emerald-700" value={data.soldiLasciatiMattina||''} onChange={e => handleChange('soldiLasciatiMattina', e.target.value)}/></div>
                 </div>
             </div>

             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                 <div className="bg-slate-800 text-white p-4 rounded-xl text-center mb-4"><span className="text-xs font-bold uppercase">Totale Reale</span><div className="text-3xl font-bold">{formatEUR(soldiIncassatiTotali)}</div></div>
                 <div className={`p-4 rounded-xl text-center border-2 ${differenza===0?'border-emerald-500 bg-emerald-50':'border-rose-500 bg-rose-50'}`}><span className="text-xs font-bold uppercase">Differenza</span><div className={`text-3xl font-black ${differenza===0?'text-emerald-600':'text-rose-600'}`}>{differenza>0?'+':''}{formatEUR(differenza)}</div></div>
                 <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4"><h4 className="text-xs font-bold text-yellow-700 uppercase mb-3 flex items-center gap-1"><ListChecks size={14}/> Checklist Chiusura</h4><div className="space-y-2"><label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"><input type="checkbox" className="accent-indigo-600 w-4 h-4" checked={checklist.debtors} onChange={e => setChecklist({...checklist, debtors: e.target.checked})} /><span>Ho segnato i Debitori?</span></label><label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"><input type="checkbox" className="accent-indigo-600 w-4 h-4" checked={checklist.cash} onChange={e => setChecklist({...checklist, cash: e.target.checked})} /><span>Contati soldi nel cassetto?</span></label></div></div>
                 <div className="mt-4 p-3 bg-slate-50 rounded-lg text-center"><button onClick={downloadCSV} className="w-full flex items-center justify-center gap-2 text-slate-500 text-xs font-bold hover:text-indigo-600 transition-colors"><Download size={14}/> Scarica Excel Giornata</button></div>
             </div>
        </div>
      </div>
      {/* MODALI CONDIVISE */}
      {showReportModal && (<div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center"><div className="bg-white w-full md:w-[700px] md:rounded-2xl rounded-t-2xl h-[90vh] md:h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300"><div className="p-5 border-b border-slate-100 flex justify-between items-center bg-indigo-50 rounded-t-2xl"><div><h2 className="text-xl font-bold text-indigo-900 flex items-center gap-2"><PieChart size={24} className="text-indigo-600"/> Report Mensile</h2><p className="text-sm text-indigo-400">Analisi completa: {currentDate.slice(0, 7)}</p></div><button onClick={() => setShowReportModal(false)} className="p-2 bg-white/50 rounded-full hover:bg-white text-indigo-900"><X size={20}/></button></div><div className="flex-1 overflow-y-auto p-5">{loadingReport ? (<div className="flex flex-col items-center justify-center h-full text-slate-400"><Sparkles className="animate-spin mb-2" size={32}/><p>Sto analizzando tutti i giorni del mese...</p></div>) : monthlyStats ? (<div className="space-y-6"><div className="grid grid-cols-2 gap-4"><div className="bg-indigo-600 text-white p-4 rounded-xl shadow-lg"><div className="text-xs font-bold opacity-70 uppercase mb-1">Guadagno Accessori</div><div className="text-2xl font-bold">{formatEUR(monthlyStats.totalAgio)}</div><div className="text-[10px] opacity-70 mt-1">Totale Agio (Utile) nel mese</div></div><div className={`p-4 rounded-xl shadow-lg text-white ${monthlyStats.totalDiff >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}><div className="text-xs font-bold opacity-70 uppercase mb-1">Differenziale Mensile</div><div className="text-2xl font-bold">{monthlyStats.totalDiff > 0 ? '+' : ''}{formatEUR(monthlyStats.totalDiff)}</div><div className="text-[10px] opacity-70 mt-1">Bilancio cassa netto</div></div></div><div><h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Calendar size={16} /> Dettaglio Giornaliero</h3><div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden"><table className="w-full text-sm"><thead className="bg-slate-100 text-slate-500 font-bold text-xs uppercase"><tr><th className="p-3 text-left">Giorno</th><th className="p-3 text-right">Utile Accessori</th><th className="p-3 text-right">Differenza Cassa</th></tr></thead><tbody className="divide-y divide-slate-200">{monthlyStats.daysData.map((day, idx) => (<tr key={idx} className="hover:bg-white transition-colors"><td className="p-3 font-medium text-slate-700">{day.date}</td><td className="p-3 text-right text-indigo-600 font-bold">{formatEUR(day.agio)}</td><td className={`p-3 text-right font-bold ${day.diff === 0 ? 'text-emerald-600' : day.diff < 0 ? 'text-rose-500' : 'text-amber-500'}`}>{day.diff > 0 ? '+' : ''}{formatEUR(day.diff)}</td></tr>))}</tbody></table></div></div></div>) : null}</div><div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl text-center text-xs text-slate-400">Il calcolo considera tutti i giorni salvati con prefisso {shopId}</div></div></div>)}
      {showHistoryModal && selectedEntity && (<div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-md h-[80vh] flex flex-col animate-in zoom-in"><div className="p-4 bg-slate-50 border-b flex justify-between items-center rounded-t-2xl"><div><h3 className="font-bold text-lg text-slate-800">{selectedEntity.name}</h3><p className="text-xs text-slate-500">Cronologia Movimenti</p></div><X onClick={() => setShowHistoryModal(false)} className="cursor-pointer text-slate-500"/></div><div className="flex-1 overflow-y-auto p-4 space-y-3">{(selectedEntity.history || []).length === 0 ? (<p className="text-center text-slate-400 text-sm mt-10">Nessuna cronologia disponibile.</p>) : ([...selectedEntity.history].reverse().map((h, idx) => (<div key={idx} className={`p-3 rounded-lg border ${h.type === 'add' ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}><div className="flex justify-between mb-1"><span className={`text-xs font-bold uppercase ${h.type === 'add' ? 'text-rose-600' : 'text-emerald-600'}`}>{h.type === 'add' ? (activeContext === 'debtors' ? '🔴 Debito' : '🟢 Versamento') : (activeContext === 'debtors' ? '🟢 Pagamento' : '🔴 Prelievo')}</span><span className="text-xs text-slate-400">{new Date(h.date).toLocaleDateString('it-IT')}</span></div><div className="flex justify-between items-center"><span className="text-sm text-slate-700 italic">{h.note || "-"}</span><span className="font-bold text-lg">{formatEUR(h.amount)}</span></div></div>)))}</div><div className="p-4 bg-slate-50 border-t rounded-b-2xl text-center"><p className="text-xs text-slate-500 uppercase font-bold">Saldo Attuale</p><p className="text-2xl font-black text-slate-800">{formatEUR(selectedEntity.amount)}</p></div></div></div>)}
      {showAddEntityModal && (<div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in"><div className="p-4 bg-slate-50 border-b flex justify-between items-center"><h3 className="font-bold">Nuovo {activeContext === 'debtors' ? 'Debito' : 'Investimento'}</h3><X onClick={() => setShowAddEntityModal(false)} className="cursor-pointer"/></div><div className="p-6 space-y-3"><div><label className="text-xs font-bold text-slate-500">Nome</label><input className="w-full border p-2 rounded-lg" value={newEntityName} onChange={e => setNewEntityName(e.target.value)} placeholder="Nome"/></div><div><label className="text-xs font-bold text-slate-500">Importo</label><input type="number" className="w-full border p-2 rounded-lg font-bold text-lg" value={newEntityAmount} onChange={e => setNewEntityAmount(e.target.value)} placeholder="0.00"/></div><div><label className="text-xs font-bold text-slate-500">Data</label><input type="date" className="w-full border p-2 rounded-lg" value={newEntityDate} onChange={e => setNewEntityDate(e.target.value)}/></div><div><label className="text-xs font-bold text-slate-500">Note</label><textarea className="w-full border p-2 rounded-lg text-sm" rows="2" value={newEntityNote} onChange={e => setNewEntityNote(e.target.value)} placeholder="Es. Dettagli..."/></div><p className="text-[10px] text-slate-400 italic text-center mt-2">Se il nome esiste, l'importo verrà sommato.</p><button onClick={confirmAddEntity} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold mt-2">Salva</button></div></div></div>)}
      {showTransactionModal && (<div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"><h3 className="font-bold mb-4 text-center">{transactionData.type==='add' ? (activeContext === 'debtors' ? 'Aggiungi Debito' : 'Nuovo Versamento') : (activeContext === 'debtors' ? 'Registra Pagamento' : 'Preleva Capitale')}</h3><input type="number" autoFocus className="w-full border p-4 rounded-xl text-center text-3xl font-bold mb-4" value={transactionData.amount} onChange={e => setTransactionData({...transactionData, amount:e.target.value})} placeholder="0.00" /><button onClick={confirmTransaction} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">Conferma</button></div></div>)}
    </div>
  );
};

export default App;