// RealmCraft calendar: each world sets its own hours per day, week days, months and seasons (1, 2, 4, 8, 12…).
// Time is kept as "hours since the start"; everything else is worked out from it.
(function () {
  const RC = window.RC;
  RC.Calendar = class {
    constructor(def) {
      this.def = Object.assign({ hoursPerDay: 24, hourSeconds: 45, days: ['Day'], months: [{ name: 'Month', days: 30 }], seasons: [{ name: 'Season', from: 0 }], marketDays: [], start: {} }, def || {});
      const d = this.def, s = Object.assign({ year: 1, month: 0, day: 1, hour: 8 }, d.start);
      this.daysPerYear = d.months.reduce((a, m) => a + m.days, 0);
      let days = (s.year - 1) * this.daysPerYear; for (let i = 0; i < s.month; i++) days += d.months[i].days; days += s.day - 1;
      this.hours = days * d.hoursPerDay + s.hour;
      this.speed = 1;   // 0 = time stands still
    }
    step(dt) { this.hours += (dt / this.def.hourSeconds) * this.speed; }
    add(h) { this.hours += h; }
    // what time it is, in every unit the world has
    now() {
      const d = this.def, H = d.hoursPerDay;
      const dayIndex = Math.floor(this.hours / H), hour = this.hours - dayIndex * H;
      const year = Math.floor(dayIndex / this.daysPerYear) + 1; let dy = dayIndex - (year - 1) * this.daysPerYear, month = 0; const dayOfYear = dy + 1;
      while (month < d.months.length - 1 && dy >= d.months[month].days) { dy -= d.months[month].days; month++; }
      let season = d.seasons[0]; for (const s of d.seasons) if (month >= s.from) season = s;
      if (month < d.seasons[0].from) season = d.seasons[d.seasons.length - 1];   // (before the first season starts: still the last one, e.g. winter)
      const weekday = dayIndex % d.days.length;
      const f = hour / H;   // 0..1 through the day: night, dawn, morning, afternoon, evening (in proportion, for any day length)
      const period = f < 5 / 24 ? 'night' : f < 8 / 24 ? 'dawn' : f < 12 / 24 ? 'morning' : f < 17 / 24 ? 'afternoon' : f < 20.5 / 24 ? 'evening' : 'night';
      return { hour, dayOfYear,day: dy + 1, dayNumber: dayIndex + 1, month, monthName: d.months[month].name, year, weekday, weekdayName: d.days[weekday],
        season: season.name, seasonIndex: d.seasons.indexOf(season), period, dayFraction: f, market: d.marketDays.includes(weekday) };
    }
    // 10:07 AM (a 24-hour world) or 13:40 of 30 (any other)
    clock(h = this.now().hour) {
      const H = this.def.hoursPerDay, hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
      if (H !== 24) return `${hh}:${String(mm).padStart(2, '0')} of ${H}`;
      return `${String(hh % 12 === 0 ? 12 : hh % 12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`;
    }
  };
})();
