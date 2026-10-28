# Mobile Hero Carousel Images Setup Guide

## Overview
The hero carousel now supports **different images for mobile and desktop** viewports. Images automatically switch at **767px viewport width**.

---

## Current Configuration

### Desktop Images (≥ 768px)
Located in `home-beta.component.ts` → `heroSlidesDesktop` array:
```typescript
readonly heroSlidesDesktop = [
  '/assets/images/Welcome%20to%20Nam%20Chidambaram.png',                          // Slide 1
  '/assets/images/Annamalai%20University%20Clock%20Tower%20Campus.png',           // Slide 2
  '/assets/images/Chidambaram%2C%20Built%20by%20Community.png',                   // Slide 3
  '/assets/images/pichavaram-image-1.png',                                         // Slide 4
  '/assets/images/samiyarpettai-beach-1.png',                                      // Slide 5
  '/assets/images/hotel-image-lakshmi-villas.png'                                  // Slide 6
];
```

### Mobile Images (≤ 767px)
Located in `home-beta.component.ts` → `heroSlidesMobile` array:
```typescript
readonly heroSlidesMobile = [
  '/assets/images/Welcome%20to%20Nam%20Chidambaram.png',                          // Slide 1
  '/assets/images/Annamalai%20University%20Clock%20Tower%20Campus.png',           // Slide 2
  '/assets/images/Chidambaram%2C%20Built%20by%20Community.png',                   // Slide 3
  '/assets/images/pichavaram-image-1.png',                                         // Slide 4
  '/assets/images/samiyarpettai-beach-1.png',                                      // Slide 5
  '/assets/images/hotel-image-lakshmi-villas.png'                                  // Slide 6
];
```

---

## How It Works

1. **Component Detection**: On page load and window resize, the component checks viewport width
2. **Automatic Switching**: If width ≤ 767px → uses `heroSlidesMobile`, otherwise → uses `heroSlidesDesktop`
3. **Computed Signal**: `heroSlides` is a computed signal that returns the correct array
4. **No Logic Changes**: All carousel logic (navigation, auto-play) works automatically with correct images

---

## Recommendations for Mobile Images

### Optimization Tips

#### 1. **Image Cropping**
- **Mobile**: Crop images to portrait or square aspect ratio (9:16 or 1:1)
- **Desktop**: Keep widescreen format (16:9 or 3:2)
- **Benefit**: Ensures full image visibility without distortion on small screens

#### 2. **Image Resolution**
- **Mobile**: 480px × 720px (small file size, fast loading)
- **Tablet**: 600px × 900px (medium)
- **Desktop**: 1200px × 800px (full resolution)
- **Benefit**: Faster load times, better mobile performance

#### 3. **Content Focus**
- **Mobile**: Frame subjects in center, avoid important elements at edges (they get cropped)
- **Desktop**: Can use full composition with side elements
- **Benefit**: Better user experience on all devices

#### 4. **File Format**
- Use **WebP** with PNG fallback for better compression
- Example: `image-name.webp` (smaller) + `image-name.png` (fallback)
- Current setup uses PNG, which is fine but WebP would be faster

---

## Example Mobile Image Strategy

### Slide 1: Welcome
- **Desktop**: Wide landscape welcome scene
- **Mobile**: Cropped portrait version with main focal point centered

### Slide 2: University
- **Desktop**: Full campus view with landmark
- **Mobile**: Closeup of clock tower (main focal point)

### Slide 3: Community
- **Desktop**: Wide group/community gathering
- **Mobile**: Portrait-oriented community moment

### Slide 4: Pichavaram
- **Desktop**: Scenic wide landscape
- **Mobile**: Vertical landscape or close-up detail

### Slide 5: Beach
- **Desktop**: Wide beach horizon
- **Mobile**: Vertical beach scene

### Slide 6: Hotel
- **Desktop**: Full building facade
- **Mobile**: Entrance or signature feature closeup

---

## How to Update Images

### Step 1: Create Mobile Versions
Create mobile-optimized images and save them to `/assets/images/` with names like:
- `welcome-mobile.png` (480×720)
- `university-mobile.png` (480×720)
- etc.

**OR** keep the same names if replacing existing files with mobile-optimized versions.

### Step 2: Update Component
Edit `home-beta.component.ts` and update the `heroSlidesMobile` array:

```typescript
readonly heroSlidesMobile = [
  '/assets/images/welcome-mobile.png',                    // Mobile-optimized
  '/assets/images/university-mobile.png',                 // Mobile-optimized
  '/assets/images/community-mobile.png',                  // Mobile-optimized
  '/assets/images/pichavaram-mobile.png',                 // Mobile-optimized
  '/assets/images/beach-mobile.png',                      // Mobile-optimized
  '/assets/images/hotel-mobile.png'                       // Mobile-optimized
];
```

### Step 3: Test
1. View the site on mobile (< 768px) - should show mobile images
2. View on desktop (> 768px) - should show desktop images
3. Resize browser window - images should switch automatically

---

## Current Behavior

✅ **Viewport Detection**: Automatic at 767px breakpoint  
✅ **Responsive**: Images change when resizing browser  
✅ **No Layout Shift**: Both arrays have same 6 images  
✅ **Auto-play**: Works on both desktop and mobile  
✅ **Controls**: Responsive buttons on all screens  

---

## What You Can Customize

### Option A: Different Images (Recommended)
- Create mobile-specific versions with better framing
- Optimize file sizes for mobile devices
- Provide better visual experience on small screens

### Option B: Different Order
- Show slides in different order on mobile
- Example: Focus on most important content first on mobile

### Option C: Different Number of Slides
- Fewer slides on mobile (e.g., 4 instead of 6)
- Modify the array length in `heroSlidesMobile`

### Option D: Different Transitions
- Slower transitions on mobile for accessibility
- Modify CSS `transition` property in media queries

---

## File Checklist

```
src/
├── app/
│   └── home/
│       ├── home-beta.component.ts       ✅ Updated with mobile detection
│       ├── home-beta.component.html     ✅ Updated with computed signal
│       └── home-beta.component.scss     ✅ Optimized for all breakpoints
└── assets/
    └── images/
        ├── Welcome%20to%20Nam%20Chidambaram.png
        ├── Annamalai%20University%20Clock%20Tower%20Campus.png
        ├── Chidambaram%2C%20Built%20by%20Community.png
        ├── pichavaram-image-1.png
        ├── samiyarpettai-beach-1.png
        └── hotel-image-lakshmi-villas.png
        
        ⚠️ TODO: Add mobile-optimized versions:
        ├── welcome-mobile.png (or replace existing)
        ├── university-mobile.png (or replace existing)
        ├── community-mobile.png (or replace existing)
        ├── pichavaram-mobile.png (or replace existing)
        ├── beach-mobile.png (or replace existing)
        └── hotel-mobile.png (or replace existing)
```

---

## Next Steps

1. **Provide mobile images** - Suggest which images should be different for mobile
2. **File format** - Confirm format (PNG, WebP, etc.)
3. **Image dimensions** - Confirm optimal sizes for mobile (e.g., 480×720)
4. **File naming** - Confirm naming convention (e.g., `-mobile` suffix)
5. **Update paths** - I'll update the component with new image URLs

---

## Testing After Setup

```bash
# Test on desktop
# URL: http://localhost:4200 (window width > 768px)
# Expected: Shows heroSlidesDesktop images

# Test on mobile
# Chrome DevTools: F12 → Toggle Device Toolbar (Ctrl+Shift+M)
# Set to iPhone/mobile view (width < 768px)
# Expected: Shows heroSlidesMobile images

# Test resize
# Resize browser window between 767px and 768px
# Expected: Images smoothly switch
```

---

## Questions?

Let me know:
1. **Which slides** need different images for mobile?
2. **Image style**: Same photo cropped differently? Or completely different images?
3. **Aspect ratio preference**: Portrait (9:16), Square (1:1), or Modified landscape?
4. **File size**: Do you have file size constraints?
5. **Naming convention**: How should mobile images be named?
