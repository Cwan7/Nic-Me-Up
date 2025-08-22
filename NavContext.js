import React, { createContext, useRef, useContext } from "react";

// 1) Create context
const NavigationContext = createContext(null);

// 2) Provider component (wraps the app)
export function NavigationProvider({ children }) {
  // This ref will be shared globally
  const hasNavigated = useRef(false);

  return (
    <NavigationContext.Provider value={hasNavigated}>
      {children}
    </NavigationContext.Provider>
  );
}

// 3) Hook for consuming
export function useHasNavigated() {
  return useContext(NavigationContext);
}