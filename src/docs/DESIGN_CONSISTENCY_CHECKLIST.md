# DESIGN CONSISTENCY CHECKLIST — Enterprise Polish

## PRINZIPIEN
- ✅ Gleiche Layoutstruktur auf allen Pages
- ✅ Gleiche Headerlogik
- ✅ Gleiche Section-Rhythmen
- ✅ Gleiche Typography
- ✅ Gleiche Card-Systeme
- ✅ Gleiche Hover-States
- ✅ Gleiche Navigation
- ✅ Gleiche Sticky-Logik
- ✅ Gleiche Farben
- ✅ Gleiche Surface-Tiefen
- ✅ Gleiche Loading States
- ✅ Gleiche Empty States

---

## HEADER STRUKTUR (ALLE PAGES)

### Standard Header
```jsx
<div className="bg-white border-b border-[hsl(var(--border-subtle))]/60 px-6 py-5">
  <div className="max-w-7xl mx-auto">
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-X-500 to-Y-600 flex items-center justify-center shadow-sm flex-shrink-0">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <h1 className="text-lg font-bold text-[hsl(var(--text-heading))]">Page Title</h1>
        <p className="text-xs text-[hsl(var(--text-muted))]">Subtitle description</p>
      </div>
    </div>
  </div>
</div>
```

### CHECKLISTE:
- [ ] Dashboard
- [ ] Kundenübersicht
- [ ] Neukunden
- [ ] Verträge
- [ ] Anträge
- [ ] Dokumente
- [ ] Aufgaben
- [ ] Verkaufschancen
- [ ] Beratungsdossier
- [ ] Finance Dashboard
- [ ] CEO Cockpit
- [ ] Alle Admin Pages

---

## SECTION SPACING

### Standard Section
```jsx
<div className="p-6">
  <div className="max-w-7xl mx-auto">
    {/* Content */}
  </div>
</div>
```

### Compact Section
```jsx
<div className="p-4">
  <div className="max-w-5xl mx-auto">
    {/* Content */}
  </div>
</div>
```

### CHECKLISTE:
- [ ] Alle Pages verwenden gleiche Spacing (p-6 für main, p-4 für compact)
- [ ] max-w-7xl für wide layouts
- [ ] max-w-5xl für standard layouts
- [ ] max-w-3xl für narrow layouts

---

## CARD SYSTEM

### Enterprise Card
```jsx
<div className="bg-white rounded-xl border border-[hsl(var(--border-subtle))]/40 p-4 hover:shadow-sm transition-all">
  {/* Content */}
</div>
```

### Surface Card
```jsx
<div className="bg-[hsl(var(--surface-0))] rounded-lg border border-[hsl(var(--border-subtle))]/30 p-3">
  {/* Content */}
</div>
```

### CHECKLISTE:
- [ ] Alle Customer Cards verwenden gleichen Style
- [ ] Alle Contract Cards verwenden gleichen Style
- [ ] Alle Task Cards verwenden gleichen Style
- [ ] Alle KPI Cards verwenden gleichen Style
- [ ] Hover-States sind konsistent
- [ ] Border-Colors sind konsistent

---

## TYPOGRAPHY

### Headings
```jsx
h1: text-lg font-bold text-[hsl(var(--text-heading))]  // Page Title
h2: text-sm font-bold text-[hsl(var(--text-heading))]  // Section Title
h3: text-[11px] font-semibold uppercase tracking-widest text-[hsl(var(--text-muted))]  // Subsection
```

### Body Text
```jsx
text-sm: Standard body text
text-xs: Secondary text
text-[10px]: Tertiary text / captions
text-[11px]: Small labels
```

### CHECKLISTE:
- [ ] Alle Pages verwenden gleiche Heading-Hierarchie
- [ ] Body Text ist konsistent (text-sm für main content)
- [ ] Muted Text verwendet text-[hsl(var(--text-muted))]
- [ ] Keine harten Farbwerte (#000, #fff) — nur Design Tokens

---

## BUTTONS & ACTIONS

### Primary Button
```jsx
<Button className="h-9 px-4 text-sm font-semibold bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))/0.9]">
  Action
</Button>
```

### Secondary Button
```jsx
<Button variant="outline" className="h-9 px-4 text-sm">
  Cancel
</Button>
```

### Icon Button
```jsx
<button className="p-2 text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--text-heading))] hover:bg-[hsl(var(--surface-2))] rounded-md transition-colors">
  <Icon className="w-4 h-4" />
</button>
```

### CHECKLISTE:
- [ ] Alle Primary Buttons verwenden gleichen Style
- [ ] Alle Secondary Buttons verwenden gleichen Style
- [ ] Icon Buttons sind konsistent (p-2, rounded-md)
- [ ] Hover-States sind gleich

---

## LOADING STATES

### Table Loading
```jsx
<LoadingTable rows={8} className="py-12" />
```

### Card Loading
```jsx
<div className="space-y-3">
  {[...Array(3)].map((_, i) => (
    <div key={i} className="bg-white rounded-xl border p-4 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
    </div>
  ))}
</div>
```

### CHECKLISTE:
- [ ] Alle Pages verwenden LoadingTable für Tables
- [ ] Card Loading ist konsistent
- [ ] Animate-pulse wird verwendet
- [ ] Loading States zeigen realistische Skeletons

---

## EMPTY STATES

### Standard Empty State
```jsx
<EmptyState
  type="empty"
  title="Keine Ergebnisse"
  description="Passen Sie das Filter an."
  size="lg"
/>
```

### CHECKLISTE:
- [ ] Alle Pages verwenden EmptyState Component
- [ ] Types sind konsistent (empty, customers, tasks, etc.)
- [ ] Icons sind konsistent
- [ ] Colors sind konsistent

---

## BADGES & STATUS

### Status Badge
```jsx
<span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
  Status
</span>
```

### Priority Badge
```jsx
<span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-primary text-white">
  High
</span>
```

### CHECKLISTE:
- [ ] Alle Status Badges verwenden gleichen Style
- [ ] Priority Badges sind konsistent
- [ ] Colors folgen Design System (emerald, amber, rose, blue)
- [ ] Border-Colors sind konsistent (border-{color}-200)

---

## FORM ELEMENTS

### Input Field
```jsx
<Input 
  placeholder="Search..." 
  className="w-full pl-9 pr-8 py-1.5 text-[13px] border border-[hsl(var(--border-subtle))] rounded-lg bg-[hsl(var(--surface-0))]"
/>
```

### Select Dropdown
```jsx
<select className="w-full p-2 border rounded text-sm bg-background mt-0.5">
  <option>Option 1</option>
</select>
```

### CHECKLISTE:
- [ ] Alle Inputs verwenden gleichen Style
- [ ] Border-Colors sind konsistent
- [ ] Padding ist gleich (p-2 oder py-1.5)
- [ ] Rounded-Corners sind konsistent (rounded-lg)

---

## NAVIGATION & BREADCRUMBS

### Segment Navigation
```jsx
<div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-[hsl(var(--primary))] text-white">
    Active
  </button>
  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-[hsl(var(--surface-1))]">
    Inactive
  </button>
</div>
```

### CHECKLISTE:
- [ ] Segment Navigation ist konsistent
- [ ] Active States sind gleich
- [ ] Hover-States sind gleich
- [ ] Spacing ist konsistent (gap-1.5, px-3, py-1.5)

---

## COLOR SYSTEM

### Backgrounds
- Page: `bg-[hsl(var(--surface-1))]`
- Cards: `bg-white` oder `bg-[hsl(var(--surface-0))]`
- Surfaces: `bg-[hsl(var(--surface-1))]` oder `bg-[hsl(var(--surface-2))]`

### Borders
- Subtle: `border-[hsl(var(--border-subtle))]/40`
- Default: `border-[hsl(var(--border-subtle))]/60`
- Strong: `border-[hsl(var(--border-default))]`

### Text
- Heading: `text-[hsl(var(--text-heading))]`
- Body: `text-[hsl(var(--text-body))]`
- Muted: `text-[hsl(var(--text-muted))]`
- Subtle: `text-[hsl(var(--text-subtle))]`

### CHECKLISTE:
- [ ] Keine harten Farbwerte (#000, #fff, etc.)
- [ ] Alle Colors verwenden Design Tokens
- [ ] Semantic Colors sind konsistent (emerald=success, amber=warning, rose=error)

---

## MOBILE RESPONSIVENESS

### Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

### CHECKLISTE:
- [ ] Grid-Layouts brechen korrekt um (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- [ ] Navigation ist scrollable auf Mobile (overflow-x-auto)
- [ ] Touch Targets sind ≥ 44px
- [ ] Text ist lesbar auf Mobile (≥ text-sm)
- [ ] Cards sind full-width auf Mobile

---

## PERFORMANCE

### Query Optimization
```jsx
useQuery({
  queryKey: ['data'],
  queryFn: () => fetchData(),
  staleTime: 5 * 60 * 1000, // 5 Minuten
  refetchOnWindowFocus: false,
})
```

### CHECKLISTE:
- [ ] Alle Queries haben staleTime gesetzt
- [ ] refetchOnWindowFocus ist false wo nicht benötigt
- [ ] Limits sind gesetzt (max 50-100 Records)
- [ ] Keine N+1 Queries

---

## TESTING PROTOCOL

### Daily Review
1. [ ] 3 zufällige Pages auswählen
2. [ ] Header-Struktur prüfen
3. [ ] Spacing messen (Pixel-perfect?)
4. [ ] Typography prüfen (alle Font-Sizes?)
5. [ ] Colors prüfen (alle Tokens?)
6. [ ] Hover-States testen
7. [ ] Loading States prüfen
8. [ ] Empty States prüfen
9. [ ] Mobile testen (iPad, iPhone)

### Fix Protocol
1. [ ] Inkonsistenz dokumentieren
2. [ ] Component identifizieren
3. [ ] Fix mit find_replace umsetzen
4. [ ] Alle betroffenen Pages updaten
5. [ ] Testing durchführen

---

**STATUS:** 🟡 IN PROGRESS
**FOKUS:** Konsistenz vor Features
**ZIEL:** 100% Design-System Compliance bis 2026-06-02