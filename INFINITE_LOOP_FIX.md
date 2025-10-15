# Infinite Loop Fix - React Query Migration

## 🐛 Problem: Maximum Update Depth Exceeded

**Error Message:**
```
Maximum update depth exceeded. This can happen when a component repeatedly 
calls setState inside componentWillUpdate or componentDidUpdate. React limits 
the number of nested updates to prevent infinite loops.
```

**Location:** `src/app/(app)/products/page.tsx:498` (Switch component)

---

## 🔍 Root Cause

During the React Query migration, we introduced **un-memoized derived state** and **un-memoized callbacks** in the `SmartPricingProvider` context. This caused infinite re-render loops:

### Issue #1: Un-memoized Loading State
```typescript
// ❌ BEFORE (Caused infinite loops)
const isLoadingGlobal = globalDisableMutation.isPending || globalResumeMutation.isPending;
```

**Problem:** 
- This computed value was recreated on every render
- New boolean value → context updates → consumers re-render → new boolean value → repeat
- React detected the infinite loop and threw an error

### Issue #2: Un-memoized Callbacks
```typescript
// ❌ BEFORE (Caused infinite loops)
const handleGlobalToggle = (currentEnabled: boolean) => {
  setPendingGlobalAction(currentEnabled ? 'disable' : 'enable');
  setShowGlobalConfirm(true);
};
```

**Problem:**
- New function created on every render
- Context value changes → all consumers re-render → new function → repeat

### Issue #3: Un-memoized Context Value
```typescript
// ❌ BEFORE (Caused infinite loops)
<SmartPricingContext.Provider
  value={{
    globalEnabled,
    handleGlobalToggle,
    isLoadingGlobal,
    // ... other values
  }}
>
```

**Problem:**
- New object created on every render (even if values inside haven't changed)
- All context consumers re-render unnecessarily
- Triggers more state updates → infinite loop

---

## ✅ Solution: Proper Memoization

### Fix #1: Memoize Loading State with `useMemo`
```typescript
// ✅ AFTER (Prevents infinite loops)
const isLoadingGlobal = useMemo(
  () => globalDisableMutation.isPending || globalResumeMutation.isPending,
  [globalDisableMutation.isPending, globalResumeMutation.isPending]
);
```

**Why it works:**
- Only recomputes when mutation states actually change
- Returns same reference if dependencies haven't changed
- Prevents unnecessary re-renders

### Fix #2: Memoize Callbacks with `useCallback`
```typescript
// ✅ AFTER (Prevents infinite loops)
const handleGlobalToggle = useCallback((currentEnabled: boolean) => {
  setPendingGlobalAction(currentEnabled ? 'disable' : 'enable');
  setShowGlobalConfirm(true);
}, []);

const confirmGlobalDisable = useCallback(async () => {
  // ... implementation
}, [globalDisableMutation]);

const confirmGlobalResume = useCallback(async (option: ResumeOption) => {
  // ... implementation  
}, [globalResumeMutation]);

const setProductState = useCallback((productId: string, enabled: boolean) => {
  // ... implementation
}, []);

const isProductEnabled = useCallback((productId: string) => {
  // ... implementation
}, [globalEnabled, productStates]);
```

**Why it works:**
- Returns same function reference unless dependencies change
- Prevents context value from changing on every render
- Breaks the re-render loop

### Fix #3: Memoize Context Value with `useMemo`
```typescript
// ✅ AFTER (Prevents infinite loops)
const contextValue = useMemo(
  () => ({
    globalEnabled,
    setGlobalEnabled,
    handleGlobalToggle,
    confirmGlobalDisable,
    confirmGlobalEnable,
    confirmGlobalResume,
    isLoadingGlobal,
    showGlobalConfirm,
    setShowGlobalConfirm,
    showGlobalResumeModal,
    setShowGlobalResumeModal,
    pendingGlobalAction,
    globalPriceOptions,
    productStates,
    setProductState,
    setMultipleProductStates,
    isProductEnabled,
    globalSnapshots,
    setGlobalSnapshots,
  }),
  [
    globalEnabled,
    setGlobalEnabled,
    handleGlobalToggle,
    confirmGlobalDisable,
    confirmGlobalEnable,
    confirmGlobalResume,
    isLoadingGlobal,
    showGlobalConfirm,
    showGlobalResumeModal,
    pendingGlobalAction,
    globalPriceOptions,
    productStates,
    setProductState,
    setMultipleProductStates,
    isProductEnabled,
    globalSnapshots,
  ]
);

<SmartPricingContext.Provider value={contextValue}>
  {children}
</SmartPricingContext.Provider>
```

**Why it works:**
- Returns same object reference unless dependencies change
- Only updates context when actual values change
- Prevents cascading re-renders across all consumers

---

## 📁 Files Modified

### 1. `src/features/pricing-engine/hooks/useSmartPricing.tsx`
**Changes:**
- ✅ Added `useMemo` import
- ✅ Added `useCallback` import  
- ✅ Memoized `isLoadingGlobal` with `useMemo`
- ✅ Memoized all callbacks with `useCallback`
- ✅ Memoized context value object with `useMemo`

### 2. `src/features/pricing-engine/hooks/useSmartPricingToggle.ts`
**Changes:**
- ✅ Added `useMemo` import
- ✅ Memoized `isLoading` with `useMemo`

---

## 🎯 React Performance Best Practices

### When to Use `useMemo`
- ✅ Derived state computed from other values
- ✅ Loading states computed from multiple sources
- ✅ Context value objects
- ✅ Expensive calculations

### When to Use `useCallback`
- ✅ Functions passed to context
- ✅ Functions passed as props to child components
- ✅ Functions in dependency arrays
- ✅ Event handlers that reference other memoized values

### Red Flags That Indicate Missing Memoization
- 🚨 "Maximum update depth exceeded" errors
- 🚨 Infinite re-render loops
- 🚨 Components re-rendering excessively
- 🚨 Performance degradation with React Query mutations
- 🚨 Context consumers re-rendering unnecessarily

---

## ✅ Verification

**Before Fix:**
- ❌ Infinite re-render loop
- ❌ App crashed with "Maximum update depth" error
- ❌ Switch component couldn't be toggled

**After Fix:**
- ✅ No infinite loops
- ✅ Stable re-render behavior
- ✅ Switch component works correctly
- ✅ No linting errors
- ✅ All functionality restored

---

## 📚 Lessons Learned

### 1. React Query + Context Requires Extra Care
When using React Query mutations within React Context:
- Always memoize loading states derived from `mutation.isPending`
- Always memoize callbacks that use mutations
- Always memoize the context value object

### 2. Memoization is Critical for Context Providers
Un-memoized values in Context Providers cause:
- All consumers to re-render on every provider render
- Potential infinite loops if consumers trigger provider updates
- Poor performance across the entire app

### 3. Migration Checklist
When migrating to React Query, always:
- [ ] Memoize derived loading states
- [ ] Memoize callbacks that use mutations
- [ ] Memoize context value objects
- [ ] Test for infinite loops
- [ ] Verify performance with React DevTools Profiler

---

## 🚀 Performance Impact

**Before Fix:**
- 🔴 Infinite re-renders causing app crash
- 🔴 100% CPU usage
- 🔴 Browser unresponsive

**After Fix:**
- ✅ Minimal re-renders (only when state actually changes)
- ✅ Normal CPU usage
- ✅ Smooth, responsive UI
- ✅ Proper React Query caching behavior

---

## 📝 Summary

The infinite loop was caused by un-memoized derived state and callbacks in the React Context during the React Query migration. By properly using `useMemo` and `useCallback`, we:

1. Stabilized loading state calculations
2. Prevented unnecessary function recreations
3. Optimized context value updates
4. Fixed the infinite re-render loop
5. Restored normal app functionality

**Status: ✅ FIXED**

All components now work correctly with proper memoization and stable re-render behavior.

