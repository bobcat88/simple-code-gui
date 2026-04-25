import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

export function useSessionId() {
  const [sessionId, setSessionId] = useState<string>('');

  useEffect(() => {
    let sid = sessionStorage.getItem('transwarp-session-id');
    if (!sid) {
      sid = uuidv4();
      sessionStorage.setItem('transwarp-session-id', sid);
    }
    setSessionId(sid);
  }, []);

  return sessionId;
}
