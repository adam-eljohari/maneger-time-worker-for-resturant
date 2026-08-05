export const MONTH_NAMES = [
  '', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

export const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const YEAR_OPTIONS = Array.from({ length: 11 }, (_, index) => 2025 + index);
export const DEFAULT_START = '07:00';
export const DEFAULT_END = '19:00';
export const FRIDAY_END = '17:00';

export function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

export function getDayInfo(year, month, day) {
  const dayOfWeek = new Date(year, month - 1, day).getDay();
  return {
    dayOfWeek,
    name: DAY_NAMES[dayOfWeek],
    closed: dayOfWeek === 0,
    short: dayOfWeek === 5,
    saturday: dayOfWeek === 6
  };
}

export function parseTime(value) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function calculateDuration(start, end, { short = false } = {}) {
  const startMinutes = parseTime(start);
  const endMinutes = parseTime(end);
  if (startMinutes === null || endMinutes === null) return null;
  if (startMinutes === endMinutes) return null;
  if (short && (start >= FRIDAY_END || end > FRIDAY_END || endMinutes < startMinutes)) return null;
  let duration = endMinutes - startMinutes;
  if (duration < 0) duration += 24 * 60;
  return duration;
}

export function formatMinutes(minutes) {
  if (!Number.isFinite(minutes)) return '—';
  const rounded = Math.round(minutes);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

export function entryKey(employeeId, day) {
  return `${employeeId}:${day}`;
}

export function getEntryMinutes(entries, employeeId, day, period) {
  const info = getDayInfo(period.year, period.month, day);
  if (info.closed) return null;
  const entry = entries[entryKey(employeeId, day)];
  if (!entry || entry.off) return null;
  return calculateDuration(entry.start, entry.end, { short: info.short });
}

export function getEmployeeSummary(entries, employeeId, period) {
  let minutes = 0;
  let shifts = 0;
  for (let day = 1; day <= daysInMonth(period.month, period.year); day += 1) {
    const value = getEntryMinutes(entries, employeeId, day, period);
    if (value !== null) {
      minutes += value;
      shifts += 1;
    }
  }
  return { minutes, shifts };
}

export function getMonthSummary(entries, employees, period) {
  const byEmployee = employees.map((employee) => ({
    ...employee,
    ...getEmployeeSummary(entries, employee.id, period)
  }));
  const minutes = byEmployee.reduce((sum, employee) => sum + employee.minutes, 0);
  const shifts = byEmployee.reduce((sum, employee) => sum + employee.shifts, 0);
  return {
    minutes,
    shifts,
    workingEmployees: byEmployee.filter((employee) => employee.shifts > 0).length,
    average: shifts ? Math.round(minutes / shifts) : 0,
    byEmployee
  };
}

export function normalizeEntries(entries, employees, period) {
  const normalized = { ...entries };
  const totalDays = daysInMonth(period.month, period.year);
  employees.forEach((employee) => {
    for (let day = 1; day <= totalDays; day += 1) {
      const key = entryKey(employee.id, day);
      const entry = normalized[key];
      if (!entry) continue;
      const info = getDayInfo(period.year, period.month, day);
      if (info.closed) delete normalized[key];
      else if (info.short && entry.end > FRIDAY_END) normalized[key] = { ...entry, end: FRIDAY_END };
    }
  });
  return normalized;
}

export function fillEmptyEntries(entries, employees, period, scopeEmployeeId, start, end) {
  const next = { ...entries };
  const targets = scopeEmployeeId
    ? employees.filter((employee) => employee.id === scopeEmployeeId)
    : employees;
  let count = 0;
  targets.forEach((employee) => {
    for (let day = 1; day <= daysInMonth(period.month, period.year); day += 1) {
      const info = getDayInfo(period.year, period.month, day);
      const key = entryKey(employee.id, day);
      if (info.closed || next[key]) continue;
      next[key] = { start, end: info.short ? FRIDAY_END : end, off: false };
      count += 1;
    }
  });
  return { entries: next, count };
}
