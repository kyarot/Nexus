# Design Document: Mobile Responsive UI

## Overview

This design document outlines the technical approach for implementing comprehensive mobile responsiveness across the entire Community Echo application. The application is built with React + TypeScript, Vite, Tailwind CSS, and shadcn/ui components. The design ensures seamless user experience across mobile (320px-767px), tablet (768px-1023px), and desktop (1024px+) viewports with no layout breaks, overflow issues, or visual errors.

### Goals

1. **Universal Responsiveness**: Every page and component adapts gracefully to all viewport sizes
2. **Touch-Optimized**: All interactive elements meet WCAG 2.1 Level AA accessibility standards (44x44px minimum)
3. **Performance**: Optimized rendering and loading for mobile devices and networks
4. **Consistency**: Unified responsive patterns across all user roles (coordinator, fieldworker, volunteer, public)
5. **Maintainability**: Clear patterns and documentation for future development

### Key Technical Decisions

**Decision 1: Hybrid Approach for Responsive Logic**
- **Use Tailwind CSS responsive utilities** (sm:, md:, lg:, xl:, 2xl:) as the primary mechanism for layout adaptation
- **Use useIsMobile() hook** for conditional rendering logic where CSS alone cannot achieve the desired behavior (e.g., rendering different components, changing data structures)
- **Rationale**: Tailwind utilities provide declarative, maintainable styling with excellent performance. The hook handles cases requiring JavaScript logic (component swapping, conditional features).

**Decision 2: Sidebar State Management**
- **Desktop (≥1024px)**: Sidebar auto-expands on hover, collapses when mouse leaves (existing behavior preserved)
- **Mobile (<1024px)**: Sidebar hidden by default, replaced with bottom navigation bar
- **Tablet (768px-1023px)**: Sidebar behaves like desktop but with adjusted spacing
- **Rationale**: Mobile users need maximum screen real estate. Bottom navigation is a familiar mobile pattern. Desktop hover behavior provides quick access without permanent screen space consumption.

**Decision 3: Table Responsiveness Strategy**
- **Primary approach**: Transform tables into card-based layouts on mobile using CSS Grid
- **Secondary approach**: Horizontal scroll with visual indicators for tables where card transformation is impractical
- **Implementation**: Use Tailwind's `hidden` and `block` utilities to conditionally render table vs card layouts
- **Rationale**: Card layouts provide better mobile UX for most data. Horizontal scroll preserved for complex tables where card transformation loses context.

**Decision 4: shadcn/ui Component Adaptation**
- **Dialog components**: Use responsive max-width classes (`max-w-[95vw] md:max-w-lg`) and ensure proper padding
- **Sheet components**: Leverage existing Sheet component for mobile slide-ins (already mobile-optimized)
- **Popover/Dropdown**: Ensure touch-friendly spacing and positioning with `side` and `sideOffset` props
- **Rationale**: shadcn/ui components are built on Radix UI with good mobile foundations. Tailwind utilities provide the responsive layer.

**Decision 5: Performance Optimization**
- **Lazy loading**: Use React.lazy() for route-based code splitting (already implemented)
- **Image optimization**: Ensure responsive images with proper sizing attributes
- **Chart rendering**: Use responsive containers with dynamic dimensions based on viewport
- **Rationale**: Mobile devices have limited resources. Lazy loading and optimized rendering ensure fast initial load and smooth interactions.



## Architecture

### Responsive Breakpoint System

The application uses Tailwind CSS's default breakpoint system with mobile-first approach:

```typescript
// Tailwind breakpoints (from tailwind.config.ts)
{
  'sm': '640px',   // Small tablets and large phones (landscape)
  'md': '768px',   // Tablets
  'lg': '1024px',  // Laptops and desktops
  'xl': '1280px',  // Large desktops
  '2xl': '1400px'  // Extra large desktops (custom)
}
```

**Viewport Categories**:
- **Mobile**: 320px - 767px (default styles, no prefix)
- **Tablet**: 768px - 1023px (md: prefix)
- **Desktop**: 1024px+ (lg: prefix)

**Mobile-First Principle**: All base styles target mobile viewports. Larger viewport styles are added progressively using breakpoint prefixes.

### Layout Architecture

```
┌─────────────────────────────────────────┐
│         DashboardLayout                 │
│  ┌──────────┬───────────────────────┐  │
│  │          │                       │  │
│  │ Global   │   Main Content        │  │
│  │ Sidebar  │   (Outlet)            │  │
│  │ (Desktop)│                       │  │
│  │          │                       │  │
│  └──────────┴───────────────────────┘  │
│  ┌─────────────────────────────────┐   │
│  │  Bottom Nav (Mobile Only)       │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Desktop Layout** (≥1024px):
- Sidebar: 64px width, expands on hover
- Main content: Full remaining width with left margin animation
- Bottom nav: Hidden

**Mobile Layout** (<1024px):
- Sidebar: Hidden
- Main content: Full width, no margin
- Bottom nav: Fixed at bottom, 64px height

### Component Hierarchy

```
App
├── Landing Pages (Public)
│   ├── Index (Hero, Features, How It Works, Testimonials, Footer)
│   ├── Login
│   ├── Signup
│   └── CommunityVoice
│
├── DashboardLayout (Authenticated)
│   ├── GlobalSidebar (Desktop) / BottomNav (Mobile)
│   ├── Coordinator Pages
│   │   ├── Dashboard (StatMetricCards, Charts, Maps)
│   │   ├── Missions (Mission Cards, Filters)
│   │   ├── Volunteers (Avatar Cards, Grid)
│   │   ├── Forecast (Charts, Data Visualizations)
│   │   ├── GeminiInsights (Insight Cards)
│   │   ├── IntelligenceHub (Intelligence Displays)
│   │   ├── ImpactReports (Reports, Tables)
│   │   ├── ResourceInventory (Inventory Tables)
│   │   ├── CommunityEcho (Feedback Displays)
│   │   ├── AlertsFeed (Alert Cards)
│   │   └── NeedTerrainMap (Map Component)
│   │
│   ├── Fieldworker Pages
│   │   ├── FieldWorker (Dashboard)
│   │   ├── ActiveMission (Mission Details)
│   │   ├── VoiceReport (Voice Recording)
│   │   ├── ScanSurvey (Camera Interface)
│   │   ├── MyReports (Report Cards)
│   │   └── Profile (Profile Form)
│   │
│   └── Volunteer Pages
│       ├── VolunteerDashboard (Dashboard Widgets)
│       ├── VolunteerMissions (Mission Cards)
│       ├── EmpathyEngine (Empathy Content)
│       ├── VolunteerImpact (Impact Visualizations)
│       └── VolunteerProfile (Profile Form)
│
└── Shared Components
    ├── UI Components (shadcn/ui)
    ├── Map Components (MapPicker, MissionsLiveMap, etc.)
    ├── Data Visualizations (Charts, Graphs)
    └── Form Components (Inputs, Buttons, Selects)
```

### State Management for Responsive Behavior

**Sidebar State** (existing):
```typescript
// hooks/use-sidebar-store.ts
interface SidebarStore {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}
```

**Mobile Detection** (existing):
```typescript
// hooks/use-mobile.tsx
const MOBILE_BREAKPOINT = 768;
export function useIsMobile(): boolean {
  // Returns true when viewport < 768px
}
```

**Usage Pattern**:
```typescript
const isMobile = useIsMobile();
const { isOpen, setIsOpen } = useSidebarStore();

// Conditional rendering
{isMobile ? <MobileComponent /> : <DesktopComponent />}

// Conditional behavior
onClick={() => {
  if (isMobile) setIsOpen(false); // Close sidebar on mobile after navigation
}}
```



## Components and Interfaces

### 1. Navigation Components

#### GlobalSidebar Component

**Current Implementation**: 
- Fixed 64px width sidebar with hover expansion
- Bottom navigation bar for mobile (already implemented)

**Responsive Enhancements**:

```typescript
// GlobalSidebar.tsx modifications
export function GlobalSidebar({ role, onTabChange, activeTab }) {
  const isMobile = useIsMobile();
  
  return (
    <>
      {/* Desktop Sidebar - hidden on mobile */}
      <motion.aside
        className="fixed left-0 top-0 bottom-0 w-16 bg-gradient-to-b from-[#1E1B4B] to-[#16133A] 
                   border-r border-white/10 z-50 hidden lg:flex flex-col py-5"
        // ... existing hover logic
      >
        {/* Sidebar content */}
      </motion.aside>

      {/* Mobile Bottom Navigation - visible only on mobile */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-[#1E1B4B] border-t border-white/10 
                      flex lg:hidden items-center justify-around z-50 px-2 shadow-2xl">
        {/* Bottom nav items */}
      </nav>
    </>
  );
}
```

**Key Responsive Classes**:
- `hidden lg:flex`: Hide sidebar on mobile, show on desktop
- `flex lg:hidden`: Show bottom nav on mobile, hide on desktop
- Touch targets: All nav buttons use `w-10 h-10` (40px) with padding, achieving 44px+ touch area

#### DashboardLayout Component

**Responsive Modifications**:

```typescript
export function DashboardLayout({ role }: DashboardLayoutProps) {
  const { isOpen } = useSidebarStore();
  const isMobile = useIsMobile();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <GlobalSidebar role={role} />
      <motion.main 
        animate={{ 
          marginLeft: isMobile ? 0 : (isOpen ? 64 : 0),
          paddingBottom: isMobile ? '4rem' : 0 // Space for bottom nav
        }}
        className="flex-1 overflow-y-auto"
      >
        <Outlet />
        {role === "coordinator" && !isMobile ? <NexusCopilot /> : null}
      </motion.main>
    </div>
  );
}
```

**Responsive Behavior**:
- Mobile: No left margin, bottom padding for nav bar
- Desktop: Left margin animates with sidebar state
- Copilot: Hidden on mobile to reduce clutter

#### Landing Page Navbar

**Responsive Pattern**:

```typescript
export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-lg border-b border-border">
      <div className="max-w-content mx-auto px-4 md:px-8 flex items-center justify-between h-16">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="NEXUS Logo" className="w-8 h-8 rounded-lg" />
          <span className="text-xl font-bold text-primary">NEXUS</span>
        </div>

        {/* Desktop Navigation - hidden on mobile */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href} 
               className="text-sm font-medium text-text-secondary hover:text-primary transition-colors">
              {link.label}
            </a>
          ))}
        </div>

        {/* Mobile Hamburger - visible only on mobile */}
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden w-11 h-11 flex items-center justify-center"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* CTA Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login">Login</Link>
          </Button>
          <Button variant="gradient" size="sm" className="rounded-pill" asChild>
            <Link to="/login">Get Started Free</Link>
          </Button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-surface border-t border-border">
          <div className="px-4 py-4 space-y-3">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href}
                 className="block py-2 text-sm font-medium text-text-secondary">
                {link.label}
              </a>
            ))}
            <div className="pt-3 border-t border-border space-y-2">
              <Button variant="ghost" size="sm" className="w-full" asChild>
                <Link to="/login">Login</Link>
              </Button>
              <Button variant="gradient" size="sm" className="w-full rounded-pill" asChild>
                <Link to="/login">Get Started Free</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
```

### 2. Card Components

#### StatMetricCard Component

**Responsive Pattern**:

```typescript
export function StatMetricCard({ label, value, delta, accent, className }: StatMetricCardProps) {
  return (
    <div className={cn(
      "rounded-card border border-l-4 bg-card shadow-card",
      "p-4 md:p-5", // Reduced padding on mobile
      accentStyles[accent], 
      className
    )}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl md:text-[28px] font-bold leading-tight text-foreground font-data">
        {/* Smaller font on mobile */}
        {value}
      </p>
      {delta && (
        <div className="mt-2 flex items-center gap-1 text-xs font-medium">
          {/* Delta content */}
        </div>
      )}
    </div>
  );
}
```

**Grid Layout for Cards**:

```typescript
// Dashboard page
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
  <StatMetricCard label="Active Missions" value={12} />
  <StatMetricCard label="Volunteers" value={48} />
  <StatMetricCard label="Reports Today" value={23} />
  <StatMetricCard label="Zones Covered" value={8} />
</div>
```

**Responsive Grid Behavior**:
- Mobile (default): 1 column, cards stack vertically
- Small tablets (sm:): 2 columns
- Desktop (lg:): 4 columns

#### GeminiInsightCard Component

**Responsive Pattern**:

```typescript
export function GeminiInsightCard({ insight, className }: GeminiInsightCardProps) {
  return (
    <div className={cn(
      "rounded-card border bg-card shadow-card",
      "p-4 md:p-6", // Responsive padding
      className
    )}>
      <div className="flex items-start gap-3 md:gap-4">
        <div className="shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/10 
                        flex items-center justify-center">
          <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm md:text-base font-semibold text-foreground mb-2">
            {insight.title}
          </h3>
          <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
            {insight.content}
          </p>
        </div>
      </div>
    </div>
  );
}
```

### 3. Map Components

#### MapPicker Component

**Responsive Pattern**:

```typescript
export function MapPicker({ onLocationSelect, className }: MapPickerProps) {
  const isMobile = useIsMobile();
  
  return (
    <div className={cn(
      "relative rounded-card overflow-hidden border border-border",
      "h-64 md:h-96 lg:h-[500px]", // Responsive height
      className
    )}>
      <MapContainer
        center={[0, 0]}
        zoom={isMobile ? 10 : 12} // Adjusted zoom for mobile
        className="w-full h-full"
        zoomControl={!isMobile} // Hide zoom controls on mobile (use pinch)
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {/* Map content */}
      </MapContainer>
      
      {/* Mobile-optimized controls */}
      <div className={cn(
        "absolute z-[1000]",
        "top-4 right-4 md:top-6 md:right-6", // Responsive positioning
        "flex flex-col gap-2"
      )}>
        <button className="w-11 h-11 bg-white rounded-lg shadow-lg flex items-center justify-center">
          <Locate className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
```

**Key Responsive Features**:
- Height scales with viewport: 256px (mobile) → 384px (tablet) → 500px (desktop)
- Zoom level adjusted for mobile screens
- Touch-friendly controls (44x44px minimum)
- Pinch-to-zoom enabled by default on mobile

### 4. Data Visualization Components

#### Chart Container Pattern

**Responsive Wrapper**:

```typescript
export function ResponsiveChartContainer({ children, className }: Props) {
  return (
    <div className={cn("w-full", className)}>
      <ResponsiveContainer width="100%" height={300} className="md:h-[400px]">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
```

**Usage with Recharts**:

```typescript
<ResponsiveChartContainer>
  <BarChart data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis 
      dataKey="name" 
      tick={{ fontSize: 12 }} // Smaller font on mobile
      angle={-45} // Angle labels on mobile
      textAnchor="end"
      height={60}
    />
    <YAxis tick={{ fontSize: 12 }} />
    <Tooltip 
      contentStyle={{ fontSize: '14px' }} // Touch-friendly tooltip
    />
    <Legend 
      wrapperStyle={{ fontSize: '12px' }}
      layout="horizontal" // Stack legend on mobile if needed
    />
    <Bar dataKey="value" fill="#4F46E5" />
  </BarChart>
</ResponsiveChartContainer>
```

#### CommunityPulseDonut Component

**Responsive Pattern**:

```typescript
export function CommunityPulseDonut({ data, className }: Props) {
  const isMobile = useIsMobile();
  
  return (
    <div className={cn("flex flex-col md:flex-row items-center gap-4 md:gap-8", className)}>
      {/* Chart */}
      <div className="w-full md:w-1/2">
        <ResponsiveContainer width="100%" height={isMobile ? 200 : 300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={isMobile ? 50 : 70}
              outerRadius={isMobile ? 80 : 110}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      
      {/* Legend */}
      <div className="w-full md:w-1/2 space-y-2">
        {data.map((item) => (
          <div key={item.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-sm text-foreground">{item.name}</span>
            </div>
            <span className="text-sm font-semibold">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```



### 5. Form Components

#### Form Input Pattern

**Responsive Input Component**:

```typescript
export function ResponsiveInput({ label, error, ...props }: ResponsiveInputProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <input
        className={cn(
          "w-full rounded-lg border border-input bg-background",
          "px-3 py-2 md:px-4 md:py-2.5", // Responsive padding
          "text-base", // 16px minimum to prevent iOS zoom
          "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
          "transition-colors",
          error && "border-destructive"
        )}
        {...props}
      />
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
```

**Key Mobile Considerations**:
- `text-base` (16px): Prevents iOS Safari from zooming on input focus
- Full width on mobile: `w-full`
- Touch-friendly padding: Minimum 44px height achieved with `py-2.5`
- Clear focus indicators for accessibility

#### Form Layout Pattern

**Responsive Form Container**:

```typescript
export function ResponsiveForm({ children, onSubmit, className }: Props) {
  return (
    <form 
      onSubmit={onSubmit}
      className={cn(
        "w-full max-w-md mx-auto",
        "px-4 md:px-0", // Padding on mobile, none on desktop
        "space-y-4 md:space-y-6", // Responsive spacing
        className
      )}
    >
      {children}
    </form>
  );
}
```

**Usage Example (Login Page)**:

```typescript
export function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Welcome Back
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Sign in to your account
          </p>
        </div>
        
        <ResponsiveForm onSubmit={handleSubmit}>
          <ResponsiveInput
            label="Email"
            type="email"
            placeholder="you@example.com"
            required
          />
          <ResponsiveInput
            label="Password"
            type="password"
            placeholder="••••••••"
            required
          />
          
          <Button 
            type="submit" 
            className="w-full h-11 md:h-12 text-base"
          >
            Sign In
          </Button>
        </ResponsiveForm>
      </div>
    </div>
  );
}
```

#### Select and Dropdown Components

**Responsive Select Pattern**:

```typescript
<Select>
  <SelectTrigger className="w-full h-11 md:h-12 text-base">
    <SelectValue placeholder="Select an option" />
  </SelectTrigger>
  <SelectContent 
    className="max-h-[60vh]" // Prevent overflow on mobile
    position="popper"
    sideOffset={4}
  >
    <SelectItem value="option1" className="h-11 text-base">
      Option 1
    </SelectItem>
    <SelectItem value="option2" className="h-11 text-base">
      Option 2
    </SelectItem>
  </SelectContent>
</Select>
```

**Key Features**:
- Touch-friendly height: 44px minimum
- Font size: 16px to prevent zoom
- Max height constraint for mobile viewports
- Proper positioning with `sideOffset`

### 6. Table Components

#### Responsive Table Strategy

**Approach 1: Card Transformation (Preferred)**

Transform table rows into cards on mobile:

```typescript
export function ResponsiveTable({ data, columns }: ResponsiveTableProps) {
  const isMobile = useIsMobile();
  
  if (isMobile) {
    return (
      <div className="space-y-4">
        {data.map((row, index) => (
          <div key={index} className="rounded-card border bg-card p-4 space-y-3">
            {columns.map((column) => (
              <div key={column.key} className="flex justify-between items-start">
                <span className="text-sm font-medium text-muted-foreground">
                  {column.header}
                </span>
                <span className="text-sm text-foreground text-right">
                  {row[column.key]}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <div className="rounded-card border overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-4 py-3 text-left text-sm font-semibold">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index} className="border-t">
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-3 text-sm">
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Approach 2: Horizontal Scroll (For Complex Tables)**

```typescript
export function ScrollableTable({ data, columns }: TableProps) {
  return (
    <div className="relative">
      {/* Scroll indicator */}
      <div className="md:hidden absolute right-0 top-0 bottom-0 w-8 
                      bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
      
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <table className="w-full min-w-[640px]"> {/* Minimum width for readability */}
          <thead className="bg-muted">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-3 md:px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index} className="border-t">
                {columns.map((column) => (
                  <td key={column.key} className="px-3 md:px-4 py-3 text-sm whitespace-nowrap">
                    {row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Decision Matrix**:
- **Use Card Transformation**: When table has ≤5 columns, data is primarily text, row actions are simple
- **Use Horizontal Scroll**: When table has >5 columns, complex data relationships, or when column comparison is important

### 7. Modal and Dialog Components

#### Responsive Dialog Pattern

```typescript
export function ResponsiveDialog({ open, onOpenChange, title, children }: Props) {
  const isMobile = useIsMobile();
  
  if (isMobile) {
    // Use Sheet for mobile (slide-up drawer)
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent 
          side="bottom" 
          className="h-[90vh] rounded-t-2xl"
        >
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 overflow-y-auto h-[calc(90vh-80px)]">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    );
  }
  
  // Use Dialog for desktop
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Alternative: Pure CSS Approach**

```typescript
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className={cn(
    "max-w-[95vw] md:max-w-lg",
    "max-h-[90vh] overflow-y-auto",
    "p-4 md:p-6"
  )}>
    <DialogHeader>
      <DialogTitle className="text-lg md:text-xl">{title}</DialogTitle>
    </DialogHeader>
    <div className="mt-4 space-y-4">
      {children}
    </div>
  </DialogContent>
</Dialog>
```

### 8. Landing Page Components

#### HeroSection Responsive Pattern

```typescript
export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center 
                        px-4 md:px-8 py-20 md:py-0">
      <div className="max-w-content mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Text Content */}
          <div className="text-center lg:text-left space-y-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
              Empower Communities with{" "}
              <span className="text-primary">AI-Driven Insights</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto lg:mx-0">
              NEXUS connects NGOs, volunteers, and communities through intelligent 
              coordination and real-time data.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button size="lg" variant="gradient" className="rounded-pill h-12 px-8">
                Get Started Free
              </Button>
              <Button size="lg" variant="outline" className="rounded-pill h-12 px-8">
                Watch Demo
              </Button>
            </div>
          </div>
          
          {/* Hero Image/Animation */}
          <div className="relative h-64 md:h-96 lg:h-[500px]">
            <HeroFloatingCards />
          </div>
        </div>
      </div>
    </section>
  );
}
```

#### FeaturesSection Responsive Pattern

```typescript
export function FeaturesSection() {
  return (
    <section id="features" className="py-16 md:py-24 px-4 md:px-8 bg-surface">
      <div className="max-w-content mx-auto">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Powerful Features
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to coordinate community impact
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {features.map((feature) => (
            <div key={feature.title} 
                 className="rounded-card border bg-card p-6 md:p-8 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-primary/10 
                              flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 md:w-7 md:h-7 text-primary" />
              </div>
              <h3 className="text-lg md:text-xl font-semibold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-sm md:text-base text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

#### Testimonials Responsive Pattern

```typescript
export function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const isMobile = useIsMobile();
  
  return (
    <section className="py-16 md:py-24 px-4 md:px-8">
      <div className="max-w-content mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-12">
          Trusted by Organizations
        </h2>
        
        {isMobile ? (
          // Mobile: Single testimonial with swipe
          <div className="relative">
            <div className="overflow-hidden">
              <div 
                className="flex transition-transform duration-300"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
              >
                {testimonials.map((testimonial, index) => (
                  <div key={index} className="w-full flex-shrink-0 px-4">
                    <TestimonialCard testimonial={testimonial} />
                  </div>
                ))}
              </div>
            </div>
            
            {/* Navigation dots */}
            <div className="flex justify-center gap-2 mt-6">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    index === currentIndex ? "bg-primary" : "bg-muted"
                  )}
                />
              ))}
            </div>
          </div>
        ) : (
          // Desktop: Grid layout
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <TestimonialCard key={index} testimonial={testimonial} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
```



## Data Models

### Responsive Breakpoint Configuration

```typescript
// types/responsive.ts

export const BREAKPOINTS = {
  mobile: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1400,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

export interface ResponsiveValue<T> {
  mobile?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  '2xl'?: T;
}
```

### Component Props Interfaces

```typescript
// types/components.ts

export interface ResponsiveComponentProps {
  className?: string;
  mobileClassName?: string;
  desktopClassName?: string;
}

export interface TouchTargetProps {
  /** Minimum touch target size in pixels (default: 44) */
  minTouchSize?: number;
  /** Additional padding for touch area */
  touchPadding?: number;
}

export interface ResponsiveGridProps {
  /** Number of columns at each breakpoint */
  cols?: ResponsiveValue<number>;
  /** Gap between items at each breakpoint */
  gap?: ResponsiveValue<number>;
  children: React.ReactNode;
}

export interface ResponsiveTableColumn<T> {
  key: keyof T;
  header: string;
  /** Hide column on mobile */
  hideOnMobile?: boolean;
  /** Custom render function */
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  /** Column width (desktop only) */
  width?: string;
}

export interface ResponsiveTableProps<T> {
  data: T[];
  columns: ResponsiveTableColumn<T>[];
  /** Use card layout on mobile (default: true) */
  mobileCardLayout?: boolean;
  /** Enable horizontal scroll on mobile (default: false) */
  mobileScroll?: boolean;
  /** Row click handler */
  onRowClick?: (row: T) => void;
}
```

### Viewport Detection Hook Interface

```typescript
// hooks/use-viewport.ts

export interface ViewportSize {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

export function useViewport(): ViewportSize {
  const [viewport, setViewport] = useState<ViewportSize>({
    width: window.innerWidth,
    height: window.innerHeight,
    breakpoint: getBreakpoint(window.innerWidth),
    isMobile: window.innerWidth < BREAKPOINTS.md,
    isTablet: window.innerWidth >= BREAKPOINTS.md && window.innerWidth < BREAKPOINTS.lg,
    isDesktop: window.innerWidth >= BREAKPOINTS.lg,
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setViewport({
        width,
        height: window.innerHeight,
        breakpoint: getBreakpoint(width),
        isMobile: width < BREAKPOINTS.md,
        isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
        isDesktop: width >= BREAKPOINTS.lg,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return viewport;
}

function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS['2xl']) return '2xl';
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  if (width >= BREAKPOINTS.sm) return 'sm';
  return 'mobile';
}
```

### Responsive Grid Component Data Model

```typescript
// components/ResponsiveGrid.tsx

export interface ResponsiveGridConfig {
  /** Default mobile: 1 column */
  mobile: number;
  /** Small tablets: 2 columns */
  sm: number;
  /** Tablets: 2-3 columns */
  md: number;
  /** Desktop: 3-4 columns */
  lg: number;
  /** Large desktop: 4+ columns */
  xl: number;
}

export const GRID_PRESETS: Record<string, ResponsiveGridConfig> = {
  cards: { mobile: 1, sm: 2, md: 2, lg: 3, xl: 4 },
  stats: { mobile: 1, sm: 2, md: 2, lg: 4, xl: 4 },
  features: { mobile: 1, sm: 1, md: 2, lg: 3, xl: 3 },
  avatars: { mobile: 2, sm: 3, md: 4, lg: 6, xl: 8 },
};

export function ResponsiveGrid({ 
  preset = 'cards', 
  cols, 
  gap = 4, 
  children 
}: ResponsiveGridProps) {
  const config = cols || GRID_PRESETS[preset];
  
  return (
    <div className={cn(
      "grid",
      `grid-cols-${config.mobile}`,
      `sm:grid-cols-${config.sm}`,
      `md:grid-cols-${config.md}`,
      `lg:grid-cols-${config.lg}`,
      `xl:grid-cols-${config.xl}`,
      `gap-${gap}`
    )}>
      {children}
    </div>
  );
}
```

### Touch Target Validation Model

```typescript
// utils/touch-target.ts

export interface TouchTargetMetrics {
  width: number;
  height: number;
  meetsMinimum: boolean;
  meetsRecommended: boolean;
  warnings: string[];
}

export const TOUCH_TARGET_STANDARDS = {
  /** WCAG 2.5.5 Level AAA minimum */
  minimum: 44,
  /** Recommended for optimal usability */
  recommended: 48,
  /** Minimum spacing between targets */
  spacing: 8,
} as const;

export function validateTouchTarget(
  element: HTMLElement
): TouchTargetMetrics {
  const rect = element.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(element);
  
  // Include padding in touch target calculation
  const paddingTop = parseFloat(computedStyle.paddingTop);
  const paddingBottom = parseFloat(computedStyle.paddingBottom);
  const paddingLeft = parseFloat(computedStyle.paddingLeft);
  const paddingRight = parseFloat(computedStyle.paddingRight);
  
  const width = rect.width + paddingLeft + paddingRight;
  const height = rect.height + paddingTop + paddingBottom;
  
  const warnings: string[] = [];
  
  if (width < TOUCH_TARGET_STANDARDS.minimum) {
    warnings.push(`Width ${width}px is below minimum ${TOUCH_TARGET_STANDARDS.minimum}px`);
  }
  if (height < TOUCH_TARGET_STANDARDS.minimum) {
    warnings.push(`Height ${height}px is below minimum ${TOUCH_TARGET_STANDARDS.minimum}px`);
  }
  
  return {
    width,
    height,
    meetsMinimum: width >= TOUCH_TARGET_STANDARDS.minimum && 
                  height >= TOUCH_TARGET_STANDARDS.minimum,
    meetsRecommended: width >= TOUCH_TARGET_STANDARDS.recommended && 
                      height >= TOUCH_TARGET_STANDARDS.recommended,
    warnings,
  };
}
```

### Responsive Image Model

```typescript
// types/media.ts

export interface ResponsiveImageProps {
  src: string;
  alt: string;
  /** Sizes for different viewports */
  sizes?: {
    mobile?: string;
    tablet?: string;
    desktop?: string;
  };
  /** Aspect ratio (e.g., "16/9", "4/3", "1/1") */
  aspectRatio?: string;
  /** Object fit behavior */
  objectFit?: 'cover' | 'contain' | 'fill' | 'none';
  /** Loading strategy */
  loading?: 'lazy' | 'eager';
  className?: string;
}

export function ResponsiveImage({
  src,
  alt,
  sizes,
  aspectRatio = '16/9',
  objectFit = 'cover',
  loading = 'lazy',
  className,
}: ResponsiveImageProps) {
  return (
    <div 
      className={cn("relative w-full overflow-hidden", className)}
      style={{ aspectRatio }}
    >
      <img
        src={sizes?.mobile || src}
        srcSet={`
          ${sizes?.mobile || src} 640w,
          ${sizes?.tablet || src} 768w,
          ${sizes?.desktop || src} 1024w
        `}
        sizes="(max-width: 640px) 100vw, (max-width: 768px) 100vw, 1024px"
        alt={alt}
        loading={loading}
        className={cn(
          "absolute inset-0 w-full h-full",
          objectFit === 'cover' && "object-cover",
          objectFit === 'contain' && "object-contain",
          objectFit === 'fill' && "object-fill"
        )}
      />
    </div>
  );
}
```



## Error Handling

### Responsive Layout Errors

**Error Type 1: Horizontal Overflow**

```typescript
// utils/overflow-detection.ts

export function detectHorizontalOverflow(): HTMLElement[] {
  const overflowingElements: HTMLElement[] = [];
  const allElements = document.querySelectorAll('*');
  
  allElements.forEach((element) => {
    const el = element as HTMLElement;
    if (el.scrollWidth > el.clientWidth) {
      overflowingElements.push(el);
    }
  });
  
  return overflowingElements;
}

// Development-only overflow detection
if (process.env.NODE_ENV === 'development') {
  window.addEventListener('resize', () => {
    const overflowing = detectHorizontalOverflow();
    if (overflowing.length > 0) {
      console.warn('Horizontal overflow detected:', overflowing);
    }
  });
}
```

**Error Type 2: Touch Target Violations**

```typescript
// utils/touch-target-validator.ts

export function validateAllTouchTargets(): void {
  if (process.env.NODE_ENV !== 'development') return;
  
  const interactiveElements = document.querySelectorAll(
    'button, a, input, select, textarea, [role="button"], [onclick]'
  );
  
  const violations: Array<{ element: HTMLElement; metrics: TouchTargetMetrics }> = [];
  
  interactiveElements.forEach((element) => {
    const metrics = validateTouchTarget(element as HTMLElement);
    if (!metrics.meetsMinimum) {
      violations.push({ element: element as HTMLElement, metrics });
    }
  });
  
  if (violations.length > 0) {
    console.error('Touch target violations detected:', violations);
  }
}
```

**Error Type 3: Viewport-Specific Rendering Errors**

```typescript
// components/ErrorBoundary.tsx

export class ResponsiveErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; viewport: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      viewport: this.getViewportInfo()
    };
  }

  getViewportInfo(): string {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Responsive component error:', {
      error,
      errorInfo,
      viewport: this.state.viewport,
      userAgent: navigator.userAgent,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-card border bg-card p-6 text-center">
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              We encountered an error on {this.state.viewport} viewport.
            </p>
            <Button onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Image Loading Errors

```typescript
// components/ResponsiveImage.tsx

export function ResponsiveImage({ src, alt, fallback, ...props }: Props) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  return (
    <div className="relative w-full">
      {loading && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      
      {error ? (
        <div className="absolute inset-0 bg-muted flex items-center justify-center">
          <ImageOff className="w-8 h-8 text-muted-foreground" />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoading(false)}
          onError={() => {
            setError(true);
            setLoading(false);
            if (fallback) {
              // Attempt to load fallback
              const img = new Image();
              img.src = fallback;
            }
          }}
          className={cn(
            "w-full h-full object-cover transition-opacity",
            loading ? "opacity-0" : "opacity-100"
          )}
          {...props}
        />
      )}
    </div>
  );
}
```

### Map Component Errors

```typescript
// components/MapErrorBoundary.tsx

export function MapErrorBoundary({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<Error | null>(null);
  const isMobile = useIsMobile();

  if (error) {
    return (
      <div className={cn(
        "rounded-card border bg-card flex items-center justify-center",
        "h-64 md:h-96"
      )}>
        <div className="text-center p-4">
          <MapOff className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">
            {isMobile 
              ? "Unable to load map. Please check your connection."
              : "Map failed to load. Please refresh the page."}
          </p>
          <Button size="sm" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary
      fallback={<div>Map error</div>}
      onError={(error) => setError(error)}
    >
      {children}
    </ErrorBoundary>
  );
}
```

### Network Errors (Mobile-Specific)

```typescript
// hooks/use-network-status.ts

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionType, setConnectionType] = useState<string>('unknown');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Detect connection type (if available)
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    if (connection) {
      setConnectionType(connection.effectiveType);
      connection.addEventListener('change', () => {
        setConnectionType(connection.effectiveType);
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, connectionType };
}

// Usage in components
export function NetworkAwareComponent() {
  const { isOnline, connectionType } = useNetworkStatus();
  
  if (!isOnline) {
    return (
      <div className="fixed bottom-20 left-4 right-4 md:bottom-4 md:left-auto md:right-4 md:w-96 
                      bg-destructive text-destructive-foreground rounded-lg p-4 shadow-lg z-50">
        <div className="flex items-center gap-3">
          <WifiOff className="w-5 h-5" />
          <div>
            <p className="font-semibold text-sm">No Internet Connection</p>
            <p className="text-xs opacity-90">Some features may be unavailable</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (connectionType === 'slow-2g' || connectionType === '2g') {
    return (
      <div className="fixed bottom-20 left-4 right-4 md:bottom-4 md:left-auto md:right-4 md:w-96 
                      bg-warning text-warning-foreground rounded-lg p-4 shadow-lg z-50">
        <div className="flex items-center gap-3">
          <Wifi className="w-5 h-5" />
          <div>
            <p className="font-semibold text-sm">Slow Connection</p>
            <p className="text-xs opacity-90">Loading may take longer than usual</p>
          </div>
        </div>
      </div>
    );
  }
  
  return null;
}
```



## Testing Strategy

### Overview

Mobile responsiveness testing requires a multi-layered approach combining automated tests, manual testing, and real device validation. Property-based testing is **NOT applicable** to this feature because:

1. **UI rendering and layout**: Responsiveness is primarily about visual presentation and CSS behavior, not algorithmic correctness
2. **No universal properties**: Layout behavior is device-specific and context-dependent, not universally quantifiable
3. **Better alternatives exist**: Visual regression tests, snapshot tests, and manual device testing provide more value

### Testing Approach

**Testing Layers**:
1. **Unit Tests**: Component rendering at different viewport sizes
2. **Integration Tests**: Layout behavior and responsive state management
3. **Visual Regression Tests**: Screenshot comparison across viewports
4. **Manual Testing**: Real device testing and browser compatibility
5. **Accessibility Tests**: Touch target validation and WCAG compliance

### 1. Unit Tests (Vitest + React Testing Library)

**Viewport Simulation Tests**:

```typescript
// __tests__/components/ResponsiveGrid.test.tsx

import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ResponsiveGrid } from '@/components/ResponsiveGrid';

describe('ResponsiveGrid', () => {
  beforeEach(() => {
    // Reset viewport
    global.innerWidth = 1024;
    global.innerHeight = 768;
  });

  it('renders single column on mobile viewport', () => {
    // Simulate mobile viewport
    global.innerWidth = 375;
    window.dispatchEvent(new Event('resize'));
    
    const { container } = render(
      <ResponsiveGrid preset="cards">
        <div>Card 1</div>
        <div>Card 2</div>
        <div>Card 3</div>
      </ResponsiveGrid>
    );
    
    const grid = container.firstChild as HTMLElement;
    expect(grid).toHaveClass('grid-cols-1');
  });

  it('renders multiple columns on desktop viewport', () => {
    global.innerWidth = 1280;
    window.dispatchEvent(new Event('resize'));
    
    const { container } = render(
      <ResponsiveGrid preset="cards">
        <div>Card 1</div>
        <div>Card 2</div>
        <div>Card 3</div>
      </ResponsiveGrid>
    );
    
    const grid = container.firstChild as HTMLElement;
    expect(grid).toHaveClass('lg:grid-cols-3');
  });
});
```

**Hook Tests**:

```typescript
// __tests__/hooks/use-mobile.test.tsx

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useIsMobile } from '@/hooks/use-mobile';

describe('useIsMobile', () => {
  it('returns true for mobile viewport', () => {
    global.innerWidth = 375;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('returns false for desktop viewport', () => {
    global.innerWidth = 1024;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('updates when viewport changes', () => {
    global.innerWidth = 1024;
    const { result, rerender } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    
    act(() => {
      global.innerWidth = 375;
      window.dispatchEvent(new Event('resize'));
    });
    
    rerender();
    expect(result.current).toBe(true);
  });
});
```

**Component Conditional Rendering Tests**:

```typescript
// __tests__/components/ResponsiveTable.test.tsx

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ResponsiveTable } from '@/components/ResponsiveTable';

const mockData = [
  { id: 1, name: 'Item 1', status: 'Active' },
  { id: 2, name: 'Item 2', status: 'Inactive' },
];

const mockColumns = [
  { key: 'name', header: 'Name' },
  { key: 'status', header: 'Status' },
];

describe('ResponsiveTable', () => {
  it('renders card layout on mobile', () => {
    global.innerWidth = 375;
    
    render(<ResponsiveTable data={mockData} columns={mockColumns} />);
    
    // Should render cards, not table
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });

  it('renders table layout on desktop', () => {
    global.innerWidth = 1024;
    
    render(<ResponsiveTable data={mockData} columns={mockColumns} />);
    
    // Should render table
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
  });
});
```

### 2. Integration Tests

**Navigation State Tests**:

```typescript
// __tests__/integration/navigation.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { DashboardLayout } from '@/layouts/DashboardLayout';

describe('Navigation Integration', () => {
  it('shows bottom navigation on mobile', () => {
    global.innerWidth = 375;
    
    render(
      <BrowserRouter>
        <DashboardLayout role="coordinator" />
      </BrowserRouter>
    );
    
    // Bottom nav should be visible
    const bottomNav = screen.getByRole('navigation');
    expect(bottomNav).toHaveClass('lg:hidden');
  });

  it('shows sidebar on desktop', () => {
    global.innerWidth = 1024;
    
    render(
      <BrowserRouter>
        <DashboardLayout role="coordinator" />
      </BrowserRouter>
    );
    
    // Sidebar should be visible
    const sidebar = screen.getByRole('complementary');
    expect(sidebar).toHaveClass('hidden', 'lg:flex');
  });

  it('closes mobile menu after navigation', () => {
    global.innerWidth = 375;
    
    const { container } = render(
      <BrowserRouter>
        <DashboardLayout role="coordinator" />
      </BrowserRouter>
    );
    
    // Click navigation item
    const navItem = screen.getByText('Dashboard');
    fireEvent.click(navItem);
    
    // Menu should close (implementation-specific assertion)
    // This would check sidebar state
  });
});
```

### 3. Visual Regression Tests (Playwright)

```typescript
// e2e/responsive.spec.ts

import { test, expect } from '@playwright/test';

const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 720 },
};

test.describe('Responsive Layout', () => {
  for (const [device, viewport] of Object.entries(VIEWPORTS)) {
    test(`Dashboard renders correctly on ${device}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/dashboard');
      
      // Wait for content to load
      await page.waitForSelector('[data-testid="dashboard-content"]');
      
      // Take screenshot
      await expect(page).toHaveScreenshot(`dashboard-${device}.png`, {
        fullPage: true,
      });
    });

    test(`No horizontal overflow on ${device}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/dashboard');
      
      // Check for horizontal scrollbar
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      
      expect(hasHorizontalScroll).toBe(false);
    });
  }
});

test.describe('Touch Targets', () => {
  test('All buttons meet minimum touch target size on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/dashboard');
    
    const buttons = await page.locator('button').all();
    
    for (const button of buttons) {
      const box = await button.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });
});

test.describe('Component Responsiveness', () => {
  test('Tables transform to cards on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/dashboard/missions');
    
    // Should not have table element
    const table = await page.locator('table').count();
    expect(table).toBe(0);
    
    // Should have card elements
    const cards = await page.locator('[data-testid="mission-card"]').count();
    expect(cards).toBeGreaterThan(0);
  });

  test('Tables display as tables on desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/dashboard/missions');
    
    // Should have table element
    const table = await page.locator('table').count();
    expect(table).toBeGreaterThan(0);
  });
});
```

### 4. Accessibility Tests

```typescript
// __tests__/accessibility/touch-targets.test.ts

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { GlobalSidebar } from '@/components/nexus/GlobalSidebar';

expect.extend(toHaveNoViolations);

describe('Touch Target Accessibility', () => {
  it('meets WCAG 2.5.5 touch target requirements', async () => {
    global.innerWidth = 375;
    
    const { container } = render(<GlobalSidebar role="coordinator" />);
    
    // Run axe accessibility tests
    const results = await axe(container, {
      rules: {
        'target-size': { enabled: true },
      },
    });
    
    expect(results).toHaveNoViolations();
  });

  it('all interactive elements have minimum 44px touch area', () => {
    global.innerWidth = 375;
    
    const { container } = render(<GlobalSidebar role="coordinator" />);
    
    const interactiveElements = container.querySelectorAll(
      'button, a, input, [role="button"]'
    );
    
    interactiveElements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(element);
      
      const totalWidth = rect.width + 
        parseFloat(computedStyle.paddingLeft) + 
        parseFloat(computedStyle.paddingRight);
      const totalHeight = rect.height + 
        parseFloat(computedStyle.paddingTop) + 
        parseFloat(computedStyle.paddingBottom);
      
      expect(totalWidth).toBeGreaterThanOrEqual(44);
      expect(totalHeight).toBeGreaterThanOrEqual(44);
    });
  });
});
```

### 5. Manual Testing Checklist

**Device Testing Matrix**:

| Device Category | Devices | Browsers | Priority |
|----------------|---------|----------|----------|
| Mobile (iOS) | iPhone 12/13/14, iPhone SE | Safari, Chrome | High |
| Mobile (Android) | Samsung Galaxy S21/S22, Pixel 6/7 | Chrome, Firefox | High |
| Tablet (iOS) | iPad Air, iPad Pro | Safari | Medium |
| Tablet (Android) | Samsung Tab S8 | Chrome | Medium |
| Desktop | Windows, macOS | Chrome, Firefox, Safari, Edge | High |

**Manual Test Cases**:

1. **Navigation**
   - [ ] Bottom navigation visible and functional on mobile
   - [ ] Sidebar hidden on mobile, visible on desktop
   - [ ] Hamburger menu opens/closes correctly
   - [ ] Navigation items are touch-friendly (44x44px minimum)
   - [ ] Active state clearly visible

2. **Layout**
   - [ ] No horizontal scrolling on any page
   - [ ] Content fits within viewport boundaries
   - [ ] Cards stack vertically on mobile
   - [ ] Grids adapt to viewport size
   - [ ] Proper spacing and padding on all viewports

3. **Forms**
   - [ ] Input fields are full-width on mobile
   - [ ] Font size is 16px minimum (no iOS zoom)
   - [ ] Buttons are touch-friendly
   - [ ] Dropdowns and selects work correctly
   - [ ] Form validation messages display properly

4. **Tables**
   - [ ] Tables transform to cards on mobile (where applicable)
   - [ ] Horizontal scroll works with visual indicators (where applicable)
   - [ ] All data remains accessible
   - [ ] Row actions are touch-friendly

5. **Maps**
   - [ ] Maps resize correctly
   - [ ] Touch gestures work (pinch-to-zoom, pan)
   - [ ] Controls are accessible and touch-friendly
   - [ ] Popups display within viewport

6. **Charts**
   - [ ] Charts resize responsively
   - [ ] Legends remain readable
   - [ ] Tooltips work with touch
   - [ ] Axis labels don't overlap

7. **Modals/Dialogs**
   - [ ] Dialogs fit within viewport
   - [ ] Close buttons are accessible
   - [ ] Content scrolls if needed
   - [ ] Backdrop dismissal works

8. **Images/Media**
   - [ ] Images scale correctly
   - [ ] No overflow or distortion
   - [ ] Lazy loading works
   - [ ] Fallbacks display on error

9. **Performance**
   - [ ] Pages load quickly on mobile networks
   - [ ] Smooth scrolling and animations
   - [ ] No layout shifts during load
   - [ ] Touch interactions are responsive

10. **Accessibility**
    - [ ] All touch targets meet 44x44px minimum
    - [ ] Focus indicators visible
    - [ ] Screen reader navigation works
    - [ ] Color contrast meets WCAG AA
    - [ ] Keyboard navigation functional (with external keyboard)

### 6. Browser Compatibility Testing

**Test Matrix**:

```typescript
// playwright.config.ts

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    // Mobile browsers
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
    },
    
    // Tablet browsers
    {
      name: 'iPad',
      use: { ...devices['iPad Pro'] },
    },
    
    // Desktop browsers
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Desktop Firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'Desktop Safari',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
```

### 7. Performance Testing

```typescript
// e2e/performance.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Mobile Performance', () => {
  test('First Contentful Paint < 2s on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    const navigationTiming = await page.evaluate(() => {
      const perfData = window.performance.timing;
      return {
        fcp: perfData.responseEnd - perfData.navigationStart,
      };
    });
    
    expect(navigationTiming.fcp).toBeLessThan(2000);
  });

  test('No layout shifts during load', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');
    
    const cls = await page.evaluate(() => {
      return new Promise((resolve) => {
        let clsValue = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
        
        setTimeout(() => {
          observer.disconnect();
          resolve(clsValue);
        }, 3000);
      });
    });
    
    expect(cls).toBeLessThan(0.1); // Good CLS score
  });
});
```

### Test Execution Strategy

**Development Phase**:
1. Run unit tests on every commit
2. Run integration tests before PR merge
3. Manual testing on at least 2 mobile devices per feature

**Pre-Release Phase**:
1. Full visual regression test suite
2. Complete manual testing checklist
3. Real device testing on all priority devices
4. Performance testing on 3G network simulation

**Post-Release**:
1. Monitor error logs for viewport-specific issues
2. Collect user feedback on mobile experience
3. A/B test responsive patterns if needed



## Implementation Roadmap

### Phase 1: Foundation (Week 1)

**Goals**: Establish responsive infrastructure and core patterns

**Tasks**:
1. Create responsive utility hooks and components
   - Enhance `useViewport()` hook with breakpoint detection
   - Create `ResponsiveGrid` component with presets
   - Create `ResponsiveTable` component with card transformation
   - Create `ResponsiveImage` component with lazy loading

2. Update global layout components
   - Modify `DashboardLayout` for mobile padding
   - Update `GlobalSidebar` mobile/desktop visibility
   - Ensure bottom navigation is properly styled
   - Add responsive error boundaries

3. Establish testing infrastructure
   - Set up Playwright for visual regression
   - Create viewport simulation utilities
   - Add touch target validation utilities
   - Configure test matrix for multiple devices

**Deliverables**:
- Reusable responsive components
- Updated layout system
- Testing infrastructure ready

### Phase 2: Navigation & Core UI (Week 2)

**Goals**: Make navigation and core UI components responsive

**Tasks**:
1. Landing page components
   - `Navbar` with mobile hamburger menu
   - `HeroSection` responsive layout
   - `FeaturesSection` responsive grid
   - `Testimonials` mobile carousel
   - `Footer` stacked layout

2. Authentication pages
   - `Login` page responsive form
   - `Signup` page responsive form
   - Ensure 16px input font size
   - Touch-friendly buttons

3. Core UI components
   - Update all shadcn/ui Dialog usage
   - Ensure Sheet components work on mobile
   - Update Popover positioning
   - Verify Dropdown touch-friendliness

**Deliverables**:
- Fully responsive landing pages
- Mobile-optimized authentication
- Touch-friendly UI components

### Phase 3: Coordinator Dashboard (Week 3)

**Goals**: Make all coordinator pages responsive

**Tasks**:
1. Dashboard page
   - Responsive `StatMetricCard` grid
   - Mobile-friendly charts
   - Adaptive map components

2. Data-heavy pages
   - `Missions` page card layout
   - `Volunteers` page responsive grid
   - `Forecast` page chart adaptations
   - `ImpactReports` table transformations

3. Specialized pages
   - `GeminiInsights` card stacking
   - `IntelligenceHub` mobile layout
   - `ResourceInventory` table strategy
   - `AlertsFeed` mobile cards

**Deliverables**:
- All coordinator pages responsive
- No horizontal overflow
- Touch-friendly interactions

### Phase 4: Fieldworker & Volunteer Pages (Week 4)

**Goals**: Ensure fieldworker and volunteer experiences are mobile-optimized

**Tasks**:
1. Fieldworker pages (already mobile-first, verify)
   - `ActiveMission` component review
   - `VoiceReport` touch controls
   - `ScanSurvey` camera interface
   - `MyReports` card layout
   - `Profile` form optimization

2. Volunteer pages
   - `VolunteerDashboard` responsive widgets
   - `VolunteerMissions` card layout
   - `EmpathyEngine` mobile adaptation
   - `VolunteerImpact` chart responsiveness
   - `VolunteerProfile` form layout

3. Public pages
   - `CommunityVoice` form optimization
   - `CommunityVoiceTrack` mobile layout

**Deliverables**:
- Fieldworker pages verified mobile-ready
- Volunteer pages fully responsive
- Public pages mobile-optimized

### Phase 5: Testing & Refinement (Week 5)

**Goals**: Comprehensive testing and bug fixes

**Tasks**:
1. Automated testing
   - Run full visual regression suite
   - Execute accessibility tests
   - Performance testing on mobile networks
   - Cross-browser compatibility tests

2. Manual testing
   - Test on real iOS devices (iPhone 12, 13, 14, SE)
   - Test on real Android devices (Samsung, Pixel)
   - Test on tablets (iPad, Android tablets)
   - Complete manual testing checklist

3. Bug fixes and refinements
   - Fix any layout breaks
   - Adjust touch targets
   - Optimize performance
   - Refine animations and transitions

**Deliverables**:
- All tests passing
- Zero critical bugs
- Performance metrics met
- Documentation complete

### Phase 6: Documentation & Handoff (Week 6)

**Goals**: Document patterns and best practices

**Tasks**:
1. Developer documentation
   - Responsive component usage guide
   - Breakpoint strategy documentation
   - Touch target guidelines
   - Common patterns and examples

2. Testing documentation
   - Testing strategy guide
   - Device testing procedures
   - Visual regression workflow
   - Accessibility testing checklist

3. Maintenance guide
   - How to add new responsive components
   - Debugging responsive issues
   - Performance optimization tips
   - Browser compatibility notes

**Deliverables**:
- Complete developer documentation
- Testing and QA guides
- Maintenance procedures
- Knowledge transfer complete

## Success Metrics

### Functional Metrics

1. **Zero Horizontal Overflow**: No pages should have horizontal scrolling on any viewport
2. **100% Touch Target Compliance**: All interactive elements meet 44x44px minimum
3. **Zero Layout Breaks**: No visual disruptions or overlapping content
4. **Cross-Browser Compatibility**: Works on Chrome, Safari, Firefox, Edge (mobile and desktop)

### Performance Metrics

1. **First Contentful Paint**: < 2 seconds on mobile 3G
2. **Cumulative Layout Shift**: < 0.1 (good CLS score)
3. **Time to Interactive**: < 3 seconds on mobile
4. **Bundle Size**: No significant increase (< 5% growth)

### Accessibility Metrics

1. **WCAG 2.1 Level AA Compliance**: All touch targets, color contrast, focus indicators
2. **Screen Reader Compatibility**: Proper navigation and content structure
3. **Keyboard Navigation**: Full functionality with external keyboard

### User Experience Metrics

1. **Mobile Bounce Rate**: Decrease by 20%
2. **Mobile Task Completion**: Increase by 30%
3. **Mobile Session Duration**: Increase by 25%
4. **User Satisfaction**: > 4.5/5 on mobile usability surveys

## Risk Mitigation

### Risk 1: Performance Degradation on Mobile

**Mitigation**:
- Implement lazy loading for images and heavy components
- Use code splitting for route-based loading
- Optimize chart rendering with responsive containers
- Monitor bundle size throughout development

### Risk 2: Browser-Specific Issues

**Mitigation**:
- Test on real devices early and often
- Use feature detection instead of browser detection
- Implement fallbacks for unsupported features
- Maintain browser compatibility matrix

### Risk 3: Touch Target Violations

**Mitigation**:
- Use touch target validation utilities in development
- Run automated accessibility tests
- Manual testing on real devices
- Establish minimum size standards in design system

### Risk 4: Complex Table Transformations

**Mitigation**:
- Start with card transformation pattern
- Fall back to horizontal scroll for complex tables
- Test with real data early
- Gather user feedback on table UX

### Risk 5: Map Component Issues on Mobile

**Mitigation**:
- Test map interactions on touch devices early
- Implement error boundaries for map failures
- Provide fallback UI for map loading errors
- Optimize map tile loading for mobile networks

## Conclusion

This design document provides a comprehensive technical approach for implementing mobile responsiveness across the entire Community Echo application. The hybrid strategy of using Tailwind CSS utilities for styling and the `useIsMobile()` hook for conditional logic provides a maintainable and performant solution.

Key success factors:
1. **Mobile-first approach**: Base styles target mobile, progressively enhance for larger viewports
2. **Touch-optimized**: All interactive elements meet WCAG 2.1 Level AA standards (44x44px minimum)
3. **Performance-focused**: Lazy loading, code splitting, and optimized rendering
4. **Comprehensive testing**: Automated tests, visual regression, real device validation
5. **Clear patterns**: Reusable components and documented best practices

The 6-week implementation roadmap provides a structured approach to systematically make every page and component responsive, with built-in testing and refinement phases to ensure quality.

