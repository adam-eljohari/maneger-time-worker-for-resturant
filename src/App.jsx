import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleOff,
  Clock3,
  Download,
  FileSpreadsheet,
  LayoutDashboard,
  Plus,
  Save,
  Search,
  Settings,
  Smartphone,
  Sparkles,
  Store,
  TimerReset,
  Trash2,
  UserRound,
  Users,
  UtensilsCrossed,
  X
} from 'lucide-react';
import {
  DAY_NAMES,
  DEFAULT_END,
  DEFAULT_START,
  FRIDAY_END,
  MONTH_NAMES,
  YEAR_OPTIONS,
  calculateDuration,
  daysInMonth,
  entryKey,
  fillEmptyEntries,
  formatMinutes,
  getDayInfo,
  getEmployeeSummary,
  getEntryMinutes,
  getMonthSummary,
  normalizeEntries
} from './lib/schedule.js';

const DEFAULT_EMPLOYEES = ['סמי', 'רמי', 'אבראהים', 'מוחמד', 'ראזי', 'מוסטאפה', 'אדם', 'מרים']
  .map((name) => ({ id: name, name }));

const EMPLOYEES_KEY = 'restaurant-hours-v3:employees';
const RESTAURANT_KEY = 'restaurant-hours-v3:restaurant-name';
const ENTRIES_PREFIX = 'restaurant-hours-v2';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'סקירה', icon: LayoutDashboard },
  { id: 'timesheet', label: 'דיווח', icon: Clock3 },
  { id: 'employees', label: 'עובדים', icon: Users },
  { id: 'settings', label: 'הגדרות', icon: Settings }
];

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function getInitialPeriod() {
  const today = new Date();
  const year = Math.min(2035, Math.max(2025, today.getFullYear()));
  return { month: today.getMonth() + 1, year };
}

function periodStorageKey(period) {
  return `${ENTRIES_PREFIX}:${period.year}-${String(period.month).padStart(2, '0')}`;
}

function loadEntries(period, employees) {
  const saved = readJson(periodStorageKey(period), {});
  return normalizeEntries(saved && typeof saved === 'object' ? saved : {}, employees, period);
}

function App() {
  const [employees, setEmployees] = useState(() => readJson(EMPLOYEES_KEY, DEFAULT_EMPLOYEES));
  const [restaurantName, setRestaurantName] = useState(() => localStorage.getItem(RESTAURANT_KEY) || 'המסעדה שלי');
  const [period, setPeriod] = useState(getInitialPeriod);
  const [entries, setEntries] = useState(() => loadEntries(getInitialPeriod(), readJson(EMPLOYEES_KEY, DEFAULT_EMPLOYEES)));
  const [activeView, setActiveView] = useState('dashboard');
  const [activeEmployeeId, setActiveEmployeeId] = useState(() => employees[0]?.id || '');
  const [saveStatus, setSaveStatus] = useState('saved');
  const [toast, setToast] = useState('');
  const [quickFillOpen, setQuickFillOpen] = useState(false);
  const [quickScope, setQuickScope] = useState('employee');
  const [quickStart, setQuickStart] = useState(DEFAULT_START);
  const [quickEnd, setQuickEnd] = useState(DEFAULT_END);
  const [clearOpen, setClearOpen] = useState(false);
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [employeeToRemove, setEmployeeToRemove] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);

  const summary = useMemo(
    () => getMonthSummary(entries, employees, period),
    [entries, employees, period]
  );

  const activeEmployee = employees.find((employee) => employee.id === activeEmployeeId) || employees[0];

  useEffect(() => {
    setSaveStatus('saving');
    try {
      localStorage.setItem(periodStorageKey(period), JSON.stringify(entries));
      const timer = window.setTimeout(() => setSaveStatus('saved'), 260);
      return () => window.clearTimeout(timer);
    } catch {
      setSaveStatus('error');
      return undefined;
    }
  }, [entries, period]);

  useEffect(() => {
    localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem(RESTAURANT_KEY, restaurantName);
  }, [restaurantName]);

  useEffect(() => {
    const onBeforeInstall = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function changePeriod(patch) {
    const nextPeriod = { ...period, ...patch };
    setPeriod(nextPeriod);
    setEntries(loadEntries(nextPeriod, employees));
  }

  function updateEntry(employeeId, day, patch) {
    const info = getDayInfo(period.year, period.month, day);
    if (info.closed) return;
    const key = entryKey(employeeId, day);
    setEntries((current) => {
      const previous = current[key] || { start: '', end: '', off: false };
      const nextEntry = { ...previous, ...patch };
      if (info.short && nextEntry.end > FRIDAY_END) {
        nextEntry.end = FRIDAY_END;
        setToast('ביום שישי שעת היציאה מוגבלת ל־17:00');
      }
      const next = { ...current };
      if (!nextEntry.start && !nextEntry.end && !nextEntry.off) delete next[key];
      else next[key] = nextEntry;
      return next;
    });
  }

  function runQuickFill() {
    const scopeId = quickScope === 'employee' ? activeEmployee?.id : null;
    const result = fillEmptyEntries(entries, employees, period, scopeId, quickStart, quickEnd);
    setEntries(result.entries);
    setQuickFillOpen(false);
    setToast(result.count ? `${result.count} משמרות נוספו בהצלחה` : 'אין ימי עבודה ריקים למילוי');
  }

  function clearMonth() {
    setEntries({});
    setClearOpen(false);
    setToast(`נתוני ${MONTH_NAMES[period.month]} נמחקו`);
  }

  function addEmployee() {
    const name = newEmployeeName.trim();
    if (!name) return;
    if (employees.some((employee) => employee.name === name)) {
      setToast('העובד כבר נמצא ברשימה');
      return;
    }
    const id = `employee-${Date.now().toString(36)}`;
    setEmployees((current) => [...current, { id, name }]);
    setActiveEmployeeId(id);
    setNewEmployeeName('');
    setAddEmployeeOpen(false);
    setToast(`${name} נוסף לרשימת העובדים`);
  }

  function removeEmployee() {
    if (!employeeToRemove) return;
    setEmployees((current) => current.filter((employee) => employee.id !== employeeToRemove.id));
    setEntries((current) => Object.fromEntries(
      Object.entries(current).filter(([key]) => !key.startsWith(`${employeeToRemove.id}:`))
    ));
    if (activeEmployeeId === employeeToRemove.id) {
      setActiveEmployeeId(employees.find((employee) => employee.id !== employeeToRemove.id)?.id || '');
    }
    setToast(`${employeeToRemove.name} הוסר מהרשימה`);
    setEmployeeToRemove(null);
  }

  function openEmployeeTimesheet(employeeId) {
    setActiveEmployeeId(employeeId);
    setActiveView('timesheet');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function exportExcel() {
    const { default: writeExcelFile } = await import('write-excel-file/browser');
    const details = [['שם עובד', 'תאריך', 'יום', 'כניסה', 'יציאה', 'סטטוס', 'שעות']];
    const totals = [['שם עובד', 'מספר משמרות', 'סך שעות']];
    const totalDays = daysInMonth(period.month, period.year);

    employees.forEach((employee) => {
      for (let day = 1; day <= totalDays; day += 1) {
        const info = getDayInfo(period.year, period.month, day);
        const entry = entries[entryKey(employee.id, day)] || {};
        const minutes = getEntryMinutes(entries, employee.id, day, period);
        const date = `${String(day).padStart(2, '0')}/${String(period.month).padStart(2, '0')}/${period.year}`;
        details.push([
          employee.name,
          date,
          info.name,
          info.closed || entry.off ? '' : (entry.start || ''),
          info.closed || entry.off ? '' : (entry.end || ''),
          info.closed ? 'המסעדה סגורה' : (entry.off ? 'לא עבד' : (minutes !== null ? 'עבד' : '')),
          minutes !== null ? formatMinutes(minutes) : ''
        ]);
      }
      const employeeSummary = getEmployeeSummary(entries, employee.id, period);
      totals.push([employee.name, employeeSummary.shifts, formatMinutes(employeeSummary.minutes)]);
    });
    totals.push(['סה״כ', summary.shifts, formatMinutes(summary.minutes)]);

    await writeExcelFile([
      {
        data: details,
        sheet: 'פירוט שעות',
        columns: [{ width: 18 }, { width: 14 }, { width: 11 }, { width: 11 }, { width: 11 }, { width: 18 }, { width: 12 }],
        stickyRowsCount: 1,
        rightToLeft: true
      },
      {
        data: totals,
        sheet: 'סיכום חודשי',
        columns: [{ width: 20 }, { width: 18 }, { width: 16 }],
        stickyRowsCount: 1,
        rightToLeft: true
      }
    ], { fontFamily: 'Arial', fontSize: 11 }).toFile(`דוח_שעות_${MONTH_NAMES[period.month]}_${period.year}.xlsx`);
    setToast('קובץ ה־Excel מוכן');
  }

  async function installApp() {
    if (!installPrompt) {
      setToast('פתח את תפריט הדפדפן ובחר „הוספה למסך הבית”');
      return;
    }
    await installPrompt.prompt();
    setInstallPrompt(null);
  }

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} onNavigate={setActiveView} restaurantName={restaurantName} />

      <div className="app-main">
        <Topbar
          period={period}
          onPeriodChange={changePeriod}
          saveStatus={saveStatus}
          restaurantName={restaurantName}
        />

        <main className="page-content">
          {activeView === 'dashboard' && (
            <Dashboard
              period={period}
              employees={employees}
              summary={summary}
              onNavigate={setActiveView}
              onOpenEmployee={openEmployeeTimesheet}
              onExport={exportExcel}
            />
          )}
          {activeView === 'timesheet' && (
            <Timesheet
              period={period}
              entries={entries}
              employees={employees}
              activeEmployee={activeEmployee}
              onEmployeeChange={setActiveEmployeeId}
              onEntryChange={updateEntry}
              onQuickFill={() => { setQuickScope('employee'); setQuickFillOpen(true); }}
            />
          )}
          {activeView === 'employees' && (
            <Employees
              employees={employees}
              summary={summary}
              onOpenEmployee={openEmployeeTimesheet}
              onAdd={() => setAddEmployeeOpen(true)}
              onRemove={setEmployeeToRemove}
            />
          )}
          {activeView === 'settings' && (
            <SettingsView
              restaurantName={restaurantName}
              onRestaurantNameChange={setRestaurantName}
              onExport={exportExcel}
              onFillAll={() => { setQuickScope('all'); setQuickFillOpen(true); }}
              onClear={() => setClearOpen(true)}
              onInstall={installApp}
            />
          )}
        </main>
      </div>

      <MobileNav activeView={activeView} onNavigate={setActiveView} />

      {quickFillOpen && (
        <Modal title="מילוי חכם" onClose={() => setQuickFillOpen(false)}>
          <p className="modal-copy">
            {quickScope === 'all' ? 'מילוי כל הימים הריקים לכל העובדים.' : `מילוי הימים הריקים של ${activeEmployee?.name || 'העובד'}.`}
            {' '}ימי ראשון יישארו סגורים, ובימי שישי היציאה תהיה ב־17:00.
          </p>
          <div className="time-pair modal-fields">
            <Field label="שעת כניסה">
              <input type="time" value={quickStart} onChange={(event) => setQuickStart(event.target.value)} step="900" />
            </Field>
            <Field label="שעת יציאה רגילה">
              <input type="time" value={quickEnd} onChange={(event) => setQuickEnd(event.target.value)} step="900" />
            </Field>
          </div>
          <div className="modal-actions">
            <button className="button button-ghost" onClick={() => setQuickFillOpen(false)}>ביטול</button>
            <button className="button button-primary" onClick={runQuickFill}><Sparkles size={18} />מלא ימים ריקים</button>
          </div>
        </Modal>
      )}

      {clearOpen && (
        <Modal title="מחיקת נתוני החודש" onClose={() => setClearOpen(false)} tone="danger">
          <p className="modal-copy">כל נתוני השעות של {MONTH_NAMES[period.month]} {period.year} יימחקו. לא ניתן לבטל את הפעולה.</p>
          <div className="modal-actions">
            <button className="button button-ghost" onClick={() => setClearOpen(false)}>חזרה</button>
            <button className="button button-danger" onClick={clearMonth}><Trash2 size={18} />מחק נתונים</button>
          </div>
        </Modal>
      )}

      {addEmployeeOpen && (
        <Modal title="הוספת עובד" onClose={() => setAddEmployeeOpen(false)}>
          <Field label="שם העובד">
            <input
              autoFocus
              type="text"
              value={newEmployeeName}
              onChange={(event) => setNewEmployeeName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && addEmployee()}
              placeholder="לדוגמה: יוסף"
            />
          </Field>
          <div className="modal-actions">
            <button className="button button-ghost" onClick={() => setAddEmployeeOpen(false)}>ביטול</button>
            <button className="button button-primary" onClick={addEmployee}><Plus size={18} />הוסף עובד</button>
          </div>
        </Modal>
      )}

      {employeeToRemove && (
        <Modal title={`הסרת ${employeeToRemove.name}`} onClose={() => setEmployeeToRemove(null)} tone="danger">
          <p className="modal-copy">העובד ונתוני השעות שלו בחודש הנוכחי יוסרו מהרשימה.</p>
          <div className="modal-actions">
            <button className="button button-ghost" onClick={() => setEmployeeToRemove(null)}>ביטול</button>
            <button className="button button-danger" onClick={removeEmployee}><Trash2 size={18} />הסר עובד</button>
          </div>
        </Modal>
      )}

      <div className={`toast ${toast ? 'toast-visible' : ''}`} role="status" aria-live="polite">
        <CheckCircle2 size={19} />
        <span>{toast}</span>
      </div>
    </div>
  );
}

function Sidebar({ activeView, onNavigate, restaurantName }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon"><Clock3 size={25} /></div>
        <div><strong>זמן צוות</strong><span>ניהול שעות חכם</span></div>
      </div>
      <nav className="side-nav" aria-label="ניווט ראשי">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} className={activeView === item.id ? 'active' : ''} onClick={() => onNavigate(item.id)}>
              <Icon size={20} /><span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="sidebar-restaurant"><Store size={18} /><div><span>מסעדה</span><strong>{restaurantName}</strong></div></div>
    </aside>
  );
}

function Topbar({ period, onPeriodChange, saveStatus, restaurantName }) {
  return (
    <header className="topbar">
      <div className="mobile-brand"><div className="brand-icon"><Clock3 size={22} /></div><div><strong>זמן צוות</strong><span>{restaurantName}</span></div></div>
      <div className="period-picker">
        <CalendarDays size={18} />
        <select aria-label="חודש" value={period.month} onChange={(event) => onPeriodChange({ month: Number(event.target.value) })}>
          {MONTH_NAMES.slice(1).map((month, index) => <option value={index + 1} key={month}>{month}</option>)}
        </select>
        <select aria-label="שנה" value={period.year} onChange={(event) => onPeriodChange({ year: Number(event.target.value) })}>
          {YEAR_OPTIONS.map((year) => <option value={year} key={year}>{year}</option>)}
        </select>
      </div>
      <div className={`save-indicator ${saveStatus}`}>
        {saveStatus === 'saved' ? <Check size={15} /> : <Save size={15} />}
        <span>{saveStatus === 'saving' ? 'שומר…' : saveStatus === 'error' ? 'השמירה נכשלה' : 'נשמר אוטומטית'}</span>
      </div>
    </header>
  );
}

function Dashboard({ period, employees, summary, onNavigate, onOpenEmployee, onExport }) {
  const maxMinutes = Math.max(...summary.byEmployee.map((employee) => employee.minutes), 1);
  return (
    <div className="view-stack">
      <section className="welcome-card">
        <div>
          <span className="eyebrow">תמונת מצב חודשית</span>
          <h1>{MONTH_NAMES[period.month]} {period.year}</h1>
          <p>כל מה שצריך לניהול שעות הצוות, במקום אחד ובצורה ברורה.</p>
        </div>
        <div className="welcome-actions">
          <button className="button button-light" onClick={() => onNavigate('timesheet')}><Clock3 size={18} />דיווח שעות</button>
          <button className="icon-button-light" onClick={onExport} aria-label="ייצוא לאקסל"><Download size={20} /></button>
        </div>
      </section>

      <section className="summary-grid" aria-label="סיכום חודשי">
        <SummaryCard icon={TimerReset} label="סך שעות" value={formatMinutes(summary.minutes)} suffix="שעות" tone="green" />
        <SummaryCard icon={BriefcaseBusiness} label="משמרות שהוזנו" value={summary.shifts} suffix="משמרות" tone="blue" />
        <SummaryCard icon={Users} label="עובדים עם דיווח" value={`${summary.workingEmployees}/${employees.length}`} suffix="עובדים" tone="purple" />
        <SummaryCard icon={BarChart3} label="ממוצע למשמרת" value={formatMinutes(summary.average)} suffix="שעות" tone="orange" />
      </section>

      <div className="dashboard-columns">
        <section className="panel employee-performance">
          <div className="panel-heading"><div><span className="eyebrow dark">סיכום צוות</span><h2>שעות לפי עובד</h2></div><button className="text-button" onClick={() => onNavigate('employees')}>לכל העובדים <ChevronLeft size={16} /></button></div>
          <div className="employee-bars">
            {summary.byEmployee.map((employee) => (
              <button className="employee-bar" key={employee.id} onClick={() => onOpenEmployee(employee.id)}>
                <span className="avatar">{employee.name.charAt(0)}</span>
                <span className="bar-info"><span><strong>{employee.name}</strong><small>{employee.shifts} משמרות</small></span><i><b style={{ width: `${(employee.minutes / maxMinutes) * 100}%` }} /></i></span>
                <strong className="bar-total">{formatMinutes(employee.minutes)}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="panel rules-panel">
          <div className="panel-heading"><div><span className="eyebrow dark">שבוע עבודה</span><h2>כללי המסעדה</h2></div></div>
          <div className="rule-list">
            <div className="rule closed"><span><CircleOff size={19} /></span><div><strong>יום ראשון</strong><small>המסעדה סגורה</small></div></div>
            <div className="rule short"><span><Clock3 size={19} /></span><div><strong>יום שישי</strong><small>עובדים עד 17:00</small></div></div>
            <div className="rule open"><span><CheckCircle2 size={19} /></span><div><strong>יום שבת</strong><small>יום עבודה רגיל</small></div></div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, suffix, tone }) {
  return (
    <article className={`summary-card ${tone}`}>
      <span className="summary-icon"><Icon size={21} /></span>
      <div><span>{label}</span><strong>{value}</strong><small>{suffix}</small></div>
    </article>
  );
}

function Timesheet({ period, entries, employees, activeEmployee, onEmployeeChange, onEntryChange, onQuickFill }) {
  const [filter, setFilter] = useState('all');
  if (!activeEmployee) return <EmptyEmployees />;
  const totalDays = daysInMonth(period.month, period.year);
  const employeeSummary = getEmployeeSummary(entries, activeEmployee.id, period);
  const days = Array.from({ length: totalDays }, (_, index) => index + 1).filter((day) => {
    if (filter === 'all') return true;
    const info = getDayInfo(period.year, period.month, day);
    const entry = entries[entryKey(activeEmployee.id, day)];
    if (filter === 'missing') return !info.closed && !entry;
    if (filter === 'worked') return getEntryMinutes(entries, activeEmployee.id, day, period) !== null;
    return true;
  });

  return (
    <div className="view-stack">
      <section className="timesheet-header panel">
        <div className="employee-selector-wrap">
          <label htmlFor="employee-select">עובד</label>
          <select id="employee-select" value={activeEmployee.id} onChange={(event) => onEmployeeChange(event.target.value)}>
            {employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.name}</option>)}
          </select>
        </div>
        <div className="employee-month-total"><span>סה״כ החודש</span><strong>{formatMinutes(employeeSummary.minutes)}</strong><small>{employeeSummary.shifts} משמרות</small></div>
        <button className="button button-primary" onClick={onQuickFill}><Sparkles size={18} />מילוי חכם</button>
      </section>

      <section className="filter-row" aria-label="סינון ימים">
        {[['all', 'כל הימים'], ['missing', 'חסרים'], ['worked', 'דווחו']].map(([id, label]) => (
          <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </section>

      <section className="days-list">
        {days.map((day) => (
          <DayCard
            key={day}
            day={day}
            period={period}
            employee={activeEmployee}
            entry={entries[entryKey(activeEmployee.id, day)]}
            onChange={(patch) => onEntryChange(activeEmployee.id, day, patch)}
          />
        ))}
        {!days.length && <div className="empty-filter"><CheckCircle2 size={30} /><strong>הכול מסודר</strong><span>לא נמצאו ימים להצגה בסינון הזה.</span></div>}
      </section>
    </div>
  );
}

function DayCard({ day, period, employee, entry = {}, onChange }) {
  const info = getDayInfo(period.year, period.month, day);
  const minutes = info.closed || entry.off ? null : calculateDuration(entry.start, entry.end, { short: info.short });
  const isToday = (() => {
    const today = new Date();
    return today.getFullYear() === period.year && today.getMonth() + 1 === period.month && today.getDate() === day;
  })();

  if (info.closed) {
    return (
      <article className="day-card day-closed">
        <DateBadge day={day} info={info} isToday={isToday} />
        <div className="closed-message"><UtensilsCrossed size={21} /><div><strong>המסעדה סגורה</strong><span>אין עבודה ביום ראשון</span></div></div>
        <span className="status-pill closed">סגור</span>
      </article>
    );
  }

  return (
    <article className={`day-card ${info.short ? 'day-short' : ''} ${isToday ? 'day-today' : ''} ${entry.off ? 'day-off' : ''}`}>
      <DateBadge day={day} info={info} isToday={isToday} />
      <div className="day-inputs">
        <Field label="כניסה">
          <input type="time" step="900" value={entry.start || ''} disabled={entry.off} max={info.short ? '16:45' : undefined} onChange={(event) => onChange({ start: event.target.value })} />
        </Field>
        <span className="time-separator">—</span>
        <Field label="יציאה">
          <input type="time" step="900" value={entry.end || ''} disabled={entry.off} max={info.short ? FRIDAY_END : undefined} onChange={(event) => onChange({ end: event.target.value })} />
        </Field>
      </div>
      <div className="day-result">
        {entry.off ? <span className="status-pill off">לא עבד</span> : minutes !== null ? <><strong>{formatMinutes(minutes)}</strong><span>שעות</span></> : <><strong>—</strong><span>{entry.start || entry.end ? 'יש להשלים שעות' : 'טרם דווח'}</span></>}
      </div>
      <label className="off-switch">
        <input type="checkbox" checked={Boolean(entry.off)} onChange={(event) => onChange({ off: event.target.checked })} />
        <span><i /></span>
        <em>{entry.off ? 'סומן כחופש' : 'לא עבד'}</em>
      </label>
      {info.short && <span className="friday-note">שישי · עד 17:00</span>}
    </article>
  );
}

function DateBadge({ day, info, isToday }) {
  return <div className="date-badge"><span>{info.name}</span><strong>{day}</strong>{isToday && <small>היום</small>}</div>;
}

function Employees({ employees, summary, onOpenEmployee, onAdd, onRemove }) {
  const [search, setSearch] = useState('');
  const filtered = summary.byEmployee.filter((employee) => employee.name.includes(search.trim()));
  return (
    <div className="view-stack">
      <section className="page-heading">
        <div><span className="eyebrow dark">ניהול צוות</span><h1>העובדים שלי</h1><p>{employees.length} עובדים פעילים במערכת</p></div>
        <button className="button button-primary" onClick={onAdd}><Plus size={18} />עובד חדש</button>
      </section>
      <div className="search-box"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="חיפוש עובד…" /></div>
      <section className="employee-grid">
        {filtered.map((employee) => (
          <article className="employee-card" key={employee.id}>
            <div className="employee-card-top"><span className="avatar large">{employee.name.charAt(0)}</span><button className="remove-employee" onClick={() => onRemove(employee)} aria-label={`הסר את ${employee.name}`}><Trash2 size={17} /></button></div>
            <h2>{employee.name}</h2><span className="employee-role">עובד מסעדה</span>
            <div className="employee-card-stats"><div><strong>{formatMinutes(employee.minutes)}</strong><span>שעות</span></div><i /><div><strong>{employee.shifts}</strong><span>משמרות</span></div></div>
            <button className="button button-soft full" onClick={() => onOpenEmployee(employee.id)}>פתח דוח שעות <ChevronLeft size={17} /></button>
          </article>
        ))}
      </section>
      {!filtered.length && <div className="empty-filter"><UserRound size={30} /><strong>לא נמצא עובד</strong><span>נסה לחפש שם אחר.</span></div>}
    </div>
  );
}

function SettingsView({ restaurantName, onRestaurantNameChange, onExport, onFillAll, onClear, onInstall }) {
  return (
    <div className="view-stack settings-view">
      <section className="page-heading"><div><span className="eyebrow dark">התאמה אישית</span><h1>הגדרות</h1><p>שם המסעדה, כללי העבודה וניהול הנתונים.</p></div></section>
      <section className="settings-grid">
        <div className="panel settings-section">
          <div className="settings-title"><span className="settings-icon"><Store size={20} /></span><div><h2>פרטי המסעדה</h2><p>השם יופיע בראש המערכת.</p></div></div>
          <Field label="שם המסעדה"><input type="text" value={restaurantName} onChange={(event) => onRestaurantNameChange(event.target.value)} /></Field>
        </div>
        <div className="panel settings-section">
          <div className="settings-title"><span className="settings-icon"><CalendarDays size={20} /></span><div><h2>כללי שבוע העבודה</h2><p>הכללים נאכפים אוטומטית.</p></div></div>
          <div className="compact-rules"><span><b>ראשון</b> סגור</span><span><b>שישי</b> עד 17:00</span><span><b>שבת</b> עבודה רגילה</span></div>
        </div>
        <div className="panel settings-section span-two">
          <div className="settings-title"><span className="settings-icon"><FileSpreadsheet size={20} /></span><div><h2>נתונים ודוחות</h2><p>פעולות על החודש שנבחר בחלק העליון.</p></div></div>
          <div className="settings-actions">
            <button className="action-tile" onClick={onExport}><span><Download size={20} /></span><div><strong>ייצוא ל־Excel</strong><small>פירוט מלא וסיכום חודשי</small></div><ChevronLeft size={18} /></button>
            <button className="action-tile" onClick={onFillAll}><span><Sparkles size={20} /></span><div><strong>מילוי חכם לכולם</strong><small>מילוי כל המשמרות החסרות</small></div><ChevronLeft size={18} /></button>
            <button className="action-tile install" onClick={onInstall}><span><Smartphone size={20} /></span><div><strong>התקנה בטלפון</strong><small>הוספה למסך הבית כאפליקציה</small></div><ChevronLeft size={18} /></button>
            <button className="action-tile danger" onClick={onClear}><span><Trash2 size={20} /></span><div><strong>ניקוי החודש</strong><small>מחיקת כל הדיווחים בחודש</small></div><ChevronLeft size={18} /></button>
          </div>
        </div>
      </section>
      <div className="local-note"><Save size={18} /><div><strong>שמירה מקומית מאובטחת</strong><span>הנתונים נשמרים בדפדפן במכשיר הזה. לסנכרון בין מכשירים יידרש חיבור למסד נתונים.</span></div></div>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function Modal({ title, children, onClose, tone = 'default' }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal ${tone}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-heading"><h2>{title}</h2><button onClick={onClose} aria-label="סגירה"><X size={21} /></button></div>
        {children}
      </section>
    </div>
  );
}

function EmptyEmployees() {
  return <div className="empty-employees"><Users size={38} /><h2>אין עובדים ברשימה</h2><p>הוסף עובד חדש דרך מסך העובדים כדי להתחיל.</p></div>;
}

function MobileNav({ activeView, onNavigate }) {
  return (
    <nav className="mobile-nav" aria-label="ניווט ראשי">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return <button key={item.id} className={activeView === item.id ? 'active' : ''} onClick={() => onNavigate(item.id)}><Icon size={21} /><span>{item.label}</span></button>;
      })}
    </nav>
  );
}

export default App;
