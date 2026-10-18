import type { Session } from '@supabase/supabase-js';
import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  /** 保存済みのセッションを読み込み中なら true */
  isLoading: boolean;
};

const AuthContext = createContext<AuthState>({ session: null, isLoading: true });

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>({ session: null, isLoading: true });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setState({ session: data.session, isLoading: false });
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, isLoading: false });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
