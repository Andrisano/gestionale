import React, { useState, useEffect } from 'react';
import { Calculator, AlertCircle, CheckCircle, Banknote, CreditCard, Fuel, ShoppingBag, Coins, Wallet, Sparkles, ArrowRight, Download, Calendar, Lock, Users, Plus, Trash2, Package, X, Smartphone, TrendingUp, FileText, PieChart, ShieldCheck, Home, UserMinus, ArrowLeft, Cloud, RefreshCw, PlusCircle, MinusCircle, Clock, AlertTriangle, UserPlus, RefreshCcw } from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
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

// --- INIZIALIZZAZIONE ---
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (e) {
  // Ignora se già inizializzata
}

const auth = getAuth(app);
const db = getFirestore(app);
const appId = "gestionale-cassa-v2"; 

const DailyCashSheet = () => {
  // --- STATE ---
  const [user, setUser] = useState(null);
  
  // Lettura sicura dal LocalStorage
  const [shopId, setShopId] = useState(() => {
    try { return localStorage.getItem('shopId') || ''; } catch (e) { return ''; }
  });
  
  const [isShopIdLocked, setIsShopIdLocked] = useState(() => {
    try { return !!localStorage.getItem('shopId'); } catch (e) { return false; }
  });

  const [appVersion] = useState("v2.5"); 
  
  const [currentView, setCurrentView] = useState('menu'); 
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().slice(0,10));
  const [connectionStatus, setConnectionStatus] = useState("disconnected"); 
  const [dataLoaded, setDataLoaded] = useState(false);

  // --- AUTHENTICATION ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth Error:", err);
        setConnectionStatus("error");
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setConnectionStatus("connected");
    });
    return () => unsubscribe();
  }, []);

  // --- DATA DEFAULTS ---
  const defaultData = {
    incassoGiornaliero: 0, crediti: 0, pos: 0, riscossioni: 0,
    buoniCarburante: 0, ricariche: 0, totaleMonete: 0,
    totaleAssegni: 0, soldiLasciatiMattina: 0
  };
  const defaultBreakdown = { 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0 };

  const [data, setData] = useState(defaultData);
  const [cashBreakdown, setCashBreakdown] = useState(defaultBreakdown);
  const [products, setProducts] = useState([]); 
  const [globalCatalog, setGlobalCatalog] = useState([]);
  
  const [debtors, setDebtors] = useState([]);

  // Modali
  const [showProductModal, setShowProductModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [monthlyStats, setMonthlyStats] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [showAddDebtorModal, setShowAddDebtorModal] = useState(false);
  const [newDebtorName, setNewDebtorName] = useState("");
  const [newDebtorAmount, setNewDebtorAmount] = useState("");
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionData, setTransactionData] = useState({ id: null, type: 'add', amount: "" });

  // --- SYNC DATI ---
  // 1. Catalogo Globale
  useEffect(() => {
    if (!user || !shopId) return;
    const catalogRef = doc(db, 'artifacts', appId, 'public', 'data', 'catalogs', shopId);
    return onSnapshot(catalogRef, (snap) => {
        if (snap.exists()) setGlobalCatalog(snap.data().items || []);
    });
  }, [user, shopId]);

  // 2. Debitori
  useEffect(() => {
    if (!user || !shopId) return;
    const debtorsRef = doc(db, 'artifacts', appId, 'public', 'data', 'debtors', shopId);
    return onSnapshot(debtorsRef, (snap) => {
        if (snap.exists()) setDebtors(snap.data().list || []);
        else setDebtors([]);
    });
  }, [user, shopId]);

  // 3. Foglio Giornaliero
  useEffect(() => {
    if (!user || !shopId) return;
    const docId = `${shopId}_${currentDate}`;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'daily_sheets', docId);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const remote = docSnap.data();
        setData(prev => ({ ...prev, ...remote.data }));
        setCashBreakdown(prev => ({ ...prev, ...remote.cashBreakdown }));
        if (remote.products && remote.products.length > 0) setProducts(remote.products);
        else if (globalCatalog.length > 0) setProducts(globalCatalog.map(p => ({ ...p, qty: 0 })));
        else setProducts([]);
      } else {
        setData(defaultData);
        setCashBreakdown(defaultBreakdown);
        if (globalCatalog.length > 0) setProducts(globalCatalog.map(p => ({ ...p, qty: 0 })));
        else setProducts([]);
      }
      setDataLoaded(true);
    });
    return () => unsubscribe();
  }, [user, shopId, currentDate, globalCatalog.length]); 

  // --- SALVATAGGIO ---
  const saveToCloud = async (newData, newBreakdown, newProducts) => {
    if (!user || !shopId || !dataLoaded) return;
    setConnectionStatus("syncing");
    const docId = `${shopId}_${currentDate}`;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'daily_sheets', docId);
    try {
      await setDoc(docRef, {
        data: newData, cashBreakdown: newBreakdown, products: newProducts,
        lastUpdated: new Date().toISOString(), updatedBy: user.uid, schemaVersion: 2
      }, { merge: true });
      setTimeout(() => setConnectionStatus("connected"), 500);
    } catch (err) { setConnectionStatus("error"); }
  };

  const updateGlobalCatalog = async (list) => {
      if (!user || !shopId) return;
      const catalogRef = doc(db, 'artifacts', appId, 'public', 'data', 'catalogs', shopId);
      await setDoc(catalogRef, { items: list.map(({ qty, ...item }) => item) }, { merge: true });
  };

  const saveDebtors = async (list) => {
      if (!user || !shopId) return;
      const debtorsRef = doc(db, 'artifacts', appId, 'public', 'data', 'debtors', shopId);
      await setDoc(debtorsRef, { list }, { merge: true });
  };

  // --- HANDLERS ---
  const handleChange = (field, value) => {
    const newData = { ...data, [field]: parseFloat(value) || 0 };
    setData(newData);
    saveToCloud(newData, cashBreakdown, products);
  };

  const handleCashChange = (denom, qty) => {
    const newBreakdown = { ...cashBreakdown, [denom]: parseInt(qty) || 0 };
    setCashBreakdown(newBreakdown);
    saveToCloud(data, newBreakdown, products);
  };

  const addProduct = () => {
    const newProds = [...products, { id: Date.now(), name: '', price: 0, agio: 0, qty: 1 }];
    setProducts(newProds);
    saveToCloud(data, cashBreakdown, newProds);
    updateGlobalCatalog(newProds);
  };
  const updateProduct = (id, field, val) => {
    const newProds = products.map(p => p.id === id ? { ...p, [field]: val } : p);
    setProducts(newProds);
    saveToCloud(data, cashBreakdown, newProds);
    updateGlobalCatalog(newProds); 
  };
  const removeProduct = (id) => {
    if(!confirm("Eliminare dal catalogo?")) return;
    const newProds = products.filter(p => p.id !== id);
    setProducts(newProds);
    saveToCloud(data, cashBreakdown, newProds);
    updateGlobalCatalog(newProds);
  };

  // Gestione Modali Debitori
  const openAddDebtorModal = () => { setNewDebtorName(""); setNewDebtorAmount(""); setShowAddDebtorModal(true); };
  
  const confirmAddDebtor = () => {
    if (!newDebtorName.trim()) return;
    const amount = parseFloat(newDebtorAmount) || 0;
    const newDebtors = [...debtors, { id: Date.now(), name: newDebtorName, amount, date: new Date().toISOString().slice(0,10), lastUpdated: new Date().toISOString() }];
    setDebtors(newDebtors); saveDebtors(newDebtors); setShowAddDebtorModal(false);
  };
  
  const openTransactionModal = (id, type) => { setTransactionData({ id, type, amount: "" }); setShowTransactionModal(true); };
  
  const confirmTransaction = () => {
     const { id, type, amount } = transactionData;
     const val = parseFloat(amount);
     if (isNaN(val) || val <= 0) return;
     const newDebtors = debtors.map(d => {
         if (d.id === id) {
             const newAmount = type === 'add' ? d.amount + val : d.amount - val;
             return { ...d, amount: Math.max(0, newAmount), lastUpdated: new Date().toISOString() };
         }
         return d;
     }).filter(d => d.amount > 0.01);
     setDebtors(newDebtors); saveDebtors(newDebtors); setShowTransactionModal(false);
  };
  
  const removeDebtor = (id) => { if(!confirm("Eliminare?")) return; const newDebtors = debtors.filter(d => d.id !== id); setDebtors(newDebtors); saveDebtors(newDebtors); };

  // --- CALCOLI ---
  const totaleAccessori = products.reduce((acc, p) => acc + (parseFloat(p.price || 0) * parseFloat(p.qty || 0)), 0);
  const totaleAgio = products.reduce((acc, p) => acc + (parseFloat(p.agio || 0) * parseFloat(p.qty || 0)), 0);
  const totaleBanconote = Object.keys(cashBreakdown).reduce((acc, k) => acc + (parseFloat(k) * cashBreakdown[k]), 0);
  const soldiIncassatiTotali = totaleBanconote + data.totaleMonete + data.totaleAssegni + data.soldiLasciatiMattina;
  const totaleContanteTeorico = data.incassoGiornaliero + data.riscossioni + data.ricariche + totaleAccessori - data.crediti - data.pos - data.buoniCarburante;
  const differenza = soldiIncassatiTotali - totaleContanteTeorico;

  // --- REPORT MENSILE ---
  const generateMonthlyReport = async () => {
    if (!user || !shopId) return;
    setLoadingReport(true); setShowReportModal(true);
    const currentMonthPrefix = `${shopId}_${currentDate.slice(0, 7)}`;
    try {
        const querySnapshot = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'daily_sheets'));
        let totalDiff = 0, totalAgioMese = 0, daysData = [];
        querySnapshot.forEach((doc) => {
            if (doc.id.startsWith(currentMonthPrefix)) {
                const dData = doc.data();
                const dayP = dData.products || [];
                const dayD = dData.data || {};
                const dayB = dData.cashBreakdown || {};
                const dayAgio = dayP.reduce((acc, p) => acc + (parseFloat(p.agio||0)*parseFloat(p.qty||0)), 0);
                const dayAcc = dayP.reduce((acc, p) => acc + (parseFloat(p.price||0)*parseFloat(p.qty||0)), 0);
                const dayReal = Object.keys(dayB).reduce((acc, k) => acc + (parseFloat(k)*dayB[k]), 0) + (dayD.totaleMonete||0) + (dayD.totaleAssegni||0) + (dayD.soldiLasciatiMattina||0);
                const dayTheo = (dayD.incassoGiornaliero||0) + (dayD.riscossioni||0) + (dayD.ricariche||0) + (dayP.reduce((acc, p) => acc + (parseFloat(p.price||0)*parseFloat(p.qty||0)), 0)) - (dayD.crediti||0) - (dayD.pos||0) - (dayD.buoniCarburante||0);
                const diff = dayReal - dayTheo;
                totalDiff += diff; totalAgioMese += dayAgio;
                daysData.push({ date: doc.id.split('_').pop(), diff, agio: dayAgio });
            }
        });
        daysData.sort((a, b) => a.date.localeCompare(b.date));
        setMonthlyStats({ totalDiff, totalAgio: totalAgioMese, daysData });
    } catch (e) { console.error(e); } finally { setLoadingReport(false); }
  };

  const formatEUR = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);
  const formatNum = (val) => new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  
  const getDaysInactive = (lastUpdatedStr) => { if (!lastUpdatedStr) return 0; const last = new Date(lastUpdatedStr); const now = new Date(); return Math.ceil(Math.abs(now - last) / (1000 * 60 * 60 * 24)); };

  // --- DOWNLOAD CSV ---
  const downloadCSV = () => {
    let csv = "data:text/csv;charset=utf-8,DATA;VOCE;IMPORTO\n";
    csv += `${currentDate};Incasso Base;${formatNum(data.incassoGiornaliero)}\n${currentDate};Ricariche;${formatNum(data.ricariche)}\n${currentDate};Accessori Tot;${formatNum(totaleAccessori)}\n${currentDate};Utile Accessori;${formatNum(totaleAgio)}\n${currentDate};Teorico;${formatNum(totaleContanteTeorico)}\n${currentDate};Reale;${formatNum(soldiIncassatiTotali)}\n${currentDate};DIFFERENZA;${formatNum(differenza)}\n`;
    products.forEach(p => csv += `${currentDate};PROD: ${p.name};${p.price} x ${p.qty};Agio: ${p.agio}\n`);
    const link = document.createElement("a"); link.href = encodeURI(csv); link.download = `Cassa_${shopId}_${currentDate}.csv`; document.body.appendChild(link); link.click(); link.remove();
  };

  // --- AI ---
  const apiKey = ""; // Opzionale
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const analyzeDiscrepancy = async () => {
    setIsAnalyzing(true);
    try {
      const prompt = `Analizza: Teorico ${formatEUR(totaleContanteTeorico)}, Reale ${formatEUR(soldiIncassatiTotali)}, Diff ${formatEUR(differenza)}. 3 cause brevi.`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const res = await response.json(); setAiAnalysis(res.candidates?.[0]?.content?.parts?.[0]?.text || "Errore.");
    } catch (e) { setAiAnalysis("AI non configurata."); } finally { setIsAnalyzing(false); }
  };

  // --- RENDER ---
  if (!isShopIdLocked) return (<div className="min-h-screen bg-slate-900 flex items-center justify-center p-4"><div className="bg-white p-6 rounded-2xl w-full max-w-sm text-center shadow-2xl"><div className="bg-blue-100 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"><ShieldCheck className="w-6 h-6 text-blue-600" /></div><h2 className="text-xl font-bold mb-2">Accesso Gestionale</h2><p className="text-sm text-slate-500 mb-4">Versione Cloud {appVersion}</p><input type="text" placeholder="Codice Negozio" value={shopId} onChange={(e) => setShopId(e.target.value.toUpperCase().replace(/\s/g, '-'))} className="w-full p-3 border rounded-xl text-center text-lg font-bold mb-4 uppercase"/><button onClick={() => {if(shopId.length>2) {localStorage.setItem('shopId', shopId); setIsShopIdLocked(true)}}} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">Entra</button></div></div>);

  if (currentView === 'menu') return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans flex flex-col items-center justify-center">
        <div className="w-full max-w-md space-y-6">
            <div className="text-center mb-8"><div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold mb-4"><Sparkles size={12} /> {appVersion} - Online</div><h1 className="text-2xl font-bold text-slate-800">Negozio: {shopId}</h1><p className="text-slate-500">Pannello di Controllo</p></div>
            <button onClick={() => setCurrentView('daily')} className="w-full bg-white p-6 rounded-2xl shadow-md border border-slate-100 flex items-center gap-4 hover:shadow-lg transition-all active:scale-95 group"><div className="bg-blue-100 p-4 rounded-xl group-hover:bg-blue-600 transition-colors"><Calculator className="w-8 h-8 text-blue-600 group-hover:text-white" /></div><div className="text-left"><h3 className="text-lg font-bold text-slate-700">Calcoli Giornalieri</h3><p className="text-sm text-slate-400">Quadratura cassa, accessori, report</p></div><ArrowRight className="ml-auto text-slate-300" /></button>
            <button onClick={() => setCurrentView('debtors')} className="w-full bg-white p-6 rounded-2xl shadow-md border border-slate-100 flex items-center gap-4 hover:shadow-lg transition-all active:scale-95 group"><div className="bg-rose-100 p-4 rounded-xl group-hover:bg-rose-600 transition-colors"><Users className="w-8 h-8 text-rose-600 group-hover:text-white" /></div><div className="text-left"><h3 className="text-lg font-bold text-slate-700">Clienti Debitori</h3><p className="text-sm text-slate-400">Gestione crediti, acconti e saldi</p></div><ArrowRight className="ml-auto text-slate-300" /></button>
            <div className="flex gap-2"><button onClick={() => {if(confirm('Uscire?')){localStorage.removeItem('shopId'); setIsShopIdLocked(false)}}} className="flex-1 py-4 text-slate-400 text-sm font-medium hover:text-red-500">Esci dal negozio</button><button onClick={() => window.location.reload()} className="flex-1 py-4 text-indigo-400 text-sm font-medium hover:text-indigo-600 flex items-center justify-center gap-1"><RefreshCcw size={14}/> Aggiorna App</button></div>
        </div>
    </div>
  );

  if (currentView === 'debtors') return (
    <div className="min-h-screen bg-slate-50 font-sans p-4 pb-20">
        <div className="max-w-2xl mx-auto">
            <div className="bg-white p-4 rounded-xl shadow-sm mb-6 sticky top-0 z-20 flex justify-between items-center border-b border-slate-100"><button onClick={() => setCurrentView('menu')} className="p-2 bg-slate-100 rounded-lg text-slate-600"><Home size={20}/></button><h2 className="font-bold text-lg text-slate-700">Registro Debiti</h2><div className="w-10"></div></div>
            <div className="bg-gradient-to-br from-rose-500 to-pink-600 text-white p-6 rounded-2xl shadow-lg mb-6 text-center"><p className="text-rose-100 text-xs font-bold uppercase tracking-wider mb-1">Totale Crediti da Riscuotere</p><h1 className="text-4xl font-extrabold">{formatEUR(totalDebt)}</h1></div>
            <div className="space-y-3">
                {debtors.length === 0 && <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-slate-200 border-dashed"><UserMinus className="mx-auto mb-2 opacity-30" size={48}/><p>Nessun cliente debitore.</p></div>}
                {sortedDebtors.map(debtor => { const daysInactive = getDaysInactive(debtor.lastUpdated || debtor.date); const isLate = daysInactive > 30; return (
                    <div key={debtor.id} className={`bg-white p-4 rounded-xl shadow-sm border flex justify-between items-center transition-all ${isLate ? 'border-l-4 border-l-red-500 border-t-slate-100 border-r-slate-100 border-b-slate-100 bg-red-50/30' : 'border-slate-100'}`}>
                        <div className="flex-1"><div className="flex items-center gap-2"><h3 className="font-bold text-slate-800 text-lg">{debtor.name}</h3>{isLate && <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><AlertTriangle size={10}/> Fermo da {daysInactive}gg</span>}</div><p className="text-xs text-slate-400 flex items-center gap-1 mt-1"><Clock size={10}/> {new Date(debtor.lastUpdated || debtor.date).toLocaleDateString('it-IT')}</p></div>
                        <div className="flex flex-col items-end gap-2"><div className="font-extrabold text-slate-700 text-xl">{formatEUR(debtor.amount)}</div><div className="flex gap-2"><button onClick={() => openTransactionModal(debtor.id, 'subtract')} className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 p-2 rounded-lg transition-colors" title="Segna Pagamento"><MinusCircle size={20} /></button><button onClick={() => openTransactionModal(debtor.id, 'add')} className="bg-rose-100 hover:bg-rose-200 text-rose-700 p-2 rounded-lg transition-colors" title="Aggiungi Altro Debito"><PlusCircle size={20} /></button><button onClick={() => removeDebtor(debtor.id)} className="bg-slate-100 hover:bg-slate-200 text-slate-400 p-2 rounded-lg ml-2"><Trash2 size={20} /></button></div></div>
                    </div>
                )})}
            </div>
            <button onClick={openAddDebtorModal} className="fixed bottom-6 right-6 w-14 h-14 bg-rose-600 text-white rounded-full shadow-xl flex items-center justify-center hover:scale-105 transition-transform z-50"><Plus size={28} /></button>
        </div>
        {showAddDebtorModal && (<div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-300"><div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center"><h3 className="font-bold text-slate-700 flex items-center gap-2"><UserPlus size={20} className="text-indigo-600"/> Nuovo Cliente</h3><button onClick={() => setShowAddDebtorModal(false)} className="p-1 bg-white rounded-full text-slate-400 hover:text-red-500"><X size={20}/></button></div><div className="p-6 space-y-4"><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Cliente</label><input type="text" value={newDebtorName} onChange={(e) => setNewDebtorName(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-slate-800" placeholder="Es. Mario Rossi"/></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Importo Debito</label><input type="number" value={newDebtorAmount} onChange={(e) => setNewDebtorAmount(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-slate-800 text-xl" placeholder="0.00"/></div><button onClick={confirmAddDebtor} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold mt-2">Salva Cliente</button></div></div></div>)}
        {showTransactionModal && (<div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-300"><div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center"><h3 className="font-bold text-slate-700 flex items-center gap-2">{transactionData.type === 'add' ? <PlusCircle className="text-rose-600"/> : <MinusCircle className="text-emerald-600"/>}{transactionData.type === 'add' ? 'Aggiungi Debito' : 'Registra Pagamento'}</h3><button onClick={() => setShowTransactionModal(false)} className="p-1 bg-white rounded-full text-slate-400 hover:text-red-500"><X size={20}/></button></div><div className="p-6 space-y-4"><p className="text-sm text-slate-500 text-center">{transactionData.type === 'add' ? "Quanto vuoi aggiungere al saldo?" : "Quanto ha pagato il cliente (acconto/saldo)?"}</p><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">€</span><input type="number" value={transactionData.amount} onChange={(e) => setTransactionData({...transactionData, amount: e.target.value})} className="w-full pl-10 p-4 border-2 border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-extrabold text-slate-800 text-3xl text-center" placeholder="0.00" autoFocus/></div><button onClick={confirmTransaction} className={`w-full py-3 rounded-xl font-bold text-white mt-2 ${transactionData.type === 'add' ? 'bg-rose-600' : 'bg-emerald-600'}`}>Conferma</button></div></div></div>)}
    </div>
  );

  // Daily Sheet View
  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20 md:pb-0"> 
      <div className="max-w-7xl mx-auto md:p-6 p-2">
        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 mb-4 flex flex-col gap-3 sticky top-0 z-30">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2"><button onClick={() => setCurrentView('menu')} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg mr-1"><ArrowLeft size={18}/></button><div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : connectionStatus === 'syncing' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></div><div><div className="font-bold text-slate-700 text-sm flex items-center gap-1">{shopId}{connectionStatus === 'syncing' && <RefreshCw size={10} className="animate-spin text-slate-400"/>}</div></div></div>
                <div className="flex gap-2"><button onClick={downloadCSV} className="p-2 bg-slate-100 rounded-lg text-slate-600"><Download size={18}/></button></div>
            </div>
            <div className="flex gap-2">
                <div className="flex flex-1 items-center justify-between bg-slate-100 rounded-lg p-1"><button onClick={() => {const d=new Date(currentDate); d.setDate(d.getDate()-1); setCurrentDate(d.toISOString().slice(0,10))}} className="p-2 text-slate-500"><ArrowRight className="rotate-180" size={18}/></button><div className="flex items-center gap-2"><Calendar size={16} className="text-blue-600"/><input type="date" value={currentDate} onChange={(e) => setCurrentDate(e.target.value)} className="bg-transparent font-bold text-slate-700 outline-none text-sm"/></div><button onClick={() => {const d=new Date(currentDate); d.setDate(d.getDate()+1); setCurrentDate(d.toISOString().slice(0,10))}} className="p-2 text-slate-500"><ArrowRight size={18}/></button></div>
                <button onClick={generateMonthlyReport} className="px-3 bg-indigo-600 text-white rounded-lg shadow-sm flex items-center justify-center active:scale-95 transition-transform"><PieChart size={20} /></button>
            </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          <div className="flex flex-col gap-3">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Banknote size={14} className="text-blue-500"/> Calcolo Teorico</h3>
                <div className="mb-4"><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Incasso Base</label><input type="number" value={data.incassoGiornaliero || ''} onChange={(e) => handleChange('incassoGiornaliero', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-2xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200" placeholder="0,00"/></div>
                <div className="space-y-3 mb-4">
                    <div className="flex justify-between items-center bg-emerald-50/50 p-2 rounded-lg border border-emerald-100"><span className="text-sm font-bold text-emerald-700 flex items-center gap-1"><Smartphone size={14}/> (+) Ricariche</span><input type="number" value={data.ricariche || ''} onChange={(e) => handleChange('ricariche', e.target.value)} className="w-24 text-right font-bold text-emerald-700 bg-transparent outline-none text-lg" placeholder="0"/></div>
                    <div onClick={() => setShowProductModal(true)} className="flex justify-between items-center bg-indigo-50 p-3 rounded-lg border border-indigo-100 cursor-pointer active:scale-95 transition-transform"><div className="flex flex-col"><span className="text-sm font-bold text-indigo-700 flex items-center gap-1"><Package size={14}/> (+) Accessori</span><span className="text-[10px] text-indigo-400">{products.length} prodotti nel catalogo</span></div><span className="font-bold text-indigo-700 text-lg">{formatEUR(totaleAccessori)}</span></div>
                    <div className="flex justify-between items-center p-2"><span className="text-sm font-medium text-emerald-600">(+) Riscossioni</span><input type="number" value={data.riscossioni || ''} onChange={(e) => handleChange('riscossioni', e.target.value)} className="w-24 text-right font-bold text-slate-700 bg-transparent outline-none border-b border-slate-200 focus:border-emerald-400" placeholder="0"/></div>
                </div>
                <div className="space-y-2 border-t border-slate-100 pt-3">{[{ label: "Crediti Clienti", field: "crediti" }, { label: "POS / Carte", field: "pos" }, { label: "Buoni Carburante", field: "buoniCarburante" }].map(item => (<div key={item.field} className="flex justify-between items-center"><span className="text-sm font-medium text-red-500 flex items-center gap-1">(-) {item.label}</span><input type="number" value={data[item.field] || ''} onChange={(e) => handleChange(item.field, e.target.value)} className="w-24 text-right font-bold text-slate-700 bg-transparent outline-none border-b border-slate-200 focus:border-red-400" placeholder="0"/></div>))}</div>
                <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center"><span className="font-bold text-slate-400 text-xs uppercase">Totale Teorico</span><span className="font-extrabold text-xl text-slate-800">{formatEUR(totaleContanteTeorico)}</span></div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Coins size={14} className="text-yellow-500"/> Conteggio Cassa</h3>
                <div className="grid grid-cols-1 gap-2 mb-4">{[500, 200, 100, 50, 20, 10, 5].map(denom => (<div key={denom} className="flex items-center bg-slate-50 rounded-lg p-1 pr-3"><div className="w-16 py-2 bg-white rounded-md text-center text-xs font-bold text-slate-600 shadow-sm border border-slate-100">€ {denom}</div><input type="number" value={cashBreakdown[denom] || ''} onChange={(e) => handleCashChange(denom, e.target.value)} placeholder="0" className="flex-1 bg-transparent text-center font-bold text-lg text-blue-900 outline-none"/><div className="w-16 text-right text-[10px] text-slate-400 font-medium">{denom * (cashBreakdown[denom] || 0) > 0 ? formatNum(denom * (cashBreakdown[denom] || 0)) : '-'}</div></div>))}</div>
                <div className="grid grid-cols-2 gap-3 mb-3"><div className="bg-slate-50 p-2 rounded-lg"><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Monete</label><input type="number" value={data.totaleMonete || ''} onChange={(e) => handleChange('totaleMonete', e.target.value)} className="w-full bg-white border border-slate-200 rounded p-2 text-right font-bold text-slate-700" placeholder="0"/></div><div className="bg-slate-50 p-2 rounded-lg"><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Assegni</label><input type="number" value={data.totaleAssegni || ''} onChange={(e) => handleChange('totaleAssegni', e.target.value)} className="w-full bg-white border border-slate-200 rounded p-2 text-right font-bold text-slate-700" placeholder="0"/></div></div>
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex justify-between items-center"><span className="text-xs font-bold text-emerald-700">(+) Fondo Cassa</span><input type="number" value={data.soldiLasciatiMattina || ''} onChange={(e) => handleChange('soldiLasciatiMattina', e.target.value)} className="w-24 text-right bg-transparent font-bold text-lg text-emerald-700 outline-none" placeholder="0"/></div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 h-full flex flex-col justify-between">
                <div>
                    <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><ShoppingBag size={14} className="text-purple-500"/> Quadratura</h3>
                    <div className="bg-slate-800 text-white p-4 rounded-xl shadow-lg mb-4 flex justify-between items-center"><span className="text-xs font-bold text-slate-400 uppercase">Totale Reale</span><span className="text-2xl font-extrabold">{formatEUR(soldiIncassatiTotali)}</span></div>
                    <div className={`p-5 rounded-xl border-2 text-center transition-colors ${differenza === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Differenza</div><div className={`text-4xl font-black ${differenza === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{differenza > 0 ? '+' : ''}{formatEUR(differenza)}</div><div className="mt-2 flex justify-center">{differenza === 0 ? <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1"><CheckCircle size={12}/> Perfetto</span> : <span className="bg-rose-100 text-rose-700 text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1"><AlertCircle size={12}/> Errore</span>}</div></div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100">
                    <button onClick={analyzeDiscrepancy} disabled={isAnalyzing} className="w-full py-3 rounded-xl bg-indigo-50 text-indigo-600 font-bold active:bg-indigo-100 transition-colors flex items-center justify-center gap-2 text-sm">{isAnalyzing ? "..." : <><Sparkles size={16}/> Analizza con AI</>}</button>
                    {aiAnalysis && <div className="mt-3 text-sm text-slate-600 bg-white p-3 rounded-lg border border-slate-100 shadow-sm animate-in fade-in">{aiAnalysis}</div>}
                </div>
            </div>
          </div>
        </div>
      </div>
      {showProductModal && (<div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end md:items-center justify-center"><div className="bg-white w-full md:w-[600px] md:rounded-2xl rounded-t-2xl h-[90vh] md:h-[80vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300"><div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl"><div><h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Package size={20} className="text-indigo-600"/> Prodotti & Accessori</h2><p className="text-xs text-slate-500">I prodotti salvati qui rimangono validi tutto l'anno</p></div><button onClick={() => setShowProductModal(false)} className="p-2 bg-white rounded-full shadow-sm text-slate-500 hover:text-red-500"><X size={20}/></button></div><div className="flex-1 overflow-y-auto p-4 space-y-3">{products.length === 0 && <div className="text-center py-10 text-slate-400"><Package size={48} className="mx-auto mb-2 opacity-20"/><p>Nessun prodotto nel catalogo.</p><p className="text-xs">Premi "+" per aggiungere.</p></div>}{products.map((prod) => (<div key={prod.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col gap-2"><div className="flex justify-between items-start gap-2"><input type="text" placeholder="Nome Prodotto" value={prod.name} onChange={(e) => updateProduct(prod.id, 'name', e.target.value)} className="font-bold text-slate-700 outline-none w-full placeholder-slate-300"/><button onClick={() => removeProduct(prod.id)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={18}/></button></div><div className="flex gap-2 items-center"><div className="flex-1 bg-slate-50 rounded-lg p-2 border border-slate-100"><label className="text-[10px] font-bold text-slate-400 uppercase block">Prezzo</label><input type="number" value={prod.price || ''} onChange={(e) => updateProduct(prod.id, 'price', e.target.value)} className="w-full bg-transparent font-bold text-slate-800 outline-none" placeholder="0.00"/></div><div className="flex-1 bg-slate-50 rounded-lg p-2 border border-slate-100"><label className="text-[10px] font-bold text-indigo-300 uppercase block">Agio (Utile)</label><input type="number" value={prod.agio || ''} onChange={(e) => updateProduct(prod.id, 'agio', e.target.value)} className="w-full bg-transparent font-bold text-indigo-600 outline-none" placeholder="0.00"/></div><div className="w-24 bg-yellow-50 rounded-lg p-2 border border-yellow-200"><label className="text-[10px] font-bold text-yellow-600 uppercase block text-center">Venduti Oggi</label><input type="number" value={prod.qty || ''} onChange={(e) => updateProduct(prod.id, 'qty', e.target.value)} className="w-full bg-transparent font-bold text-slate-800 outline-none text-center text-lg" placeholder="0"/></div></div><div className="flex justify-between items-center pt-1 border-t border-slate-50 text-xs"><span className="text-slate-400">Totale riga: <b>{formatEUR((prod.price || 0) * (prod.qty || 0))}</b></span>{prod.agio > 0 && <span className="text-indigo-500 font-bold">Guadagno: {formatEUR((prod.agio || 0) * (prod.qty || 0))}</span>}</div></div>))}</div><div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl"><div className="flex justify-between items-center mb-4 text-sm"><span className="text-slate-500">Totale Vendita Oggi:</span><span className="font-bold text-xl text-slate-800">{formatEUR(totaleAccessori)}</span></div>{totaleAgio > 0 && <div className="flex justify-between items-center mb-4 text-xs"><span className="text-indigo-400 flex items-center gap-1"><TrendingUp size={12}/> Guadagno Totale Oggi:</span><span className="font-bold text-indigo-600">{formatEUR(totaleAgio)}</span></div>}<button onClick={addProduct} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"><Plus size={20}/> Nuovo Prodotto al Catalogo</button></div></div></div>)}
      {showReportModal && (<div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center"><div className="bg-white w-full md:w-[700px] md:rounded-2xl rounded-t-2xl h-[90vh] md:h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300"><div className="p-5 border-b border-slate-100 flex justify-between items-center bg-indigo-50 rounded-t-2xl"><div><h2 className="text-xl font-bold text-indigo-900 flex items-center gap-2"><PieChart size={24} className="text-indigo-600"/> Report Mensile</h2><p className="text-sm text-indigo-400">Analisi completa: {currentDate.slice(0, 7)}</p></div><button onClick={() => setShowReportModal(false)} className="p-2 bg-white/50 rounded-full hover:bg-white text-indigo-900"><X size={20}/></button></div><div className="flex-1 overflow-y-auto p-5">{loadingReport ? (<div className="flex flex-col items-center justify-center h-full text-slate-400"><Sparkles className="animate-spin mb-2" size={32}/><p>Sto analizzando tutti i giorni del mese...</p></div>) : monthlyStats ? (<div className="space-y-6"><div className="grid grid-cols-2 gap-4"><div className="bg-indigo-600 text-white p-4 rounded-xl shadow-lg"><div className="text-xs font-bold opacity-70 uppercase mb-1">Guadagno Accessori</div><div className="text-2xl font-bold">{formatEUR(monthlyStats.totalAgio)}</div><div className="text-[10px] opacity-70 mt-1">Totale Agio (Utile) nel mese</div></div><div className={`p-4 rounded-xl shadow-lg text-white ${monthlyStats.totalDiff >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}><div className="text-xs font-bold opacity-70 uppercase mb-1">Somma Differenze</div><div className="text-2xl font-bold">{monthlyStats.totalDiff > 0 ? '+' : ''}{formatEUR(monthlyStats.totalDiff)}</div><div className="text-[10px] opacity-70 mt-1">Bilancio cassa netto</div></div></div><div><h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Calendar size={16} /> Dettaglio Giornaliero</h3><div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden"><table className="w-full text-sm"><thead className="bg-slate-100 text-slate-500 font-bold text-xs uppercase"><tr><th className="p-3 text-left">Giorno</th><th className="p-3 text-right">Utile Accessori</th><th className="p-3 text-right">Differenza Cassa</th></tr></thead><tbody className="divide-y divide-slate-200">{monthlyStats.daysData.map((day, idx) => (<tr key={idx} className="hover:bg-white transition-colors"><td className="p-3 font-medium text-slate-700">{day.date}</td><td className="p-3 text-right text-indigo-600 font-bold">{formatEUR(day.agio)}</td><td className={`p-3 text-right font-bold ${day.diff === 0 ? 'text-emerald-600' : day.diff < 0 ? 'text-rose-500' : 'text-amber-500'}`}>{day.diff > 0 ? '+' : ''}{formatEUR(day.diff)}</td></tr>))}</tbody></table></div></div></div>) : null}</div><div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl text-center text-xs text-slate-400">Il calcolo considera tutti i giorni salvati con prefisso {shopId}</div></div></div>)}

    </div>
  );
};

export default DailyCashSheet;