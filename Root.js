import React from 'react';
import App from './App';
import { NavigationProvider } from './NavContext';

export default function Root() {
  return (
    <NavigationProvider>
      <App />
    </NavigationProvider>
  );
}