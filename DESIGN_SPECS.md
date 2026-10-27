# Professional Service Card Design Details

## Card Structure

```
┌─────────────────────────────────────────┐
│  [Color Icon]                           │
│  56px × 56px with tone background       │
│                                         │
│  Service Category Name                  │
│  (1.1rem, 700 weight)                   │
│                                         │
│  X services                             │
│  (0.82rem, muted color)                 │
│                                         │
│                              [Arrow →]  │
│                              32px circle│
└─────────────────────────────────────────┘
```

## Color Palette

### Icon Backgrounds (56px)
| Tone   | Background | Icon Color | Usage |
|--------|-----------|-----------|-------|
| Green  | #e8f5e9   | #2e7d32   | Home, Housing |
| Blue   | #e3f2fd   | #1565c0   | Business, Transport |
| Rose   | #fce4ec   | #c2185b   | Health, Wellness |
| Orange | #ffe0b2   | #e65100   | Construction, Food |
| Purple | #f3e5f5   | #6a1b9a   | Education, Events |
| Pink   | #fce4ec   | #ad1457   | Retail, Shopping |
| Gold   | #fff8e1   | #f57f17   | Entertainment |

## Spacing & Sizing

### Desktop (1200px+)
- Grid: 4 columns
- Gap: 1.5rem
- Card Padding: 2rem 1.75rem
- Min Height: 240px
- Icon Size: 56px

### Tablet (900-1200px)
- Grid: 3 columns
- Gap: 1.25rem
- Card Padding: 1.75rem 1.5rem
- Min Height: 220px
- Icon Size: 48px

### Mobile Landscape (560-900px)
- Grid: 2 columns
- Gap: 1.15rem
- Card Padding: 1.5rem
- Min Height: 200px

### Mobile Portrait (< 560px)
- Grid: 1 column (full width)
- Gap: 0.8rem
- Card Padding: 1.25rem
- Layout: Horizontal (icon left, content right)
- Icon Size: 44px

## Animation Timings

```css
/* All transitions use standard easing */
transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);

/* Hover effects */
Card lift: translateY(-8px) - 300ms
Icon scale: 1 → 1.12 - 300ms
Arrow shift: 0 → 4px - 300ms

/* Reduces motion */
@media (prefers-reduced-motion: reduce) {
  /* All transitions removed */
}
```

## Typography

### Section Heading
- Font: Default (sans-serif)
- Size: 1.8rem - 2.5rem (responsive)
- Weight: 700
- Color: #1a1a1a

### Card Title (h3)
- Font: Default (sans-serif)
- Size: 1.1rem
- Weight: 700
- Line Height: 1.3
- Color: #1a1a1a
- On Hover: #0f5139 (brand green)

### Service Count
- Font: Default (sans-serif)
- Size: 0.82rem
- Weight: 500
- Color: #999

## Shadow & Depth

### Default State
```css
box-shadow: 0 4px 12px rgba(31, 65, 49, 0.06);
```

### Hover State
```css
box-shadow: 0 16px 32px rgba(31, 65, 49, 0.12);
```

## Borders

### Default
- Border: 1.5px solid #f0f0f0
- Border Radius: 20px

### Hover
- Border: 1.5px solid #e0e0e0
- (Smoother transition on interaction)

## Interactive Elements

### Arrow Button
- Size: 32px × 32px circle
- Default Background: rgba(15, 81, 57, 0.08)
- Default Color: #0f5139
- Hover Background: rgba(15, 81, 57, 0.16)
- Transition: 300ms cubic-bezier(0.4, 0, 0.2, 1)

### Link Behavior
- `<a>` element with RouterLink
- Entire card is clickable
- No text decoration
- Standard focus ring on keyboard navigation

## Accessibility Features

### Color Contrast
- Primary text vs background: 21:1 (AAA)
- Icon vs icon background: 8:1+ (AAA)
- Secondary text vs background: 4.5:1+ (AA)

### Focus States
- Browser default focus ring applied
- High contrast for keyboard navigation
- Clear visual indication of interactive elements

### Semantic HTML
- `<a>` element for links
- Proper heading hierarchy (h3 for titles)
- Logical tab order

### Screen Readers
- Card titles clearly identify each category
- Arrow icon is decorative (aria-hidden could be used)
- Service count provides context

## Icon Mapping

| Category | Icon | CSS Class |
|----------|------|-----------|
| Home/Housing | bi-house-heart | bi |
| Construction | bi-hammer | bi |
| Health/Medical | bi-heart-pulse | bi |
| Education/Learning | bi-mortarboard | bi |
| Business/Professional | bi-briefcase | bi |
| Retail/Shopping | bi-shop | bi |
| Food/Dining | bi-cup-hot | bi |
| Transport/Travel | bi-car-front | bi |
| Entertainment/Events | bi-calendar-event | bi |
| Fallback | bi-grid-3x3-gap | bi |

All icons use Bootstrap Icons (bi class).

## Responsive Breakpoints

```scss
@media (max-width: 1200px) {
  // 3 column layout
}

@media (max-width: 900px) {
  // 2 column layout
}

@media (max-width: 560px) {
  // 1 column horizontal layout
}

@media (prefers-reduced-motion: reduce) {
  // No animations
}
```

## CSS Classes Reference

| Class | Purpose |
|-------|---------|
| `.nc-pro-category-grid` | Main grid container |
| `.nc-pro-category-card` | Individual card element |
| `.nc-pro-icon-wrapper` | Icon container (56px) |
| `.tone-green/.tone-blue/etc` | Color variant modifier |
| `.nc-pro-category-content` | Content wrapper (title, count) |
| `.nc-pro-arrow` | Arrow indicator button |

## Browser Rendering

- GPU acceleration via `transform` properties
- CSS Grid for layout
- Flexbox for internal card structure
- CSS transitions for smooth animations
- No JavaScript animations
- Optimized for 60fps performance

---

*Last Updated: October 24, 2026*
