# Tailwind CSS v4 — Spacing & Layout Rules

> **Read this before writing ANY component.** These rules prevent the #1 UI bug: compressed layouts with no breathing room.

---

## CRITICAL: Do NOT Add a Manual CSS Reset

Tailwind v4's `@import "tailwindcss"` includes its own preflight reset. **Never** add this to your CSS:

```css
/* ❌ DO NOT DO THIS — breaks all Tailwind spacing utilities */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
```

**Why it breaks:** Tailwind v4 generates utilities inside `@layer utilities`. Un-layered CSS (like a bare `*` reset) has higher specificity than layered CSS. So `* { padding: 0 }` overrides `.p-8 { padding: 32px }` — every `p-*`, `m-*`, `gap-*`, `space-*` utility silently fails.

**If you need custom base styles**, wrap them in `@layer base`:
```css
@layer base {
  html {
    font-family: var(--font-body);
    color: var(--color-text-primary);
  }
}
```

---

## Spacing Mental Model

Think of every UI element in terms of these layers:

```
PAGE  →  p-4 (mobile) / p-6 (desktop) padding on content area
  CARD  →  p-6 (compact) / p-8 (forms) internal padding
    SECTION  →  space-y-6 or mt-8 between sections
      FIELD GROUP  →  space-y-5 (20px) between each field
        LABEL → mb-1.5 (6px) below label, before input
        INPUT → h-11 (44px) or h-12 (48px) height
```

**If you ever write a card without `p-6` or `p-8`, STOP — you're making the compression mistake.**

---

## Required Spacing Values

### Cards
| Context | Padding | Border Radius |
|---------|---------|---------------|
| Form cards | `p-8` (32px) | `rounded-2xl` (16px) |
| Content cards | `p-6` (24px) | `rounded-xl` (12px) |
| Compact cards (stats) | `p-5` (20px) | `rounded-xl` (12px) |
| Mobile cards | `p-6` (24px) | `rounded-xl` (12px) |

### Form Fields
| Element | Spacing Class | Pixel Value |
|---------|--------------|-------------|
| Between field groups | `space-y-5` | 20px |
| Label to input gap | `mb-1.5` on label | 6px |
| Input height | `h-11` | 44px |
| Input horizontal padding | `px-3.5` | 14px |
| Primary button height | `h-12` | 48px |
| Fields to action row | `mt-4` | 16px |
| Action row to button | `mt-6` | 24px |

### Page Layout
| Element | Spacing Class | Pixel Value |
|---------|--------------|-------------|
| Content area padding (desktop) | `p-6` | 24px |
| Content area padding (mobile) | `p-4` | 16px |
| Between page sections | `space-y-6` | 24px |
| Page title to content | `mb-6` | 24px |
| Max content width | `max-w-[1400px]` | 1400px |

### Sidebar
| Element | Value |
|---------|-------|
| Menu item padding | `px-3 h-10` |
| Section label margin | `mt-4 mb-2 ml-3` |
| Divider margin | `my-3` |
| Sidebar padding | `py-2 px-4` |

### Topbar
| Element | Value |
|---------|-------|
| Height | `h-16` (64px) |
| Horizontal padding | `pl-4 pr-6` (mobile) / `pl-6 pr-6` (desktop) |
| Right cluster gap | `gap-2` |

### Tables
| Element | Value |
|---------|-------|
| Cell padding | `px-4 py-3` |
| Header text | `text-xs uppercase font-semibold` |
| Row hover | hover:bg-gray-50 |

### Modals
| Element | Value |
|---------|-------|
| Internal padding | `p-6` |
| Header to body gap | `mt-4` |
| Body to footer gap | `mt-6` |

---

## Common Mistakes

### 1. Using `gap-1` or `gap-2` for form fields
```tsx
// ❌ Too tight — fields crammed together
<div className="space-y-2">

// ✅ Correct — 20px between fields
<div className="space-y-5">
```

### 2. Forgetting card padding
```tsx
// ❌ Content touches card edges
<div className="bg-white rounded-xl border">
  <input ... />
</div>

// ✅ 32px breathing room
<div className="bg-white rounded-xl border p-8">
  <input ... />
</div>
```

### 3. Labels too small or no gap to input
```tsx
// ❌ Label crammed against input, too small
<label className="text-xs">Email</label>
<input ... />

// ✅ Proper size + 6px gap
<label className="block text-sm font-medium text-gray-700 mb-1.5">
  Email Address
</label>
<input ... />
```

### 4. No outer padding on centered layouts
```tsx
// ❌ Card touches screen edges on mobile
<div className="flex items-center justify-center min-h-screen">

// ✅ 16px side padding prevents edge-touching
<div className="flex items-center justify-center min-h-screen px-4">
```

### 5. Buttons too short
```tsx
// ❌ Default height — too short for primary actions
<button className="bg-red-600 text-white rounded-lg px-4 py-2">

// ✅ 48px height — proper touch target
<button className="bg-red-600 text-white rounded-lg w-full h-12">
```

### 6. Using uppercase labels with tiny font
```tsx
// ❌ Hard to read, looks cramped
<label className="text-[10px] uppercase tracking-wider">

// ✅ Clean, readable
<label className="text-sm font-medium text-gray-700">
```

---

## Verification Checklist

After building any component, check:

- [ ] Card has `p-6` or `p-8` padding (inspect → computed padding should be 24px or 32px)
- [ ] Form fields have ~20px vertical gap between them
- [ ] Labels have ~6px gap before their input
- [ ] Inputs are at least 44px tall
- [ ] Primary buttons are 48px tall
- [ ] At 375px mobile width, nothing touches screen edges
- [ ] The layout feels like "comfortable breathing room", not "crammed prototype"

---

## Tailwind v4 `@theme` Notes

- Custom CSS variables go in `@theme { }` — they become Tailwind utilities automatically
- `--color-*` variables → `bg-*`, `text-*`, `border-*` utilities
- `--shadow-*` variables → `shadow-*` utilities  
- `--font-*` variables → `font-*` utilities
- Standard spacing (`p-8`, `mt-6`, `gap-4`) works out of the box — no config needed
- Do NOT override `--spacing` unless you want to change the 4px base unit
