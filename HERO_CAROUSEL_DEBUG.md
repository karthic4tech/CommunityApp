# Mobile Hero Carousel - Debugging Guide

## 🔍 What Changed for Debugging

I've added several debugging features to help identify the issue:

### 1. **Debug Indicator on Page**
- A green box appears at the **top-left of the hero section**
- Shows: `📱 MOBILE | Width: XXXpx | Images: Mobile (480×720)`
- Or: `💻 DESKTOP | Width: XXXpx | Images: Desktop (High-Res)`

### 2. **Improved Viewport Detection**
- Better detection for Chrome DevTools mobile emulation
- Handles orientation changes
- Debounced resize listener

### 3. **Console Logging**
- Open DevTools (F12) → Console tab
- See detailed logs about viewport detection
- See which image set is being used

---

## 🧪 How to Test Now

### On Mobile (≤ 767px):

1. **Open Chrome DevTools** (F12)
2. **Toggle Device Toolbar** (Ctrl+Shift+M)
3. **Set to iPhone 12** (390px width)
4. **Look at top-left of hero section** - you should see:
   ```
   📱 MOBILE | Width: 390px | Images: Mobile (480×720)
   ```

5. **Check Console** (F12 → Console tab) - you should see:
   ```
   Hero carousel initialized
   Mobile images: (6) [...nam-chidambaram-mobile-480x720.png, ...]
   Desktop images: (6) [...Welcome%20to%20Nam%20Chidambaram.png, ...]
   Current viewport width: 390
   Is mobile: true
   Current slides: (6) [...nam-chidambaram-mobile-480x720.png, ...]
   ```

### On Desktop (≥ 768px):

1. **Close Device Toolbar** or make browser window wide
2. **Look at top-left** - you should see:
   ```
   💻 DESKTOP | Width: 1920px | Images: Desktop (High-Res)
   ```

---

## ❌ If Mobile Images Still Don't Show

Try these steps:

### Step 1: Verify Image Files Exist
```bash
# Navigate to public folder
cd public/assets/images/

# Check if mobile images are there
ls -la nam-chidambaram-mobile-480x720.png
ls -la annamalai-university-mobile-480x720.png
ls -la chidambaram-community-mobile-480x720.png
ls -la pichavaram-tourism-mobile-480x720.png
ls -la samiyarpettai-beach-mobile-480x720.png
ls -la lakshmi-villas-mobile-480x720.png
```

### Step 2: Check Browser Console for 404 Errors
1. Open DevTools (F12)
2. Go to Console tab
3. Look for red errors like:
   ```
   Failed to load resource: the server responded with a status of 404
   /assets/images/nam-chidambaram-mobile-480x720.png
   ```

### Step 3: Check Network Tab
1. DevTools → Network tab
2. Refresh page (F5)
3. Filter for image files
4. Look for mobile image names
5. If status is 404 → file not found
6. If status is 200 → file loading OK but might not display

### Step 4: Clear Cache
1. DevTools → Application tab (or Storage)
2. Click "Clear site data"
3. Refresh page (Ctrl+Shift+R)

### Step 5: Check Image Dimensions
1. DevTools → Network tab
2. Find mobile image
3. Click on it
4. Go to Preview tab
5. Check if image is actually 480×720

---

## 📊 What Should Happen

| Screen Size | Expected Indicator | Expected Images | Height |
|---|---|---|---|
| **Mobile** (≤767px) | 📱 MOBILE | nam-chidambaram-mobile-480x720.png | 520px |
| **Desktop** (≥768px) | 💻 DESKTOP | Welcome%20to%20Nam%20Chidambaram.png | 520px |

---

## 🛠️ Troubleshooting Checklist

- [ ] Viewport detection shows correct device type (check green indicator)
- [ ] Console shows correct image set being used
- [ ] Mobile images exist in `/public/assets/images/`
- [ ] No 404 errors in Network tab
- [ ] Browser cache cleared
- [ ] Window resized to trigger viewport check
- [ ] Orientation change detected (mobile)

---

## 📝 Next Steps

1. **Test on mobile** and check the green debug indicator
2. **Open Console** (F12) and share what you see
3. **Take a screenshot** showing the debug indicator
4. **Check Network tab** for any 404 errors
5. **Let me know** which files are showing 404s (if any)

The debug indicator will help us identify if:
- ✅ Viewport detection is working
- ✅ Images are loading from correct path
- ❌ Image files don't exist
- ❌ Viewport size is wrong
- ❌ Computed signal isn't updating

---

## 🎯 Expected Result

When everything works correctly on mobile:
1. Green indicator shows: `📱 MOBILE | Width: 390px | Images: Mobile (480×720)`
2. Console shows mobile image paths
3. Hero carousel displays mobile-optimized images
4. Images are 480×720px instead of full desktop size
5. Performance is faster (smaller images)

---

**Test this now and let me know what the debug indicator shows!** 📱
