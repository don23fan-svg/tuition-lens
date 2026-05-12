import React, { useState, useEffect, useMemo } from 'react';

// ============================================================================
// TUITION LENS v3 — Production version using real IPEDS 2024-25 data
// 1,569 four-year non-profit institutions with verified cost and admit data
// ============================================================================
//
// To deploy: place schools_data.json in the same directory as this component,
// or modify the fetch URL below to point to your hosted data file.
// ============================================================================

const FALLBACK_SCHOOLS = [
  { id: 185590, name: 'Montclair State University', state: 'NJ', city: 'Montclair', region: 'Mid-Atlantic', isPublic: true, tuitionIS: 15912, tuitionOOS: 26022, books: 1500, roomBoardOn: 16730, otherOn: 2360, admitRate: 0.88, enrollment: 20151 },
  { id: 186380, name: 'Rutgers University-New Brunswick', state: 'NJ', city: 'New Brunswick', region: 'Mid-Atlantic', isPublic: true, tuitionIS: 17929, tuitionOOS: 37441, books: 1340, roomBoardOn: 15714, otherOn: 2360, admitRate: 0.58, enrollment: 41428 },
  { id: 134130, name: 'University of Florida', state: 'FL', city: 'Gainesville', region: 'Southeast', isPublic: true, tuitionIS: 6381, tuitionOOS: 28659, books: 1340, roomBoardOn: 12120, otherOn: 2400, admitRate: 0.24, enrollment: 38246 }
];

// Merit aid scholarship thresholds — these are school-published, not user-configured
// Auto-applied if student meets the GPA/SAT criteria
const MERIT_OVERLAYS = {
  185590: { autoMerit: [
      { name: 'Presidential Scholarship (entry)', minGPA: 3.4, minSAT: 0, amount: 2000 },
      { name: 'Presidential Scholarship (mid)', minGPA: 3.6, minSAT: 1200, amount: 3500 },
      { name: 'Presidential Scholarship (top)', minGPA: 3.7, minSAT: 1300, amount: 5000 }] },
  186380: { autoMerit: [
      { name: 'Scarlet Scholarship', minGPA: 3.6, minSAT: 1300, amount: 3000 },
      { name: "Dean's Scholarship", minGPA: 3.7, minSAT: 1350, amount: 6000 },
      { name: 'Presidential Scholarship', minGPA: 3.9, minSAT: 1450, amount: 12000 }] },
  100751: { autoMerit: [
      { name: 'Crimson Scholar', minGPA: 3.5, minSAT: 1230, amount: 18000 },
      { name: 'Capstone Scholar', minGPA: 3.5, minSAT: 1290, amount: 22000 },
      { name: 'Foundation in Excellence', minGPA: 3.5, minSAT: 1330, amount: 26000 },
      { name: 'Presidential Elite', minGPA: 3.5, minSAT: 1420, amount: 33000 }] },
  106397: { autoMerit: [
      { name: 'NRTA Scholarship', minGPA: 3.2, minSAT: 0, amount: 12000 },
      { name: 'NRTA Plus', minGPA: 3.6, minSAT: 0, amount: 14000 },
      { name: 'NRTA Max', minGPA: 3.8, minSAT: 0, amount: 16000 }] },
  176017: { autoMerit: [
      { name: 'Academic Excellence (mid)', minGPA: 3.0, minSAT: 1170, amount: 13000 },
      { name: 'Academic Excellence (high)', minGPA: 3.25, minSAT: 1230, amount: 18000 },
      { name: 'Academic Excellence (top)', minGPA: 3.5, minSAT: 1290, amount: 22500 }] },
  157085: { autoMerit: [
      { name: 'Provost Award', minGPA: 3.3, minSAT: 1200, amount: 8000 },
      { name: 'Wildcat Award', minGPA: 3.5, minSAT: 1240, amount: 14000 },
      { name: 'Presidential Award', minGPA: 3.8, minSAT: 1340, amount: 22000 }] },
  218663: { autoMerit: [
      { name: 'Carolina Scholar (basic)', minGPA: 3.5, minSAT: 1240, amount: 14000 },
      { name: 'Carolina Scholar (top)', minGPA: 3.8, minSAT: 1390, amount: 22000 }] }
};

// US state abbreviations for the home state dropdown
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'];

// Waiver types — apply to selected schools
// 'percentage' — reduces tuition by X%
// 'flatTuition' — replaces tuition with a fixed amount (e.g., FL Grandparent Waiver gives in-state rate)
// 'flatAmount' — fixed dollar reduction applied per year

const REGIONS = ['All', 'Mid-Atlantic', 'New England', 'Southeast', 'Midwest', 'Southwest', 'West'];

const formatCurrency = (n) => Math.abs(n) < 0.5 ? '$0' : '$' + Math.round(n).toLocaleString();
const formatCurrencyShort = (n) => Math.abs(n) >= 1000 ? '$' + (n / 1000).toFixed(1) + 'k' : '$' + Math.round(n);

function getAdmitLikelihood(school, studentSAT) {
  // Combined logic: use SAT positioning if available, fall back to admit rate
  const a = school.admitRate;
  const has25 = school.sat25 != null;
  const has75 = school.sat75 != null;

  if (studentSAT && has25 && has75) {
    // Student SAT vs school's range
    if (studentSAT >= school.sat75) {
      // Above 75th percentile
      if (a && a >= 0.50) return 'safety';
      if (a && a >= 0.25) return 'likely';
      return 'target';
    }
    if (studentSAT >= (school.sat25 + school.sat75) / 2) {
      // Between 50-75th
      if (a && a >= 0.60) return 'likely';
      if (a && a >= 0.30) return 'target';
      return 'reach';
    }
    if (studentSAT >= school.sat25) {
      // Between 25-50th
      if (a && a >= 0.70) return 'likely';
      if (a && a >= 0.40) return 'target';
      return 'reach';
    }
    // Below 25th
    if (a && a >= 0.80) return 'target';
    if (a && a >= 0.50) return 'reach';
    return 'unlikely';
  }

  // Fall back to admit rate only
  if (!a) return null;
  if (a >= 0.80) return 'safety';
  if (a >= 0.60) return 'likely';
  if (a >= 0.40) return 'target';
  if (a >= 0.20) return 'reach';
  return 'unlikely';
}

function getSATFit(school, studentSAT) {
  if (!studentSAT || school.sat25 == null || school.sat75 == null) return null;
  if (studentSAT >= school.sat75) return 'above';
  if (studentSAT >= school.sat25) return 'within';
  return 'below';
}

function getMatchingScholarships(overlay, gpa, sat) {
  if (!overlay?.autoMerit) return [];
  if (!gpa || !sat) return overlay.autoMerit;
  return overlay.autoMerit.filter((s) => gpa >= s.minGPA && sat >= s.minSAT);
}

function getBestScholarship(overlay, gpa, sat) {
  const m = getMatchingScholarships(overlay, gpa, sat);
  return m.length ? m.reduce((b, s) => s.amount > b.amount ? s : b, m[0]) : null;
}

function project529WithContributions(currentBalance, monthlyContrib, annualGrowthPct, yearsToCollege) {
  // Monthly growth from contributions: future value of annuity + future value of starting balance
  if (yearsToCollege <= 0) return currentBalance;
  const monthlyRate = (annualGrowthPct / 100) / 12;
  const months = yearsToCollege * 12;
  const monthly = monthlyContrib || 0;

  // FV of starting balance at compound growth
  const fvBalance = currentBalance * Math.pow(1 + monthlyRate, months);

  // FV of monthly contributions (annuity)
  let fvContribs = 0;
  if (monthly > 0) {
    if (Math.abs(monthlyRate) < 1e-9) {
      fvContribs = monthly * months;
    } else {
      fvContribs = monthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
    }
  }

  return fvBalance + fvContribs;
}

function calculateScenario({ schools, settings, scenarios529, student, schoolsLib }) {
  const { startYear, coaInflation, growth529Pre, growth529During, parentAnnualContribution, studentAnnualContribution, federalLoansUsed } = settings;
  const yearsToStart = Math.max(0, startYear - 2025);
  const totalBalance529AtStart = scenarios529.reduce(
    (sum, s) => sum + project529WithContributions(s.balance, s.monthlyContrib || 0, growth529Pre, yearsToStart),
    0
  );

  return schools.map((cfg) => {
    const base = schoolsLib.find((s) => s.id === cfg.id);
    if (!base) return null;
    const merit = MERIT_OVERLAYS[cfg.id] || {};
    const school = { ...base, ...merit };
    const { useCommuter, useMerit = true, customMerit = 0, enabledWaiverIds = [] } = cfg;

    // Find applicable waivers — only those user enabled AND that apply to this school
    const userWaivers = settings.waivers || [];
    const applicableWaivers = userWaivers.filter(
      (w) => enabledWaiverIds.includes(w.id) && (w.appliesToSchoolIds || []).includes(school.id)
    );

    let runningBalance = totalBalance529AtStart;
    const years = [];
    let totalCOA = 0, total529Used = 0, totalParentPaid = 0, totalStudentPaid = 0, totalLoansUsed = 0, totalShortfall = 0, totalMerit = 0;

    let bestMerit = null;
    if (useMerit && merit.autoMerit) {
      bestMerit = getBestScholarship(merit, student.gpa, student.sat);
    }
    const meritAmount = (bestMerit ? bestMerit.amount : 0) + customMerit;

    function getYearTuition(mult) {
      // Determine base tuition based on home state
      const isInState = settings.homeState && school.state === settings.homeState;
      let baseTuition = (!school.isPublic || isInState) ? school.tuitionIS : school.tuitionOOS;

      // Apply waivers (stacking: percentage applies first, then flat amounts subtract)
      let tuition = baseTuition;
      for (const w of applicableWaivers) {
        if (w.type === 'percentage') {
          tuition = tuition * (1 - (w.value || 0) / 100);
        } else if (w.type === 'flatTuition') {
          tuition = w.value || 0; // replaces tuition entirely
        } else if (w.type === 'flatAmount') {
          tuition = Math.max(0, tuition - (w.value || 0));
        }
      }
      return tuition * mult;
    }

    function getYearTravel(mult) {
      // Travel cost depends on distance from home state
      const isInState = settings.homeState && school.state === settings.homeState;
      const baseTravel = isInState ? 800 : 1500;
      return baseTravel * mult;
    }

    for (let yr = 0; yr < 4; yr++) {
      const mult = Math.pow(1 + coaInflation / 100, yearsToStart + yr);
      const tuition = getYearTuition(mult);
      let roomBoard = school.roomBoardOn || 12000;
      // Commuter mode reduces room/board to reflect living at home
      if (useCommuter) roomBoard = 7500;
      const housingCost = roomBoard * mult;
      const books = (school.books || 1340) * mult;
      const personal = (school.otherOn || 2360) * mult;
      const travel = getYearTravel(mult);
      const yrCOA = tuition + housingCost + books + personal + travel;
      const yrMerit = meritAmount * mult;
      const yrCOAAfter = Math.max(0, yrCOA - yrMerit);

      let rem = yrCOAAfter;
      const draw529 = Math.min(rem, runningBalance);
      rem -= draw529;
      runningBalance -= draw529;
      if (runningBalance > 0) runningBalance *= 1 + growth529During / 100;

      const parentPays = Math.min(rem, parentAnnualContribution);
      rem -= parentPays;
      const studentPays = Math.min(rem, studentAnnualContribution);
      rem -= studentPays;

      const loanLim = [5500, 6500, 7500, 7500][yr];
      const loansUsed = federalLoansUsed ? Math.min(rem, loanLim) : 0;
      rem -= loansUsed;

      totalCOA += yrCOA;
      totalMerit += yrMerit;
      total529Used += draw529;
      totalParentPaid += parentPays;
      totalStudentPaid += studentPays;
      totalLoansUsed += loansUsed;
      totalShortfall += rem;

      years.push({
        year: yr + 1, calYear: startYear + yr,
        coa: yrCOA, meritAid: yrMerit,
        from529: draw529, fromParent: parentPays, fromStudent: studentPays,
        fromLoans: loansUsed, shortfall: rem
      });
    }

    return {
      ...school, schoolConfig: cfg, bestMerit,
      admitLikelihood: getAdmitLikelihood(school, student.sat),
      years,
      totals: { coa: totalCOA, meritAid: totalMerit, from529: total529Used,
        fromParent: totalParentPaid, fromStudent: totalStudentPaid,
        fromLoans: totalLoansUsed, shortfall: totalShortfall }
    };
  }).filter(Boolean);
}

export default function CollegePlanner() {
  const [schoolsLib, setSchoolsLib] = useState(FALLBACK_SCHOOLS);
  const [libLoading, setLibLoading] = useState(true);
  const [libError, setLibError] = useState(null);

  const [settings, setSettings] = useState({
    studentName: '',
    homeState: '',
    startYear: 2030,
    coaInflation: 5,
    growth529Pre: 5,
    growth529During: 3,
    parentAnnualContribution: 0,
    studentAnnualContribution: 0,
    federalLoansUsed: false,
    waivers: []
  });

  const [student, setStudent] = useState({ gpa: 3.5, sat: 1200 });

  const [scenarios529, setScenarios529] = useState([]);

  const [selectedSchools, setSelectedSchools] = useState([]);

  const [savedScenarios, setSavedScenarios] = useState([]);
  const [activeTab, setActiveTab] = useState('compare');
  const [storageLoaded, setStorageLoaded] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState('All');
  const [filterState, setFilterState] = useState('');
  const [filterMerit, setFilterMerit] = useState(false);
  const [filterPublic, setFilterPublic] = useState(false);
  const [filterAdmit, setFilterAdmit] = useState('All');
  const [filterSATFit, setFilterSATFit] = useState('All'); // All, Above, Within, Below
  const [sortBy, setSortBy] = useState('default'); // default, cheapest, mostSelective, leastSelective, bestMerit

  useEffect(() => {
    fetch('schools_data.json')
      .then((r) => { if (!r.ok) throw new Error('Could not load schools data'); return r.json(); })
      .then((data) => { setSchoolsLib(data); setLibLoading(false); })
      .catch((e) => { setLibError(e.message); setLibLoading(false); });
  }, []);

  useEffect(() => {
    async function load() {
      try { const s = await window.storage.get('settings_v3'); if (s?.value) setSettings(JSON.parse(s.value)); } catch {}
      try { const s = await window.storage.get('student_v3'); if (s?.value) setStudent(JSON.parse(s.value)); } catch {}
      try { const s = await window.storage.get('funds529_v3'); if (s?.value) setScenarios529(JSON.parse(s.value)); } catch {}
      try { const s = await window.storage.get('selectedSchools_v3'); if (s?.value) setSelectedSchools(JSON.parse(s.value)); } catch {}
      try { const s = await window.storage.get('savedScenarios_v3'); if (s?.value) setSavedScenarios(JSON.parse(s.value)); } catch {}
      setStorageLoaded(true);
    }
    load();
  }, []);

  useEffect(() => { if (storageLoaded) window.storage.set('settings_v3', JSON.stringify(settings)).catch(() => {}); }, [settings, storageLoaded]);
  useEffect(() => { if (storageLoaded) window.storage.set('student_v3', JSON.stringify(student)).catch(() => {}); }, [student, storageLoaded]);
  useEffect(() => { if (storageLoaded) window.storage.set('funds529_v3', JSON.stringify(scenarios529)).catch(() => {}); }, [scenarios529, storageLoaded]);
  useEffect(() => { if (storageLoaded) window.storage.set('selectedSchools_v3', JSON.stringify(selectedSchools)).catch(() => {}); }, [selectedSchools, storageLoaded]);
  useEffect(() => { if (storageLoaded) window.storage.set('savedScenarios_v3', JSON.stringify(savedScenarios)).catch(() => {}); }, [savedScenarios, storageLoaded]);

  const results = useMemo(() => calculateScenario({ schools: selectedSchools, settings, scenarios529, student, schoolsLib }),
    [selectedSchools, settings, scenarios529, student, schoolsLib]);

  const total529 = scenarios529.reduce((sum, s) => sum + s.balance, 0);
  const total529AtCollege = scenarios529.reduce((sum, s) => sum + project529WithContributions(s.balance, s.monthlyContrib || 0, settings.growth529Pre, Math.max(0, settings.startYear - 2025)), 0);
  const totalMonthlyContrib = scenarios529.reduce((sum, s) => sum + (s.monthlyContrib || 0), 0);
  const yearsUntilStart = Math.max(0, settings.startYear - 2025);
  const totalContribsOverPeriod = totalMonthlyContrib * 12 * yearsUntilStart;

  function matchesFilters(s, selectedIds) {
    if (selectedIds.has(s.id)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !(s.state || '').toLowerCase().includes(q) && !(s.city || '').toLowerCase().includes(q)) return false;
    }
    if (filterRegion !== 'All' && s.region !== filterRegion) return false;
    if (filterState && s.state !== filterState.toUpperCase()) return false;
    if (filterPublic && !s.isPublic) return false;
    if (filterMerit) {
      const overlay = MERIT_OVERLAYS[s.id];
      if (!overlay) return false;
      if (getMatchingScholarships(overlay, student.gpa, student.sat).length === 0) return false;
    }
    if (filterAdmit !== 'All' && getAdmitLikelihood(s, student.sat) !== filterAdmit.toLowerCase()) return false;
    if (filterSATFit !== 'All') {
      const fit = getSATFit(s, student.sat);
      if (!fit) return false;
      if (filterSATFit === 'Above' && fit !== 'above') return false;
      if (filterSATFit === 'Within' && fit !== 'within') return false;
      if (filterSATFit === 'Below' && fit !== 'below') return false;
    }
    return true;
  }

  function getNetCostEstimate(s) {
    const overlay = MERIT_OVERLAYS[s.id];
    const tuition = (!s.isPublic || s.state === 'NJ') ? s.tuitionIS : s.tuitionOOS;
    const sticker = tuition + (s.roomBoardOn || 12000) + (s.books || 1340) + (s.otherOn || 2360);
    const best = overlay ? getBestScholarship(overlay, student.gpa, student.sat) : null;
    return sticker - (best ? best.amount : 0);
  }

  const filterStats = useMemo(() => {
    const selectedIds = new Set(selectedSchools.map((s) => s.id));
    let all = schoolsLib.filter((s) => matchesFilters(s, selectedIds));

    // Apply sort
    if (sortBy === 'cheapest') {
      all = [...all].sort((a, b) => getNetCostEstimate(a) - getNetCostEstimate(b));
    } else if (sortBy === 'mostSelective') {
      all = [...all].sort((a, b) => (a.admitRate ?? 1) - (b.admitRate ?? 1));
    } else if (sortBy === 'leastSelective') {
      all = [...all].sort((a, b) => (b.admitRate ?? 0) - (a.admitRate ?? 0));
    } else if (sortBy === 'bestMerit') {
      all = [...all].sort((a, b) => {
        const aMerit = MERIT_OVERLAYS[a.id] ? (getBestScholarship(MERIT_OVERLAYS[a.id], student.gpa, student.sat)?.amount || 0) : 0;
        const bMerit = MERIT_OVERLAYS[b.id] ? (getBestScholarship(MERIT_OVERLAYS[b.id], student.gpa, student.sat)?.amount || 0) : 0;
        return bMerit - aMerit;
      });
    }

    return { all, displayed: all.slice(0, 100), total: all.length };
  }, [schoolsLib, selectedSchools, searchQuery, filterRegion, filterState, filterMerit, filterPublic, filterAdmit, filterSATFit, sortBy, student]);

  function addSchool(id) {
    if (selectedSchools.find((s) => s.id === id)) return;
    // Auto-enable any waivers that apply to this school
    const applicableWaiverIds = (settings.waivers || [])
      .filter((w) => (w.appliesToSchoolIds || []).includes(id))
      .map((w) => w.id);
    setSelectedSchools([...selectedSchools, { id, useCommuter: false, useMerit: true, customMerit: 0, enabledWaiverIds: applicableWaiverIds }]);
    setActiveTab('compare');
  }

  function removeSchool(id) { setSelectedSchools(selectedSchools.filter((s) => s.id !== id)); }
  function updateSchoolConfig(id, key, value) {
    setSelectedSchools(selectedSchools.map((s) => s.id === id ? { ...s, [key]: value } : s));
  }

  function saveCurrentScenario() {
    const name = prompt('Name this scenario:');
    if (!name) return;
    setSavedScenarios([{ id: Date.now().toString(), name, timestamp: new Date().toISOString(),
      settings, student, scenarios529, selectedSchools }, ...savedScenarios]);
  }

  function loadScenario(s) {
    setSettings(s.settings);
    if (s.student) setStudent(s.student);
    setScenarios529(s.scenarios529);
    setSelectedSchools(s.selectedSchools);
    setActiveTab('compare');
  }

  function deleteScenario(id) { setSavedScenarios(savedScenarios.filter((s) => s.id !== id)); }

  return (
    <div className="min-h-screen bg-stone-50" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Fraunces', Georgia, serif; }
        .school-row:hover { background: rgba(0,0,0,0.02); }
        .accent-bar { background: linear-gradient(90deg, #064e3b 0%, #047857 100%); }
        input[type=range] { accent-color: #047857; }
      `}</style>

      <div className="accent-bar text-white">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Tuition Lens</h1>
            <p className="text-emerald-100 text-sm mt-1">
              {settings.studentName ? `${settings.studentName} · ` : ''}GPA {student.gpa.toFixed(1)} · SAT {student.sat} · Start {settings.startYear}
              {libLoading ? ' · Loading data...' : libError ? ' · Sample data' : ` · ${schoolsLib.length.toLocaleString()} schools`}
            </p>
          </div>
          <div className="text-right text-sm">
            <div className="text-emerald-100">529 funds</div>
            <div className="text-white font-medium">{formatCurrency(total529)} → {formatCurrency(total529AtCollege)}</div>
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {[
            { id: 'compare', label: 'Compare' },
            { id: 'search', label: `Find schools (${schoolsLib.length.toLocaleString()})` },
            { id: 'student', label: 'Profile' },
            { id: 'settings', label: 'Settings' },
            { id: 'funds', label: '529 Funds' },
            { id: 'saved', label: `Saved (${savedScenarios.length})` }
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-all ${
                activeTab === tab.id ? 'border-emerald-700 text-emerald-700' : 'border-transparent text-stone-500 hover:text-stone-900'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'compare' && (
          <>
            <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
              <h2 className="font-display text-2xl font-medium">4-year cost comparison</h2>
              <button onClick={saveCurrentScenario}
                className="px-4 py-2 bg-emerald-700 text-white text-sm font-medium rounded-md hover:bg-emerald-800">
                Save scenario
              </button>
            </div>
            <div className="grid gap-4 mb-6">
              {results.map((r) => (
                <SchoolResultCard key={r.id} result={r} onRemove={() => removeSchool(r.id)}
                  onUpdateConfig={(k, v) => updateSchoolConfig(r.id, k, v)} settings={settings} />
              ))}
            </div>
            {results.length === 0 && (
              <div className="bg-white border border-stone-200 rounded-lg p-8">
                <div className="text-center mb-6">
                  <h3 className="font-display text-xl font-medium text-stone-900 mb-2">Welcome to Tuition Lens</h3>
                  <p className="text-stone-600 text-sm max-w-md mx-auto">
                    Compare 4-year cost projections for any US college, model 529 drawdowns, and see what your family will actually pay.
                  </p>
                </div>
                <div className="max-w-md mx-auto space-y-3">
                  <div className="flex items-start gap-3 p-3 border border-stone-200 rounded-lg">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-medium flex-shrink-0">1</div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-stone-800">Set up your family</div>
                      <div className="text-xs text-stone-500 mt-0.5">Add student profile, home state, 529 balances, and any special situations like employer tuition waivers.</div>
                      <button onClick={() => setActiveTab('settings')}
                        className="mt-2 text-xs font-medium text-emerald-700 hover:text-emerald-900">Go to settings →</button>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 border border-stone-200 rounded-lg">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-medium flex-shrink-0">2</div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-stone-800">Find schools to compare</div>
                      <div className="text-xs text-stone-500 mt-0.5">Search {schoolsLib.length.toLocaleString()} US colleges with real IPEDS cost and admissions data.</div>
                      <button onClick={() => setActiveTab('search')}
                        className="mt-2 text-xs font-medium text-emerald-700 hover:text-emerald-900">Browse schools →</button>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 border border-stone-200 rounded-lg">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-medium flex-shrink-0">3</div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-stone-800">Compare and save scenarios</div>
                      <div className="text-xs text-stone-500 mt-0.5">Toggle assumptions like commuter status or merit aid to see real-time cost differences.</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {results.length > 0 && (
              <div className="mt-8 bg-white border border-stone-200 rounded-lg p-6 overflow-x-auto">
                <h3 className="font-display text-xl font-medium mb-4">Total out-of-pocket</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200">
                      <th className="text-left py-2 font-medium text-stone-600">School</th>
                      <th className="text-right py-2 font-medium text-stone-600">4-yr COA</th>
                      <th className="text-right py-2 font-medium text-stone-600">Merit</th>
                      <th className="text-right py-2 font-medium text-stone-600">529</th>
                      <th className="text-right py-2 font-medium text-stone-600">You pay</th>
                      <th className="text-right py-2 font-medium text-stone-600">Student</th>
                      <th className="text-right py-2 font-medium text-stone-600">Loans</th>
                      <th className="text-right py-2 font-medium text-stone-600">Gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.id} className="school-row border-b border-stone-100">
                        <td className="py-3 font-medium">{r.name}</td>
                        <td className="text-right py-3">{formatCurrencyShort(r.totals.coa)}</td>
                        <td className="text-right py-3 text-emerald-700">{r.totals.meritAid > 0 ? '−' + formatCurrencyShort(r.totals.meritAid) : '—'}</td>
                        <td className="text-right py-3 text-emerald-700">{formatCurrencyShort(r.totals.from529)}</td>
                        <td className="text-right py-3">{formatCurrencyShort(r.totals.fromParent)}</td>
                        <td className="text-right py-3">{formatCurrencyShort(r.totals.fromStudent)}</td>
                        <td className="text-right py-3">{r.totals.fromLoans > 0 ? formatCurrencyShort(r.totals.fromLoans) : '—'}</td>
                        <td className={`text-right py-3 font-medium ${r.totals.shortfall > 0.5 ? 'text-red-600' : 'text-stone-400'}`}>
                          {r.totals.shortfall > 0.5 ? formatCurrencyShort(r.totals.shortfall) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTab === 'search' && (
          <SearchTab schoolsLib={schoolsLib} filterStats={filterStats}
            searchQuery={searchQuery} setSearchQuery={setSearchQuery}
            filterRegion={filterRegion} setFilterRegion={setFilterRegion}
            filterState={filterState} setFilterState={setFilterState}
            filterMerit={filterMerit} setFilterMerit={setFilterMerit}
            filterPublic={filterPublic} setFilterPublic={setFilterPublic}
            filterAdmit={filterAdmit} setFilterAdmit={setFilterAdmit}
            filterSATFit={filterSATFit} setFilterSATFit={setFilterSATFit}
            sortBy={sortBy} setSortBy={setSortBy}
            student={student} settings={settings} onAdd={addSchool} />
        )}

        {activeTab === 'student' && (
          <div className="bg-white border border-stone-200 rounded-lg p-6 max-w-2xl">
            <h2 className="font-display text-2xl font-medium mb-6">Student profile</h2>
            <p className="text-sm text-stone-600 mb-6">
              GPA and SAT drive merit aid matching. Move the SAT slider and watch which schools open up.
            </p>
            <SettingSlider label="Unweighted GPA" min={2.5} max={4.0} step={0.1}
              value={student.gpa} onChange={(v) => setStudent({ ...student, gpa: v })}
              format={(v) => v.toFixed(1)} />
            <SettingSlider label="SAT score" min={900} max={1600} step={10}
              value={student.sat} onChange={(v) => setStudent({ ...student, sat: v })}
              format={(v) => v.toString()} />
            <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="text-sm font-medium text-emerald-900 mb-2">Snapshot</div>
              <div className="text-xs text-emerald-800 space-y-1">
                <div>GPA {student.gpa.toFixed(1)} ({student.gpa >= 3.8 ? 'top-tier' : student.gpa >= 3.5 ? 'strong' : student.gpa >= 3.3 ? 'solid' : 'developing'})</div>
                <div>SAT {student.sat} ({student.sat >= 1400 ? '94th+ %ile' : student.sat >= 1300 ? '85th+ %ile' : student.sat >= 1200 ? '74th+ %ile' : 'developing'})</div>
                <div className="pt-1 text-emerald-700 font-medium">
                  Auto-merit matches: {Object.entries(MERIT_OVERLAYS).filter(([id, o]) => getMatchingScholarships(o, student.gpa, student.sat).length > 0).length}
                </div>
              </div>
            </div>
            <div className="mt-4 bg-stone-100 border border-stone-200 rounded-lg p-4 text-xs text-stone-600">
              <strong>Note:</strong> IPEDS provides cost and admit rate data for all 1,569 schools. Merit aid eligibility thresholds are manually curated for the subset of schools with well-documented automatic awards (Alabama, Mississippi, Arkansas, Kentucky, South Carolina, MSU, Rutgers, etc.).
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-white border border-stone-200 rounded-lg p-6">
              <h2 className="font-display text-2xl font-medium mb-4">Family info</h2>
              <SettingField label="Student name" type="text" value={settings.studentName}
                onChange={(v) => setSettings({ ...settings, studentName: v })} />
              <div className="py-3 border-t border-stone-200">
                <label className="block text-sm font-medium text-stone-700 mb-1">Home state</label>
                <select value={settings.homeState}
                  onChange={(e) => setSettings({ ...settings, homeState: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded text-sm bg-white">
                  <option value="">— Select state —</option>
                  {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <p className="text-xs text-stone-500 mt-1">Determines in-state vs. out-of-state tuition. Public schools in this state will use in-state rates.</p>
              </div>
              <SettingField label="College start year" type="number" value={settings.startYear}
                onChange={(v) => setSettings({ ...settings, startYear: parseInt(v) || 2030 })}
                note={`${Math.max(0, settings.startYear - 2026)} years from now`} />
            </div>

            <div className="bg-white border border-stone-200 rounded-lg p-6">
              <div className="flex items-baseline justify-between mb-1">
                <h2 className="font-display text-2xl font-medium">529 funds & growth</h2>
                <button onClick={() => setActiveTab('funds')}
                  className="text-xs text-emerald-700 hover:text-emerald-900 font-medium">
                  Edit funds →
                </button>
              </div>
              <p className="text-sm text-stone-600 mb-4">Current 529 accounts. Edit balances and contributions on the 529 Funds tab.</p>

              <div className="space-y-2 mb-5">
                {scenarios529.length === 0 ? (
                  <button onClick={() => setActiveTab('funds')}
                    className="w-full text-sm text-stone-500 py-3 border border-dashed border-stone-300 rounded hover:border-emerald-400 hover:text-emerald-700">
                    + Add a 529 fund
                  </button>
                ) : (
                  scenarios529.map((fund) => (
                    <div key={fund.id} className="flex justify-between items-baseline py-2 px-3 bg-stone-50 rounded text-sm">
                      <div>
                        <div className="font-medium text-stone-800">{fund.label}</div>
                        {(fund.monthlyContrib || 0) > 0 && (
                          <div className="text-xs text-stone-500">+ {formatCurrency(fund.monthlyContrib)}/mo</div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(fund.balance)}</div>
                        <div className="text-xs text-stone-500">today</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <SettingSlider label="529 growth (until enrollment)" min={0} max={10} step={0.5}
                value={settings.growth529Pre} onChange={(v) => setSettings({ ...settings, growth529Pre: v })}
                format={(v) => `${v}%/yr`}
                note="Compound annual return assumption pre-college. S&P 500 avg ~7-10%; age-based 529 portfolios typically 5-7%." />
              <SettingSlider label="529 growth (during college)" min={0} max={6} step={0.5}
                value={settings.growth529During} onChange={(v) => setSettings({ ...settings, growth529During: v })}
                format={(v) => `${v}%/yr`}
                note="More conservative because funds are being drawn down." />

              <div className="mt-5 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="text-xs uppercase tracking-wide text-emerald-700 font-medium mb-2">Your 529 projection at fall {settings.startYear}</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-stone-700">Current balances</span>
                    <span className="font-medium">{formatCurrency(total529)}</span>
                  </div>
                  {totalMonthlyContrib > 0 && (
                    <div className="flex justify-between text-stone-700">
                      <span>+ Contributions ({formatCurrency(totalMonthlyContrib)}/mo × {yearsUntilStart}yr)</span>
                      <span className="font-medium text-emerald-700">+{formatCurrency(totalContribsOverPeriod)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-stone-700">
                    <span>+ Investment growth ({settings.growth529Pre}%/yr)</span>
                    <span className="font-medium text-emerald-700">+{formatCurrency(total529AtCollege - total529 - totalContribsOverPeriod)}</span>
                  </div>
                  <div className="flex justify-between pt-2 mt-2 border-t border-emerald-200 text-base">
                    <span className="font-medium text-emerald-900">Total available</span>
                    <span className="font-semibold text-emerald-900 font-display">{formatCurrency(total529AtCollege)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-stone-200 rounded-lg p-6">
              <h2 className="font-display text-2xl font-medium mb-1">Annual contributions during college</h2>
              <p className="text-sm text-stone-600 mb-4">How much you and your student will contribute each year toward college costs (separate from 529 drawdowns).</p>
              <SettingField label="Parent contribution per year" type="number" value={settings.parentAnnualContribution}
                onChange={(v) => setSettings({ ...settings, parentAnnualContribution: parseInt(v) || 0 })}
                prefix="$"
                note="Out-of-pocket dollars you'll pay each year, beyond what the 529 covers" />
              <SettingField label="Student contribution per year" type="number" value={settings.studentAnnualContribution}
                onChange={(v) => setSettings({ ...settings, studentAnnualContribution: parseInt(v) || 0 })}
                prefix="$"
                note="What your student will contribute from work, savings, or external scholarships annually" />
            </div>

            <div className="bg-white border border-stone-200 rounded-lg p-6">
              <h2 className="font-display text-2xl font-medium mb-1">College cost assumptions</h2>
              <p className="text-sm text-stone-600 mb-4">How fast college costs inflate from 2024-25 base rates.</p>
              <SettingSlider label="College cost inflation" min={0} max={10} step={0.5}
                value={settings.coaInflation} onChange={(v) => setSettings({ ...settings, coaInflation: v })}
                format={(v) => `${v}%/yr`}
                note="Historical avg: 5-7%/yr. Public schools often 5-8%; privates 3-5%." />
            </div>

            <div className="bg-white border border-stone-200 rounded-lg p-6">
              <div className="flex items-baseline justify-between mb-1">
                <h2 className="font-display text-2xl font-medium">Special situations</h2>
                <button onClick={() => {
                  const newWaiver = {
                    id: Date.now().toString(),
                    label: 'New waiver',
                    type: 'percentage',
                    value: 50,
                    appliesToSchoolIds: []
                  };
                  setSettings({ ...settings, waivers: [...(settings.waivers || []), newWaiver] });
                }}
                  className="px-3 py-1.5 bg-emerald-700 text-white text-sm font-medium rounded-md hover:bg-emerald-800">+ Add waiver</button>
              </div>
              <p className="text-sm text-stone-600 mb-4">
                Tuition waivers, employer benefits, or state-specific programs that reduce tuition at specific schools. Examples: employer-provided tuition remission for employee's children, military benefits, state reciprocity agreements, the FL Grandparent Waiver.
              </p>

              {(!settings.waivers || settings.waivers.length === 0) ? (
                <div className="text-center py-6 border border-dashed border-stone-300 rounded text-sm text-stone-500">
                  No special waivers configured. Click "+ Add waiver" if you have one to apply.
                </div>
              ) : (
                <div className="space-y-3">
                  {settings.waivers.map((w) => (
                    <WaiverEditor key={w.id} waiver={w} schoolsLib={schoolsLib}
                      onChange={(updated) => setSettings({ ...settings, waivers: settings.waivers.map((x) => x.id === w.id ? updated : x) })}
                      onRemove={() => setSettings({ ...settings, waivers: settings.waivers.filter((x) => x.id !== w.id) })} />
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-stone-200 rounded-lg p-6">
              <h2 className="font-display text-2xl font-medium mb-4">Federal student loans</h2>
              <div className="flex items-center justify-between">
                <div className="flex-1 pr-4">
                  <div className="text-sm font-medium">Use federal student loans</div>
                  <div className="text-xs text-stone-500 mt-1">
                    Fills cost gaps with Direct Unsubsidized Loans in the student's name: $5.5K (Yr 1) → $6.5K (Yr 2) → $7.5K (Yr 3-4). Max $27K total over 4 years. Current rate ~6.5%, no credit check or co-signer required, payments start 6 months after graduation.
                  </div>
                </div>
                <label className="inline-flex items-center cursor-pointer flex-shrink-0">
                  <input type="checkbox" checked={settings.federalLoansUsed}
                    onChange={(e) => setSettings({ ...settings, federalLoansUsed: e.target.checked })}
                    className="sr-only peer" />
                  <div className="relative w-11 h-6 bg-stone-300 peer-checked:bg-emerald-700 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'funds' && (
          <div className="max-w-3xl">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="font-display text-2xl font-medium">529 funds</h2>
              <button onClick={() => setScenarios529([...scenarios529, { id: Date.now().toString(), label: 'New 529', balance: 0, monthlyContrib: 0 }])}
                className="px-3 py-1.5 bg-emerald-700 text-white text-sm font-medium rounded-md hover:bg-emerald-800">+ Add fund</button>
            </div>
            <p className="text-sm text-stone-600 mb-6">
              Set current balance + ongoing monthly contributions. The app projects to fall {settings.startYear} using your growth rate from Settings ({settings.growth529Pre}%/yr).
            </p>
            <div className="space-y-3">
              {scenarios529.map((fund) => {
                const projected = project529WithContributions(fund.balance, fund.monthlyContrib || 0, settings.growth529Pre, Math.max(0, settings.startYear - 2025));
                const contribTotal = (fund.monthlyContrib || 0) * 12 * Math.max(0, settings.startYear - 2025);
                const growth = projected - fund.balance - contribTotal;
                return (
                  <div key={fund.id} className="bg-white border border-stone-200 rounded-lg p-4">
                    <div className="flex gap-3 mb-3">
                      <input type="text" value={fund.label}
                        onChange={(e) => setScenarios529(scenarios529.map((s) => s.id === fund.id ? { ...s, label: e.target.value } : s))}
                        className="flex-1 px-3 py-2 border border-stone-200 rounded text-sm font-medium"
                        placeholder="Fund name" />
                      <button onClick={() => setScenarios529(scenarios529.filter((s) => s.id !== fund.id))}
                        className="text-stone-400 hover:text-red-600 text-xl leading-none px-2">×</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">Current balance</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-stone-400 text-sm pointer-events-none">$</span>
                          <CurrencyInput
                            value={fund.balance}
                            onChange={(v) => setScenarios529(scenarios529.map((s) => s.id === fund.id ? { ...s, balance: v } : s))}
                            className="w-full pl-7 pr-3 py-2 border border-stone-200 rounded text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">Monthly contribution (until enrollment)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-stone-400 text-sm pointer-events-none">$</span>
                          <CurrencyInput
                            value={fund.monthlyContrib || 0}
                            onChange={(v) => setScenarios529(scenarios529.map((s) => s.id === fund.id ? { ...s, monthlyContrib: v } : s))}
                            className="w-full pl-7 pr-3 py-2 border border-stone-200 rounded text-sm"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-stone-100 text-xs text-stone-600">
                      <div className="flex justify-between items-baseline">
                        <span>Current balance</span>
                        <span className="font-medium">{formatCurrency(fund.balance)}</span>
                      </div>
                      {(fund.monthlyContrib || 0) > 0 && (
                        <div className="flex justify-between items-baseline">
                          <span>+ Contributions over {Math.max(0, settings.startYear - 2025)} years</span>
                          <span className="font-medium text-emerald-700">+{formatCurrency(contribTotal)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-baseline">
                        <span>+ Investment growth</span>
                        <span className="font-medium text-emerald-700">+{formatCurrency(growth)}</span>
                      </div>
                      <div className="flex justify-between items-baseline pt-1 mt-1 border-t border-stone-100">
                        <span className="font-medium">Projected at fall {settings.startYear}</span>
                        <span className="font-semibold text-emerald-900 text-sm">{formatCurrency(projected)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="text-sm font-medium text-emerald-900">Total 529 plans</div>
              <div className="text-2xl font-display font-semibold text-emerald-900 mt-1">{formatCurrency(total529)} today</div>
              {totalMonthlyContrib > 0 && (
                <div className="text-sm text-emerald-800 mt-1">
                  + {formatCurrency(totalMonthlyContrib)}/month → {formatCurrency(totalContribsOverPeriod)} additional contributions over {yearsUntilStart} years
                </div>
              )}
              <div className="text-sm text-emerald-800 mt-2 pt-2 border-t border-emerald-200">
                Projected total at fall {settings.startYear}: <span className="font-semibold">{formatCurrency(total529AtCollege)}</span>
              </div>
            </div>
            <div className="mt-4 bg-stone-100 border border-stone-200 rounded-lg p-4 text-xs text-stone-600">
              <strong>Note on contributions:</strong> 529 plans have annual contribution limits tied to federal gift tax (~$19K/yr per parent per child in 2025), so up to ~$38K/yr from married parents without filing a gift tax return. Some states also offer state income tax deductions for contributions. NJ is one of the few states with NO state deduction — contributions are tax-deferred at the federal level only.
            </div>
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="max-w-3xl">
            <h2 className="font-display text-2xl font-medium mb-6">Saved scenarios</h2>
            {savedScenarios.length === 0 ? (
              <p className="text-stone-500 text-sm">No saved scenarios yet.</p>
            ) : (
              <div className="space-y-3">
                {savedScenarios.map((s) => (
                  <div key={s.id} className="bg-white border border-stone-200 rounded-lg p-4 flex justify-between items-start gap-3">
                    <div className="flex-1">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-stone-500">
                        {new Date(s.timestamp).toLocaleDateString()} · {s.selectedSchools.length} schools
                        {s.student && ` · GPA ${s.student.gpa}/SAT ${s.student.sat}`}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => loadScenario(s)}
                        className="px-3 py-1.5 text-sm border border-emerald-700 text-emerald-700 rounded hover:bg-emerald-50">Load</button>
                      <button onClick={() => deleteScenario(s.id)}
                        className="px-3 py-1.5 text-sm text-stone-500 hover:text-red-600">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 mt-8 border-t border-stone-200">
        <p className="text-xs text-stone-400">
          Cost and admissions data: IPEDS 2024-25 Provisional Release (NCES). Merit thresholds curated from each school's published programs.
          Verify all numbers directly with each school before making decisions.
        </p>
      </div>
    </div>
  );
}

function SearchTab({ schoolsLib, filterStats, searchQuery, setSearchQuery, filterRegion, setFilterRegion,
  filterState, setFilterState, filterMerit, setFilterMerit, filterPublic, setFilterPublic, filterAdmit, setFilterAdmit,
  filterSATFit, setFilterSATFit, sortBy, setSortBy, student, settings, onAdd }) {
  return (
    <div>
      <h2 className="font-display text-2xl font-medium mb-2">Find schools</h2>
      <p className="text-sm text-stone-600 mb-6">
        {schoolsLib.length.toLocaleString()} four-year institutions. Profile: GPA {student.gpa.toFixed(1)}, SAT {student.sat}.
      </p>

      <div className="bg-white border border-stone-200 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, state, or city..."
            className="px-3 py-2 border border-stone-200 rounded text-sm" />
          <input type="text" value={filterState} onChange={(e) => setFilterState(e.target.value)}
            placeholder="State (e.g. NJ, FL, AL)" maxLength={2}
            className="px-3 py-2 border border-stone-200 rounded text-sm" />
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          <span className="text-xs text-stone-500 self-center mr-1">Region:</span>
          {REGIONS.map((r) => (
            <button key={r} onClick={() => setFilterRegion(r)}
              className={`text-xs px-3 py-1 rounded-full border ${filterRegion === r ? 'bg-emerald-700 border-emerald-700 text-white' : 'bg-white border-stone-300 text-stone-600 hover:border-stone-400'}`}>
              {r}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          <span className="text-xs text-stone-500 self-center mr-1">Admit:</span>
          {['All', 'Safety', 'Likely', 'Target', 'Reach'].map((a) => (
            <button key={a} onClick={() => setFilterAdmit(a)}
              className={`text-xs px-3 py-1 rounded-full border ${filterAdmit === a ? 'bg-emerald-700 border-emerald-700 text-white' : 'bg-white border-stone-300 text-stone-600 hover:border-stone-400'}`}>
              {a}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          <span className="text-xs text-stone-500 self-center mr-1">SAT fit:</span>
          {[
            { val: 'All', label: 'All' },
            { val: 'Above', label: '↑ Above 75th' },
            { val: 'Within', label: '· In range' },
            { val: 'Below', label: '↓ Below 25th' }
          ].map((s) => (
            <button key={s.val} onClick={() => setFilterSATFit(s.val)}
              className={`text-xs px-3 py-1 rounded-full border ${filterSATFit === s.val ? 'bg-emerald-700 border-emerald-700 text-white' : 'bg-white border-stone-300 text-stone-600 hover:border-stone-400'}`}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          <span className="text-xs text-stone-500 self-center mr-1">Sort:</span>
          {[
            { val: 'default', label: 'Default' },
            { val: 'cheapest', label: 'Lowest net cost' },
            { val: 'bestMerit', label: 'Biggest merit award' },
            { val: 'mostSelective', label: 'Most selective' },
            { val: 'leastSelective', label: 'Least selective' }
          ].map((s) => (
            <button key={s.val} onClick={() => setSortBy(s.val)}
              className={`text-xs px-3 py-1 rounded-full border ${sortBy === s.val ? 'bg-emerald-700 border-emerald-700 text-white' : 'bg-white border-stone-300 text-stone-600 hover:border-stone-400'}`}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterPublic(!filterPublic)}
            className={`text-xs px-3 py-1.5 rounded-full border ${filterPublic ? 'bg-emerald-700 border-emerald-700 text-white' : 'bg-white border-stone-300 text-stone-600'}`}>
            Public only
          </button>
          <button onClick={() => setFilterMerit(!filterMerit)}
            className={`text-xs px-3 py-1.5 rounded-full border ${filterMerit ? 'bg-emerald-700 border-emerald-700 text-white' : 'bg-white border-stone-300 text-stone-600'}`}>
            Qualifies for merit
          </button>
        </div>
      </div>

      <div className="text-sm text-stone-500 mb-3">
        {filterStats.displayed.length} of {filterStats.total.toLocaleString()} matching schools
        {filterStats.total > filterStats.displayed.length && ' — refine filters to narrow'}
      </div>

      <div className="space-y-3">
        {filterStats.displayed.map((s) => (
          <SchoolBrowseCard key={s.id} school={s} student={student} settings={settings} onAdd={() => onAdd(s.id)} />
        ))}
      </div>
    </div>
  );
}

function SchoolBrowseCard({ school, student, settings, onAdd }) {
  const merit = MERIT_OVERLAYS[school.id];
  const matches = merit ? getMatchingScholarships(merit, student.gpa, student.sat) : [];
  const best = matches.length ? matches.reduce((b, s) => s.amount > b.amount ? s : b) : null;
  const likelihood = getAdmitLikelihood(school, student.sat);
  const satFit = getSATFit(school, student.sat);
  const isInState = settings.homeState && school.state === settings.homeState;
  const tuition = (!school.isPublic || isInState) ? school.tuitionIS : school.tuitionOOS;
  const sticker = tuition + (school.roomBoardOn || 12000) + (school.books || 1340) + (school.otherOn || 2360);
  const applicableWaivers = (settings.waivers || []).filter((w) => (w.appliesToSchoolIds || []).includes(school.id));

  return (
    <div className="bg-white border border-stone-200 rounded-lg p-4 hover:border-emerald-200 transition-colors flex items-start justify-between gap-3 flex-wrap">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-display text-lg font-medium">{school.name}</h3>
          <span className="text-xs text-stone-500">{school.city ? school.city + ', ' : ''}{school.state}</span>
          {likelihood && <AdmitBadge likelihood={likelihood} />}
          {!school.isPublic && <span className="text-xs text-stone-500 italic">private</span>}
        </div>
        <div className="text-xs text-stone-500 mt-1 flex gap-3 flex-wrap">
          {school.enrollment && <span>{school.enrollment.toLocaleString()} students</span>}
          {school.admitRate != null && <span>Accept {Math.round(school.admitRate * 100)}%</span>}
          {school.sat25 && school.sat75 && (
            <span>
              SAT {school.sat25}-{school.sat75}
              {satFit === 'above' && <span className="text-emerald-600 font-medium"> ↑ above 75th</span>}
              {satFit === 'within' && <span className="text-blue-600 font-medium"> · within range</span>}
              {satFit === 'below' && <span className="text-amber-600 font-medium"> ↓ below 25th</span>}
            </span>
          )}
          <span>Sticker: {formatCurrencyShort(sticker)}/yr</span>
          {school.isPublic && !isInState && (
            <span>IS: {formatCurrencyShort(school.tuitionIS)} · OOS: {formatCurrencyShort(school.tuitionOOS)}</span>
          )}
        </div>
        {best && (
          <div className="mt-2 inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs px-2.5 py-1 rounded-full">
            <span className="font-medium">✓ {best.name}</span>
            <span>{formatCurrency(best.amount)}/yr</span>
          </div>
        )}
        {applicableWaivers.length > 0 && applicableWaivers.map((w) => (
          <div key={w.id} className="mt-2 mr-2 inline-flex bg-blue-50 border border-blue-200 text-blue-900 text-xs px-2.5 py-1 rounded-full font-medium">
            ✓ {w.label}
          </div>
        ))}
      </div>
      <button onClick={onAdd}
        className="px-3 py-1.5 bg-emerald-700 text-white text-sm rounded hover:bg-emerald-800 whitespace-nowrap">
        + Compare
      </button>
    </div>
  );
}

function AdmitBadge({ likelihood }) {
  const config = {
    safety: { label: 'Safety', bg: 'bg-emerald-100', text: 'text-emerald-900' },
    likely: { label: 'Likely', bg: 'bg-blue-100', text: 'text-blue-900' },
    target: { label: 'Target', bg: 'bg-stone-100', text: 'text-stone-700' },
    reach: { label: 'Reach', bg: 'bg-amber-100', text: 'text-amber-900' },
    unlikely: { label: 'Very tough', bg: 'bg-red-100', text: 'text-red-900' }
  };
  const c = config[likelihood] || config.target;
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.bg} ${c.text}`}>{c.label}</span>;
}

function SchoolResultCard({ result, onRemove, onUpdateConfig, settings }) {
  const [expanded, setExpanded] = useState(false);
  const config = result.schoolConfig;
  const merit = MERIT_OVERLAYS[result.id];
  const applicableWaivers = (settings.waivers || []).filter((w) => (w.appliesToSchoolIds || []).includes(result.id));

  function toggleWaiver(waiverId) {
    const current = config.enabledWaiverIds || [];
    const next = current.includes(waiverId)
      ? current.filter((id) => id !== waiverId)
      : [...current, waiverId];
    onUpdateConfig('enabledWaiverIds', next);
  }

  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <div className="p-4 flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-xl font-medium">{result.name}</h3>
            <span className="text-xs text-stone-500">{result.state}</span>
            {result.admitLikelihood && <AdmitBadge likelihood={result.admitLikelihood} />}
          </div>
          <div className="text-xs text-stone-500 mt-1 flex gap-3 flex-wrap">
            {result.sat25 && result.sat75 && <span>SAT {result.sat25}-{result.sat75}</span>}
            {result.admitRate != null && <span>Accept {Math.round(result.admitRate * 100)}%</span>}
            {result.enrollment && <span>{result.enrollment.toLocaleString()} students</span>}
          </div>
          {result.bestMerit && (
            <div className="text-xs text-emerald-700 mt-1">
              ✓ {result.bestMerit.name} — {formatCurrency(result.bestMerit.amount)}/yr
            </div>
          )}
          <div className="flex gap-2 mt-3 flex-wrap">
            {applicableWaivers.map((w) => (
              <ChipToggle key={w.id} label={w.label}
                active={(config.enabledWaiverIds || []).includes(w.id)}
                onClick={() => toggleWaiver(w.id)} />
            ))}
            <ChipToggle label="Commuter (live at home)" active={config.useCommuter}
              onClick={() => onUpdateConfig('useCommuter', !config.useCommuter)} />
            {merit?.autoMerit?.length > 0 && (
              <ChipToggle label="Auto-merit" active={config.useMerit !== false}
                onClick={() => onUpdateConfig('useMerit', !(config.useMerit !== false))} />
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-stone-500">4-yr cost</div>
          <div className="text-2xl font-display font-semibold">{formatCurrencyShort(result.totals.coa)}</div>
          <div className="text-xs text-stone-500">avg {formatCurrency(result.totals.coa / 4)}/yr</div>
        </div>
        <div className="flex flex-col gap-1">
          <button onClick={() => setExpanded(!expanded)}
            className="text-xs px-2 py-1 text-emerald-700 hover:bg-emerald-50 rounded">
            {expanded ? 'Hide' : 'Details'}
          </button>
          <button onClick={onRemove} className="text-xs px-2 py-1 text-stone-400 hover:text-red-600">Remove</button>
        </div>
      </div>
      <div className="px-4 pb-2">
        <PaymentStack totals={result.totals} />
      </div>
      {expanded && (
        <div className="border-t border-stone-100 bg-stone-50 p-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-stone-500">
                <th className="text-left pb-2">Year</th>
                <th className="text-right pb-2">COA</th>
                <th className="text-right pb-2">Merit</th>
                <th className="text-right pb-2">529</th>
                <th className="text-right pb-2">Parents</th>
                <th className="text-right pb-2">Student</th>
                <th className="text-right pb-2">Loans</th>
                <th className="text-right pb-2">Gap</th>
              </tr>
            </thead>
            <tbody>
              {result.years.map((y) => (
                <tr key={y.year} className="border-t border-stone-200">
                  <td className="py-1.5">Yr {y.year} ({y.calYear})</td>
                  <td className="text-right py-1.5">{formatCurrency(y.coa)}</td>
                  <td className="text-right py-1.5 text-emerald-700">{y.meritAid > 0 ? '−' + formatCurrency(y.meritAid) : '—'}</td>
                  <td className="text-right py-1.5">{formatCurrency(y.from529)}</td>
                  <td className="text-right py-1.5">{formatCurrency(y.fromParent)}</td>
                  <td className="text-right py-1.5">{formatCurrency(y.fromStudent)}</td>
                  <td className="text-right py-1.5">{y.fromLoans > 0 ? formatCurrency(y.fromLoans) : '—'}</td>
                  <td className={`text-right py-1.5 font-medium ${y.shortfall > 0.5 ? 'text-red-600' : 'text-stone-400'}`}>
                    {y.shortfall > 0.5 ? formatCurrency(y.shortfall) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PaymentStack({ totals }) {
  const total = totals.coa;
  if (total === 0) return null;
  const segments = [
    { label: 'Merit', value: totals.meritAid, color: '#10b981' },
    { label: '529', value: totals.from529, color: '#047857' },
    { label: 'Parents', value: totals.fromParent, color: '#1e40af' },
    { label: 'Student', value: totals.fromStudent, color: '#7c3aed' },
    { label: 'Loans', value: totals.fromLoans, color: '#ea580c' },
    { label: 'Gap', value: totals.shortfall, color: '#dc2626' }
  ].filter((s) => s.value > 0.5);

  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden bg-stone-100">
        {segments.map((s, i) => (
          <div key={i} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
        ))}
      </div>
      <div className="flex gap-3 flex-wrap mt-1.5 text-xs">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ background: s.color }} />
            <span className="text-stone-600">{s.label}: {formatCurrencyShort(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WaiverEditor({ waiver, schoolsLib, onChange, onRemove }) {
  const [schoolPickerOpen, setSchoolPickerOpen] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState('');

  const appliedSchools = (waiver.appliesToSchoolIds || [])
    .map((id) => schoolsLib.find((s) => s.id === id))
    .filter(Boolean);

  const searchResults = useMemo(() => {
    if (!schoolSearch || schoolSearch.length < 2) return [];
    const q = schoolSearch.toLowerCase();
    return schoolsLib
      .filter((s) => s.name.toLowerCase().includes(q) || (s.state || '').toLowerCase().includes(q))
      .filter((s) => !(waiver.appliesToSchoolIds || []).includes(s.id))
      .slice(0, 8);
  }, [schoolSearch, schoolsLib, waiver.appliesToSchoolIds]);

  function addSchoolToWaiver(id) {
    onChange({ ...waiver, appliesToSchoolIds: [...(waiver.appliesToSchoolIds || []), id] });
    setSchoolSearch('');
  }

  function removeSchoolFromWaiver(id) {
    onChange({ ...waiver, appliesToSchoolIds: (waiver.appliesToSchoolIds || []).filter((x) => x !== id) });
  }

  const typeOptions = [
    { value: 'percentage', label: 'Percentage off tuition', helper: 'e.g., 60% off tuition' },
    { value: 'flatTuition', label: 'Replace tuition with fixed amount', helper: 'e.g., charge $5,000 instead of normal tuition' },
    { value: 'flatAmount', label: 'Fixed dollar amount off', helper: 'e.g., subtract $10,000 from tuition' }
  ];

  return (
    <div className="border border-stone-200 rounded-lg p-4 bg-stone-50">
      <div className="flex justify-between items-start gap-2 mb-3">
        <input type="text" value={waiver.label}
          onChange={(e) => onChange({ ...waiver, label: e.target.value })}
          className="flex-1 px-3 py-2 border border-stone-200 rounded text-sm font-medium bg-white"
          placeholder="Waiver name (e.g., Employee tuition remission)" />
        <button onClick={onRemove}
          className="text-stone-400 hover:text-red-600 text-xl leading-none px-2">×</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs text-stone-500 mb-1">Waiver type</label>
          <select value={waiver.type}
            onChange={(e) => onChange({ ...waiver, type: e.target.value })}
            className="w-full px-3 py-2 border border-stone-200 rounded text-sm bg-white">
            {typeOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <p className="text-xs text-stone-500 mt-1">{typeOptions.find((t) => t.value === waiver.type)?.helper}</p>
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-1">
            {waiver.type === 'percentage' ? 'Percent off' : 'Dollar amount'}
          </label>
          <div className="relative">
            {waiver.type !== 'percentage' && (
              <span className="absolute left-3 top-2 text-stone-400 text-sm pointer-events-none">$</span>
            )}
            <CurrencyInput
              value={waiver.value || 0}
              onChange={(v) => onChange({ ...waiver, value: v })}
              className={`w-full ${waiver.type !== 'percentage' ? 'pl-7 pr-3' : 'px-3'} py-2 border border-stone-200 rounded text-sm bg-white`}
            />
            {waiver.type === 'percentage' && (
              <span className="absolute right-3 top-2 text-stone-400 text-sm pointer-events-none">%</span>
            )}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs text-stone-500 mb-1">Applies to schools</label>
        {appliedSchools.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {appliedSchools.map((s) => (
              <div key={s.id} className="inline-flex items-center gap-1.5 bg-white border border-stone-300 text-stone-700 text-xs px-2.5 py-1 rounded-full">
                <span>{s.name} ({s.state})</span>
                <button onClick={() => removeSchoolFromWaiver(s.id)}
                  className="text-stone-400 hover:text-red-600 leading-none">×</button>
              </div>
            ))}
          </div>
        )}
        <input type="text" value={schoolSearch}
          onChange={(e) => setSchoolSearch(e.target.value)}
          placeholder="Type school name to add..."
          className="w-full px-3 py-2 border border-stone-200 rounded text-sm bg-white" />
        {searchResults.length > 0 && (
          <div className="mt-1 border border-stone-200 rounded bg-white max-h-48 overflow-y-auto">
            {searchResults.map((s) => (
              <button key={s.id} onClick={() => addSchoolToWaiver(s.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-stone-50 border-b border-stone-100 last:border-b-0">
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-stone-500">{s.city ? s.city + ', ' : ''}{s.state}</div>
              </button>
            ))}
          </div>
        )}
        {schoolSearch.length >= 2 && searchResults.length === 0 && (
          <p className="text-xs text-stone-500 mt-1">No matching schools found.</p>
        )}
      </div>
    </div>
  );
}

function ChipToggle({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${active ? 'bg-emerald-700 border-emerald-700 text-white' : 'bg-white border-stone-300 text-stone-600 hover:border-stone-400'}`}>
      {active ? '✓ ' : ''}{label}
    </button>
  );
}

function CurrencyInput({ value, onChange, className }) {
  // Local state holds the raw string the user is typing, decoupled from the
  // committed numeric value. This avoids the controlled-input problem where
  // "0" persists in the field and blocks easy editing.
  const [raw, setRaw] = useState(() => formatRaw(value));
  const [focused, setFocused] = useState(false);

  function formatRaw(v) {
    const n = Number(v) || 0;
    return n === 0 ? '' : n.toLocaleString();
  }

  // Sync from parent when not focused (so external updates flow in, but
  // we don't interrupt the user while they're typing).
  React.useEffect(() => {
    if (!focused) setRaw(formatRaw(value));
  }, [value, focused]);

  function handleChange(e) {
    // Strip everything except digits
    const digits = e.target.value.replace(/[^\d]/g, '');
    // Format with commas for display
    const formatted = digits === '' ? '' : parseInt(digits, 10).toLocaleString();
    setRaw(formatted);
    onChange(digits === '' ? 0 : parseInt(digits, 10));
  }

  function handleFocus(e) {
    setFocused(true);
    // Select all on focus so typing replaces the existing value
    e.target.select();
  }

  function handleBlur() {
    setFocused(false);
    // Re-format on blur to clean up
    setRaw(formatRaw(value));
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={raw}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder="0"
      className={className}
    />
  );
}

function SettingField({ label, type, value, onChange, note, prefix }) {
  const isCurrency = prefix === '$';
  return (
    <div className="py-3 border-t border-stone-200 first:border-t-0">
      <label className="block text-sm font-medium text-stone-700 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-2 text-stone-400 text-sm pointer-events-none">{prefix}</span>}
        {isCurrency ? (
          <CurrencyInput
            value={value}
            onChange={onChange}
            className="w-full pl-7 pr-3 py-2 border border-stone-200 rounded text-sm"
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full ${prefix ? 'pl-7 pr-3' : 'px-3'} py-2 border border-stone-200 rounded text-sm`}
          />
        )}
      </div>
      {note && <p className="text-xs text-stone-500 mt-1">{note}</p>}
    </div>
  );
}

function SettingSlider({ label, min, max, step, value, onChange, format, note }) {
  return (
    <div className="py-3 border-t border-stone-200 first:border-t-0">
      <div className="flex justify-between items-baseline mb-1">
        <label className="text-sm font-medium text-stone-700">{label}</label>
        <span className="text-sm font-medium text-emerald-700">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full" />
      {note && <p className="text-xs text-stone-500 mt-1">{note}</p>}
    </div>
  );
}
